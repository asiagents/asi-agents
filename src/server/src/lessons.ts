/**
 * Lessons — learning-process oriented store of agent/work outputs
 * (research reports, training pushes, group Finals, manual notes).
 * Persisted in app-state `lessons[]`. Source is the auto-tag.
 */
import { loadState, saveState } from "./store.js";
import type { Lesson, LessonSource } from "./types.js";

const MAX_LESSONS = 200;
const MAX_TITLE = 200;
const MAX_BODY = 24_000;
const RECENT_FOR_CONTEXT = 5;
const MAX_PINNED_FOR_CONTEXT = 8;
const CONTEXT_BODY_CHARS = 400;

const SOURCES = new Set<LessonSource>(["research", "training", "group_final", "manual"]);

/** Canonical auto-tag label for UI (group_final → Final). */
export function lessonSourceTag(source: LessonSource): string {
  switch (source) {
    case "research":
      return "research";
    case "training":
      return "training";
    case "group_final":
      return "final";
    case "manual":
      return "manual";
    default:
      return "manual";
  }
}

export function normalizeLesson(raw: unknown): Lesson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<Lesson>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
  const title = typeof o.title === "string" ? o.title.trim().slice(0, MAX_TITLE) : "";
  const body = typeof o.body === "string" ? o.body.trim().slice(0, MAX_BODY) : "";
  if (!id || !title || !body) return null;
  const source: LessonSource =
    typeof o.source === "string" && SOURCES.has(o.source as LessonSource)
      ? (o.source as LessonSource)
      : "manual";
  const agentIds = Array.isArray(o.agentIds)
    ? o.agentIds.map((x) => String(x).trim()).filter(Boolean).slice(0, 40)
    : [];
  const createdAt =
    typeof o.createdAt === "string" && o.createdAt.trim()
      ? o.createdAt.trim()
      : new Date().toISOString();
  const pinned = o.pinned === true;
  return { id, title, body, source, agentIds, createdAt, pinned };
}

export function normalizeLessons(raw: unknown): Lesson[] {
  if (!Array.isArray(raw)) return [];
  const out: Lesson[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const lesson = normalizeLesson(row);
    if (!lesson || seen.has(lesson.id)) continue;
    seen.add(lesson.id);
    out.push(lesson);
  }
  return out.slice(0, MAX_LESSONS);
}

function newId(): string {
  return `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clipTitle(text: string, fallback: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return fallback;
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 1)}…` : t;
}

function sortLessons(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
}

/** Newest first; pinned float to top. */
export function listLessons(): Lesson[] {
  return sortLessons(normalizeLessons(loadState().lessons));
}

export function createLesson(input: {
  title: string;
  body: string;
  source?: LessonSource | string;
  agentIds?: string[];
  pinned?: boolean;
}): Lesson | { error: string } {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!title) return { error: "title required" };
  if (!body) return { error: "body required" };

  const source: LessonSource =
    typeof input.source === "string" && SOURCES.has(input.source as LessonSource)
      ? (input.source as LessonSource)
      : "manual";

  const lesson: Lesson = {
    id: newId(),
    title: title.slice(0, MAX_TITLE),
    body: body.slice(0, MAX_BODY),
    source,
    agentIds: Array.isArray(input.agentIds)
      ? input.agentIds.map((x) => String(x).trim()).filter(Boolean).slice(0, 40)
      : [],
    createdAt: new Date().toISOString(),
    pinned: input.pinned === true,
  };

  const state = loadState();
  const next = [lesson, ...normalizeLessons(state.lessons)].slice(0, MAX_LESSONS);
  state.lessons = next;
  saveState(state);
  return lesson;
}

export function patchLesson(
  id: string,
  patch: { pinned?: boolean; title?: string; body?: string }
): Lesson | { error: string } {
  const key = id.trim();
  if (!key) return { error: "id required" };
  const state = loadState();
  const list = normalizeLessons(state.lessons);
  const idx = list.findIndex((l) => l.id === key);
  if (idx < 0) return { error: "lesson not found" };
  const cur = list[idx]!;
  const next: Lesson = { ...cur };
  if (patch.pinned !== undefined) next.pinned = patch.pinned === true;
  if (typeof patch.title === "string") {
    const t = patch.title.trim();
    if (!t) return { error: "title required" };
    next.title = t.slice(0, MAX_TITLE);
  }
  if (typeof patch.body === "string") {
    const b = patch.body.trim();
    if (!b) return { error: "body required" };
    next.body = b.slice(0, MAX_BODY);
  }
  list[idx] = next;
  state.lessons = list;
  saveState(state);
  return next;
}

export function deleteLesson(id: string): { ok: true } | { error: string } {
  const key = id.trim();
  if (!key) return { error: "id required" };
  const state = loadState();
  const before = normalizeLessons(state.lessons);
  const next = before.filter((l) => l.id !== key);
  if (next.length === before.length) return { error: "lesson not found" };
  state.lessons = next;
  saveState(state);
  return { ok: true };
}

