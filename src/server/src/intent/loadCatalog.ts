import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IntentCatalog, IntentCatalogRow } from "./types.js";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "../../../../");

let cache: IntentCatalog | null = null;

export function clearIntentCatalogCache(): void {
  cache = null;
}

function catalogPath(): string {
  const fromEnv = process.env.ASI_INTENT_CATALOG_PATH?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(repoRoot, "config", "intents.catalog.json");
}

export function loadIntentCatalog(): IntentCatalog {
  if (cache) return cache;
  const raw = JSON.parse(fs.readFileSync(catalogPath(), "utf8")) as IntentCatalog;
  const ids = new Set<string>();
  for (const row of raw.intents) {
    if (ids.has(row.id)) throw new Error(`duplicate intent id: ${row.id}`);
    ids.add(row.id);
  }
  if (raw.intentCount !== raw.intents.length) {
    throw new Error(`intentCount ${raw.intentCount} !== intents.length ${raw.intents.length}`);
  }
  cache = raw;
  return raw;
}

export function listIntentRows(): IntentCatalogRow[] {
  return loadIntentCatalog().intents;
}
