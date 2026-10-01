import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHIEF_ID, withChiefIds } from "./withChief.js";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "../../..");

export const CUSTOM_SET_ID = "custom";

export interface ProSetEntry {
  id: string;
  name: string;
  agentIds: string[];
}

export interface ProSetsRegistryFile {
  sets: ProSetEntry[];
}

function proSetsPath(): string {
  const fromEnv = process.env.ASI_PRO_SETS_REGISTRY?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(repoRoot, "config", "pro-sets.registry.json");
}

function readJsonFile(p: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function loadCatalog(): ProSetEntry[] {
  const raw = readJsonFile(proSetsPath());
  if (!raw || typeof raw !== "object") return [];
  const sets = (raw as ProSetsRegistryFile).sets;
  if (!Array.isArray(sets)) return [];
  return sets
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const id = String((s as ProSetEntry).id ?? "").trim();
      if (!id) return null;
      const agentIds = Array.isArray((s as ProSetEntry).agentIds)
        ? (s as ProSetEntry).agentIds.map((x) => String(x)).filter(Boolean)
        : [];
      return {
        id,
        name: String((s as ProSetEntry).name ?? id),
        agentIds: withChiefIds(agentIds.filter((aid) => aid !== CHIEF_ID)),
      };
    })
    .filter((s): s is ProSetEntry => !!s);
}

/** Built-in Pro sets with Chief injected (cannot be omitted). */
export function listProSets(): { id: string; name: string; agentIds: string[] }[] {
  return loadCatalog().map((s) => ({
    id: s.id,
    name: s.name,
    agentIds: withChiefIds(s.agentIds),
  }));
}

export function proSetMemberIds(setId: string, customAgentIds: readonly string[]): string[] {
  if (setId === CUSTOM_SET_ID) {
    return withChiefIds(customAgentIds.filter((id) => id !== CHIEF_ID));
  }
  const entry = loadCatalog().find((s) => s.id === setId);
  const base = entry?.agentIds ?? [];
  return withChiefIds(base.filter((id) => id !== CHIEF_ID));
}

export function normalizeCustomProAgentIds(ids: readonly string[]): string[] {
  return withChiefIds(ids.filter((id) => id && id !== CHIEF_ID));
}
