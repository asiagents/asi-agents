import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const engineDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(engineDir, "../../..");

/** Repo `models/` tree — GGUF drop-in + router artifacts (see models/README.md). */
export function modelsRoot(): string {
  const fromEnv = process.env.ASI_MODELS_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(repoRoot, "models");
}

export function customModelsDir(): string {
  const dir = path.join(modelsRoot(), "custom");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function routerModelsDir(): string {
  const dir = path.join(modelsRoot(), "router");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** AMS product catalog + optional weight drops (`models/ams/`). */
export function amsModelsDir(): string {
  const dir = path.join(modelsRoot(), "ams");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function amsCatalogPath(): string {
  return path.join(amsModelsDir(), "catalog.json");
}

function listExtInDir(dir: string, ext: string): string[] {
  const needle = ext.toLowerCase().startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(needle))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

export function listCustomGguf(): string[] {
  return listExtInDir(customModelsDir(), ".gguf");
}

/** Real AMS GGUF weight files only (excludes catalog.json). */
export function listAmsGguf(): string[] {
  return listExtInDir(amsModelsDir(), ".gguf");
}

/** Real AMS ONNX weight files under models/ams/ (HF currently ships these for Micro). */
export function listAmsOnnx(): string[] {
  return listExtInDir(amsModelsDir(), ".onnx");
}

export function routerReady(): boolean {
  const dir = routerModelsDir();
  try {
    const entries = fs.readdirSync(dir);
    return entries.some((e) => e === "package.json" || e.endsWith(".json") || e.endsWith(".exe"));
  } catch {
    return false;
  }
}
