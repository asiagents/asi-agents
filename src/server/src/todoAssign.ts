/**
 * Home To-do module — assign + classify helpers (server).
 * Modes: chief (default) | auto (role/skills) | agent (explicit) | personal (boss).
 */
import { BOSS_ID, CHIEF_ID } from "./withChief.js";
import type { TaskCategory } from "./types.js";

export type TodoAssignMode = "chief" | "auto" | "agent" | "personal";

export type AssignableAgent = {
  id: string;
  name?: string;
  role?: string;
  roleTag?: string | null;
  skills?: string[];
  isChief?: boolean;
};

const CATEGORIES = new Set<TaskCategory>([
  "work",
  "personal",
  "ops",
  "research",
  "finance",
  "general",
]);

/** Keyword hints → category (later-friendly; replace with model suggest later). */
const CATEGORY_HINTS: { category: TaskCategory; words: string[] }[] = [
  { category: "finance", words: ["budget", "invoice", "payroll", "expense", "spend", "tax", "finance", "money", "payment"] },
  { category: "research", words: ["research", "brief", "literature", "cite", "survey", "investigate", "look up", "find out"] },
  { category: "ops", words: ["deploy", "ops", "server", "uptime", "incident", "restart", "infra", "monitor", "backup"] },
  { category: "work", words: ["meeting", "deadline", "client", "project", "ship", "launch", "standup", "sprint"] },
  { category: "personal", words: ["personal", "family", "errand", "grocery", "doctor", "gym", "home"] },
];

const CATEGORY_AGENT_HINTS: Record<TaskCategory, string[]> = {
  finance: ["finance", "budget", "spend", "money", "invoice"],
  research: ["research", "cite", "literature", "find", "analyst"],
  ops: ["ops", "devops", "infra", "server", "shell"],
  work: ["project", "manager", "plan", "coord"],
  personal: [],
  general: [],
};

export function isTaskCategory(v: unknown): v is TaskCategory {
  return typeof v === "string" && CATEGORIES.has(v as TaskCategory);
}

export function suggestCategory(text: string, fallback: TaskCategory = "general"): TaskCategory {
  const hay = text.toLowerCase();
  let best: TaskCategory = fallback;
  let bestScore = 0;
  for (const row of CATEGORY_HINTS) {
    let score = 0;
    for (const w of row.words) {
      if (hay.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = row.category;
    }
  }
  return best;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function agentCorpus(a: AssignableAgent): string {
  return [a.id, a.name, a.role, a.roleTag, ...(a.skills ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Score agent against todo text + category; Chief excluded as specialty winner. */
export function scoreAgentForTodo(
  agent: AssignableAgent,
  text: string,
  category?: TaskCategory
): number {
  if (agent.isChief || agent.id === CHIEF_ID || agent.id === BOSS_ID) return 0;
  const corpus = agentCorpus(agent);
  if (!corpus.trim()) return 0;
  const tokens = tokenize(text);
  let score = 0;
  for (const t of tokens) {
    if (corpus.includes(t)) score += 1;
  }
  const hints = category ? CATEGORY_AGENT_HINTS[category] ?? [] : [];
  for (const h of hints) {
    if (corpus.includes(h)) score += 2;
  }
  return score;
}

/**
 * Resolve assignee id from assign mode.
 * Default / unclear auto → Chief. Personal → boss sentinel.
 */
export function resolveTodoAssignee(opts: {
  mode: TodoAssignMode;
  text: string;
  category?: TaskCategory;
  agentId?: string;
  agents: AssignableAgent[];
}): { agentId: string; matched: boolean; score: number } {
  const mode = opts.mode;
  if (mode === "personal") {
    return { agentId: BOSS_ID, matched: true, score: 0 };
  }
  if (mode === "chief") {
    return { agentId: CHIEF_ID, matched: true, score: 0 };
  }
  if (mode === "agent") {
    const id = (opts.agentId ?? "").trim();
    if (!id || id === BOSS_ID) {
      return { agentId: CHIEF_ID, matched: false, score: 0 };
    }
    return { agentId: id, matched: true, score: 0 };
  }

  // auto
  let bestId = CHIEF_ID;
  let bestScore = 0;
  for (const a of opts.agents) {
    const s = scoreAgentForTodo(a, opts.text, opts.category);
    if (s > bestScore) {
      bestScore = s;
      bestId = a.id;
    }
  }
  const clear = bestScore >= 2;
  return {
    agentId: clear ? bestId : CHIEF_ID,
    matched: clear,
    score: bestScore,
  };
}

export function normalizeAssignMode(raw: unknown): TodoAssignMode {
  const s = String(raw ?? "chief").trim().toLowerCase();
  if (s === "auto" || s === "agent" || s === "personal" || s === "boss") {
    return s === "boss" ? "personal" : (s as TodoAssignMode);
  }
  return "chief";
}
