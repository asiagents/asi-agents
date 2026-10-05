import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getProviderApiKey } from "./store.js";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "../../..");
const CURATED_PATH = path.join(repoRoot, "config", "models.capabilities.catalog.json");

const CACHE_TTL_MS = 60 * 60 * 1000;
const LIVE_LIMIT = 500;

export type CatalogSource = "openrouter" | "curated";

export interface CapabilityCatalogModel {
  id: string;
  name: string;
  /** Provider slug (openrouter segment, ollama, local stack name, etc.). */
  provider: string;
  capabilities: string[];
  contextLength?: number;
  pricingHint?: "free" | "paid" | "unknown";
  modality?: string;
  notes?: string;
}

export interface ModelsCatalogResponse {
  source: CatalogSource;
  label: string;
  fetchedAt: string;
  total: number;
  limit: number;
  error?: string;
  models: CapabilityCatalogModel[];
}

type CuratedFile = {
  version?: number;
  label?: string;
  models?: CapabilityCatalogModel[];
};

let openRouterCache: { at: number; models: CapabilityCatalogModel[]; error?: string } | null = null;

function readCurated(): { label: string; models: CapabilityCatalogModel[] } {
  try {
    const raw = fs.readFileSync(CURATED_PATH, "utf8");
    const parsed = JSON.parse(raw) as CuratedFile;
    const models = Array.isArray(parsed.models) ? parsed.models : [];
    return {
      label: parsed.label ?? "Curated reference",
      models: models.filter((m) => m.id && m.name),
    };
  } catch {
    return { label: "Curated reference", models: [] };
  }
}

function uniqCaps(caps: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of caps) {
    const k = c.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

function inferCapabilities(id: string, modality?: string, name?: string): string[] {
  const hay = `${id} ${name ?? ""}`.toLowerCase();
  const mod = (modality ?? "").toLowerCase();

  // Music / audio-gen models are not chat LLMs (e.g. google/lyria-*).
  if (
    /lyria|musicgen|stable-?audio|riffusion|suno|udio\b/.test(hay) ||
    /text->audio|text-to-audio|audio->audio/.test(mod)
  ) {
    return uniqCaps(["audio", "music"]);
  }

  const caps: string[] = ["chat"];

  if (mod.includes("image") || /llava|moondream|vision|glm-4v|gpt-4o|gemini|pixtral|qwen-vl|internvl|llama-3\.2-vision|bakllava/i.test(hay)) {
    caps.push("vision");
  }
  if (/embed|nomic-embed|bge-|e5-|minilm/i.test(hay)) caps.push("embed");
  if (/coder|code|deepseek-coder|codestral|starcoder|wizardcoder/i.test(hay)) caps.push("code");
  if (/o1|o3|reason|think|r1|deepseek-r1/i.test(hay)) caps.push("reasoning");
  if (/tool|function|hermes|firefunction/i.test(hay)) caps.push("tools");
  if (/pdf|document|docling|nougat|mineru|layout/i.test(hay)) {
    caps.push("documents", "pdf");
  }
  if (/sheet|excel|tabular|csv|spreadsheet/i.test(hay)) caps.push("spreadsheet");
  if (/whisper|audio|speech|transcribe|tts|voice/i.test(hay)) caps.push("audio", "stt");
  if (/ocr|tesseract|paddleocr/i.test(hay)) caps.push("ocr");
  if (/slide|deck|pptx|presentation/i.test(hay)) caps.push("deck", "slides");

  return uniqCaps(caps);
}

/** Shared with live API model scan (Ours tab) and catalog rows. */
export function pricingHintFromOpenRouter(row: {
  id?: string;
  pricing?: { prompt?: string; completion?: string };
}): "free" | "paid" | "unknown" {
  const id = String(row.id ?? "").toLowerCase();
  if (id.includes(":free") || id.endsWith("/free")) return "free";
  const prompt = row.pricing?.prompt;
  const completion = row.pricing?.completion;
  if (prompt === "0" && completion === "0") return "free";
  if (prompt != null || completion != null) return "paid";
  return "unknown";
}

async function fetchOpenRouterCatalog(apiKey: string): Promise<{ models: CapabilityCatalogModel[]; error?: string }> {
  const now = Date.now();
  if (openRouterCache && now - openRouterCache.at < CACHE_TTL_MS) {
    return { models: openRouterCache.models, error: openRouterCache.error };
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const err = `upstream ${res.status}`;
      openRouterCache = { at: now, models: [], error: err };
      return { models: [], error: err };
    }
    const body = (await res.json()) as {
      data?: {
        id?: string;
        name?: string;
        context_length?: number;
        architecture?: { modality?: string };
        pricing?: { prompt?: string; completion?: string };
      }[];
    };
    const rows = Array.isArray(body.data) ? body.data : [];
    const models: CapabilityCatalogModel[] = [];
    for (const row of rows.slice(0, LIVE_LIMIT)) {
      const id = row.id != null ? String(row.id) : "";
      if (!id) continue;
      const segment = id.split("/")[0] ?? "openrouter";
      models.push({
        id,
        name: row.name != null ? String(row.name) : id,
        provider: segment,
        capabilities: inferCapabilities(id, row.architecture?.modality, row.name),
        contextLength: typeof row.context_length === "number" ? row.context_length : undefined,
        pricingHint: pricingHintFromOpenRouter(row),
        modality: row.architecture?.modality,
      });
    }

    openRouterCache = { at: now, models };
    return { models };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    openRouterCache = { at: now, models: [], error: msg };
    return { models: [], error: msg };
  }
}

