import type { Express } from "express";
import { isValidCronExpression } from "./cronExpr.js";
import {
  createCronRoutine,
  createTask,
  deleteCronRoutine,
  listCronRoutines,
  markCronRoutineRan,
  patchCronRoutine,
} from "./store.js";

const TICK_MS = 30_000;
let timer: ReturnType<typeof setInterval> | null = null;

function fireDueRoutines(): void {
  const now = Date.now();
  for (const r of listCronRoutines()) {
    if (!r.enabled) continue;
    const due = r.nextRunAt ? Date.parse(r.nextRunAt) : 0;
    if (!Number.isFinite(due) || due > now) continue;
    const scheduleNote = r.cronExpr?.trim()
      ? `cron · ${r.cronExpr.trim()}`
      : `cron · every ${r.everyMinutes}m`;
    createTask({
      title: r.title,
      agentId: r.agentId,
      status: "pending",
      note: r.note ? `${scheduleNote} · ${r.note}` : scheduleNote,
    });
    markCronRoutineRan(r.id);
  }
}

/** Interval poller — creates tasks when routines are due (crontab or everyMinutes). */
export function startCronJob(): void {
  if (timer) return;
  fireDueRoutines();
  timer = setInterval(() => {
    try {
      fireDueRoutines();
    } catch (e) {
      console.warn("[cron]", e instanceof Error ? e.message : e);
    }
  }, TICK_MS);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}

export function mountCronRoutes(app: Express): void {
  app.get("/api/cron", (_req, res) => {
    res.json({
      routines: listCronRoutines(),
      shipped: true,
      engine: "crontab+interval",
      tickMs: TICK_MS,
      note: "5-field crontab when cronExpr set; otherwise everyMinutes fallback. Creates a pending task on fire.",
    });
  });

  app.post("/api/cron", (req, res) => {
    const title = String(req.body?.title ?? "").trim();
    const agentId = String(req.body?.agentId ?? "").trim();
    const cronExprRaw = req.body?.cronExpr != null ? String(req.body.cronExpr).trim() : "";
    const everyRaw = req.body?.everyMinutes;
    const everyMinutes =
      everyRaw != null && everyRaw !== ""
        ? Number(everyRaw)
        : cronExprRaw
          ? 60
          : Number(everyRaw ?? 60);
    const note = req.body?.note != null ? String(req.body.note).trim() : undefined;
    const enabled = req.body?.enabled !== false;
    if (!title) return res.status(400).json({ error: "title required" });
    if (!agentId) return res.status(400).json({ error: "agentId required" });
    if (cronExprRaw && !isValidCronExpression(cronExprRaw)) {
      return res.status(400).json({
        error: "invalid cronExpr",
        hint: "Use 5 fields: minute hour day-of-month month day-of-week (e.g. 0 9 * * 1-5)",
      });
    }
    if (!cronExprRaw && (!Number.isFinite(everyMinutes) || everyMinutes < 1)) {
      return res.status(400).json({ error: "everyMinutes must be >= 1 (or provide cronExpr)" });
    }
    try {
      const routine = createCronRoutine({
        title,
        agentId,
        everyMinutes: Number.isFinite(everyMinutes) && everyMinutes >= 1 ? everyMinutes : 60,
        cronExpr: cronExprRaw || undefined,
        enabled,
        note,
      });
      res.status(201).json({ routine });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "create failed" });
    }
  });

  app.patch("/api/cron/:id", (req, res) => {
    const patch: Parameters<typeof patchCronRoutine>[1] = {};
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
    if (req.body?.everyMinutes != null) {
      const everyMinutes = Number(req.body.everyMinutes);
      if (!Number.isFinite(everyMinutes) || everyMinutes < 1) {
        return res.status(400).json({ error: "everyMinutes must be >= 1" });
      }
      patch.everyMinutes = everyMinutes;
    }
    if ("cronExpr" in (req.body ?? {})) {
      const cronExpr = req.body.cronExpr == null || req.body.cronExpr === ""
        ? undefined
        : String(req.body.cronExpr).trim();
      if (cronExpr && !isValidCronExpression(cronExpr)) {
        return res.status(400).json({ error: "invalid cronExpr" });
      }
      patch.cronExpr = cronExpr;
    }
    if (req.body?.enabled != null) patch.enabled = Boolean(req.body.enabled);
    if (req.body?.note != null) patch.note = String(req.body.note).trim() || undefined;
    const routine = patchCronRoutine(req.params.id, patch);
    if (!routine) return res.status(404).json({ error: "not found" });
    res.json({ routine });
  });

  app.delete("/api/cron/:id", (req, res) => {
    const ok = deleteCronRoutine(req.params.id);
    if (!ok) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  });
}
