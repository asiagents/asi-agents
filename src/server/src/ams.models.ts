import fs from "node:fs";
import path from "node:path";
import {
  amsCatalogPath,
  amsModelsDir,
  listAmsGguf,
  listAmsOnnx,
  listCustomGguf,
} from "./modelPaths.js";

/** Mirrors `ModelCard` in models.ts (avoid circular import). */
type AmsModelCard = {
  id: string;
  name: string;
  source: string;
  meta: string;
  tags: string[];
  paid: boolean;
  recommended?: boolean;
  kind: "scanned" | "catalog" | "api";
  params?: string;
  ramHint?: string;
};

export type AmsWeightFormat = "gguf" | "onnx";

export type AmsCatalogItem = {
  id: string;
  name: string;
  role?: string;
  tier?: string;
  params?: string;
  default?: boolean;
  /** Ship-default AMS routers (Micro / Hybrid). */
  ship?: boolean;
  /** Hidden from Models AMS UI unless ASI_AMS_SHOW_ADVANCED=1. */
  advanced?: boolean;
  tags?: string[];
  pathHint?: string;
  weightHints?: string[];
  /** Extra basename tokens that only match `.onnx` (e.g. legacy micro-50m training names → Micro 70M). */
  onnxWeightHints?: string[];
  suggestedFileName?: string;
  /** Honest ONNX basename when HF publishes ONNX instead of GGUF. */
  suggestedOnnxFileName?: string;
  diskSizeHint?: string;
  ramHint?: string;
  hardwareHint?: string;
  obtainHint?: string;
  installSteps?: string[];
  notes?: string;
  hfRepo?: string;
  hfUrl?: string;
};