const LOCAL_CATALOG_PROVIDERS = new Set([
  "ollama",
  "gguf",
  "local",
  "docling",
  "marker",
  "unstructured",
  "stack",
  "audio",
]);

function isLocalCatalogModel(m: CapabilityCatalogModel): boolean {
  const p = m.provider.toLowerCase();
  if (LOCAL_CATALOG_PROVIDERS.has(p)) return true;
  const id = m.id.toLowerCase();
  return (
    id.startsWith("ollama/") ||
    id.startsWith("local/") ||
    id.startsWith("gguf/") ||
    id.startsWith("stack/") ||
    id.startsWith("audio/")
  );
}

function isFreeCatalogModel(m: CapabilityCatalogModel): boolean {
  if (m.pricingHint === "free") return true;
  if (m.pricingHint === "paid") return false;
  return isLocalCatalogModel(m);
}

export type CatalogQuery = {
  q?: string;
  capabilities?: string[];
  /** Comma-separated in HTTP: `free`, `local`, `api` */
  browse?: ("free" | "local" | "api")[];
  offset?: number;
  limit?: number;
};

function filterModels(all: CapabilityCatalogModel[], query: CatalogQuery): {
  total: number;
  page: CapabilityCatalogModel[];
} {
  const q = (query.q ?? "").trim().toLowerCase();
  const capFilter = (query.capabilities ?? []).map((c) => c.toLowerCase()).filter(Boolean);
  const browse = (query.browse ?? []).filter(Boolean);
  let rows = all;
  if (q) {
    rows = rows.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.capabilities.some((c) => c.includes(q))
    );
  }
  if (capFilter.length > 0) {
    rows = rows.filter((m) => capFilter.every((need) => m.capabilities.map((c) => c.toLowerCase()).includes(need)));
  }
  if (browse.length > 0) {
    const needFree = browse.includes("free");
    const needLocal = browse.includes("local");
    const needApi = browse.includes("api");
    const hostingWanted = needLocal || needApi;
    rows = rows.filter((m) => {
      if (hostingWanted) {
        const local = isLocalCatalogModel(m);
        const api = !local;
        const hostingOk = (needLocal && local) || (needApi && api);
        if (!hostingOk) return false;
      }
      if (needFree && !isFreeCatalogModel(m)) return false;
      return true;
    });
  }
  const total = rows.length;
  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  return { total, page: rows.slice(offset, offset + limit) };
}

export async function getModelsCatalog(query: CatalogQuery = {}): Promise<ModelsCatalogResponse> {
  const fetchedAt = new Date().toISOString();
  const orKey = getProviderApiKey("openrouter");

  if (orKey) {
    const { models: live, error } = await fetchOpenRouterCatalog(orKey);
    if (live.length > 0) {
      const { total, page } = filterModels(live, query);
      return {
        source: "openrouter",
        label: "OpenRouter catalog (live)",
        fetchedAt,
        total,
        limit: LIVE_LIMIT,
        error,
        models: page,
      };
    }
    const curated = readCurated();
    const { total, page } = filterModels(curated.models, query);
    return {
      source: "curated",
      label: curated.label,
      fetchedAt,
      total,
      limit: curated.models.length,
      error: error ?? "OpenRouter returned no models — showing curated fallback",
      models: page,
    };
  }

  const curated = readCurated();
  const { total, page } = filterModels(curated.models, query);
  return {
    source: "curated",
    label: curated.label,
    fetchedAt,
    total,
    limit: curated.models.length,
    models: page,
  };
}
