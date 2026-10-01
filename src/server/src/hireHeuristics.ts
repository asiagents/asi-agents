/**
 * Local hire heuristics — skills + model picks from role/brief + Browse pool.
 * No LLM. Fail soft: empty skills / no pool → leave defaults.
 */
import { filterKnownAmsSkillIds, readAllSkills } from "./skills.catalog.js";
import { getSelectedModelPool } from "./store.js";

/** Role-key → preferred AMS catalog skill ids (validated at resolve time). */
const ROLE_SKILL_DEFAULTS: Record<string, string[]> = {
  travel: ["travel"],
  finance: ["budgeting", "spend-gates", "forecasting"],
  money: ["budgeting", "spend-gates", "invoicing"],
  coding: ["code-review", "shell-sandbox", "test-writing"],
  code: ["code-review", "shell-sandbox", "test-writing"],
  build: ["code-review", "shell-sandbox", "test-writing"],
  research: ["citations", "literature", "lit-review"],
  design: ["ui-mockups", "slides", "brand-voice"],
  create: ["ui-mockups", "slides", "story"],
  writer: ["story", "brand-voice", "proposal-draft"],
  writing: ["story", "brand-voice", "proposal-draft"],
  legal: ["contract-review", "case-law", "nda-draft"],
  health: ["triage-notes", "care-plans", "symptom-triage"],
  teaching: ["lesson-plans", "quiz-gen"],
  ops: ["scheduling", "mail-triage", "ticket-summarize"],
  marketing: ["seo", "brand-voice", "slides"],
  council: ["citations", "ticket-summarize", "proposal-draft"],
};

/** Keyword → skill ids (scored by hit count). */
const SKILL_HINTS: { words: string[]; skills: string[] }[] = [
  { words: ["code", "coding", "software", "engineer", "dev", "debug", "refactor", "typescript", "python"], skills: ["code-review", "shell-sandbox", "test-writing"] },
  { words: ["research", "cite", "literature", "survey", "investigate", "analyst", "brief"], skills: ["citations", "literature", "lit-review"] },
  { words: ["finance", "budget", "money", "invoice", "payroll", "tax", "spend", "forecast"], skills: ["budgeting", "spend-gates", "forecasting", "invoicing"] },
  { words: ["travel", "trip", "itinerary", "flight", "hotel"], skills: ["travel"] },
  { words: ["design", "ui", "ux", "mockup", "figma", "visual"], skills: ["ui-mockups", "slides", "brand-voice"] },
  { words: ["write", "writing", "draft", "copy", "blog", "story", "editor"], skills: ["story", "brand-voice", "proposal-draft"] },
  { words: ["legal", "contract", "law", "nda", "compliance"], skills: ["contract-review", "case-law", "nda-draft"] },
  { words: ["health", "medical", "clinic", "patient", "care"], skills: ["triage-notes", "care-plans", "symptom-triage"] },
  { words: ["teach", "lesson", "tutor", "quiz", "classroom"], skills: ["lesson-plans", "quiz-gen"] },
  { words: ["ops", "ops", "schedule", "mail", "ticket", "support"], skills: ["scheduling", "mail-triage", "ticket-summarize"] },
  { words: ["market", "seo", "growth", "campaign"], skills: ["seo", "brand-voice", "slides"] },
  { words: ["data", "stats", "clean", "analy"], skills: ["stats", "data-cleaning"] },
  { words: ["slide", "deck", "present"], skills: ["slides"] },
  { words: ["shell", "terminal", "script"], skills: ["shell-sandbox"] },
];

/** Map role/skill text → preferred assignment role for pool model pick. */
export type HireModelRole = "coding" | "vision" | "agentic" | "chat";

