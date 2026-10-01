import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CUSTOM_SET_ID, listProSets, proSetMemberIds } from "./proSets.js";
import { getCustomProAgentIds } from "./store.js";
import { isChiefId } from "./withChief.js";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "../../..");

export interface ProAgentRow {
  id: string;
  name: string;
  role: string;
  skills: string[];
  modelId: string;
}

function proAgentsPath(): string {
  const fromEnv = process.env.ASI_PRO_AGENTS_REGISTRY?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(repoRoot, "config", "pro-agents.registry.json");
}

let catalogCache: ProAgentRow[] | null = null;

function loadCatalog(): ProAgentRow[] {
  if (catalogCache) return catalogCache;
  try {
    const raw = JSON.parse(fs.readFileSync(proAgentsPath(), "utf8")) as { agents?: ProAgentRow[] };
    catalogCache = Array.isArray(raw.agents)
      ? raw.agents
          .map((a) => ({
            id: String(a.id ?? "").trim(),
            name: String(a.name ?? a.id ?? "").trim(),
            role: String(a.role ?? "specialist").trim(),
            skills: Array.isArray(a.skills) ? a.skills.map((s) => String(s)).filter(Boolean) : [],
            modelId: String(a.modelId ?? "micro").trim(),
          }))
          .filter((a) => a.id)
      : [];
  } catch {
    catalogCache = [];
  }
  return catalogCache;
}

function allProMemberIds(): Set<string> {
  const custom = getCustomProAgentIds();
  const ids = new Set<string>();
  for (const s of listProSets()) {
    for (const id of proSetMemberIds(s.id, custom)) ids.add(id);
  }
  for (const id of proSetMemberIds(CUSTOM_SET_ID, custom)) ids.add(id);
  return ids;
}

/** Resolve a Pro specialist id (e.g. `p-mira`, custom `c-*`) for chat routing. */
export function findProAgent(proId: string): ProAgentRow | null {
  const id = proId.trim();
  if (!id || isChiefId(id)) return null;

  const hit = loadCatalog().find((a) => a.id === id);
  if (hit) return hit;

  if (!allProMemberIds().has(id)) return null;
  return {
    id,
    name: id,
    role: "Pro specialist",
    skills: [],
    modelId: "micro",
  };
}

export function isProSpecialistId(proId: string): boolean {
  return findProAgent(proId.trim()) !== null;
}

/** Pro specialists eligible for company training (catalog + set members; no Chief). */
export function listTrainableProAgents(): ProAgentRow[] {
  const members = allProMemberIds();
  const out: ProAgentRow[] = [];
  const seen = new Set<string>();
  for (const row of loadCatalog()) {
    if (!row.id || isChiefId(row.id) || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  for (const id of members) {
    if (seen.has(id) || isChiefId(id)) continue;
    const row = findProAgent(id);
    if (row) {
      seen.add(id);
      out.push(row);
    }
  }
  return out;
}
