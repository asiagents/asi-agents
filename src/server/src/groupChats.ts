import { loadDefaultBoardIds, normalizeBoardIds } from "./boards.js";
import { CUSTOM_SET_ID, proSetMemberIds } from "./proSets.js";
import { loadState, saveState } from "./store.js";
import type {
  GroupMessage,
  GroupProposal,
  GroupProposalDecision,
  GroupSessionState,
  NamedGroupChat,
  ProfileHomeMode,
} from "./types.js";
import {
  CHIEF_ID,
  isChiefId,
  isUserModerator,
  USER_MODERATOR_ID,
  withChiefIds,
} from "./withChief.js";

export type CouncilDeskMode = ProfileHomeMode;

export type CouncilModeRoster = {
  memberIds: string[];
  observerIds: string[];
};

/** Normalize moderator: `"user"` or a voting member; default Chief. */
export function normalizeModeratorId(
  raw: unknown,
  memberIds: string[]
): string {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (isUserModerator(id)) return USER_MODERATOR_ID;
  if (id && memberIds.includes(id)) return id;
  if (memberIds.includes(CHIEF_ID)) return CHIEF_ID;
  return memberIds[0] ?? CHIEF_ID;
}

/** Cap debate length: 1–1440 minutes, or null (unlimited). */
export function normalizeMaxDurationMinutes(raw: unknown): number | null {
  if (raw == null || raw === "" || raw === false) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(1440, Math.max(1, Math.round(n)));
}

/** Observer ids: unique, no Chief, never overlapping voting members. */
export function normalizeObserverIds(
  raw: unknown,
  memberIds: string[]
): string[] {
  if (!Array.isArray(raw)) return [];
  const memberSet = new Set(memberIds);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const id = String(row ?? "").trim();
    if (!id || isChiefId(id) || memberSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function sessionExpiresAtIso(
  sessionStartedAt: string | null | undefined,
  maxDurationMinutes: number | null | undefined
): string | null {
  if (!sessionStartedAt || !maxDurationMinutes || maxDurationMinutes <= 0) return null;
  const start = Date.parse(sessionStartedAt);
  if (!Number.isFinite(start)) return null;
  return new Date(start + maxDurationMinutes * 60_000).toISOString();
}

export function isGroupSessionExpired(group: NamedGroupChat): boolean {
  if (group.session !== "open") return false;
  const expires = sessionExpiresAtIso(group.sessionStartedAt, group.maxDurationMinutes ?? null);
  if (!expires) return false;
  return Date.now() >= Date.parse(expires);
}

function emptyProposal(): GroupProposal {
  return {
    title: "",
    by: "chief",
    model: "micro",
    points: [],
    note: "",
  };
}

function slugifyName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "group";
}

function newGroupId(name: string): string {
  return `g-${slugifyName(name)}-${Date.now().toString(36).slice(-6)}`;
}

function normalizeProposalDecision(raw: unknown): GroupProposalDecision {
  if (raw === "approved" || raw === "rejected") return raw;
  return "open";
}

function normalizeProposal(raw: unknown): GroupProposal {
  const base = emptyProposal();
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Partial<GroupProposal>;
  return {
    title: typeof p.title === "string" && p.title.trim() ? p.title.trim() : base.title,
    by: typeof p.by === "string" && p.by.trim() ? p.by.trim() : base.by,
    model: typeof p.model === "string" && p.model.trim() ? p.model.trim() : base.model,
    points: Array.isArray(p.points)
      ? p.points.map((x) => String(x).trim()).filter(Boolean)
      : base.points,
    note: typeof p.note === "string" ? p.note : base.note,
  };
}

function normalizeMessages(raw: unknown): GroupMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: GroupMessage[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const m = row as Partial<GroupMessage>;
    const id = typeof m.id === "string" && m.id.trim() ? m.id.trim() : "";
    const who = typeof m.who === "string" && m.who.trim() ? m.who.trim() : "";
    const text = typeof m.text === "string" ? m.text : "";
    const at = typeof m.at === "string" && m.at.trim() ? m.at.trim() : new Date().toISOString();
    if (!id || !who) continue;
    const meta =
      m.meta && typeof m.meta === "object" ? (m.meta as GroupMessage["meta"]) : undefined;
    out.push({
      id,
      who,
      text,
      at,
      decide: m.decide === true ? true : undefined,
      final: m.final === true ? true : undefined,
      meta,
    });
  }
  return out;
}

