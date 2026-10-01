/**
 * Thin control-plane store interface. FileStore is the default; Postgres lives in
 * `@asi-agents/postgres-store` and is only constructed when the optional flag is on
 * and a real connection string is available — never a fake DB.
 */
import {
  createTask,
  listCronRoutines,
  listTasks,
  loadState,
  patchTask,
  saveState,
} from "./store.js";
import { createLesson, listLessons, normalizeLessons } from "./lessons.js";
import { getCompanyBriefing, normalizeCompanyBriefing } from "./companyBriefing.js";
import {
  getAgentTraining,
  getAgentTrainingMap,
  normalizeAgentTrainingMap,
} from "./agentTraining.js";
import type {
  AgentTask,
  AgentTrainingMap,
  CompanyBriefing,
  CronRoutine,
  Lesson,
  LessonSource,
  TaskStatus,
} from "./types.js";
import {
  dualWriteEnabled,
  isPostgresConnected,
  postgresDualWriteSink,
} from "./postgresPrefs.js";

export const CONTROL_PLANE_SNAPSHOT_VERSION = 1 as const;

/** Control-plane overlay snapshot — no secrets / provider keys / mail tokens. */
export interface ControlPlaneSnapshot {
  version: typeof CONTROL_PLANE_SNAPSHOT_VERSION;
  exportedAt: string;
  tasks: AgentTask[];
  lessons: Lesson[];
  agentTraining: AgentTrainingMap;
  cronRoutines: CronRoutine[];
  companyBriefing: CompanyBriefing | null;
}

export interface ControlPlaneStore {
  listTasks(): AgentTask[];
  createTask(input: {
    title: string;
    agentId: string;
    status?: TaskStatus;
    due?: string;
    researchId?: string;
    step?: string;
    note?: string;
  }): AgentTask;
  patchTask(
    id: string,
    patch: Partial<Pick<AgentTask, "title" | "agentId" | "status" | "due" | "researchId" | "step" | "note">>
  ): AgentTask | null;
  listLessons(): Lesson[];
  createLesson(input: {
    title: string;
    body: string;
    source?: LessonSource;
    agentIds?: string[];
  }): Lesson | { error: string };
  getAgentTraining(agentId: string): ReturnType<typeof getAgentTraining>;
  listCronRoutines(): CronRoutine[];
  exportSnapshot(): ControlPlaneSnapshot;
  importSnapshot(snap: ControlPlaneSnapshot): ControlPlaneSnapshot;
}

function migrateTasks(tasks: unknown): AgentTask[] {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .map((raw) => {
      const t = raw as Record<string, unknown>;
      const legacy = typeof t.status === "string" ? t.status : "";
      let status: TaskStatus = "pending";
      if (legacy === "open" || legacy === "pending") status = "pending";
      else if (legacy === "in_progress" || legacy === "ongoing") status = "ongoing";
      else if (legacy === "done" || legacy === "completed") status = "completed";
      else if (legacy === "blocked") status = "blocked";
      return {
        id: typeof t.id === "string" ? t.id : "",
        title: typeof t.title === "string" ? t.title : "",
        agentId: typeof t.agentId === "string" ? t.agentId : "chief",
        status,
        ...(typeof t.due === "string" ? { due: t.due } : {}),
        ...(typeof t.researchId === "string" ? { researchId: t.researchId } : {}),
        ...(typeof t.step === "string" ? { step: t.step } : {}),
        ...(typeof t.note === "string" ? { note: t.note } : {}),
        ...(Array.isArray(t.comments) ? { comments: t.comments as AgentTask["comments"] } : {}),
      };
    })
    .filter((t) => t.id && t.title);
}

export function normalizeControlPlaneSnapshot(raw: unknown): ControlPlaneSnapshot | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Snapshot must be a JSON object." };
  const o = raw as Partial<ControlPlaneSnapshot>;
  const version = o.version === CONTROL_PLANE_SNAPSHOT_VERSION ? o.version : CONTROL_PLANE_SNAPSHOT_VERSION;
  return {
    version,
    exportedAt:
      typeof o.exportedAt === "string" && o.exportedAt.trim()
        ? o.exportedAt.trim()
        : new Date().toISOString(),
    tasks: migrateTasks(o.tasks),
    lessons: normalizeLessons(o.lessons),
    agentTraining: normalizeAgentTrainingMap(o.agentTraining),
    cronRoutines: Array.isArray(o.cronRoutines) ? (o.cronRoutines as CronRoutine[]) : [],
    companyBriefing: normalizeCompanyBriefing(o.companyBriefing),
  };
}

/** Default file-backed control plane (`app-state.json`). */
export class FileStore implements ControlPlaneStore {
  listTasks(): AgentTask[] {
    return listTasks();
  }

  createTask(input: {
    title: string;
    agentId: string;
    status?: TaskStatus;
    due?: string;
    researchId?: string;
    step?: string;
    note?: string;
  }): AgentTask {
    return createTask(input);
  }

