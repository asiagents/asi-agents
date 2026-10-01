import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { listAmsModelCards } from "./ams.models.js";
import {
  estimateRamHintFromParams,
  estimateRamHintFromSizeBytes,
  inferParamsLabel,
  inferSkillTags,
} from "./modelMetaHints.js";
import { customModelsDir, listCustomGguf, routerModelsDir, routerReady } from "./modelPaths.js";
import { fetchAllConfiguredApiModels } from "./providers.js";
import { listProviderKeyStatus } from "./store.js";

const execFileAsync = promisify(execFile);

export interface ModelCard {
  id: string;
  name: string;
  source: string;
  meta: string;
  tags: string[];
  paid: boolean;
  recommended?: boolean;
  /** `scanned` = on disk or local runtime; `catalog` = reference; `api` = live provider model list. */
  kind: "scanned" | "catalog" | "api";
  /** Cloud provider id when the card is routed off-device (optional). */
  provider?: string;
  /** Parameter size label when known (e.g. `4B`, `14B` from Ollama details or filename). */
  params?: string;
  /** Rough expected RAM at load (Q4-style heuristic or AMS catalog hint). */
  ramHint?: string;
}

/** Honest scan diagnostics for Settings → Browse (no invented model rows). */
export interface ModelsScanMeta {
  /** Artifacts under `models/router/` (package.json / manifest / exe) — not process liveness. */
  routerReady: boolean;
  /** True only when `GET {ASI_ROUTER_URL}/health` answers OK. */
  routerLive?: boolean;
  /** Inverse of routerLive — process off / stub lane. */
  routerStub?: boolean;
  probes: {
    ollama: { host: string; reachable: boolean; count: number; error?: string };
    llamacpp: { configured: boolean; base: string | null; reachable: boolean; count: number; error?: string };
    customGguf: number;
    /** AMS `models/ams/` — recipe count vs real `.gguf` on disk. */
    ams: { catalogTotal: number; catalogShown: number; installedGguf: number; installedOnnx: number };
    api: {
      configuredProviderIds: string[];
      totalCount: number;
      providerCounts: Record<string, number>;
    };
  };
}

function ollamaHost(): string {
  let raw = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").trim().replace(/\/$/, "");
  if (raw && !/^https?:\/\//i.test(raw)) {
    raw = `http://${raw}`;
  }
  return raw;
}

function llamaCppBase(): string | null {
  const raw = process.env.LLAMA_CPP_HOST ?? process.env.OPENAI_BASE_URL;
  if (!raw || !String(raw).trim()) return null;
  let base = String(raw).trim().replace(/\/$/, "");
  if (!base.endsWith("/v1")) base = `${base}/v1`;
  return base;
}

/** Live Ollama tag names (empty when Ollama is down or has no tags). */
export async function fetchOllamaTagNames(): Promise<string[]> {
  const { cards } = await probeOllamaModels();
  return cards.map((c) => c.name).filter(Boolean);
}

/** Lightweight Ollama probe for generate fail-closed diagnostics. */
export async function getOllamaProbeSummary(): Promise<{
  host: string;
  reachable: boolean;
  count: number;
  error?: string;
}> {
  const p = await probeOllamaModels();
  return {
    host: p.host,
    reachable: p.reachable,
    count: p.cards.length,
    error: p.error,
  };
}

/** Lightweight llama.cpp probe for generate fail-closed diagnostics. */
export async function getLlamaCppProbeSummary(): Promise<{
  configured: boolean;
  base: string | null;
  reachable: boolean;
  count: number;
  error?: string;
}> {
  const p = await probeLlamaCppModels();
  return {
    configured: p.configured,
    base: p.base,
    reachable: p.reachable,
    count: p.cards.length,
    error: p.error,
  };
}

type OllamaProbe = { cards: ModelCard[]; host: string; reachable: boolean; error?: string };