export function normalizeNamedGroup(raw: unknown, fallbackMembers?: string[]): NamedGroupChat | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<NamedGroupChat>;
  const id = typeof g.id === "string" && g.id.trim() ? g.id.trim() : "";
  const name = typeof g.name === "string" && g.name.trim() ? g.name.trim() : "";
  if (!id || !name) return null;
  const session: GroupSessionState = g.session === "closed" ? "closed" : "open";
  const memberIds = normalizeBoardIds(g.memberIds, fallbackMembers ?? loadDefaultBoardIds());
  const observerIds = normalizeObserverIds(g.observerIds, memberIds);
  const maxDurationMinutes = normalizeMaxDurationMinutes(g.maxDurationMinutes);
  const startedRaw =
    typeof g.sessionStartedAt === "string" && g.sessionStartedAt.trim()
      ? g.sessionStartedAt.trim()
      : null;
  const sessionStartedAt =
    session === "open" && startedRaw && Number.isFinite(Date.parse(startedRaw))
      ? startedRaw
      : null;
  const topic =
    typeof g.topic === "string" ? g.topic.trim().slice(0, 500) : undefined;
  return {
    id,
    name,
    topic: topic || undefined,
    memberIds,
    observerIds,
    messages: normalizeMessages(g.messages),
    session,
    proposal: normalizeProposal(g.proposal),
    proposalDecision: normalizeProposalDecision(g.proposalDecision),
    moderatorId: normalizeModeratorId(g.moderatorId, memberIds),
    maxDurationMinutes,
    sessionStartedAt,
  };
}

/** Sync legacy single-group fields from the active named group (backward compat). */
function syncLegacyFromActive(state: ReturnType<typeof loadState>, active: NamedGroupChat): void {
  state.activeGroupId = active.id;
  state.groupMessages = active.messages;
  state.groupSession = active.session;
  state.groupProposal = active.proposal;
  state.groupProposalDecision = active.proposalDecision;
  state.boardIds = active.memberIds;
}

function migrateLegacyIfNeeded(): NamedGroupChat[] {
  const state = loadState();
  const existing = Array.isArray(state.groupChats)
    ? state.groupChats.map((g) => normalizeNamedGroup(g)).filter((g): g is NamedGroupChat => !!g)
    : [];
  if (existing.length > 0) {
    if (
      !Array.isArray(state.groupChats) ||
      state.groupChats.length !== existing.length ||
      typeof state.activeGroupId !== "string"
    ) {
      state.groupChats = existing;
      const activeId = typeof state.activeGroupId === "string" ? state.activeGroupId.trim() : "";
      const active = existing.find((g) => g.id === activeId) ?? existing[0]!;
      syncLegacyFromActive(state, active);
      saveState(state);
    }
    return existing;
  }

  const members = normalizeBoardIds(state.boardIds, loadDefaultBoardIds());
  const migratedSession: GroupSessionState =
    state.groupSession === "closed" ? "closed" : "open";
  const migrated: NamedGroupChat = {
    id: "g-council-default",
    name: "Group council",
    memberIds: members,
    observerIds: [],
    messages: normalizeMessages(state.groupMessages),
    session: migratedSession,
    proposal: normalizeProposal(state.groupProposal),
    proposalDecision: normalizeProposalDecision(state.groupProposalDecision),
    moderatorId: normalizeModeratorId(undefined, members),
    maxDurationMinutes: null,
    sessionStartedAt: migratedSession === "open" ? new Date().toISOString() : null,
  };
  state.groupChats = [migrated];
  syncLegacyFromActive(state, migrated);
  saveState(state);
  return [migrated];
}

export function listGroupChats(): NamedGroupChat[] {
  return migrateLegacyIfNeeded();
}

