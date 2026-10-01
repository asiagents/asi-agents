/**
 * Agent company training — append briefing + role + self-learning note into
 * app-state `agentTraining` so chat / council system prompts can see it.
 */
import { loadAgents } from "./agents.js";
import {
  briefingFreshness,
  getCompanyBriefing,
  selfLearningNote,
} from "./companyBriefing.js";
import { listTrainableProAgents } from "./proAgents.js";
import { loadState, saveState } from "./store.js";
import type {
  AgentTrainingEntry,
  AgentTrainingMap,
  BriefingFreshness,
  CompanyBriefing,
  Lesson,
  TrainingDiffReport,
} from "./types.js";
import {
  addLessonFromTraining,
  listGroupFinalLessons,
  listLessons,
  recentLessonsSystemBlock,
} from "./lessons.js";

const SYSTEM_BRIEFING_CHARS = 6_000;
const LEARNING_BRIEFING_CHARS = 2_000;

export function normalizeAgentTrainingEntry(raw: unknown): AgentTrainingEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<AgentTrainingEntry>;
  const trainedAt =
    typeof o.trainedAt === "string" && o.trainedAt.trim()
      ? o.trainedAt.trim()
      : new Date().toISOString();
  const role = typeof o.role === "string" ? o.role.trim().slice(0, 500) : "";
  const learnings = Array.isArray(o.learnings)
    ? o.learnings
        .map((x) => String(x).trim())
        .filter(Boolean)
        .slice(0, 20)
        .map((x) => x.slice(0, 4000))
    : [];
  const briefingChars =
    typeof o.briefingChars === "number" && Number.isFinite(o.briefingChars)
      ? Math.max(0, Math.floor(o.briefingChars))
      : 0;
  if (!learnings.length && !role) return null;
  return { trainedAt, role, learnings, briefingChars };
}

export function normalizeAgentTrainingMap(raw: unknown): AgentTrainingMap {
  if (!raw || typeof raw !== "object") return {};
  const out: AgentTrainingMap = {};
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(id).trim();
    if (!key) continue;
    const normalized = normalizeAgentTrainingEntry(entry);
    if (normalized) out[key] = normalized;
  }
  return out;
}

export function getAgentTrainingMap(): AgentTrainingMap {
  return normalizeAgentTrainingMap(loadState().agentTraining);
}

export function getAgentTraining(agentId: string): AgentTrainingEntry | null {
  const id = agentId.trim();
  if (!id) return null;
  return getAgentTrainingMap()[id] ?? null;
}

export function getAgentLearnings(agentId: string): string[] {
  return getAgentTraining(agentId)?.learnings ?? [];
}

function briefingLearningLine(briefing: CompanyBriefing): string {
  const src =
    briefing.source === "url" && briefing.sourceUrl
      ? ` (from ${briefing.sourceUrl})`
      : briefing.source === "paste"
        ? " (pasted)"
        : "";
  const title = briefing.title ? `${briefing.title} — ` : "";
  const body = briefing.text.slice(0, LEARNING_BRIEFING_CHARS);
  const more = briefing.text.length > LEARNING_BRIEFING_CHARS ? "…" : "";
  return `Company briefing${src}: ${title}${body}${more}`;
}

function buildLearnings(agentName: string, role: string, briefing: CompanyBriefing): string[] {
  return [
    briefingLearningLine(briefing),
    `Your role at this company: ${role || agentName}. Represent this role when advising.`,
    selfLearningNote(),
  ];
}

/** Compact block appended to system prompts when the agent has been trained. */
export function trainingSystemBlock(agentId: string): string {
  const entry = getAgentTraining(agentId);
  if (!entry) return "";
  const briefing = getCompanyBriefing();
  const parts: string[] = ["[Company training]"];
  if (entry.role) parts.push(`Assigned role: ${entry.role}.`);
  if (briefing?.text) {
    const body = briefing.text.slice(0, SYSTEM_BRIEFING_CHARS);
    const more = briefing.text.length > SYSTEM_BRIEFING_CHARS ? "…" : "";
    const src = briefing.sourceUrl ? ` Source: ${briefing.sourceUrl}.` : "";
    parts.push(`Company briefing:${src}\n${body}${more}`);
  } else if (entry.learnings[0]) {
    parts.push(entry.learnings[0]);
  }
  parts.push(selfLearningNote());
  // Pinned + recent Lessons inject into training context
  const lessonsBlock = recentLessonsSystemBlock();
  if (lessonsBlock) parts.push(lessonsBlock);
  return parts.join("\n");
}

export function withTrainingContext(basePrompt: string, agentId: string): string {
  const block = trainingSystemBlock(agentId);
  if (!block) return basePrompt;
  return `${basePrompt.trim()}\n\n${block}`;
}