  patchTask(
    id: string,
    patch: Partial<Pick<AgentTask, "title" | "agentId" | "status" | "due" | "researchId" | "step" | "note">>
  ): AgentTask | null {
    return patchTask(id, patch);
  }

  listLessons(): Lesson[] {
    return listLessons();
  }

  createLesson(input: {
    title: string;
    body: string;
    source?: LessonSource;
    agentIds?: string[];
  }): Lesson | { error: string } {
    return createLesson(input);
  }

  getAgentTraining(agentId: string) {
    return getAgentTraining(agentId);
  }

  listCronRoutines(): CronRoutine[] {
    return listCronRoutines();
  }

  exportSnapshot(): ControlPlaneSnapshot {
    return {
      version: CONTROL_PLANE_SNAPSHOT_VERSION,
      exportedAt: new Date().toISOString(),
      tasks: listTasks(),
      lessons: listLessons(),
      agentTraining: getAgentTrainingMap(),
      cronRoutines: listCronRoutines(),
      companyBriefing: getCompanyBriefing(),
    };
  }

  importSnapshot(raw: ControlPlaneSnapshot): ControlPlaneSnapshot {
    const snap = normalizeControlPlaneSnapshot(raw);
    if ("error" in snap) throw new Error(snap.error);
    const state = loadState();
    state.tasks = snap.tasks;
    state.lessons = snap.lessons;
    state.agentTraining = snap.agentTraining;
    state.cronRoutines = snap.cronRoutines;
    if (snap.companyBriefing) state.companyBriefing = snap.companyBriefing;
    else delete state.companyBriefing;
    saveState(state);
    return this.exportSnapshot();
  }
}

/**
 * Files remain primary. When dual-write is on, mirror export-shaped writes to the
 * postgres module sink (log / no-op until a real driver is wired).
 */
export class DualWriteFileStore implements ControlPlaneStore {
  constructor(private readonly primary: FileStore = new FileStore()) {}

  private mirror(op: string, detail?: unknown): void {
    if (!dualWriteEnabled()) return;
    postgresDualWriteSink(op, detail);
  }

  listTasks(): AgentTask[] {
    return this.primary.listTasks();
  }

  createTask(input: {
    title: string;
    agentId: string;
    status?: TaskStatus;
    due?: string;
    researchId?: string;
    step?: string;
    note?: string;
  }): AgentTask {
    const task = this.primary.createTask(input);
    this.mirror("createTask", { id: task.id });
    return task;
  }

  patchTask(
    id: string,
    patch: Partial<Pick<AgentTask, "title" | "agentId" | "status" | "due" | "researchId" | "step" | "note">>
  ): AgentTask | null {
    const task = this.primary.patchTask(id, patch);
    if (task) this.mirror("patchTask", { id });
    return task;
  }

  listLessons(): Lesson[] {
    return this.primary.listLessons();
  }

  createLesson(input: {
    title: string;
    body: string;
    source?: LessonSource;
    agentIds?: string[];
  }): Lesson | { error: string } {
    const result = this.primary.createLesson(input);
    if (!("error" in result)) this.mirror("createLesson", { id: result.id });
    return result;
  }

  getAgentTraining(agentId: string) {
    return this.primary.getAgentTraining(agentId);
  }

  listCronRoutines(): CronRoutine[] {
    return this.primary.listCronRoutines();
  }

  exportSnapshot(): ControlPlaneSnapshot {
    return this.primary.exportSnapshot();
  }

  importSnapshot(snap: ControlPlaneSnapshot): ControlPlaneSnapshot {
    const next = this.primary.importSnapshot(snap);
    this.mirror("importSnapshot", {
      tasks: next.tasks.length,
      lessons: next.lessons.length,
      cron: next.cronRoutines.length,
    });
    return next;
  }
}

let activeStore: ControlPlaneStore = new DualWriteFileStore();

/** Active control-plane store. Always FileStore-backed until Postgres is really connected. */
export function getControlPlaneStore(): ControlPlaneStore {
  // Prefer files even when the Use Postgres flag is on but no connection exists.
  if (!isPostgresConnected()) {
    activeStore = new DualWriteFileStore();
    return activeStore;
  }
  // Connected path still files-primary in MVP; dual-write sink may copy later.
  activeStore = new DualWriteFileStore();
  return activeStore;
}

export function exportControlPlaneSnapshot(): ControlPlaneSnapshot {
  return getControlPlaneStore().exportSnapshot();
}

export function importControlPlaneSnapshot(raw: unknown): ControlPlaneSnapshot | { error: string } {
  const snap = normalizeControlPlaneSnapshot(raw);
  if ("error" in snap) return snap;
  try {
    return getControlPlaneStore().importSnapshot(snap);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Import failed." };
  }
}