export function getActiveGroupId(): string {
  const groups = listGroupChats();
  const state = loadState();
  const activeId = typeof state.activeGroupId === "string" ? state.activeGroupId.trim() : "";
  if (activeId && groups.some((g) => g.id === activeId)) return activeId;
  return groups[0]!.id;
}

export function getNamedGroup(id: string): NamedGroupChat | null {
  const trimmed = id.trim();
  if (!trimmed) return null;
  return listGroupChats().find((g) => g.id === trimmed) ?? null;
}

export function setActiveGroupId(id: string): NamedGroupChat | null {
  const group = getNamedGroup(id);
  if (!group) return null;
  const state = loadState();
  const groups = listGroupChats();
  const idx = groups.findIndex((g) => g.id === group.id);
  if (idx < 0) return null;
  syncLegacyFromActive(state, groups[idx]!);
  state.groupChats = groups;
  saveState(state);
  return groups[idx]!;
}

export type GroupChatSummary = {
  id: string;
  name: string;
  topic?: string;
  memberIds: string[];
  session: GroupSessionState;
  messageCount: number;
  proposalDecision: GroupProposalDecision;
  moderatorId: string;
};

export function listGroupSummaries(): { groups: GroupChatSummary[]; activeGroupId: string } {
  const groups = listGroupChats();
  const activeGroupId = getActiveGroupId();
  return {
    activeGroupId,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      topic: g.topic,
      memberIds: g.memberIds,
      observerIds: g.observerIds ?? [],
      session: g.session,
      messageCount: g.messages.length,
      proposalDecision: g.proposalDecision,
      moderatorId: g.moderatorId,
      maxDurationMinutes: g.maxDurationMinutes ?? null,
    })),
  };
}

function writeGroups(groups: NamedGroupChat[], activeId?: string): NamedGroupChat[] {
  const state = loadState();
  state.groupChats = groups;
  const active =
    (activeId ? groups.find((g) => g.id === activeId) : undefined) ??
    groups.find((g) => g.id === state.activeGroupId) ??
    groups[0];
  if (active) syncLegacyFromActive(state, active);
  else {
    state.activeGroupId = undefined;
    state.groupMessages = [];
  }
  saveState(state);
  return groups;
}

export function createGroupChat(input: {
  name: string;
  memberIds?: string[];
  activate?: boolean;
}): NamedGroupChat {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("name required");
  const groups = listGroupChats();
  const memberIds = normalizeBoardIds(
    input.memberIds?.length ? input.memberIds : loadDefaultBoardIds(),
    loadDefaultBoardIds()
  );
  const created: NamedGroupChat = {
    id: newGroupId(name),
    name,
    topic: undefined,
    memberIds,
    observerIds: [],
    messages: [],
    session: "open",
    proposal: emptyProposal(),
    proposalDecision: "open",
    moderatorId: normalizeModeratorId(undefined, memberIds),
    maxDurationMinutes: null,
    sessionStartedAt: new Date().toISOString(),
  };
  const next = [...groups, created];
  writeGroups(next, input.activate === false ? undefined : created.id);
  return created;
}

export function patchGroupChat(
  id: string,
  patch: {
    name?: string;
    topic?: string | null;
    session?: GroupSessionState;
    moderatorId?: string;
    maxDurationMinutes?: number | null;
    observerIds?: string[];
  }
): NamedGroupChat | null {
  const groups = listGroupChats();
  const idx = groups.findIndex((g) => g.id === id.trim());
  if (idx < 0) return null;
  const current = groups[idx]!;
  const nextSession =
    patch.session === "open" || patch.session === "closed" ? patch.session : current.session;
  const next: NamedGroupChat = {
    ...current,
    name:
      patch.name != null && String(patch.name).trim()
        ? String(patch.name).trim()
        : current.name,
    session: nextSession,
    moderatorId:
      patch.moderatorId != null
        ? normalizeModeratorId(patch.moderatorId, current.memberIds)
        : current.moderatorId,
    maxDurationMinutes:
      patch.maxDurationMinutes !== undefined
        ? normalizeMaxDurationMinutes(patch.maxDurationMinutes)
        : current.maxDurationMinutes ?? null,
    observerIds:
      patch.observerIds !== undefined
        ? normalizeObserverIds(patch.observerIds, current.memberIds)
        : current.observerIds ?? [],
  };
  if (patch.topic !== undefined) {
    const t = patch.topic == null ? "" : String(patch.topic).trim().slice(0, 500);
    next.topic = t || undefined;
  }
  if (patch.session === "open") {
    next.proposalDecision = "open";
    // Fresh open (was closed) resets the debate timer.
    if (current.session !== "open") {
      next.sessionStartedAt = new Date().toISOString();
    } else if (!next.sessionStartedAt) {
      next.sessionStartedAt = new Date().toISOString();
    }
  } else if (patch.session === "closed") {
    next.sessionStartedAt = null;
  }
  // Setting a max duration on an open session without a start clock → start now.
  if (
    next.session === "open" &&
    next.maxDurationMinutes != null &&
    next.maxDurationMinutes > 0 &&
    !next.sessionStartedAt
  ) {
    next.sessionStartedAt = new Date().toISOString();
  }
  const updated = [...groups];
  updated[idx] = next;
  writeGroups(updated);
  return next;
}

