import type { Express } from "express";
import { loadAgents } from "./agents.js";
import { requireTasksReadScopeIfKeyPresented } from "./agentApiKeys.js";
import { runResearchPipeline } from "./researchPipeline.js";
import {
  DEFAULT_MAX_VIRTUAL_AGENTS,
  resolveMaxVirtualAgents,
  resolveVirtualAgentPool,
} from "./researchVirtualAgents.js";
import { resolveAgentSkillIds } from "./agentSystemPrompt.js";
import {
  addTaskAttachment,
  addTaskComment,
  createTask,
  deleteTask,
  deleteTaskAttachment,
  getTask,
  getTaskAttachmentFile,
  listMentionNotifications,
  listTaskAttachments,
  listTaskComments,
  listTasks,
  markMentionRead,
  patchTask,
  resolveCommentMentions,
  TASK_ATTACHMENT_MAX_BYTES,
} from "./store.js";
import type { AgentTask, TaskPriority, TaskStatus } from "./types.js";
import {
  isTaskCategory,
  normalizeAssignMode,
  resolveTodoAssignee,
  suggestCategory,
  type TodoAssignMode,
} from "./todoAssign.js";
import { kickoffAssignedTodo, shouldKickoffAssignee } from "./todoKickoff.js";
import { BOSS_ID, CHIEF_ID } from "./withChief.js";

const BROWSING_SKILL_IDS = new Set(["web-browsing", "browsing", "web-browse"]);

function agentHasBrowsingSkill(agentId: string): boolean {
  const row = loadAgents().agents.find((a) => a.id === agentId);
  const skills = resolveAgentSkillIds(agentId, row?.skills ?? []);
  return skills.some((s) => BROWSING_SKILL_IDS.has(s));
}
const STATUSES = new Set<TaskStatus>(["pending", "ongoing", "completed", "blocked"]);
const PRIORITIES = new Set<TaskPriority>(["low", "normal", "high"]);

function isPriority(v: unknown): v is TaskPriority {
  return typeof v === "string" && PRIORITIES.has(v as TaskPriority);
}

function isStatus(v: unknown): boolean {
  if (typeof v !== "string") return false;
  if (v === "open" || v === "done") return true; // legacy aliases; store normalizes
  return STATUSES.has(v as TaskStatus);
}

const RESEARCH_STEPS: { step: string; title: (q: string) => string; status: TaskStatus }[] = [
  { step: "scope", title: (q) => `Scope — ${q}`, status: "completed" },
  { step: "gather", title: (q) => `Gather sources — ${q}`, status: "pending" },
  { step: "draft", title: (q) => `Draft findings — ${q}`, status: "pending" },
  { step: "review", title: (q) => `Review / select answers — ${q}`, status: "pending" },
  { step: "report", title: (q) => `Write report — ${q}`, status: "pending" },
];

