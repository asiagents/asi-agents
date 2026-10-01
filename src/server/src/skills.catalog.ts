import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "../../..");
const CATALOG_PATH = path.join(repoRoot, "config", "ams-skills.catalog.json");

export interface AmsSkillEntry {
  id: string;
  name: string;
  group: string;
  description?: string;
  /** Optional runtime system prompt for single-skill `POST …/ams/run` (when enabled). */
  systemPrompt?: string;
}

export interface SkillsCatalogResponse {
  source: "config";
  label: string;
  fetchedAt: string;
  total: number;
  limit: number;
  skills: AmsSkillEntry[];
}

type CatalogFile = {
  version?: number;
  label?: string;
  skills?: AmsSkillEntry[];
};

export function readAllSkills(): { label: string; skills: AmsSkillEntry[] } {
  try {
    const raw = fs.readFileSync(CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw) as CatalogFile;
    const skills = Array.isArray(parsed.skills)
      ? parsed.skills.filter((s) => s.id && s.name && s.group)
      : [];
    return {
      label: parsed.label ?? "AMS Pro skills catalog",
      skills,
    };
  } catch {
    return { label: "AMS Pro skills catalog", skills: [] };
  }
}

export function getAmsSkillById(id: string): AmsSkillEntry | undefined {
  const skillId = id.trim();
  if (!skillId) return undefined;
  return readAllSkills().skills.find((s) => s.id === skillId);
}

/** Keep only ids present in `config/ams-skills.catalog.json`. */
export function filterKnownAmsSkillIds(ids: string[]): string[] {
  const known = new Set(readAllSkills().skills.map((s) => s.id));
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (id && known.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export function systemPromptForAmsSkill(entry: AmsSkillEntry): string {
  const custom = entry.systemPrompt?.trim();
  if (custom) return custom;
  const desc = entry.description?.trim();
  const detail = desc ? ` ${desc}` : "";
  return (
    `You are running the AMS skill "${entry.name}" (${entry.group}).` +
    `${detail} Stay within this skill scope. Be concise and practical.`
  );
}

export function getSkillsCatalog(opts?: {
  q?: string;
  group?: string;
  offset?: number;
  limit?: number;
}): SkillsCatalogResponse {
  const { label, skills: all } = readAllSkills();
  const q = opts?.q?.trim().toLowerCase();
  const groupFilter = opts?.group?.trim();
  let filtered = all;
  if (groupFilter && groupFilter !== "All") {
    filtered = filtered.filter((s) => s.group === groupFilter);
  }
  if (q) {
    filtered = filtered.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.group.toLowerCase().includes(q)
    );
  }
  const total = filtered.length;
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 500));
  const slice = filtered.slice(offset, offset + limit);
  return {
    source: "config",
    label,
    fetchedAt: new Date().toISOString(),
    total,
    limit,
    skills: slice,
  };
}