/** Clear group messages; keep members, topic, session, proposal. Returns null if unknown group. */
export function clearGroupMessages(id: string): GroupMessage[] | null {
  const groups = listGroupChats();
  const idx = groups.findIndex((g) => g.id === id.trim());
  if (idx < 0) return null;
  const current = groups[idx]!;
  const updated = [...groups];
  updated[idx] = { ...current, messages: [] };
  writeGroups(updated);
  return [];
}

/** Append restored messages onto an existing group (recycle-bin restore). */
export function restoreGroupMessages(id: string, messages: GroupMessage[]): GroupMessage[] | null {
  const groups = listGroupChats();
  const idx = groups.findIndex((g) => g.id === id.trim());
  if (idx < 0) return null;
  const current = groups[idx]!;
  const nextMessages = [...(current.messages ?? []), ...messages];
  const updated = [...groups];
  updated[idx] = { ...current, messages: nextMessages };
  writeGroups(updated);
  return nextMessages;
}

export function deleteGroupChat(id: string): boolean {
  const trimmed = id.trim();
  if (!trimmed) return false;
  const groups = listGroupChats();
  if (groups.length <= 1) return false; // keep at least one group
  const next = groups.filter((g) => g.id !== trimmed);
  if (next.length === groups.length) return false;
  writeGroups(next, next[0]?.id);
  return true;
}

export function setGroupMembers(id: string, memberIds: string[]): NamedGroupChat | null {
  const groups = listGroupChats();
  const idx = groups.findIndex((g) => g.id === id.trim());
  if (idx < 0) return null;
  const ids = normalizeBoardIds(memberIds);
  if (ids.length === 0) return null;
  const current = groups[idx]!;
  const updated = [...groups];
  updated[idx] = {
    ...current,
    memberIds: ids,
    // Promote from observers when added as voting members.
    observerIds: normalizeObserverIds(current.observerIds, ids),
    // Drop agent moderator when removed from roster; user moderator stays.
    moderatorId: normalizeModeratorId(current.moderatorId, ids),
  };
  writeGroups(updated);
  return updated[idx]!;
}

export function addGroupMember(id: string, agentId: string): NamedGroupChat | null {
  const group = getNamedGroup(id);
  if (!group) return null;
  const aid = String(agentId ?? "").trim();
  if (!aid) return null;
  if (group.memberIds.includes(aid)) return group;
  return setGroupMembers(id, [...group.memberIds, aid]);
}

export function removeGroupMember(id: string, agentId: string): NamedGroupChat | null {
  const group = getNamedGroup(id);
  if (!group) return null;
  const aid = String(agentId ?? "").trim();
  if (!aid || isChiefId(aid)) return null; // Chief cannot be removed
  if (!group.memberIds.includes(aid)) return group;
  return setGroupMembers(
    id,
    group.memberIds.filter((x) => x !== aid)
  );
}

export function setGroupObservers(id: string, observerIds: string[]): NamedGroupChat | null {
  const groups = listGroupChats();
  const idx = groups.findIndex((g) => g.id === id.trim());
  if (idx < 0) return null;
  const current = groups[idx]!;
  const updated = [...groups];
  updated[idx] = {
    ...current,
    observerIds: normalizeObserverIds(observerIds, current.memberIds),
  };
  writeGroups(updated);
  return updated[idx]!;
}