function clip(s: string, n = 72): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function parseOptionalInt(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

export function mountTaskRoutes(app: Express): void {
  app.get("/api/tasks", requireTasksReadScopeIfKeyPresented, (_req, res) => {
    res.json({ tasks: listTasks() });
  });

  app.get("/api/mentions", (req, res) => {
    const agentId = req.query.agentId != null ? String(req.query.agentId).trim() : undefined;
    const unreadOnly = req.query.unread === "1" || req.query.unread === "true";
    res.json({ mentions: listMentionNotifications({ agentId, unreadOnly }) });
  });

  app.patch("/api/mentions/:id/read", (req, res) => {
    const n = markMentionRead(req.params.id);
    if (!n) return res.status(404).json({ error: "not found" });
    res.json({ mention: n });
  });

  app.post("/api/tasks", (req, res) => {
    try {
      const title = String(req.body?.title ?? "").trim();
      const status = req.body?.status;
      const dueRaw = req.body?.due;
      const researchId = req.body?.researchId != null ? String(req.body.researchId).trim() : undefined;
      const step = req.body?.step != null ? String(req.body.step).trim() : undefined;
      const note = req.body?.note != null ? String(req.body.note).trim() : undefined;
      const originRaw = req.body?.origin != null ? String(req.body.origin).trim() : undefined;
      const assignMode: TodoAssignMode = normalizeAssignMode(req.body?.assignMode ?? req.body?.assign);
      if (!title) return res.status(400).json({ error: "title required" });
      if (status != null && !isStatus(status)) return res.status(400).json({ error: "invalid status" });

      let category =
        req.body?.category != null && isTaskCategory(String(req.body.category).trim())
          ? (String(req.body.category).trim() as ReturnType<typeof suggestCategory>)
          : undefined;
      if (!category && (originRaw === "todo" || req.body?.suggestCategory)) {
        category = suggestCategory(title);
      }

      let priority: TaskPriority | undefined;
      if (req.body?.priority != null) {
        if (!isPriority(req.body.priority)) return res.status(400).json({ error: "invalid priority" });
        priority = req.body.priority;
      }

      const bodyAgentId = String(req.body?.agentId ?? "").trim();
      const agents = loadAgents().agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        roleTag: a.roleTag,
        skills: a.skills,
        isChief: a.isChief,
      }));

      // Home todos: assignMode resolves agent; legacy callers still pass agentId.
      let agentId = bodyAgentId;
      let assignMeta: { mode: TodoAssignMode; matched: boolean; score: number } | undefined;
      if (originRaw === "todo" || req.body?.assignMode != null || req.body?.assign != null) {
        const resolved = resolveTodoAssignee({
          mode: assignMode,
          text: title,
          category,
          agentId: bodyAgentId,
          agents,
        });
        agentId = resolved.agentId;
        assignMeta = { mode: assignMode, matched: resolved.matched, score: resolved.score };
      } else if (!agentId) {
        agentId = CHIEF_ID;
      }

      if (!agentId) return res.status(400).json({ error: "agentId required" });
      const due = dueRaw != null && String(dueRaw).trim() ? String(dueRaw).trim() : undefined;
      const origin =
        originRaw === "todo" ||
        originRaw === "research" ||
        originRaw === "cron" ||
        originRaw === "board" ||
        originRaw === "api"
          ? originRaw
          : originRaw
            ? ("api" as const)
            : undefined;
      const task = createTask({
        title,
        agentId,
        status: status ?? "pending",
        due,
        researchId: researchId || undefined,
        step: step || undefined,
        note: note || undefined,
        category,
        priority: priority ?? "normal",
        origin,
      });

      let kickoff: ReturnType<typeof kickoffAssignedTodo> | undefined;
      const startWork = req.body?.startWork !== false;
      if (startWork && (origin === "todo" || assignMeta) && shouldKickoffAssignee(task.agentId)) {
        kickoff = kickoffAssignedTodo(task, { event: "assigned" });
      }

      res.status(201).json({ task, assign: assignMeta, kickoff });
    } catch (err) {
      const message = err instanceof Error ? err.message : "create task failed";
      res.status(500).json({ error: message });
    }
  });

  /** Preview auto-assign / category suggest for Home To-do UI (no write). */
  app.post("/api/tasks/assign-preview", (req, res) => {
    const title = String(req.body?.title ?? req.body?.text ?? "").trim();
    const assignMode = normalizeAssignMode(req.body?.assignMode ?? "auto");
    const category =
      req.body?.category != null && isTaskCategory(String(req.body.category).trim())
        ? (String(req.body.category).trim() as ReturnType<typeof suggestCategory>)
        : suggestCategory(title);
    const agents = loadAgents().agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      roleTag: a.roleTag,
      skills: a.skills,
      isChief: a.isChief,
    }));
    const resolved = resolveTodoAssignee({
      mode: assignMode,
      text: title,
      category,
      agentId: String(req.body?.agentId ?? "").trim(),
      agents,
    });
    res.json({
      agentId: resolved.agentId,
      matched: resolved.matched,
      score: resolved.score,
      category,
      assignMode,
      bossId: BOSS_ID,
      chiefId: CHIEF_ID,
    });
  });

  /**
   * Preview which virtual agents deep/predictive research would fan out to
   * from selectedModelPool (prefer free OpenRouter + live Ollama).
   */
  app.get("/api/tasks/research/pool-preview", async (req, res) => {
    const maxVirtualAgents = parseOptionalInt(req.query.maxVirtualAgents);
    const preferFree = req.query.preferFree !== "0" && req.query.preferFree !== "false";
    const mode = String(req.query.mode ?? "deep").trim() === "predictive" ? "predictive" : "deep";
    try {
      const preview = await resolveVirtualAgentPool({
        maxAgents: maxVirtualAgents,
        preferFree,
        mode,
      });
      res.json({
        ...preview,
        defaultMaxVirtualAgents: DEFAULT_MAX_VIRTUAL_AGENTS,
        resolvedMax: resolveMaxVirtualAgents(maxVirtualAgents),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: detail });
    }
  });

  /**
   * Create a linked research pipeline from a Research brief, then run
   * gather → draft → report via routeGenerate (Research agent). Fail-closed.
   * Deep / predictive types fan out to capped virtual agents from the model pool.
   */
  app.post("/api/tasks/research", async (req, res) => {
    const question = String(req.body?.question ?? "").trim();
    const agentId = String(req.body?.agentId ?? "").trim() || "research";
    const participate = Boolean(req.body?.participate);
    const type = String(req.body?.type ?? "deep").trim();
    const depth = String(req.body?.depth ?? "15m").trim();
    const selection = String(req.body?.selection ?? "balanced").trim();
    const format = String(req.body?.format ?? "memo").trim();
    const maxVirtualAgents = parseOptionalInt(req.body?.maxVirtualAgents);
    const multiAgent =
      req.body?.multiAgent == null ? null : Boolean(req.body.multiAgent);
    const preferFree =
      req.body?.preferFree == null ? true : Boolean(req.body.preferFree);
    // Live web: explicit body wins; else auto-on when agent has web-browsing skill
    // (Desk fetch fail-closes if :3456 offline / empty).
    let liveWeb: boolean;
    if (req.body?.liveWeb === false || req.body?.liveWeb === "0" || req.body?.liveWeb === "false") {
      liveWeb = false;
    } else if (req.body?.liveWeb === true || req.body?.liveWeb === "1" || req.body?.liveWeb === "true") {
      liveWeb = true;
    } else {
      liveWeb = agentHasBrowsingSkill(agentId);
    }
    if (!question) return res.status(400).json({ error: "question required" });

    const researchId = `research-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const snippet = clip(question);
    const note = `${type} · ${depth} · ${selection} · ${format}${liveWeb ? " · live-web" : ""}`;
    const tasks: AgentTask[] = [];

    for (const s of RESEARCH_STEPS) {
      tasks.push(
        createTask({
          title: s.title(snippet),
          agentId,
          status: s.status,
          researchId,
          step: s.step,
          note,
        })
      );
    }
    if (participate) {
      tasks.push(
        createTask({
          title: `Your input — ${snippet}`,
          agentId,
          status: "pending",
          researchId,
          step: "participate",
          note: "Waiting for your notes / votes in chat",
        })
      );
    }

    // Return immediately so the UI can close the brief modal and watch the
    // agent chat. Pipeline progress is pushed into the agent thread + Tasks.
    const multiAgentEffective =
      multiAgent ?? (type === "deep" || type === "predictive");
    res.status(201).json({
      researchId,
      tasks: listTasks().filter((t) => t.researchId === researchId),
      brief: {
        type,
        depth,
        selection,
        format,
        participate,
        maxVirtualAgents: resolveMaxVirtualAgents(maxVirtualAgents),
        multiAgent: multiAgentEffective,
        preferFree,
        liveWeb,
      },
      stub: false,
      pipelineRunning: true,
      pipelineOk: null,
      webSearchAvailable: null,
      liveWebRequested: liveWeb,
      disclaimer: liveWeb
        ? "Live web on — Desk fetches when :3456 is live; otherwise skipped."
        : "Based on model knowledge — live web was not used.",
      message: multiAgentEffective
        ? "Multi-agent research started — watch this agent's chat for fan-out progress and the final report."
        : "Research started — watch this agent's chat for gather → draft → report progress.",
      multiAgent: multiAgentEffective,
      agentId,
      chatPath: `/chat/${encodeURIComponent(agentId)}`,
    });

    void runResearchPipeline({
      researchId,
      question,
      agentId,
      type,
      depth,
      selection,
      format,
      participate,
      maxVirtualAgents,
      multiAgent,
      preferFree,
      liveWeb,
    }).catch((err) => {
      const detail = err instanceof Error ? err.message : String(err);
      const gather = tasks.find((t) => t.step === "gather");
      if (gather) {
        patchTask(gather.id, {
          status: "blocked",
          note: clip(`Pipeline error: ${detail}`, 280),
        });
      }
      console.error(`[research] pipeline crashed for ${researchId}:`, detail);
    });
  });

  app.get("/api/tasks/:id", requireTasksReadScopeIfKeyPresented, (req, res) => {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ error: "not found" });
    res.json({ task });
  });

  app.get("/api/tasks/:id/comments", requireTasksReadScopeIfKeyPresented, (req, res) => {
    const comments = listTaskComments(req.params.id);
    if (!comments) return res.status(404).json({ error: "not found" });
    res.json({ comments });
  });

  app.post("/api/tasks/:id/comments", (req, res) => {
    const text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ error: "text required" });
    const author = req.body?.author != null ? String(req.body.author).trim() : undefined;
    const knownIds = loadAgents().agents.map((a) => a.id);
    const mentions = resolveCommentMentions(text, knownIds);
    const result = addTaskComment(req.params.id, { text, author, mentionAgentIds: mentions });
    if (!result) return res.status(404).json({ error: "not found" });
    res.status(201).json({
      comment: result.comment,
      task: result.task,
      mentions: result.mentions,
    });
  });

  app.get("/api/tasks/:id/attachments", requireTasksReadScopeIfKeyPresented, (req, res) => {
    const attachments = listTaskAttachments(req.params.id);
    if (!attachments) return res.status(404).json({ error: "not found" });
    res.json({ attachments, maxBytes: TASK_ATTACHMENT_MAX_BYTES });
  });

  app.post("/api/tasks/:id/attachments", (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    const dataBase64 = String(req.body?.dataBase64 ?? req.body?.data ?? "").trim();
    const mime = req.body?.mime != null ? String(req.body.mime).trim() : undefined;
    const uploadedBy = req.body?.uploadedBy != null ? String(req.body.uploadedBy).trim() : undefined;
    if (!name) return res.status(400).json({ error: "name required" });
    if (!dataBase64) return res.status(400).json({ error: "dataBase64 required" });
    const result = addTaskAttachment(req.params.id, { name, mime, dataBase64, uploadedBy });
    if ("error" in result) {
      const status = result.error === "not found" ? 404 : 400;
      return res.status(status).json({ error: result.error, maxBytes: TASK_ATTACHMENT_MAX_BYTES });
    }
    res.status(201).json({ attachment: result.attachment, task: result.task });
  });

  app.get("/api/tasks/:id/attachments/:attId", requireTasksReadScopeIfKeyPresented, (req, res) => {
    const hit = getTaskAttachmentFile(req.params.id, req.params.attId);
    if (!hit) return res.status(404).json({ error: "not found" });
    res.download(hit.absolutePath, hit.attachment.name);
  });

  app.delete("/api/tasks/:id/attachments/:attId", (req, res) => {
    const ok = deleteTaskAttachment(req.params.id, req.params.attId);
    if (!ok) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const patch: Partial<
      Pick<
        AgentTask,
        | "title"
        | "agentId"
        | "status"
        | "due"
        | "researchId"
        | "step"
        | "note"
        | "category"
        | "priority"
        | "origin"
      >
    > = {};
    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) return res.status(400).json({ error: "title must not be empty" });
      patch.title = title;
    }
    if (req.body?.agentId != null) {
      const agentId = String(req.body.agentId).trim();
      if (!agentId) return res.status(400).json({ error: "agentId must not be empty" });
      patch.agentId = agentId;
    }
    if (req.body?.status != null) {
      if (!isStatus(req.body.status)) return res.status(400).json({ error: "invalid status" });
      patch.status = req.body.status as TaskStatus;
    }
    if (req.body?.due != null) {
      patch.due = String(req.body.due).trim() || undefined;
    }
    if (req.body?.researchId != null) {
      patch.researchId = String(req.body.researchId).trim() || undefined;
    }
    if (req.body?.step != null) {
      patch.step = String(req.body.step).trim() || undefined;
    }
    if (req.body?.note != null) {
      patch.note = String(req.body.note).trim() || undefined;
    }
    if (req.body?.category != null) {
      const c = String(req.body.category).trim();
      if (c && !isTaskCategory(c)) return res.status(400).json({ error: "invalid category" });
      patch.category = c ? (c as AgentTask["category"]) : undefined;
    }
    if (req.body?.priority != null) {
      if (req.body.priority === "") {
        patch.priority = undefined;
      } else if (!isPriority(req.body.priority)) {
        return res.status(400).json({ error: "invalid priority" });
      } else {
        patch.priority = req.body.priority;
      }
    }
    if (req.body?.origin != null) {
      const o = String(req.body.origin).trim();
      patch.origin =
        o === "todo" || o === "research" || o === "cron" || o === "board" || o === "api"
          ? o
          : undefined;
    }
    const prev = getTask(req.params.id);
    const task = patchTask(req.params.id, patch);
    if (!task) return res.status(404).json({ error: "not found" });

    let kickoff: ReturnType<typeof kickoffAssignedTodo> | undefined;
    const startWork = req.body?.startWork !== false;
    if (startWork && shouldKickoffAssignee(task.agentId)) {
      const agentChanged = Boolean(patch.agentId && patch.agentId !== prev?.agentId);
      const statusChanged = patch.status != null && patch.status !== prev?.status;
      if (agentChanged) {
        kickoff = kickoffAssignedTodo(task, { event: "assigned" });
      } else if (statusChanged) {
        const st = String(task.status);
        if (st === "blocked") {
          kickoff = kickoffAssignedTodo(task, { event: "blocked" });
        } else if (st === "completed" || st === "done") {
          kickoff = kickoffAssignedTodo(task, { event: "completed" });
        }
      }
    }

    res.json({ task, kickoff });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const ok = deleteTask(req.params.id);
    if (!ok) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  });
}
