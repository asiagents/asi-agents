import { addRegistryAgent, loadAgents, removeRegistryAgent, type RegistryAgent } from "./agents.js";
import {
  clearGroupMessages,
  getNamedGroup,
  restoreGroupMessages,
} from "./groupChats.js";
import {
  clearAgentThreadMessages,
  clearChiefThreadMessages,
  clearProThreadMessages,
  getAgentThreadMessages,
  getProThreadMessages,
  loadState,
  pushAgentThreadMessages,
  pushChiefThreadMessages,
  pushProThreadMessages,
  saveState,
} from "./store.js";
import type {
  ChatMessage,
  GroupMessage,
  RecycleBinItem,
  RecycleLogEntry,
  RecycleThreadKey,
} from "./types.js";
import { isChiefId } from "./withChief.js";

export type { RecycleBinItem, RecycleLogEntry, RecycleThreadKey } from "./types.js";
export type { RecycleItemKind } from "./types.js";

export const RECYCLE_RETENTION_OPTIONS = [0, 1, 3, 7, 15, 30, 45, 90] as const;
export type RecycleRetentionDays = (typeof RECYCLE_RETENTION_OPTIONS)[number];

const DAY_MS = 86_400_000;
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

function newId(): string {
  return `rb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeRetentionDays(raw: unknown): RecycleRetentionDays {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : 90;
  return (RECYCLE_RETENTION_OPTIONS as readonly number[]).includes(n)
    ? (n as RecycleRetentionDays)
    : 90;
}

export function getRecycleRetentionDays(): RecycleRetentionDays {
  return normalizeRetentionDays(loadState().recycleRetentionDays);
}

export function setRecycleRetentionDays(days: unknown): RecycleRetentionDays {
  const next = normalizeRetentionDays(days);
  const state = loadState();
  state.recycleRetentionDays = next;
  saveState(state);
  purgeExpiredRecycleBin();
  return next;
}

function expiryFor(deletedAt: Date, retentionDays: RecycleRetentionDays): string | null {
  if (retentionDays <= 0) return null;
  return new Date(deletedAt.getTime() + retentionDays * DAY_MS).toISOString();
}

function readBin(): RecycleBinItem[] {
  const list = loadState().recycleBin;
  return Array.isArray(list) ? [...list] : [];
}

function writeBin(items: RecycleBinItem[]): void {
  const state = loadState();
  state.recycleBin = items;
  saveState(state);
}

/** Drop items past retention. Returns how many were purged. */
export function purgeExpiredRecycleBin(now = new Date()): number {
  const retention = getRecycleRetentionDays();
  const bin = readBin();
  if (!bin.length) return 0;
  const next = bin.filter((item) => {
    if (retention <= 0) return false;
    const exp = item.expiresAt ? Date.parse(item.expiresAt) : NaN;
    if (!Number.isFinite(exp)) {
      const deleted = Date.parse(item.deletedAt);
      if (!Number.isFinite(deleted)) return false;
      return now.getTime() - deleted < retention * DAY_MS;
    }
    return exp > now.getTime();
  });
  const removed = bin.length - next.length;
  if (removed > 0) writeBin(next);
  return removed;
}

/** Hard-empty the recycle bin. */
export function emptyRecycleBin(): number {
  const n = readBin().length;
  writeBin([]);
  return n;
}

export function listRecycleBin(): {
  items: RecycleBinItem[];
  retentionDays: RecycleRetentionDays;
  purged: number;
} {
  const purged = purgeExpiredRecycleBin();
  return { items: readBin(), retentionDays: getRecycleRetentionDays(), purged };
}

function pushItem(
  kind: RecycleBinItem["kind"],
  label: string,
  payload: RecycleBinItem["payload"]
): RecycleBinItem | null {
  const retention = getRecycleRetentionDays();
  if (retention <= 0) return null;
  const deletedAt = new Date();
  const item: RecycleBinItem = {
    id: newId(),
    kind,
    label,
    deletedAt: deletedAt.toISOString(),
    expiresAt: expiryFor(deletedAt, retention),
    payload,
  };
  writeBin([item, ...readBin()]);
  return item;
}

export function archiveClearedChat(
  threadKey: RecycleThreadKey,
  messages: ChatMessage[],
  label: string
): RecycleBinItem | null {
  if (!messages.length) return null;
  return pushItem("cleared_chat", label, { threadKey, messages: [...messages] });
}

export function archiveClearedGroup(
  groupId: string,
  groupName: string,
  messages: GroupMessage[]
): RecycleBinItem | null {
  if (!messages.length) return null;
  return pushItem("cleared_group", groupName || groupId, {
    groupId,
    groupName,
    groupMessages: [...messages],
  });
}

export function archiveDeletedAgent(
  agent: RegistryAgent,
  opts?: { thread?: ChatMessage[]; customPro?: boolean }
): RecycleBinItem | null {
  return pushItem("deleted_agent", agent.name || agent.id, {
    agent: { ...agent },
    agentThread: opts?.thread?.length ? [...opts.thread] : undefined,
    customPro: opts?.customPro === true,
  });
}

export function archiveDeletedLogs(entries: RecycleLogEntry[], label?: string): RecycleBinItem | null {
  if (!entries.length) return null;
  return pushItem(
    "deleted_log",
    label ?? `${entries.length} log entr${entries.length === 1 ? "y" : "ies"}`,
    { logEntries: entries.map((e) => ({ ...e })) }
  );
}

/** Soft-clear Chief thread: archive then wipe. */
export function softClearChiefThread(): ChatMessage[] {
  const state = loadState();
  const messages = Array.isArray(state.chiefThread) ? state.chiefThread : [];
  archiveClearedChat("chief", messages, "Chief chat");
  return clearChiefThreadMessages();
}

export function softClearAgentThread(agentId: string): ChatMessage[] | null {
  const id = agentId.trim();
  if (!id) return null;
  const messages = getAgentThreadMessages(id);
  const name = loadAgents().agents.find((a) => a.id === id)?.name ?? id;
  archiveClearedChat(`agent:${id}`, messages, `${name} chat`);
  return clearAgentThreadMessages(id);
}

export function softClearProThread(proId: string): ChatMessage[] | null {
  const id = proId.trim();
  if (!id) return null;
  const messages = getProThreadMessages(id);
  archiveClearedChat(`pro:${id}`, messages, `Pro ${id} chat`);
  return clearProThreadMessages(id);
}

export function softClearGroupMessages(groupId: string): GroupMessage[] | null {
  const id = groupId.trim();
  if (!id) return null;
  const group = getNamedGroup(id);
  if (!group) return null;
  archiveClearedGroup(id, group.name, group.messages ?? []);
  return clearGroupMessages(id);
}

/** Soft-delete a registry agent (not Chief). */
export function softDeleteRegistryAgent(
  agentId: string
): { item: RecycleBinItem | null } | { error: string } {
  const id = agentId.trim();
  if (!id) return { error: "agent id required" };
  if (isChiefId(id)) return { error: "Chief cannot be deleted" };
  const agents = loadAgents().agents;
  const agent = agents.find((a) => a.id === id && a.source === "registry");
  if (!agent) return { error: "unknown registry agent" };
  const thread = getAgentThreadMessages(id);
  const archived = archiveDeletedAgent(agent, { thread });
  const removed = removeRegistryAgent(id);
  if (!removed) return { error: "delete failed" };
  clearAgentThreadMessages(id);
  return { item: archived };
}

/** Soft-delete a custom Pro agent snapshot supplied by the client. */
export function softDeleteCustomProAgent(
  agent: RegistryAgent,
  thread?: ChatMessage[]
): RecycleBinItem | null {
  if (!agent?.id || isChiefId(agent.id)) return null;
  const archived = archiveDeletedAgent(agent, { thread, customPro: true });
  const state = loadState();
  state.customProAgentIds = (state.customProAgentIds ?? []).filter((x) => x !== agent.id);
  if (state.proThreads?.[agent.id]) {
    const map = { ...state.proThreads };
    delete map[agent.id];
    state.proThreads = map;
  }
  saveState(state);
  return archived;
}

export function restoreRecycleItem(
  id: string
): { ok: true; item: RecycleBinItem } | { error: string } {
  purgeExpiredRecycleBin();
  const bin = readBin();
  const idx = bin.findIndex((i) => i.id === id);
  if (idx < 0) return { error: "not found" };
  const item = bin[idx]!;

  try {
    switch (item.kind) {
      case "cleared_chat": {
        const key = item.payload.threadKey;
        const messages = item.payload.messages ?? [];
        if (!key) return { error: "missing thread key" };
        if (key === "chief") {
          pushChiefThreadMessages(messages);
        } else if (key.startsWith("agent:")) {
          pushAgentThreadMessages(key.slice("agent:".length), messages);
        } else if (key.startsWith("pro:")) {
          pushProThreadMessages(key.slice("pro:".length), messages);
        } else {
          return { error: "unknown thread key" };
        }
        break;
      }
      case "cleared_group": {
        const groupId = item.payload.groupId?.trim();
        const messages = item.payload.groupMessages ?? [];
        if (!groupId) return { error: "missing group id" };
        if (!restoreGroupMessages(groupId, messages)) {
          return { error: "group no longer exists" };
        }
        break;
      }
      case "deleted_agent": {
        const agent = item.payload.agent;
        if (!agent?.id) return { error: "missing agent snapshot" };
        if (item.payload.customPro) {
          const state = loadState();
          const ids = new Set(state.customProAgentIds ?? []);
          ids.add(agent.id);
          state.customProAgentIds = [...ids];
          saveState(state);
        } else if (!addRegistryAgent(agent as RegistryAgent)) {
          return { error: "could not restore agent (id may already exist)" };
        }
        const thread = item.payload.agentThread ?? [];
        if (thread.length) {
          if (item.payload.customPro) pushProThreadMessages(agent.id, thread);
          else pushAgentThreadMessages(agent.id, thread);
        }
        break;
      }
      case "deleted_log":
        // Client rehydrates logEntries from the returned item.
        break;
      default:
        return { error: "unsupported item kind" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "restore failed";
    return { error: msg };
  }

  writeBin(bin.filter((i) => i.id !== id));
  return { ok: true, item };
}

export function permanentlyDeleteRecycleItem(id: string): boolean {
  const bin = readBin();
  const next = bin.filter((i) => i.id !== id);
  if (next.length === bin.length) return false;
  writeBin(next);
  return true;
}

let purgeTimer: ReturnType<typeof setInterval> | null = null;

/** Start hourly retention purge (idempotent). */
export function startRecycleBinPurgeJob(): void {
  purgeExpiredRecycleBin();
  if (purgeTimer) return;
  purgeTimer = setInterval(() => {
    try {
      purgeExpiredRecycleBin();
    } catch {
      /* ignore */
    }
  }, PURGE_INTERVAL_MS);
  if (typeof purgeTimer === "object" && purgeTimer && "unref" in purgeTimer) {
    (purgeTimer as NodeJS.Timeout).unref?.();
  }
}