/** Recent group Finals for Training / Lessons surfacing. */
export function listGroupFinalLessons(limit = 8): Lesson[] {
  return listLessons()
    .filter((l) => l.source === "group_final")
    .slice(0, Math.max(1, Math.min(limit, 20)));
}

/** Research report complete → Lesson (auto-tag: research). */
export function addLessonFromResearch(opts: {
  question: string;
  report: string;
  agentId: string;
  researchId?: string;
}): Lesson | null {
  const report = opts.report.trim();
  if (!report) return null;
  const q = opts.question.trim() || "Research";
  const result = createLesson({
    title: clipTitle(`Research: ${q}`, "Research report"),
    body: report,
    source: "research",
    agentIds: opts.agentId ? [opts.agentId] : [],
  });
  return "error" in result ? null : result;
}

/** "Send all agents to training" → Lesson (auto-tag: training). */
export function addLessonFromTraining(opts: {
  trainedCount: number;
  agentIds: string[];
  trainedAt: string;
  briefingChars: number;
  briefingSource: string;
  briefingUrl?: string;
  briefingTitle?: string;
}): Lesson | null {
  const lines = [
    `Trained ${opts.trainedCount} agent${opts.trainedCount === 1 ? "" : "s"} with company briefing + roles + self-learning note.`,
    `Briefing: ${opts.briefingChars.toLocaleString()} characters (${opts.briefingSource}${
      opts.briefingUrl ? ` · ${opts.briefingUrl}` : ""
    }).`,
  ];
  if (opts.briefingTitle) lines.push(`Title: ${opts.briefingTitle}`);
  lines.push(`Trained at: ${opts.trainedAt}`);
  if (opts.agentIds.length) {
    lines.push(`Agents: ${opts.agentIds.slice(0, 24).join(", ")}${opts.agentIds.length > 24 ? "…" : ""}`);
  }
  const result = createLesson({
    title: clipTitle(
      opts.briefingTitle
        ? `Training: ${opts.briefingTitle}`
        : `Training push (${opts.trainedCount} agents)`,
      "Training push"
    ),
    body: lines.join("\n"),
    source: "training",
    agentIds: opts.agentIds,
  });
  return "error" in result ? null : result;
}

/** Group Final → Lesson (auto-tag: group_final / UI “final”). */
export function addLessonFromGroupFinal(opts: {
  groupTitle?: string;
  groupId?: string;
  finalText: string;
  moderatorId: string;
  memberIds?: string[];
}): Lesson | null {
  const text = opts.finalText.trim();
  if (!text) return null;
  // Skip fail-closed finals
  if (/Final \(failed closed\)/i.test(text.slice(0, 80))) return null;
  const label = opts.groupTitle?.trim() || opts.groupId?.trim() || "Council";
  const agentIds = [
    opts.moderatorId,
    ...(Array.isArray(opts.memberIds) ? opts.memberIds : []),
  ]
    .map((x) => String(x).trim())
    .filter((id) => id && id !== "user" && id !== "system");
  const result = createLesson({
    title: clipTitle(`Final: ${label}`, "Group Final"),
    body: text,
    source: "group_final",
    agentIds: [...new Set(agentIds)].slice(0, 40),
  });
  return "error" in result ? null : result;
}

function formatLessonLine(l: Lesson): string {
  const tag = lessonSourceTag(l.source);
  const pin = l.pinned ? " [pinned]" : "";
  const snippet = l.body.replace(/\s+/g, " ").trim().slice(0, CONTEXT_BODY_CHARS);
  const more = l.body.length > CONTEXT_BODY_CHARS ? "…" : "";
  return `• (${tag})${pin} ${l.title}: ${snippet}${more}`;
}

/**
 * Lessons block for system prompts when the agent has training on.
 * Pinned / selected lessons first, then newest unpinned to fill the budget.
 */
export function recentLessonsSystemBlock(limit = RECENT_FOR_CONTEXT): string {
  const all = listLessons();
  if (!all.length) return "";

  const cap = Math.max(1, Math.min(limit + MAX_PINNED_FOR_CONTEXT, 12));
  const pinned = all.filter((l) => l.pinned).slice(0, MAX_PINNED_FOR_CONTEXT);
  const pinnedIds = new Set(pinned.map((l) => l.id));
  const recent = all
    .filter((l) => !pinnedIds.has(l.id))
    .slice(0, Math.max(0, Math.min(limit, cap - pinned.length)));
  const selected = [...pinned, ...recent];
  if (!selected.length) return "";

  const lines = [
    pinned.length
      ? "[Pinned + recent Lessons — inject into training context]"
      : "[Recent Lessons — things the team learned]",
  ];
  for (const l of selected) lines.push(formatLessonLine(l));
  return lines.join("\n");
}