const MODEL_ROLE_HINTS: { role: HireModelRole; words: string[] }[] = [
  { role: "coding", words: ["code", "coding", "build", "shell", "test", "dev", "engineer", "refactor"] },
  { role: "vision", words: ["vision", "image", "ui", "mockup", "design", "visual", "slide"] },
  { role: "agentic", words: ["agent", "router", "orchestr", "council", "tool"] },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function haystack(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

/** Prefer catalog ids from role key defaults + keyword hits on role/brief. */
export function inferHireSkills(opts: {
  role?: string | null;
  brief?: string | null;
  /** Cap how many skills to attach (default 4). */
  limit?: number;
}): string[] {
  const limit = Math.min(12, Math.max(1, opts.limit ?? 4));
  const roleKey = (opts.role ?? "").trim().toLowerCase();
  const text = haystack(opts.role, opts.brief);
  const scores = new Map<string, number>();

  const bump = (id: string, n: number) => {
    scores.set(id, (scores.get(id) ?? 0) + n);
  };

  if (roleKey && ROLE_SKILL_DEFAULTS[roleKey]) {
    for (const id of ROLE_SKILL_DEFAULTS[roleKey]) bump(id, 5);
  } else if (roleKey) {
    // Partial key match (e.g. "coding assistant" → coding)
    for (const [key, ids] of Object.entries(ROLE_SKILL_DEFAULTS)) {
      if (roleKey.includes(key) || key.includes(roleKey.split(/\s+/)[0] ?? "")) {
        for (const id of ids) bump(id, 4);
      }
    }
  }

  for (const row of SKILL_HINTS) {
    let hits = 0;
    for (const w of row.words) {
      if (text.includes(w)) hits += 1;
    }
    if (hits > 0) {
      for (const id of row.skills) bump(id, hits);
    }
  }

  // Exact catalog id / name mention
  for (const s of readAllSkills().skills) {
    if (text.includes(s.id.toLowerCase()) || text.includes(s.name.toLowerCase())) {
      bump(s.id, 6);
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const picked = ranked.slice(0, limit).map(([id]) => id);
  return filterKnownAmsSkillIds(picked);
}

export function inferHireModelRole(role?: string | null, brief?: string | null, skills: string[] = []): HireModelRole {
  const text = haystack(role, brief, skills.join(" "));
  let best: HireModelRole = "chat";
  let bestScore = 0;
  for (const row of MODEL_ROLE_HINTS) {
    let score = 0;
    for (const w of row.words) {
      if (text.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = row.role;
    }
  }
  return best;
}

function modelLooksLike(id: string, want: HireModelRole): boolean {
  const hay = id.toLowerCase();
  if (want === "coding") {
    return /code|coder|starcoder|codellama|codestral|deepseek|qwen.*coder|devstral/i.test(hay);
  }
  if (want === "vision") {
    return /llava|vision|moondream|pixtral|vl-|minicpm-v|bakllava/i.test(hay);
  }
  if (want === "agentic") {
    return /micro|hybrid|agentchat|router|ams-/i.test(hay) || hay === "micro" || hay === "hybrid";
  }
  // chat — exclude embed / non-chat-ish
  return !/embed|nomic-embed|whisper|tts|lyria|musicgen/i.test(hay);
}

/**
 * Pick primary (+ optional secondary) from Browse `selectedModelPool`.
 * Soft: empty pool → null (caller keeps registry default). Never probes Ollama.
 */
export function pickHireModelFromPool(opts: {
  role?: string | null;
  brief?: string | null;
  skills?: string[];
  poolIds?: string[];
}): { primary: string; secondary?: string } | null {
  const pool = (opts.poolIds ?? getSelectedModelPool()).filter((id) => id.trim());
  if (!pool.length) return null;

  const want = inferHireModelRole(opts.role, opts.brief, opts.skills ?? []);
  const preferred = pool.filter((id) => modelLooksLike(id, want));
  const chatish = pool.filter((id) => modelLooksLike(id, "chat"));
  const primaryPool = preferred.length ? preferred : chatish.length ? chatish : pool;
  const primary = primaryPool[0]!;
  const secondaryPool = pool.filter((id) => id !== primary);
  const secondary =
    secondaryPool.find((id) => preferred.includes(id) || chatish.includes(id)) ??
    secondaryPool[0];
  return secondary ? { primary, secondary } : { primary };
}

/** Parse "Name (role)" / "Name(role)" into parts when role field empty. */
export function parseNameRole(raw: string): { name: string; role?: string } {
  const s = raw.trim();
  const m = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!m) return { name: s.slice(0, 64) };
  const name = m[1]!.trim().slice(0, 64);
  const role = m[2]!.trim().slice(0, 120);
  return role ? { name: name || s.slice(0, 64), role } : { name: name || s.slice(0, 64) };
}

export function formatNameRole(name: string, role?: string | null): string {
  const n = name.trim();
  const r = (role ?? "").trim();
  if (!n) return r ? `(${r})` : "";
  return r ? `${n} (${r})` : n;
}