export function addGroupObserver(id: string, agentId: string): NamedGroupChat | null {
  const group = getNamedGroup(id);
  if (!group) return null;
  const aid = String(agentId ?? "").trim();
  if (!aid || isChiefId(aid)) return null;
  if (group.memberIds.includes(aid)) return group; // already voting
  const currentObs = group.observerIds ?? [];
  if (currentObs.includes(aid)) return group;
  return setGroupObservers(id, [...currentObs, aid]);
}

export function removeGroupObserver(id: string, agentId: string): NamedGroupChat | null {
  const group = getNamedGroup(id);
  if (!group) return null;
  const aid = String(agentId ?? "").trim();
  if (!aid) return null;
  const currentObs = group.observerIds ?? [];
  if (!currentObs.includes(aid)) return group;
  return setGroupObservers(
    id,
    currentObs.filter((x) => x !== aid)
  );
}

export function getGroupMessages(id: string): GroupMessage[] | null {
  const group = getNamedGroup(id);
  if (!group) return null;
  return group.messages;
}

export function appendNamedGroupMessage(
  id: string,
  input: {
    who: string;
    text: string;
    at?: string;
    decide?: boolean;
    final?: boolean;
    meta?: GroupMessage["meta"];
  }
): GroupMessage | null {
  const groups = listGroupChats();
  const idx = groups.findIndex((g) => g.id === id.trim());
  if (idx < 0) return null;
  const message: GroupMessage = {
    id: `gm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    who: input.who,
    text: input.text,
    at: input.at ?? new Date().toISOString(),
    decide: input.decide,
    final: input.final === true ? true : undefined,
    meta: input.meta,
  };
  const current = groups[idx]!;
  const updated = [...groups];
  updated[idx] = { ...current, messages: [...current.messages, message] };
  writeGroups(updated);
  return message;
}

export function setNamedGroupProposalDecision(
  id: string,
  decision: GroupProposalDecision
): GroupProposalDecision | null {
  const groups = listGroupChats();
  const idx = groups.findIndex((g) => g.id === id.trim());
  if (idx < 0) return null;
  const updated = [...groups];
  updated[idx] = {
    ...groups[idx]!,
    proposalDecision: normalizeProposalDecision(decision),
  };
  writeGroups(updated);
  return updated[idx]!.proposalDecision;
}

export function groupSessionSnapshot(group: NamedGroupChat): {
  id: string;
  name: string;
  topic?: string;
  session: GroupSessionState;
  memberIds: string[];
  observerIds: string[];
  boardIds: string[];
  councilIds: string[];
  defaultBoardIds: string[];
  proposal: GroupProposal;
  proposalDecision: GroupProposalDecision;
  moderatorId: string;
  maxDurationMinutes: number | null;
  sessionStartedAt: string | null;
  sessionExpiresAt: string | null;
  sessionExpired: boolean;
} {
  const defaultBoardIds = loadDefaultBoardIds();
  const observerIds = normalizeObserverIds(group.observerIds, group.memberIds);
  const maxDurationMinutes = normalizeMaxDurationMinutes(group.maxDurationMinutes);
  const sessionStartedAt =
    group.session === "open" &&
    typeof group.sessionStartedAt === "string" &&
    group.sessionStartedAt.trim() &&
    Number.isFinite(Date.parse(group.sessionStartedAt))
      ? group.sessionStartedAt.trim()
      : null;
  const expiresAt = sessionExpiresAtIso(sessionStartedAt, maxDurationMinutes);
  return {
    id: group.id,
    name: group.name,
    topic: group.topic,
    session: group.session,
    memberIds: group.memberIds,
    observerIds,
    boardIds: group.memberIds,
    councilIds: group.memberIds,
    defaultBoardIds,
    proposal: group.proposal,
    proposalDecision: group.proposalDecision,
    moderatorId: normalizeModeratorId(group.moderatorId, group.memberIds),
    maxDurationMinutes,
    sessionStartedAt,
    sessionExpiresAt: expiresAt,
    sessionExpired: isGroupSessionExpired(group),
  };
}

/** Chat sidebar roster (1:1 threads). Chief is never listed here — UI always shows Chief. */
export function getChatRosterIds(): string[] {
  const state = loadState();
  const raw = state.chatRosterIds;
  if (!Array.isArray(raw)) return []; // empty sentinel → UI treats as "all"
  return withChiefIds(raw.map(String).filter(Boolean)).filter((id) => !isChiefId(id));
}

export function setChatRosterIds(ids: string[]): string[] {
  const state = loadState();
  const cleaned = withChiefIds(ids.map(String).filter(Boolean)).filter((id) => !isChiefId(id));
  state.chatRosterIds = cleaned;
  saveState(state);
  return cleaned;
}

export function addChatRosterMember(agentId: string): string[] {
  const aid = String(agentId ?? "").trim();
  if (!aid || isChiefId(aid)) return getChatRosterIds();
  const current = getChatRosterIds();
  // If roster was "all" (undefined), we need to materialize — caller should pass full list first.
  // When chatRosterIds is undefined, getChatRosterIds returns []. Treat undefined specially:
  const state = loadState();
  if (!Array.isArray(state.chatRosterIds)) {
    // First explicit add while "all": keep all semantics by not switching to filtered mode
    // unless we materialize. Prefer: start filtered with just this agent + require caller to init.
    return setChatRosterIds([aid]);
  }
  if (current.includes(aid)) return current;
  return setChatRosterIds([...current, aid]);
}

export function removeChatRosterMember(agentId: string): string[] | null {
  const aid = String(agentId ?? "").trim();
  if (!aid || isChiefId(aid)) return null;
  const state = loadState();
  if (!Array.isArray(state.chatRosterIds)) {
    // Materialize from empty → cannot remove from "all" without knowing the full set.
    // Return null to signal client should PUT the full remaining list.
    return null;
  }
  return setChatRosterIds(state.chatRosterIds.filter((id) => id !== aid && !isChiefId(id)));
}

export function chatRosterIsFiltered(): boolean {
  return Array.isArray(loadState().chatRosterIds);
}

function normalizeCouncilDeskMode(raw: unknown): CouncilDeskMode | null {
  return raw === "super" || raw === "multi" || raw === "pro" ? raw : null;
}

function defaultRosterForMode(mode: "multi" | "pro"): CouncilModeRoster {
  if (mode === "multi") {
    return { memberIds: loadDefaultBoardIds(), observerIds: [] };
  }
  const state = loadState();
  const setId =
    typeof state.activeProSetId === "string" && state.activeProSetId.trim()
      ? state.activeProSetId.trim()
      : CUSTOM_SET_ID;
  const custom = Array.isArray(state.customProAgentIds) ? state.customProAgentIds : [];
  return {
    memberIds: withChiefIds(proSetMemberIds(setId, custom)),
    observerIds: [],
  };
}

function readSavedModeRoster(
  rosters: NonNullable<ReturnType<typeof loadState>["councilRostersByMode"]>,
  mode: "multi" | "pro"
): CouncilModeRoster | null {
  const saved = rosters?.[mode];
  if (!saved?.memberIds?.length) return null;
  const memberIds = normalizeBoardIds(saved.memberIds);
  return {
    memberIds,
    observerIds: normalizeObserverIds(saved.observerIds, memberIds),
  };
}

/**
 * Desk mode switch for Group council.
 * - Multi / Pro each keep their own seats (Chief always shared).
 * - Switching into Multi/Pro or between them starts a fresh council session
 *   (topic / proposal / votes / moderator reset; messages kept for read-back).
 * - Super stays read-only over the prior thread (UI gates controls).
 * Fail-closed: callers catch API errors offline; this never invents replies.
 *
 * `previousMode` is the desk mode before the switch (from the client). Needed when
 * `councilMode` is not stamped yet so the first real switch still swaps seats.
 */
export function switchCouncilMode(
  nextRaw: unknown,
  previousRaw?: unknown
): {
  switched: boolean;
  mode: CouncilDeskMode;
  group: ReturnType<typeof groupSessionSnapshot>;
} {
  const nextMode = normalizeCouncilDeskMode(nextRaw);
  const hintPrev = normalizeCouncilDeskMode(previousRaw);
  if (!nextMode) {
    const active = getNamedGroup(getActiveGroupId());
    const mode = normalizeCouncilDeskMode(loadState().councilMode) ?? hintPrev ?? "multi";
    return {
      switched: false,
      mode,
      group: active
        ? groupSessionSnapshot(active)
        : groupSessionSnapshot({
            id: "g-council-default",
            name: "Group council",
            memberIds: [CHIEF_ID],
            observerIds: [],
            messages: [],
            session: "open",
            proposal: emptyProposal(),
            proposalDecision: "open",
            moderatorId: CHIEF_ID,
            maxDurationMinutes: null,
            sessionStartedAt: null,
          }),
    };
  }

  // Ensure named groups exist before mutating.
  listGroupChats();
  const activeId = getActiveGroupId();
  const groups = listGroupChats();
  const idx = groups.findIndex((g) => g.id === activeId);
  const active = idx >= 0 ? groups[idx]! : groups[0];
  if (!active) {
    return {
      switched: false,
      mode: nextMode,
      group: groupSessionSnapshot({
        id: "g-council-default",
        name: "Group council",
        memberIds: [CHIEF_ID],
        observerIds: [],
        messages: [],
        session: "open",
        proposal: emptyProposal(),
        proposalDecision: "open",
        moderatorId: CHIEF_ID,
        maxDurationMinutes: null,
        sessionStartedAt: null,
      }),
    };
  }

  const state = loadState();
  const stamped = normalizeCouncilDeskMode(state.councilMode);
  const prevMode = stamped ?? hintPrev;
  const rosters: NonNullable<typeof state.councilRostersByMode> = {
    ...(state.councilRostersByMode ?? {}),
  };

  // Hydrate-only: no prior mode, or same mode — stamp, keep the meeting as-is.
  if (prevMode == null || prevMode === nextMode) {
    state.councilMode = nextMode;
    if ((nextMode === "multi" || nextMode === "pro") && !rosters[nextMode]?.memberIds?.length) {
      rosters[nextMode] = {
        memberIds: [...active.memberIds],
        observerIds: [...(active.observerIds ?? [])],
      };
      state.councilRostersByMode = rosters;
    }
    saveState(state);
    return { switched: false, mode: nextMode, group: groupSessionSnapshot(active) };
  }

  // Snapshot outgoing Multi/Pro seats before leaving that mode.
  if (prevMode === "multi" || prevMode === "pro") {
    rosters[prevMode] = {
      memberIds: [...active.memberIds],
      observerIds: [...(active.observerIds ?? [])],
    };
  }

  let next: NamedGroupChat = { ...active };
  const enteringTeam = nextMode === "multi" || nextMode === "pro";

  if (enteringTeam) {
    const saved = readSavedModeRoster(rosters, nextMode);
    const roster = saved ?? defaultRosterForMode(nextMode);
    next = {
      ...next,
      memberIds: roster.memberIds,
      observerIds: normalizeObserverIds(roster.observerIds, roster.memberIds),
      // Fresh council session — keep message history for read-back.
      topic: undefined,
      proposal: emptyProposal(),
      proposalDecision: "open",
      moderatorId: normalizeModeratorId(CHIEF_ID, roster.memberIds),
      session: "open",
      sessionStartedAt: new Date().toISOString(),
    };
    state.boardTopic = "";
    state.boardStances = {};
  }
  // Super: leave messages / roster / topic as-is so Work/Super can still read the prior thread.

  const updated = [...groups];
  const targetIdx = idx >= 0 ? idx : 0;
  updated[targetIdx] = next;
  state.councilMode = nextMode;
  state.councilRostersByMode = rosters;
  state.groupChats = updated;
  syncLegacyFromActive(state, next);
  saveState(state);

  return {
    switched: true,
    mode: nextMode,
    group: groupSessionSnapshot(next),
  };
}

export { CHIEF_ID, USER_MODERATOR_ID, isUserModerator, withChiefIds };