/** When false (default), Agent Chat + Ultra gate stay out of AMS lists. */
export function showAmsAdvancedCatalog(): boolean {
  const v = String(process.env.ASI_AMS_SHOW_ADVANCED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Ship UI shows Micro 70M + Hybrid 120M only unless advanced flag is on. */
export function filterVisibleAmsCatalogItems(items: AmsCatalogItem[]): AmsCatalogItem[] {
  if (showAmsAdvancedCatalog()) return items;
  return items.filter((i) => i.advanced !== true);
}

export type AmsCatalogFile = {
  version?: number;
  label?: string;
  installRoot?: string;
  items?: AmsCatalogItem[];
};

export type AmsRecipeStatus = "recipe" | "installed";

export type AmsInstallRow = {
  id: string;
  name: string;
  role?: string;
  tier?: string;
  params?: string;
  default?: boolean;
  tags: string[];
  pathHint: string;
  weightHints: string[];
  suggestedFileName?: string;
  suggestedOnnxFileName?: string;
  diskSizeHint?: string;
  ramHint?: string;
  hardwareHint?: string;
  obtainHint?: string;
  installSteps: string[];
  notes?: string;
  /** `recipe` = catalog only (no matching weight). `installed` = matching GGUF or ONNX on disk. */
  status: AmsRecipeStatus;
  matchedFile?: string;
  matchedDir?: "ams" | "custom";
  /** Honest format of the matched file — never claim GGUF when ONNX matched. */
  weightFormat?: AmsWeightFormat;
};

export type AmsInstallSnapshot = {
  label: string;
  installRoot: string;
  amsDir: string;
  catalogTotal: number;
  recipeCount: number;
  installedCount: number;
  installedGgufFiles: number;
  installedOnnxFiles: number;
  recipes: AmsInstallRow[];
};

function basenameLower(full: string): string {
  return (full.split(/[/\\]/).pop() ?? full).toLowerCase();
}

function weightHintsFor(item: AmsCatalogItem): string[] {
  return [
    item.id.toLowerCase(),
    ...(Array.isArray(item.weightHints) ? item.weightHints.map((h) => h.toLowerCase()) : []),
  ].filter(Boolean);
}

function onnxHintsFor(item: AmsCatalogItem): string[] {
  const base = weightHintsFor(item);
  const extra = Array.isArray(item.onnxWeightHints)
    ? item.onnxWeightHints.map((h) => h.toLowerCase())
    : [];
  return Array.from(new Set([...base, ...extra].filter(Boolean)));
}

type AmsWeightMatch = {
  file: string;
  dir: "ams" | "custom";
  format: AmsWeightFormat;
};

/**
 * Prefer matching `.gguf`, then `.onnx` under models/ams (and custom GGUF).
 * ONNX matching uses onnxWeightHints so legacy training/HF basenames can map to Micro 70M / Hybrid 120M honestly.
 */
function findMatchingWeight(
  item: AmsCatalogItem,
  amsGgufs: string[],
  customGgufs: string[],
  amsOnnxs: string[]
): AmsWeightMatch | null {
  const ggufHints = weightHintsFor(item);
  for (const full of amsGgufs) {
    const name = basenameLower(full);
    if (ggufHints.some((h) => name.includes(h))) return { file: full, dir: "ams", format: "gguf" };
  }
  for (const full of customGgufs) {
    const name = basenameLower(full);
    if (ggufHints.some((h) => name.includes(h))) return { file: full, dir: "custom", format: "gguf" };
  }
  const onnxHints = onnxHintsFor(item);
  for (const full of amsOnnxs) {
    const name = basenameLower(full);
    if (onnxHints.some((h) => name.includes(h))) return { file: full, dir: "ams", format: "onnx" };
  }
  return null;
}

function weightPresent(
  item: AmsCatalogItem,
  ggufNames: string[],
  onnxNames: string[] = []
): boolean {
  const ggufHints = weightHintsFor(item);
  if (ggufNames.some((name) => ggufHints.some((h) => name.includes(h)))) return true;
  const onnxHints = onnxHintsFor(item);
  return onnxNames.some((name) => onnxHints.some((h) => name.includes(h)));
}

export function readAmsCatalogFile(opts?: { includeAdvanced?: boolean }): {
  label: string;
  installRoot: string;
  items: AmsCatalogItem[];
} {
  try {
    const raw = fs.readFileSync(amsCatalogPath(), "utf8");
    const parsed = JSON.parse(raw) as AmsCatalogFile;
    const all = Array.isArray(parsed.items)
      ? parsed.items.filter((i) => i && typeof i.id === "string" && typeof i.name === "string")
      : [];
    const includeAdvanced = opts?.includeAdvanced === true || showAmsAdvancedCatalog();
    const items = includeAdvanced ? all : filterVisibleAmsCatalogItems(all);
    return {
      label: parsed.label ?? "AMS product models",
      installRoot: parsed.installRoot ?? "models/ams/",
      items,
    };
  } catch {
    return { label: "AMS product models", installRoot: "models/ams/", items: [] };
  }
}

/** Catalog recipe ids from `models/ams/catalog.json` (not generate targets until weights exist). */
export function listAmsCatalogRecipeIds(): string[] {
  return readAmsCatalogFile({ includeAdvanced: true }).items.map((i) => i.id);
}

/**
 * True for AMS product catalog recipe ids (`ams-micro-70m`, …).
 * These are never Ollama/llama.cpp tags — use `ams-gguf:…` / `ams-onnx:…` when weights are on disk.
 */
export function isAmsCatalogRecipeId(modelId?: string | null): boolean {
  const raw = String(modelId ?? "").trim();
  if (!raw || raw.startsWith("ams-gguf:") || raw.startsWith("ams-onnx:")) return false;
  return listAmsCatalogRecipeIds().includes(raw);
}

/** True when the recipe is listed as catalog-only (no matching GGUF/ONNX on disk yet). */
export function isAmsCatalogRecipeMissingWeights(modelId?: string | null): boolean {
  const raw = String(modelId ?? "").trim();
  if (!raw) return false;
  return listAmsModelCards().catalog.some((c) => c.id === raw);
}

function hardwareMetaBits(item: AmsCatalogItem): string[] {
  return [item.diskSizeHint, item.ramHint, item.hardwareHint].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0
  );
}

/**
 * Per-recipe install status: recipe vs installed (matched `.gguf` or `.onnx`).
 * Never invents installed rows — only real files under models/ams or models/custom.
 */
export function listAmsInstallSnapshot(): AmsInstallSnapshot {
  const amsDir = amsModelsDir();
  const { label, installRoot, items } = readAmsCatalogFile();
  const amsGgufs = listAmsGguf();
  const customGgufs = listCustomGguf();
  const amsOnnxs = listAmsOnnx();

  const recipes: AmsInstallRow[] = items.map((item) => {
    const match = findMatchingWeight(item, amsGgufs, customGgufs, amsOnnxs);
    const pathHint = item.pathHint?.trim() || installRoot;
    return {
      id: item.id,
      name: item.name,
      role: item.role,
      tier: item.tier,
      params: item.params,
      default: item.default,
      tags: Array.from(new Set(["ams", "local", ...(item.tags ?? [])])),
      pathHint,
      weightHints: weightHintsFor(item),
      suggestedFileName: item.suggestedFileName,
      suggestedOnnxFileName: item.suggestedOnnxFileName,
      diskSizeHint: item.diskSizeHint,
      ramHint: item.ramHint,
      hardwareHint: item.hardwareHint,
      obtainHint: item.obtainHint,
      installSteps: Array.isArray(item.installSteps) ? item.installSteps.filter(Boolean) : [],
      notes: item.notes,
      status: match ? "installed" : "recipe",
      matchedFile: match ? path.basename(match.file) : undefined,
      matchedDir: match?.dir,
      weightFormat: match?.format,
    };
  });

  const installedCount = recipes.filter((r) => r.status === "installed").length;
  return {
    label,
    installRoot,
    amsDir,
    catalogTotal: items.length,
    recipeCount: recipes.length - installedCount,
    installedCount,
    installedGgufFiles: amsGgufs.length,
    installedOnnxFiles: amsOnnxs.length,
    recipes,
  };
}

/**
 * Copy a user-provided GGUF into models/ams/ under a suggested or source basename.
 * Verifies extension; does not invent weights. Returns the destination path.
 */
export function placeAmsGguf(sourcePath: string, opts?: { recipeId?: string; fileName?: string }): {
  ok: true;
  destPath: string;
  fileName: string;
  recipeId?: string;
  statusAfter: AmsRecipeStatus;
} | {
  ok: false;
  error: string;
} {
  const src = path.resolve(String(sourcePath ?? "").trim());
  if (!src || !fs.existsSync(src) || !fs.statSync(src).isFile()) {
    return { ok: false, error: "source file not found" };
  }
  if (!src.toLowerCase().endsWith(".gguf")) {
    return { ok: false, error: "source must be a .gguf file" };
  }

  const { items } = readAmsCatalogFile({ includeAdvanced: true });
  const recipeId = opts?.recipeId?.trim();
  const recipe = recipeId ? items.find((i) => i.id === recipeId) : undefined;
  if (recipeId && !recipe) {
    return { ok: false, error: `unknown recipe id: ${recipeId}` };
  }

  const destName =
    (opts?.fileName?.trim() ||
      recipe?.suggestedFileName?.trim() ||
      path.basename(src)).replace(/[/\\]/g, "");
  if (!destName.toLowerCase().endsWith(".gguf")) {
    return { ok: false, error: "destination fileName must end with .gguf" };
  }

  const destDir = amsModelsDir();
  const destPath = path.join(destDir, destName);
  try {
    fs.copyFileSync(src, destPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "copy failed";
    return { ok: false, error: msg };
  }

  const snap = listAmsInstallSnapshot();
  const row = recipeId ? snap.recipes.find((r) => r.id === recipeId) : undefined;
  const matchedByName = snap.recipes.find(
    (r) => r.matchedFile?.toLowerCase() === destName.toLowerCase()
  );
  return {
    ok: true,
    destPath,
    fileName: destName,
    recipeId: row?.id ?? matchedByName?.id,
    statusAfter: row?.status ?? matchedByName?.status ?? "recipe",
  };
}

/**
 * AMS GGUF/ONNX on disk → scanned cards.
 * Catalog recipes without matching weights → kind "catalog" (not installed).
 * ONNX cards use `ams-onnx:…` and never claim GGUF.
 */
export function listAmsModelCards(): {
  scanned: AmsModelCard[];
  catalog: AmsModelCard[];
  amsDir: string;
  catalogTotal: number;
  installedGguf: number;
  installedOnnx: number;
} {
  const amsDir = amsModelsDir();
  const { label, items } = readAmsCatalogFile();
  const amsGgufs = listAmsGguf();
  const customGgufs = listCustomGguf();
  const amsOnnxs = listAmsOnnx();
  const ggufNames = [...amsGgufs, ...customGgufs].map(basenameLower);
  const onnxNames = amsOnnxs.map(basenameLower);

  const scannedGguf: AmsModelCard[] = amsGgufs.map((full, i) => {
    const base = full.split(/[/\\]/).pop() ?? `ams-${i}`;
    const matched = items.find((item) => weightPresent(item, [basenameLower(full)], []));
    const sizeBits = matched ? hardwareMetaBits(matched) : [];
    const metaParts = [
      `GGUF in ${amsDir}`,
      matched ? `matches ${matched.id}` : null,
      ...sizeBits.slice(0, 2),
    ].filter(Boolean);
    return {
      id: `ams-gguf:${base}`,
      name: matched ? `${matched.name} · ${base}` : base,
      source: "ams",
      meta: metaParts.join(" · "),
      tags: Array.from(
        new Set(["local", "ams", "custom", "installed", "gguf", ...(matched?.tags ?? [])])
      ),
      paid: false,
      kind: "scanned" as const,
      ...(matched?.params ? { params: matched.params } : {}),
      ...(matched?.ramHint ? { ramHint: matched.ramHint } : {}),
    };
  });

  const scannedOnnx: AmsModelCard[] = amsOnnxs.map((full, i) => {
    const base = full.split(/[/\\]/).pop() ?? `ams-onnx-${i}`;
    const matched = items.find((item) => weightPresent(item, [], [basenameLower(full)]));
    const sizeBits = matched ? hardwareMetaBits(matched) : [];
    const metaParts = [
      `ONNX on disk in ${amsDir}`,
      matched ? `matches ${matched.id}` : null,
      "not GGUF — reference router (:7821) is Ollama/llama.cpp only",
      ...sizeBits.slice(0, 2),
    ].filter(Boolean);
    return {
      id: `ams-onnx:${base}`,
      name: matched ? `${matched.name} · ${base}` : base,
      source: "ams",
      meta: metaParts.join(" · "),
      tags: Array.from(
        new Set(["local", "ams", "installed", "onnx", ...(matched?.tags ?? [])])
      ),
      paid: false,
      kind: "scanned" as const,
      ...(matched?.params ? { params: matched.params } : {}),
      ...(matched?.ramHint ? { ramHint: matched.ramHint } : {}),
    };
  });

  const scanned = [...scannedGguf, ...scannedOnnx];

  const catalog: AmsModelCard[] = [];
  for (const item of items) {
    if (weightPresent(item, ggufNames, onnxNames)) continue;
    const role = item.role?.trim() || "AMS product model";
    const params = item.params?.trim();
    const sizeBits = hardwareMetaBits(item);
    const metaParts = [
      role,
      params || null,
      "recipe — not on disk",
      ...sizeBits,
      label,
    ].filter(Boolean);
    catalog.push({
      id: item.id,
      name: item.name,
      source: "ams",
      meta: metaParts.join(" · "),
      tags: Array.from(new Set(["ams", "local", "catalog", "recipe", ...(item.tags ?? [])])),
      paid: false,
      recommended: Boolean(item.default),
      kind: "catalog",
      ...(params ? { params } : {}),
      ...(item.ramHint ? { ramHint: item.ramHint } : {}),
    });
  }

  return {
    scanned,
    catalog,
    amsDir,
    catalogTotal: items.length,
    installedGguf: amsGgufs.length,
    installedOnnx: amsOnnxs.length,
  };
}

export type AmsDownloadResult = {
  ok: boolean;
  amsDir: string;
  tokenPresent: boolean;
  results: Array<{
    id: string;
    name?: string;
    status: string;
    matchedFile?: string;
    weightFormat?: AmsWeightFormat;
    downloaded?: boolean;
    error?: string;
    note?: string;
    hfPage?: string;
  }>;
  snapshot: AmsInstallSnapshot;
  raw?: unknown;
  error?: string;
};

/**
 * Run `scripts/install-ams-models.mjs` to pull ship AMS GGUF/ONNX into models/ams/.
 * Never invents installed rows — script only places real weight files from HF.
 */
export async function downloadAmsWeights(opts?: { recipeId?: string }): Promise<AmsDownloadResult> {
  const { spawn } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const script = path.join(repoRoot, "scripts", "install-ams-models.mjs");
  if (!fs.existsSync(script)) {
    return {
      ok: false,
      amsDir: amsModelsDir(),
      tokenPresent: Boolean(process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN),
      results: [],
      snapshot: listAmsInstallSnapshot(),
      error: `install script missing: ${script}`,
    };
  }

  const args = [script, "--json"];
  const recipeId = opts?.recipeId?.trim();
  if (recipeId) {
    if (!["ams-micro-70m", "ams-hybrid-120m"].includes(recipeId) && !showAmsAdvancedCatalog()) {
      // Allow advanced ids only when flag is on; always allow ship pair
      const all = readAmsCatalogFile({ includeAdvanced: true }).items;
      const hit = all.find((i) => i.id === recipeId);
      if (!hit) {
        return {
          ok: false,
          amsDir: amsModelsDir(),
          tokenPresent: Boolean(process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN),
          results: [],
          snapshot: listAmsInstallSnapshot(),
          error: `unknown recipe id: ${recipeId}`,
        };
      }
      if (hit.advanced && !showAmsAdvancedCatalog()) {
        return {
          ok: false,
          amsDir: amsModelsDir(),
          tokenPresent: Boolean(process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN),
          results: [],
          snapshot: listAmsInstallSnapshot(),
          error: `recipe ${recipeId} is advanced — set ASI_AMS_SHOW_ADVANCED=1`,
        };
      }
    }
    args.push("--id", recipeId);
  }

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: process.env,
      windowsHide: true,
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.stderr?.on("data", (c: Buffer) => {
      err += c.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && !out.trim()) {
        reject(new Error(err.trim() || `install-ams-models exited ${code}`));
        return;
      }
      resolve(out);
    });
  });

  let raw: {
    amsDir?: string;
    tokenPresent?: boolean;
    results?: AmsDownloadResult["results"];
    error?: string;
  } = {};
  try {
    raw = JSON.parse(stdout) as typeof raw;
  } catch {
    return {
      ok: false,
      amsDir: amsModelsDir(),
      tokenPresent: Boolean(process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN),
      results: [],
      snapshot: listAmsInstallSnapshot(),
      error: `install script returned non-JSON: ${stdout.slice(0, 240)}`,
      raw: stdout,
    };
  }

  const snapshot = listAmsInstallSnapshot();
  const results = Array.isArray(raw.results) ? raw.results : [];
  const anyInstalled = results.some((r) => r.status === "installed") || snapshot.installedCount > 0;
  return {
    ok: anyInstalled || results.length > 0,
    amsDir: raw.amsDir ?? amsModelsDir(),
    tokenPresent: Boolean(raw.tokenPresent),
    results,
    snapshot,
    raw,
  };
}
