import { findProAgent } from "./proAgents.js";
import { pushAgentThreadMessages, pushChiefThreadMessages, pushProThreadMessages } from "./store.js";
import type { ChatMessage, ChatMessageSource } from "./types.js";
import { isChiefId } from "./withChief.js";

export type ThreadAppendEntry = {
  role: ChatMessage["role"];
  text: string;
  intentId?: string;
  source?: ChatMessageSource;
};

function id(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function proChatAuthorId(proId: string): string {
  return `pro-${proId.trim()}`;
}

function metaFromEntry(
  entry: ThreadAppendEntry,
  extra?: Partial<NonNullable<ChatMessage["meta"]>>
): ChatMessage["meta"] | undefined {
  const meta: NonNullable<ChatMessage["meta"]> = { ...(extra ?? {}) };
  const intentId = entry.intentId?.trim();
  if (intentId) meta.intentId = intentId;
  if (entry.source) meta.source = entry.source;
  return Object.keys(meta).length ? meta : undefined;
}

export function messageFromAppendEntry(
  entry: ThreadAppendEntry,
  extraMeta?: Partial<NonNullable<ChatMessage["meta"]>>
): ChatMessage | null {
  const text = entry.text.trim();
  if (!text) return null;
  return {
    id: id(),
    role: entry.role,
    text,
    at: new Date().toISOString(),
    meta: metaFromEntry(entry, extraMeta),
  };
}

function normalizeEntries(raw: unknown): ThreadAppendEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ThreadAppendEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const r = row as Partial<ThreadAppendEntry>;
    const role = r.role;
    if (role !== "user" && role !== "chief" && role !== "agent" && role !== "system" && role !== "handoff") {
      return null;
    }
    const text = typeof r.text === "string" ? r.text : "";
    if (!text.trim()) return null;
    const intentId = typeof r.intentId === "string" ? r.intentId.trim() : undefined;
    const source =
      r.source === "in-app" || r.source === "ams" || r.source === "llm" ? r.source : undefined;
    out.push({ role, text, intentId: intentId || undefined, source });
  }
  return out.length ? out : null;
}

export function parseThreadAppendBody(body: unknown): ThreadAppendEntry[] | null {
  if (body && typeof body === "object" && Array.isArray((body as { entries?: unknown }).entries)) {
    return normalizeEntries((body as { entries: unknown }).entries);
  }
  return normalizeEntries(body);
}

export function appendChiefThread(entries: ThreadAppendEntry[]): ChatMessage[] {
  const built: ChatMessage[] = [];
  for (const entry of entries) {
    if (entry.role === "agent") continue;
    const msg = messageFromAppendEntry(entry);
    if (msg) built.push(msg);
  }
  if (!built.length) return [];
  pushChiefThreadMessages(built);
  return built;
}

export function appendAgentThread(agentId: string, entries: ThreadAppendEntry[]): ChatMessage[] | null {
  const id = agentId.trim();
  if (!id || isChiefId(id)) return null;
  const built: ChatMessage[] = [];
  for (const entry of entries) {
    const role: ChatMessage["role"] = entry.role === "chief" ? "agent" : entry.role;
    if (role !== "user" && role !== "agent" && role !== "system" && role !== "handoff") continue;
    const extra =
      role === "agent" || role === "handoff" ? { agentId: id } : undefined;
    const msg = messageFromAppendEntry({ ...entry, role }, extra);
    if (msg) built.push(msg);
  }
  if (!built.length) return null;
  pushAgentThreadMessages(id, built);
  return built;
}

export function appendProThread(proId: string, entries: ThreadAppendEntry[]): ChatMessage[] | null {
  const id = proId.trim();
  if (!id || isChiefId(id) || !findProAgent(id)) return null;
  const authorId = proChatAuthorId(id);
  const built: ChatMessage[] = [];
  for (const entry of entries) {
    const role: ChatMessage["role"] = entry.role === "chief" ? "agent" : entry.role;
    if (role !== "user" && role !== "agent" && role !== "system" && role !== "handoff") continue;
    const msg = messageFromAppendEntry({ ...entry, role }, { agentId: authorId });
    if (msg) built.push(msg);
  }
  if (!built.length) return null;
  pushProThreadMessages(id, built);
  return built;
}