function buildTrainingDiff(
  before: AgentTrainingMap,
  afterIds: string[],
  briefingChars: number
): TrainingDiffReport {
  const newlyTrainedIds: string[] = [];
  const retrainedIds: string[] = [];
  for (const id of afterIds) {
    if (before[id]) retrainedIds.push(id);
    else newlyTrainedIds.push(id);
  }
  const previousTrainedCount = Object.keys(before).length;
  const prevChars = (() => {
    const vals = Object.values(before)
      .map((e) => e?.briefingChars)
      .filter((n): n is number => typeof n === "number" && n > 0);
    if (!vals.length) return null;
    return Math.max(...vals);
  })();
  const briefingChanged = prevChars == null || prevChars !== briefingChars;
  const parts: string[] = [];
  if (newlyTrainedIds.length) {
    parts.push(
      `${newlyTrainedIds.length} new agent${newlyTrainedIds.length === 1 ? "" : "s"} trained`
    );
  }
  if (retrainedIds.length) {
    parts.push(
      `${retrainedIds.length} re-trained`
    );
  }
  if (briefingChanged) {
    parts.push(
      prevChars == null
        ? `briefing set (${briefingChars.toLocaleString()} chars)`
        : `briefing ${prevChars.toLocaleString()} → ${briefingChars.toLocaleString()} chars`
    );
  } else {
    parts.push("briefing unchanged");
  }
  const summary =
    parts.length > 0
      ? parts.join(" · ")
      : `Trained ${afterIds.length} agent${afterIds.length === 1 ? "" : "s"}`;

  return {
    newlyTrainedIds,
    retrainedIds,
    previousTrainedCount,
    trainedCount: afterIds.length,
    previousBriefingChars: prevChars,
    briefingChars,
    briefingChanged,
    summary,
  };
}

export type SendAllTrainingResult = {
  ok: true;
  trainedCount: number;
  agentIds: string[];
  trainedAt: string;
  briefingChars: number;
  briefingSource: CompanyBriefing["source"];
  briefingUrl?: string;
  diff: TrainingDiffReport;
};

export type SendAllTrainingError = { ok: false; error: string };

/** Append/store briefing + roles + self-learning note for every registry + Pro agent. */
export function sendAllAgentsToTraining(): SendAllTrainingResult | SendAllTrainingError {
  const briefing = getCompanyBriefing();
  if (!briefing?.text) {
    return {
      ok: false,
      error: "Save a company briefing first (paste text or fetch an About Us URL).",
    };
  }

  const before = getAgentTrainingMap();
  const trainedAt = new Date().toISOString();
  const next: AgentTrainingMap = { ...before };
  const agentIds: string[] = [];

  for (const agent of loadAgents().agents) {
    const role = (agent.role || agent.roleTag || agent.name || "agent").trim();
    next[agent.id] = {
      trainedAt,
      role,
      learnings: buildLearnings(agent.name, role, briefing),
      briefingChars: briefing.charCount,
    };
    agentIds.push(agent.id);
  }

  for (const pro of listTrainableProAgents()) {
    if (agentIds.includes(pro.id)) continue;
    const role = (pro.role || pro.name || "specialist").trim();
    next[pro.id] = {
      trainedAt,
      role,
      learnings: buildLearnings(pro.name, role, briefing),
      briefingChars: briefing.charCount,
    };
    agentIds.push(pro.id);
  }

  if (!agentIds.length) {
    return { ok: false, error: "No agents found to train." };
  }

  const state = loadState();
  state.agentTraining = next;
  saveState(state);

  const briefingMeta = getCompanyBriefing();
  addLessonFromTraining({
    trainedCount: agentIds.length,
    agentIds,
    trainedAt,
    briefingChars: briefing.charCount,
    briefingSource: briefing.source,
    briefingUrl: briefing.sourceUrl,
    briefingTitle: briefingMeta?.title,
  });

  const diff = buildTrainingDiff(before, agentIds, briefing.charCount);

  return {
    ok: true,
    trainedCount: agentIds.length,
    agentIds,
    trainedAt,
    briefingChars: briefing.charCount,
    briefingSource: briefing.source,
    briefingUrl: briefing.sourceUrl,
    diff,
  };
}

export function trainingStatusSnapshot(): {
  briefing: CompanyBriefing | null;
  freshness: BriefingFreshness;
  trainedCount: number;
  lastTrainedAt: string | null;
  agents: { id: string; trainedAt: string | null; learningsCount: number; role: string | null }[];
  /** Recent group Finals surfaced as Lessons (for Training UI). */
  groupFinalLessons: Lesson[];
  pinnedLessonCount: number;
} {
  const briefing = getCompanyBriefing();
  const map = getAgentTrainingMap();
  const registry = loadAgents().agents;
  const pro = listTrainableProAgents();
  const seen = new Set<string>();
  const agents: {
    id: string;
    trainedAt: string | null;
    learningsCount: number;
    role: string | null;
  }[] = [];

  for (const a of [...registry, ...pro.map((p) => ({ id: p.id, role: p.role }))]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    const entry = map[a.id];
    const fallbackRole = "role" in a ? String(a.role || "").trim() : "";
    agents.push({
      id: a.id,
      trainedAt: entry?.trainedAt ?? null,
      learningsCount: entry?.learnings?.length ?? 0,
      role: (entry?.role || fallbackRole || null) as string | null,
    });
  }

  let lastTrainedAt: string | null = null;
  let trainedCount = 0;
  for (const e of Object.values(map)) {
    if (!e?.trainedAt) continue;
    trainedCount += 1;
    if (!lastTrainedAt || e.trainedAt > lastTrainedAt) lastTrainedAt = e.trainedAt;
  }

  const groupFinalLessons = listGroupFinalLessons(6);
  const pinnedLessonCount = listLessons().filter((l) => l.pinned).length;

  return {
    briefing,
    freshness: briefingFreshness(briefing),
    trainedCount,
    lastTrainedAt,
    agents,
    groupFinalLessons,
    pinnedLessonCount,
  };
}
