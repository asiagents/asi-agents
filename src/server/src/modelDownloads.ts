import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listAmsInstallSnapshot } from "./ams.models.js";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "../../..");
const DOWNLOADS_PATH = path.join(repoRoot, "config", "model-downloads.json");

export interface ModelDownloadItem {
  id: string;
  name: string;
  kind: string;
  capabilities: string[];
  method: "ollama" | "gguf" | "pip";
  command?: string;
  pathHint?: string;
  docsUrl?: string;
  notes?: string;
  suggestedFileName?: string;
  diskSizeHint?: string;
  ramHint?: string;
  hardwareHint?: string;
  installSteps?: string[];
  /** AMS only: recipe vs installed after disk probe (never faked). */
  status?: "recipe" | "installed";
  matchedFile?: string;
  weightFormat?: "gguf" | "onnx";
  /** Hugging Face org or model page when known. */
  hfUrl?: string;
  /** Ollama pull tag (from field or parsed from `ollama pull …`). */
  ollamaTag?: string;
}

export interface ModelDownloadsResponse {
  label: string;
  items: ModelDownloadItem[];
  /** AMS probe summary when catalog is readable. */
  ams?: {
    catalogTotal: number;
    recipeCount: number;
    installedCount: number;
    installedGgufFiles: number;
    installedOnnxFiles: number;
    amsDir: string;
  };
}

const AMS_HF_ORG = "https://huggingface.co/vvarghese";
const AMS_HF_BY_DOWNLOAD_ID: Record<string, string> = {
  "ams-micro-70m": `${AMS_HF_ORG}/ams-micro-70m`,
  "ams-hybrid-120m": `${AMS_HF_ORG}/ams-hybrid-120m`,
  "ams-agent-chat": AMS_HF_ORG,
  "ams-ultra-gate": AMS_HF_ORG,
};

function parseOllamaTag(command?: string, explicit?: string): string | undefined {
  const fromField = typeof explicit === "string" ? explicit.trim() : "";
  if (fromField) return fromField;
  const cmd = String(command ?? "").trim();
  const m = /^ollama\s+pull\s+(\S+)/i.exec(cmd);
  return m?.[1];
}

function resolveHfUrl(raw: Record<string, unknown>, id: string, kind: string): string | undefined {
  if (typeof raw.hfUrl === "string" && raw.hfUrl.trim()) return raw.hfUrl.trim();
  if (typeof raw.hfOrg === "string" && raw.hfOrg.trim()) return raw.hfOrg.trim();
  if (kind === "ams") return AMS_HF_BY_DOWNLOAD_ID[id] ?? AMS_HF_ORG;
  return undefined;
}

function mapDownloadRow(raw: Record<string, unknown>): ModelDownloadItem | null {
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  const method = raw.method;
  if (method !== "ollama" && method !== "gguf" && method !== "pip") return null;
  const capabilities = Array.isArray(raw.capabilities)
    ? raw.capabilities.filter((c): c is string => typeof c === "string")
    : [];
  const installSteps = Array.isArray(raw.installSteps)
    ? raw.installSteps.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : undefined;
  const kind = typeof raw.kind === "string" ? raw.kind : "other";
  const command = typeof raw.command === "string" ? raw.command : undefined;
  const ollamaTag = parseOllamaTag(
    command,
    typeof raw.ollamaTag === "string" ? raw.ollamaTag : undefined
  );
  return {
    id: raw.id,
    name: raw.name,
    kind,
    capabilities,
    method,
    command,
    pathHint: typeof raw.pathHint === "string" ? raw.pathHint : undefined,
    docsUrl: typeof raw.docsUrl === "string" ? raw.docsUrl : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    suggestedFileName: typeof raw.suggestedFileName === "string" ? raw.suggestedFileName : undefined,
    diskSizeHint: typeof raw.diskSizeHint === "string" ? raw.diskSizeHint : undefined,
    ramHint: typeof raw.ramHint === "string" ? raw.ramHint : undefined,
    hardwareHint: typeof raw.hardwareHint === "string" ? raw.hardwareHint : undefined,
    installSteps,
    hfUrl: resolveHfUrl(raw, raw.id, kind),
    ollamaTag: method === "ollama" ? ollamaTag : undefined,
  };
}

/** AMS download ids map to catalog recipe ids (agent-chat / ultra-gate aliases). */
function amsRecipeIdForDownload(downloadId: string): string {
  if (downloadId === "ams-agent-chat") return "agent-chat-50-100m";
  if (downloadId === "ams-ultra-gate") return "ultra-gate-1m";
  return downloadId;
}

const ADVANCED_AMS_DOWNLOAD_IDS = new Set(["ams-agent-chat", "ams-ultra-gate", "agent-chat-50-100m", "ultra-gate-1m"]);

function showAmsAdvancedDownloads(): boolean {
  const v = String(process.env.ASI_AMS_SHOW_ADVANCED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function listModelDownloads(): ModelDownloadsResponse {
  let items: ModelDownloadItem[] = [];
  let label = "Local download recipes";
  try {
    const raw = fs.readFileSync(DOWNLOADS_PATH, "utf8");
    const parsed = JSON.parse(raw) as { label?: string; items?: Record<string, unknown>[] };
    label = parsed.label ?? label;
    items = Array.isArray(parsed.items)
      ? parsed.items.map(mapDownloadRow).filter((i): i is ModelDownloadItem => i != null)
      : [];
    if (!showAmsAdvancedDownloads()) {
      items = items.filter((i) => !(i.kind === "ams" && ADVANCED_AMS_DOWNLOAD_IDS.has(i.id)));
    }
  } catch {
    return { label, items: [] };
  }

  try {
    const snap = listAmsInstallSnapshot();
    const byId = new Map(snap.recipes.map((r) => [r.id, r]));
    items = items.map((item) => {
      if (item.kind !== "ams") return item;
      const row = byId.get(amsRecipeIdForDownload(item.id));
      if (!row) return item;
      return {
        ...item,
        status: row.status,
        matchedFile: row.matchedFile,
        weightFormat: row.weightFormat,
        suggestedFileName: item.suggestedFileName ?? row.suggestedFileName,
        diskSizeHint: item.diskSizeHint ?? row.diskSizeHint,
        ramHint: item.ramHint ?? row.ramHint,
        hardwareHint: item.hardwareHint ?? row.hardwareHint,
        installSteps:
          item.installSteps && item.installSteps.length > 0 ? item.installSteps : row.installSteps,
        pathHint: item.pathHint ?? row.pathHint,
      };
    });
    return {
      label,
      items,
      ams: {
        catalogTotal: snap.catalogTotal,
        recipeCount: snap.recipeCount,
        installedCount: snap.installedCount,
        installedGgufFiles: snap.installedGgufFiles,
        installedOnnxFiles: snap.installedOnnxFiles,
        amsDir: snap.amsDir,
      },
    };
  } catch {
    return { label, items };
  }
}