type OllamaTagRow = {
  name?: string;
  model?: string;
  size?: number;
  details?: {
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
};

async function probeOllamaModels(): Promise<OllamaProbe> {
  const host = ollamaHost();
  const url = `${host}/api/tags`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      return { cards: [], host, reachable: false, error: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { models?: OllamaTagRow[] };
    const rows = Array.isArray(body.models) ? body.models : [];
    const cards = rows
      .map((row, i) => {
        const name = row.name ?? row.model ?? `ollama-${i}`;
        const family = row.details?.family ?? row.details?.families?.[0] ?? null;
        const params = inferParamsLabel(name, row.details?.parameter_size);
        const quant = row.details?.quantization_level?.trim();
        const ramHint =
          estimateRamHintFromSizeBytes(typeof row.size === "number" ? row.size : null) ??
          estimateRamHintFromParams(params);
        const skillTags = inferSkillTags(name, family);
        const metaBits = [
          `Ollama @ ${host}`,
          params ? params : null,
          quant || null,
          ramHint ? `RAM ${ramHint}` : null,
        ].filter(Boolean);
        return {
          id: `ollama:${name}`,
          name,
          source: "ollama",
          meta: metaBits.join(" · "),
          tags: Array.from(new Set(["local", "ollama", ...skillTags, ...(family ? [family] : [])])),
          paid: false,
          kind: "scanned" as const,
          provider: "ollama",
          ...(params ? { params } : {}),
          ...(ramHint ? { ramHint } : {}),
        };
      })
      .filter((m) => m.name);
    return { cards, host, reachable: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { cards: [], host, reachable: false, error: msg };
  }
}

type LlamaCppProbe = {
  cards: ModelCard[];
  configured: boolean;
  base: string | null;
  reachable: boolean;
  error?: string;
};

async function probeLlamaCppModels(): Promise<LlamaCppProbe> {
  const base = llamaCppBase();
  if (!base) {
    return { cards: [], configured: false, base: null, reachable: false };
  }
  try {
    const res = await fetch(`${base}/models`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      return { cards: [], configured: true, base, reachable: false, error: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { data?: { id?: string }[] };
    const rows = Array.isArray(body.data) ? body.data : [];
    const cards: ModelCard[] = [];
    for (const row of rows) {
      const id = row.id != null ? String(row.id) : "";
      if (!id) continue;
      const params = inferParamsLabel(id);
      const ramHint = estimateRamHintFromParams(params);
      const skillTags = inferSkillTags(id);
      cards.push({
        id: `llamacpp:${id}`,
        name: id,
        source: "llama.cpp",
        meta: [`OpenAI-compat @ ${base}`, params, ramHint ? `RAM ${ramHint}` : null]
          .filter(Boolean)
          .join(" · "),
        tags: Array.from(new Set(["local", "llamacpp", ...skillTags])),
        paid: false,
        kind: "scanned",
        provider: "llamacpp",
        ...(params ? { params } : {}),
        ...(ramHint ? { ramHint } : {}),
      });
    }
    return { cards, configured: true, base, reachable: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { cards: [], configured: true, base, reachable: false, error: msg };
  }
}

export async function listModels(): Promise<{
  models: ModelCard[];
  customDir: string;
  routerDir: string;
  meta: ModelsScanMeta;
}> {
  const custom = listCustomGguf().map((full, i) => {
    const base = full.split(/[/\\]/).pop() ?? `custom-${i}`;
    const params = inferParamsLabel(base);
    const ramHint = estimateRamHintFromParams(params);
    const skillTags = inferSkillTags(base);
    return {
      id: `custom-${base}`,
      name: base,
      source: "drop-in",
      meta: [`GGUF in ${customModelsDir()}`, params, ramHint ? `RAM ${ramHint}` : null]
        .filter(Boolean)
        .join(" · "),
      tags: Array.from(new Set(["local", "custom", ...skillTags])),
      paid: false,
      kind: "scanned" as const,
      ...(params ? { params } : {}),
      ...(ramHint ? { ramHint } : {}),
    };
  });

  const ams = listAmsModelCards();

  const [ollamaProbe, llamacppProbe, apiRows] = await Promise.all([
    probeOllamaModels(),
    probeLlamaCppModels(),
    fetchAllConfiguredApiModels(),
  ]);

  const providerCounts: Record<string, number> = {};
  for (const row of apiRows) {
    providerCounts[row.provider] = (providerCounts[row.provider] ?? 0) + 1;
  }
  const configuredProviderIds = Object.entries(listProviderKeyStatus())
    .filter(([, s]) => s.configured)
    .map(([id]) => id)
    .sort();

  const apiCards: ModelCard[] = apiRows.map((m) => ({
    id: m.id,
    name: m.name,
    source: m.provider,
    meta: `Cloud API · ${m.provider} (listed with your key)`,
    tags: ["api", m.provider],
    paid: m.paid,
    kind: "api",
    provider: m.provider,
  }));

  return {
    models: [
      ...custom,
      ...ams.scanned,
      ...ams.catalog,
      ...ollamaProbe.cards,
      ...llamacppProbe.cards,
      ...apiCards,
    ],
    customDir: customModelsDir(),
    routerDir: routerModelsDir(),
    meta: {
      routerReady: routerReady(),
      probes: {
        ollama: {
          host: ollamaProbe.host,
          reachable: ollamaProbe.reachable,
          count: ollamaProbe.cards.length,
          error: ollamaProbe.error,
        },
        llamacpp: {
          configured: llamacppProbe.configured,
          base: llamacppProbe.base,
          reachable: llamacppProbe.reachable,
          count: llamacppProbe.cards.length,
          error: llamacppProbe.error,
        },
        customGguf: custom.length,
        ams: {
          catalogTotal: ams.catalogTotal,
          catalogShown: ams.catalog.length,
          installedGguf: ams.installedGguf,
          installedOnnx: ams.installedOnnx,
        },
        api: {
          configuredProviderIds,
          totalCount: apiCards.length,
          providerCounts,
        },
      },
    },
  };
}

export interface HardwareProbe {
  /** Logical CPU threads (`os.cpus().length`); null only if OS reports none. */
  cpuThreads: number | null;
  /** Approx. CPU busy % over a short sample window; null when sample fails. */
  cpuPercent: number | null;
  /** Total system RAM in whole GB. */
  ramGb: number;
  /** Used RAM in GB (1 decimal); null when freemem unavailable. */
  ramUsedGb: number | null;
  /** Used RAM as % of total; null when unknown. */
  ramUsedPct: number | null;
  /** Total GPU VRAM in whole GB; null when no GPU probe. */
  vramGb: number | null;
  /** Used VRAM in GB (1 decimal); null when unknown. */
  vramUsedGb: number | null;
  /** Used VRAM as % of total; null when unknown. */
  vramUsedPct: number | null;
  /** GPU utilization % from nvidia-smi when available. */
  gpuPercent: number | null;
  notes: string[];
}

function roundGb1(bytes: number): number {
  return Math.round((bytes / 1024 ** 3) * 10) / 10;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function cpuTimes(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    idle += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
  }
  return { idle, total };
}

async function sampleCpuPercent(sampleMs = 220): Promise<number | null> {
  try {
    const a = cpuTimes();
    if (a.total <= 0) return null;
    await new Promise((r) => setTimeout(r, sampleMs));
    const b = cpuTimes();
    const idleDelta = b.idle - a.idle;
    const totalDelta = b.total - a.total;
    if (totalDelta <= 0) return null;
    return clampPct(100 * (1 - idleDelta / totalDelta));
  } catch {
    return null;
  }
}

async function probeNvidiaVram(): Promise<{
  vramGb: number;
  vramUsedGb: number;
  vramUsedPct: number;
  gpuPercent: number | null;
} | null> {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [
        "--query-gpu=memory.total,memory.used,utilization.gpu",
        "--format=csv,noheader,nounits",
      ],
      { timeout: 5000, windowsHide: true, maxBuffer: 256 * 1024 }
    );
    const line = stdout
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean);
    if (!line) return null;
    const parts = line.split(",").map((p) => Number(String(p).trim()));
    const [totalMiB, usedMiB, util] = parts;
    if (!Number.isFinite(totalMiB) || totalMiB <= 0 || !Number.isFinite(usedMiB)) return null;
    const vramGb = Math.round(totalMiB / 1024);
    const vramUsedGb = Math.round((usedMiB / 1024) * 10) / 10;
    const vramUsedPct = clampPct((usedMiB / totalMiB) * 100);
    const gpuPercent = Number.isFinite(util) ? clampPct(util) : null;
    return { vramGb, vramUsedGb, vramUsedPct, gpuPercent };
  } catch {
    return null;
  }
}

/** OS RAM + short CPU sample + optional nvidia-smi VRAM. Never invents GPU numbers. */
export async function probeHardware(): Promise<HardwareProbe> {
  const notes: string[] = [];
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const ramGb = Math.round(totalBytes / 1024 ** 3);
  let ramUsedGb: number | null = null;
  let ramUsedPct: number | null = null;
  if (Number.isFinite(totalBytes) && totalBytes > 0 && Number.isFinite(freeBytes)) {
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    ramUsedGb = roundGb1(usedBytes);
    ramUsedPct = clampPct((usedBytes / totalBytes) * 100);
  } else {
    notes.push("RAM usage unavailable from OS.");
  }

  const threads = os.cpus().length;
  const cpuThreads = threads > 0 ? threads : null;
  const cpuPercent = await sampleCpuPercent();
  if (cpuPercent == null) notes.push("CPU usage sample failed.");

  const gpu = await probeNvidiaVram();
  if (!gpu) notes.push("VRAM probe unavailable (nvidia-smi missing or failed).");

  return {
    cpuThreads,
    cpuPercent,
    ramGb,
    ramUsedGb,
    ramUsedPct,
    vramGb: gpu?.vramGb ?? null,
    vramUsedGb: gpu?.vramUsedGb ?? null,
    vramUsedPct: gpu?.vramUsedPct ?? null,
    gpuPercent: gpu?.gpuPercent ?? null,
    notes,
  };
}
