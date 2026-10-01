import fs from "node:fs";
import path from "node:path";
import { normalizeBoardStances, type BoardStancesMap } from "./board.js";
import { loadDefaultBoardIds, normalizeBoardIds } from "./boards.js";
import { isValidCronExpression, nextCronRunIso } from "./cronExpr.js";
import { dataDir, statePath } from "./paths.js";
import type {
  AgentApiKeyRecord,
  AgentApiKeyScope,
  AgentTask,
  AppState,
  CalendarConnector,
  CalendarPrefs,
  AdapterEntry,
  AdapterKind,
  CronRoutine,
  GoogleCalendarAuth,
  GoogleDriveAuth,
  MicrosoftGraphAuth,
  ChannelDraft,
  ChatMessage,
  GroupMessage,
  GroupProposal,
  GroupProposalDecision,
  GroupSessionState,
  MailConnection,
  MentionNotification,
  PermissionItem,
  ProfileHomeMode,
  ProfilePrefsSlice,
  ProviderSpendEvent,
  RoutingDecisionEvent,
  TaskAttachment,
  TaskComment,
  TaskStatus,
  CompanyBriefing,
  AgentTrainingMap,
  Lesson,
  LessonSource,
  UserPrefs,
  UserProfileId,
  PostgresModulePrefs,
  VoiceDictionaryEntry,
} from "./types.js";
import { normalizeCustomProAgentIds } from "./proSets.js";
import { PROVIDER_REGISTRY } from "./providers.registry.js";
import { BOSS_ID, isChiefId } from "./withChief.js";
import {
  DEFAULT_VOICE_DICTIONARY,
  normalizeVoiceDictionary,
} from "./voiceDictionary.js";

const STATE_FILE = "app-state.json";
const SPEND_LOG_CAP = 500;
const ROUTING_LOG_CAP = 100;
const MENTION_CAP = 200;
/** Max attachment bytes (5 MiB). */
export const TASK_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_API_KEY_SCOPES: AgentApiKeyScope[] = ["chat", "tasks:read"];
const ALLOWED_API_KEY_SCOPES = new Set<AgentApiKeyScope>(["chat", "tasks:read"]);

const DEFAULT_PERMISSIONS: PermissionItem[] = [];

const DEFAULT_DRAFTS: ChannelDraft[] = [];

export function defaultGroupProposal(): GroupProposal {
  return {
    title: "",
    by: "chief",
    model: "micro",
    points: [],
    note: "",
  };
}

function normalizeGroupProposalDecision(raw: unknown): GroupProposalDecision {
  if (raw === "approved" || raw === "rejected") return raw;
  return "open";
}

function normalizeGroupProposal(raw: unknown): GroupProposal {
  const base = defaultGroupProposal();
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

function defaultState(): AppState {
  return {
    chiefThread: [],
    chiefPrimary: "agentchat",
    chiefSecondary: "",
    permissions: [...DEFAULT_PERMISSIONS],
    channelDrafts: [...DEFAULT_DRAFTS],
    groupMessages: [] as GroupMessage[],
    groupSession: "open",
    groupProposal: defaultGroupProposal(),
    groupProposalDecision: "open",
    selectedModel: undefined,
    onboardingComplete: false,
    boardIds: loadDefaultBoardIds(),
    customProAgentIds: [],
    activeProSetId: "software",
    tasks: [],
    cronRoutines: [],
    adapters: [],
    agentApiKeys: {},
    mentionNotifications: [],
    providerSpendLog: [],
    routingDecisionLog: [],
    clarifyMissesByThread: {},
    calendar: defaultCalendarPrefs(),
    prefs: defaultUserPrefs(),
    providerEnabled: defaultProviderEnabled(),
    postgresPrefs: defaultPostgresModulePrefs(),
    voiceDictionary: DEFAULT_VOICE_DICTIONARY.map((e) => ({ ...e })),
    recycleBin: [],
    recycleRetentionDays: 90,
    lessons: [],
  };
}

export function defaultPostgresModulePrefs(): PostgresModulePrefs {
  return { usePostgres: false, dualWrite: false };
}

export function normalizePostgresModulePrefs(raw: unknown): PostgresModulePrefs {
  const base = defaultPostgresModulePrefs();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<PostgresModulePrefs>;
  const connectionString =
    typeof o.connectionString === "string" && o.connectionString.trim()
      ? o.connectionString.trim()
      : undefined;
  return {
    usePostgres: o.usePostgres === true,
    dualWrite: o.dualWrite === true,
    ...(connectionString ? { connectionString } : {}),
  };
}

const CALENDAR_CONNECTORS = new Set<CalendarConnector>(["google", "microsoft", "apple", "caldav"]);

export function defaultCalendarPrefs(): CalendarPrefs {
  return { enabled: false, connector: null };
}

function normalizeCalendarConnector(value: unknown): CalendarConnector | null {
  return typeof value === "string" && CALENDAR_CONNECTORS.has(value as CalendarConnector)
    ? (value as CalendarConnector)
    : null;
}

export function normalizeCalendarPrefs(raw: unknown): CalendarPrefs {
  const base = defaultCalendarPrefs();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<CalendarPrefs>;
  const accountLabel = o.accountLabel != null ? String(o.accountLabel).trim() : "";
  return {
    enabled: o.enabled === true,
    connector: normalizeCalendarConnector(o.connector),
    accountLabel: accountLabel || undefined,
  };
}

export function getCalendarPrefs(): CalendarPrefs {
  return normalizeCalendarPrefs(loadState().calendar);
}

export function setCalendarPrefs(patch: Partial<CalendarPrefs>): CalendarPrefs {
  const state = loadState();
  const next = normalizeCalendarPrefs({ ...getCalendarPrefs(), ...patch });
  state.calendar = next;
  saveState(state);
  return next;
}

const PROFILE_IDS = new Set<UserProfileId>(["work", "personal"]);
const HOME_MODES = new Set<ProfileHomeMode>(["super", "multi", "pro"]);

export function defaultProfileSlice(homeMode: ProfileHomeMode = "multi"): ProfilePrefsSlice {
  return {
    favoriteAgentIds: [],
    homeMode,
    displayContext: "",
  };
}

export function defaultUserPrefs(): UserPrefs {
  return {
    activeProfile: "work",
    profiles: {
      work: defaultProfileSlice("multi"),
      personal: defaultProfileSlice("super"),
    },
    englishOnlyReplies: true,
  };
}

function normalizeHomeMode(raw: unknown, fallback: ProfileHomeMode): ProfileHomeMode {
  return typeof raw === "string" && HOME_MODES.has(raw as ProfileHomeMode)
    ? (raw as ProfileHomeMode)
    : fallback;
}

function normalizeProfileSlice(raw: unknown, fallback: ProfilePrefsSlice): ProfilePrefsSlice {
  if (!raw || typeof raw !== "object") return { ...fallback, favoriteAgentIds: [...fallback.favoriteAgentIds] };
  const o = raw as Partial<ProfilePrefsSlice>;
  const favorites = Array.isArray(o.favoriteAgentIds)
    ? o.favoriteAgentIds.map((id) => String(id).trim()).filter(Boolean)
    : [...fallback.favoriteAgentIds];
  const seen = new Set<string>();
  const favoriteAgentIds: string[] = [];
  for (const id of favorites) {
    if (seen.has(id)) continue;
    seen.add(id);
    favoriteAgentIds.push(id);
  }
  const displayContext =
    o.displayContext != null ? String(o.displayContext).trim().slice(0, 64) : fallback.displayContext;
  return {
    favoriteAgentIds,
    homeMode: normalizeHomeMode(o.homeMode, fallback.homeMode),
    displayContext,
  };
}

export function normalizeUserPrefs(raw: unknown): UserPrefs {
  const base = defaultUserPrefs();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<UserPrefs> & { profiles?: Partial<Record<UserProfileId, unknown>> };
  const activeProfile =
    typeof o.activeProfile === "string" && PROFILE_IDS.has(o.activeProfile as UserProfileId)
      ? (o.activeProfile as UserProfileId)
      : base.activeProfile;
  const profilesRaw = (
    o.profiles && typeof o.profiles === "object" ? o.profiles : {}
  ) as Partial<Record<UserProfileId, unknown>>;
  return {
    activeProfile,
    profiles: {
      work: normalizeProfileSlice(profilesRaw.work, base.profiles.work),
      personal: normalizeProfileSlice(profilesRaw.personal, base.profiles.personal),
    },
    englishOnlyReplies: o.englishOnlyReplies === false ? false : true,
  };
}

export function getUserPrefs(): UserPrefs {
  return normalizeUserPrefs(loadState().prefs);
}

export function getVoiceDictionary(): VoiceDictionaryEntry[] {
  return normalizeVoiceDictionary(loadState().voiceDictionary);
}

export function setVoiceDictionary(entries: unknown): VoiceDictionaryEntry[] {
  const next = normalizeVoiceDictionary(Array.isArray(entries) ? entries : []);
  const state = loadState();
  state.voiceDictionary = next;
  saveState(state);
  return next;
}

export function setUserPrefs(patch: {
  activeProfile?: UserProfileId;
  profiles?: Partial<Record<UserProfileId, Partial<ProfilePrefsSlice>>>;
  englishOnlyReplies?: boolean;
}): UserPrefs {
  const state = loadState();
  const prev = normalizeUserPrefs(state.prefs);
  const nextProfiles = { ...prev.profiles };
  if (patch.profiles) {
    for (const id of PROFILE_IDS) {
      const slicePatch = patch.profiles[id];
      if (!slicePatch) continue;
      nextProfiles[id] = normalizeProfileSlice({ ...nextProfiles[id], ...slicePatch }, nextProfiles[id]);
    }
  }
  const next = normalizeUserPrefs({
    activeProfile: patch.activeProfile ?? prev.activeProfile,
    profiles: nextProfiles,
    englishOnlyReplies:
      patch.englishOnlyReplies !== undefined ? patch.englishOnlyReplies : prev.englishOnlyReplies,
  });
  state.prefs = next;
  saveState(state);
  return next;
}

function normalizeGoogleCalendarAuth(raw: unknown): GoogleCalendarAuth | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<GoogleCalendarAuth>;
  const accessToken = typeof o.accessToken === "string" ? o.accessToken.trim() : "";
  if (!accessToken) return null;
  const refreshToken = typeof o.refreshToken === "string" ? o.refreshToken.trim() : undefined;
  const expiryMs = typeof o.expiryMs === "number" && o.expiryMs > 0 ? o.expiryMs : undefined;
  const email = typeof o.email === "string" ? o.email.trim() : undefined;
  return {
    accessToken,
    refreshToken: refreshToken || undefined,
    expiryMs,
    email: email || undefined,
  };
}

export function getGoogleCalendarAuth(): GoogleCalendarAuth | null {
  return normalizeGoogleCalendarAuth(loadState().calendarGoogleAuth);
}

export function setGoogleCalendarAuth(auth: GoogleCalendarAuth | null): void {
  const state = loadState();
  if (auth == null) {
    delete state.calendarGoogleAuth;
  } else {
    state.calendarGoogleAuth = normalizeGoogleCalendarAuth(auth) ?? undefined;
  }
  saveState(state);
}

function normalizeMicrosoftGraphAuth(raw: unknown): MicrosoftGraphAuth | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<MicrosoftGraphAuth>;
  const accessToken = typeof o.accessToken === "string" ? o.accessToken.trim() : "";
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: typeof o.refreshToken === "string" && o.refreshToken.trim() ? o.refreshToken.trim() : undefined,
    expiryMs: typeof o.expiryMs === "number" && o.expiryMs > 0 ? o.expiryMs : undefined,
    email: typeof o.email === "string" && o.email.trim() ? o.email.trim() : undefined,
    scope: typeof o.scope === "string" && o.scope.trim() ? o.scope.trim() : undefined,
  };
}

export function getMicrosoftGraphAuth(): MicrosoftGraphAuth | null {
  return normalizeMicrosoftGraphAuth(loadState().calendarMicrosoftAuth);
}

export function setMicrosoftGraphAuth(auth: MicrosoftGraphAuth | null): void {
  const state = loadState();
  if (auth == null) {
    delete state.calendarMicrosoftAuth;
  } else {
    state.calendarMicrosoftAuth = normalizeMicrosoftGraphAuth(auth) ?? undefined;
  }
  saveState(state);
}

function normalizeGoogleDriveAuth(raw: unknown): GoogleDriveAuth | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<GoogleDriveAuth>;
  const accessToken = typeof o.accessToken === "string" ? o.accessToken.trim() : "";
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: typeof o.refreshToken === "string" && o.refreshToken.trim() ? o.refreshToken.trim() : undefined,
    expiryMs: typeof o.expiryMs === "number" && o.expiryMs > 0 ? o.expiryMs : undefined,
    email: typeof o.email === "string" && o.email.trim() ? o.email.trim() : undefined,
  };
}

export function getGoogleDriveAuth(): GoogleDriveAuth | null {
  return normalizeGoogleDriveAuth(loadState().googleDriveAuth);
}

export function setGoogleDriveAuth(auth: GoogleDriveAuth | null): void {
  const state = loadState();
  if (auth == null) {
    delete state.googleDriveAuth;
  } else {
    state.googleDriveAuth = normalizeGoogleDriveAuth(auth) ?? undefined;
  }
  saveState(state);
}

function normalizeBoardTopic(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).trim().slice(0, 2000);
}

function normalizeRecycleRetentionDays(raw: unknown): number {
  const allowed = new Set([0, 1, 3, 7, 15, 30, 45, 90]);
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : 90;
  return allowed.has(n) ? n : 90;
}

function normalizeCompanyBriefingField(raw: unknown): CompanyBriefing | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Partial<CompanyBriefing>;
  const text = typeof o.text === "string" ? o.text.trim() : "";
  if (!text) return undefined;
  const source = o.source === "url" || o.source === "paste" ? o.source : "paste";
  return {
    text: text.slice(0, 24_000),
    source,
    sourceUrl: typeof o.sourceUrl === "string" ? o.sourceUrl.slice(0, 2000) : undefined,
    title: typeof o.title === "string" ? o.title.slice(0, 200) : undefined,
    fetchedAt: typeof o.fetchedAt === "string" && o.fetchedAt ? o.fetchedAt : new Date().toISOString(),
    charCount: typeof o.charCount === "number" && Number.isFinite(o.charCount) ? o.charCount : text.length,
  };
}

function normalizeAgentTrainingField(raw: unknown): AgentTrainingMap | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: AgentTrainingMap = {};
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(id).trim();
    if (!key || !entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const learnings = Array.isArray(e.learnings)
      ? e.learnings.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
      : [];
    out[key] = {
      trainedAt: typeof e.trainedAt === "string" && e.trainedAt ? e.trainedAt : new Date().toISOString(),
      role: typeof e.role === "string" ? e.role.slice(0, 500) : "",
      learnings,
      briefingChars:
        typeof e.briefingChars === "number" && Number.isFinite(e.briefingChars)
          ? Math.max(0, Math.floor(e.briefingChars))
          : 0,
    };
  }
  return out;
}

const LESSON_SOURCES = new Set<LessonSource>(["research", "training", "group_final", "manual"]);

function normalizeLessonsField(raw: unknown): Lesson[] {
  if (!Array.isArray(raw)) return [];
  const out: Lesson[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Partial<Lesson>;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
    const title = typeof o.title === "string" ? o.title.trim().slice(0, 200) : "";
    const body = typeof o.body === "string" ? o.body.trim().slice(0, 24_000) : "";
    if (!id || !title || !body || seen.has(id)) continue;
    seen.add(id);
    const source: LessonSource =
      typeof o.source === "string" && LESSON_SOURCES.has(o.source as LessonSource)
        ? (o.source as LessonSource)
        : "manual";
    out.push({
      id,
      title,
      body,
      source,
      agentIds: Array.isArray(o.agentIds)
        ? o.agentIds.map((x) => String(x).trim()).filter(Boolean).slice(0, 40)
        : [],
      createdAt:
        typeof o.createdAt === "string" && o.createdAt.trim()
          ? o.createdAt.trim()
          : new Date().toISOString(),
      pinned: o.pinned === true,
    });
  }
  return out.slice(0, 200);
}

function normalizeState(state: AppState): AppState {
  const companyBriefing = normalizeCompanyBriefingField(state.companyBriefing);
  const agentTraining = normalizeAgentTrainingField(state.agentTraining);
  const lessons: Lesson[] = normalizeLessonsField(state.lessons);
  return {
    ...state,
    boardIds: normalizeBoardIds(state.boardIds),
    boardTopic: normalizeBoardTopic(state.boardTopic),
    boardStances: normalizeBoardStances(state.boardStances),
    customProAgentIds: normalizeCustomProAgentIds(state.customProAgentIds ?? []),
    calendar: normalizeCalendarPrefs(state.calendar),
    prefs: normalizeUserPrefs(state.prefs),
    providerEnabled: normalizeProviderEnabled(state.providerEnabled),
    postgresPrefs: normalizePostgresModulePrefs(state.postgresPrefs),
    voiceDictionary: normalizeVoiceDictionary(state.voiceDictionary),
    recycleBin: Array.isArray(state.recycleBin) ? state.recycleBin : [],
    recycleRetentionDays: normalizeRecycleRetentionDays(state.recycleRetentionDays),
    companyBriefing,
    agentTraining,
    lessons,
  };
}

function parseStateRaw(raw: string): AppState {
  const merged = normalizeState({ ...defaultState(), ...JSON.parse(raw) } as AppState);
  if (!Array.isArray(merged.permissions)) merged.permissions = [...DEFAULT_PERMISSIONS];
  if (merged.standingPermissionPolicies != null && typeof merged.standingPermissionPolicies !== "object") {
    merged.standingPermissionPolicies = undefined;
  }
  if (!Array.isArray(merged.channelDrafts)) merged.channelDrafts = [...DEFAULT_DRAFTS];
  if (merged.groupSession !== "open" && merged.groupSession !== "closed") merged.groupSession = "open";
  if (!Array.isArray(merged.tasks)) merged.tasks = [];
  else merged.tasks = migrateTasks(merged.tasks);
  if (!Array.isArray(merged.cronRoutines)) merged.cronRoutines = [];
  if (!Array.isArray(merged.adapters)) merged.adapters = [];
  if (!merged.agentApiKeys || typeof merged.agentApiKeys !== "object") merged.agentApiKeys = {};
  if (!Array.isArray(merged.mentionNotifications)) merged.mentionNotifications = [];
  if (!Array.isArray(merged.providerSpendLog)) merged.providerSpendLog = [];
  if (!Array.isArray(merged.routingDecisionLog)) merged.routingDecisionLog = [];
  if (!merged.clarifyMissesByThread || typeof merged.clarifyMissesByThread !== "object") {
    merged.clarifyMissesByThread = {};
  }
  if (!Array.isArray(merged.recycleBin)) merged.recycleBin = [];
  if (!Array.isArray(merged.lessons)) merged.lessons = [];
  // Never coerce missing threads to empty via accidental overwrite of live history —
  // callers must use clear* helpers. Keep arrays when present.
  if (!Array.isArray(merged.chiefThread)) merged.chiefThread = [];
  if (merged.agentThreads != null && typeof merged.agentThreads !== "object") merged.agentThreads = {};
  if (merged.proThreads != null && typeof merged.proThreads !== "object") merged.proThreads = {};
  merged.recycleRetentionDays = normalizeRecycleRetentionDays(merged.recycleRetentionDays);
  return merged;
}

/** When true, refuse saveState so a corrupt load cannot wipe app-state.json. */
let stateLoadDegraded = false;

export function loadState(): AppState {
  const p = statePath(STATE_FILE);
  const bak = `${p}.bak`;
  const tryRead = (file: string): AppState | null => {
    try {
      if (!fs.existsSync(file)) return null;
      const raw = fs.readFileSync(file, "utf8");
      if (!raw.trim()) return null;
      return parseStateRaw(raw);
    } catch {
      return null;
    }
  };

  const primary = tryRead(p);
  if (primary) {
    stateLoadDegraded = false;
    return primary;
  }

  const fromBak = tryRead(bak);
  if (fromBak) {
    console.error(`[store] loadState: primary unreadable; recovered from ${path.basename(bak)}`);
    stateLoadDegraded = false;
    return fromBak;
  }

  // Non-empty corrupt primary: do not hand out empty default that saveState could clobber with.
  try {
    if (fs.existsSync(p) && fs.statSync(p).size > 0) {
      stateLoadDegraded = true;
      console.error(
        `[store] loadState: refusing empty default over corrupt ${STATE_FILE} (${fs.statSync(p).size} bytes)`
      );
      // In-memory empty for read-only fail-closed; saveState is blocked until a good load.
      return defaultState();
    }
  } catch {
    /* fall through */
  }

  stateLoadDegraded = false;
  return defaultState();
}

function atomicWriteJson(filePath: string, json: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, json, "utf8");
  try {
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, `${filePath}.bak`);
    }
  } catch (e) {
    console.error("[store] backup before save failed:", e instanceof Error ? e.message : e);
  }
  try {
    fs.renameSync(tmp, filePath);
  } catch {
    // Windows cannot rename over an existing file — replace in place after backup.
    fs.copyFileSync(tmp, filePath);
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

export function saveState(state: AppState): void {
  if (stateLoadDegraded) {
    console.error("[store] saveState blocked: prior load was corrupt; fix or restore app-state.json.bak");
    return;
  }
  const normalized = normalizeState(state);
  // Guard: never persist a wipe of chiefThread that arrived as undefined from a bad merge.
  if (!Array.isArray(normalized.chiefThread)) {
    normalized.chiefThread = [];
  }
  atomicWriteJson(statePath(STATE_FILE), JSON.stringify(normalized, null, 2));
}

export type BoardStateSnapshot = {
  boardIds: string[];
  defaultBoardIds: string[];
  councilIds: string[];
  stances: BoardStancesMap;
  topic: string;
};

export function getBoardState(): BoardStateSnapshot {
  const s = loadState();
  const defaultBoardIds = loadDefaultBoardIds();
  const boardIds = normalizeBoardIds(s.boardIds, defaultBoardIds);
  return {
    boardIds,
    defaultBoardIds,
    councilIds: boardIds,
    stances: normalizeBoardStances(s.boardStances),
    topic: normalizeBoardTopic(s.boardTopic),
  };
}

export function updateBoard(patch: {
  boardIds?: string[];
  stances?: BoardStancesMap;
  topic?: string;
}): BoardStateSnapshot {
  const state = loadState();
  if (patch.boardIds !== undefined) {
    state.boardIds = normalizeBoardIds(patch.boardIds);
  }
  if (patch.stances !== undefined) {
    state.boardStances = normalizeBoardStances(patch.stances);
  }
  if (patch.topic !== undefined) {
    state.boardTopic = normalizeBoardTopic(patch.topic);
  }
  saveState(state);
  return getBoardState();
}

export function setBoardIds(ids: string[]): BoardStateSnapshot {
  return updateBoard({ boardIds: ids });
}

export function getCustomProAgentIds(): string[] {
  return normalizeCustomProAgentIds(loadState().customProAgentIds ?? []);
}

export function setCustomProAgentIds(ids: string[]): string[] {
  const state = loadState();
  state.customProAgentIds = normalizeCustomProAgentIds(ids);
  saveState(state);
  return state.customProAgentIds;
}

export function getGroupSession(): {
  id?: string;
  name?: string;
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
  const board = getBoardState();
  const s = loadState();
  const session: GroupSessionState = s.groupSession === "closed" ? "closed" : "open";
  const chats = Array.isArray(s.groupChats) ? s.groupChats : [];
  const activeId = typeof s.activeGroupId === "string" ? s.activeGroupId.trim() : "";
  const active =
    (activeId ? chats.find((g) => g && g.id === activeId) : undefined) ?? chats[0];
  const memberIds = active?.memberIds?.length
    ? normalizeBoardIds(active.memberIds)
    : board.boardIds;
  const rawObs = active && Array.isArray((active as { observerIds?: unknown }).observerIds)
    ? ((active as { observerIds: unknown[] }).observerIds ?? [])
    : [];
  const observerIds = rawObs
    .map((x) => String(x ?? "").trim())
    .filter((id) => id && !memberIds.includes(id) && id !== "chief");
  const rawMod =
    active && typeof (active as { moderatorId?: unknown }).moderatorId === "string"
      ? (active as { moderatorId: string }).moderatorId
      : "chief";
  const moderatorId =
    rawMod === "user" || memberIds.includes(rawMod)
      ? rawMod
      : memberIds.includes("chief")
        ? "chief"
        : memberIds[0] ?? "chief";
  const maxRaw = active && (active as { maxDurationMinutes?: unknown }).maxDurationMinutes;
  const maxN = typeof maxRaw === "number" ? maxRaw : Number(maxRaw);
  const maxDurationMinutes =
    Number.isFinite(maxN) && maxN > 0 ? Math.min(1440, Math.max(1, Math.round(maxN))) : null;
  const startedRaw =
    active && typeof (active as { sessionStartedAt?: unknown }).sessionStartedAt === "string"
      ? (active as { sessionStartedAt: string }).sessionStartedAt.trim()
      : "";
  const sessionStartedAt =
    session === "open" && startedRaw && Number.isFinite(Date.parse(startedRaw)) ? startedRaw : null;
  const sessionExpiresAt =
    sessionStartedAt && maxDurationMinutes
      ? new Date(Date.parse(sessionStartedAt) + maxDurationMinutes * 60_000).toISOString()
      : null;
  const sessionExpired =
    !!sessionExpiresAt && Date.now() >= Date.parse(sessionExpiresAt) && (active?.session === "open" || session === "open");
  return {
    id: active?.id,
    name: typeof active?.name === "string" && active.name.trim() ? active.name.trim() : undefined,
    session: active?.session === "closed" || active?.session === "open" ? active.session : session,
    memberIds,
    observerIds,
    boardIds: memberIds,
    councilIds: memberIds,
    defaultBoardIds: board.defaultBoardIds,
    proposal: normalizeGroupProposal(active?.proposal ?? s.groupProposal),
    proposalDecision: normalizeGroupProposalDecision(
      active?.proposalDecision ?? s.groupProposalDecision
    ),
    moderatorId,
    maxDurationMinutes,
    sessionStartedAt,
    sessionExpiresAt,
    sessionExpired,
  };
}

export function setGroupProposalDecision(decision: GroupProposalDecision): GroupProposalDecision {
  const state = loadState();
  const next = normalizeGroupProposalDecision(decision);
  state.groupProposalDecision = next;
  const chats = Array.isArray(state.groupChats) ? [...state.groupChats] : [];
  const activeId = typeof state.activeGroupId === "string" ? state.activeGroupId.trim() : "";
  const idx = chats.findIndex((g) => g && g.id === (activeId || chats[0]?.id));
  if (idx >= 0 && chats[idx]) {
    chats[idx] = { ...chats[idx]!, proposalDecision: next };
    state.groupChats = chats;
  }
  saveState(state);
  return next;
}

export function setGroupSession(session: GroupSessionState): ReturnType<typeof getGroupSession> {
  const state = loadState();
  state.groupSession = session === "closed" ? "closed" : "open";
  if (state.groupSession === "open") {
    state.groupProposalDecision = "open";
  }
  const chats = Array.isArray(state.groupChats) ? [...state.groupChats] : [];
  const activeId = typeof state.activeGroupId === "string" ? state.activeGroupId.trim() : "";
  const idx = chats.findIndex((g) => g && g.id === (activeId || chats[0]?.id));
  if (idx >= 0 && chats[idx]) {
    const patched = {
      ...chats[idx]!,
      session: state.groupSession,
      ...(state.groupSession === "open" ? { proposalDecision: "open" as const } : {}),
    };
    chats[idx] = patched;
    state.groupChats = chats;
  }
  saveState(state);
  return getGroupSession();
}

export function listChannelDrafts(): ChannelDraft[] {
  return loadState().channelDrafts;
}

export function createChannelDraft(input: {
  channel: ChannelDraft["channel"];
  title: string;
  meta: string;
  to: string;
  body: string;
}): ChannelDraft {
  const state = loadState();
  const draft: ChannelDraft = {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel: input.channel,
    title: input.title,
    meta: input.meta || "Waiting for you",
    to: input.to,
    body: input.body,
    sent: false,
  };
  state.channelDrafts.push(draft);
  saveState(state);
  return draft;
}

export function patchChannelDraft(
  id: string,
  patch: Partial<Pick<ChannelDraft, "title" | "meta" | "to" | "body" | "channel">>
): ChannelDraft | null {
  const state = loadState();
  const draft = state.channelDrafts.find((d) => d.id === id);
  if (!draft || draft.sent) return null;
  if (patch.channel != null) draft.channel = patch.channel;
  if (patch.title != null) draft.title = patch.title;
  if (patch.meta != null) draft.meta = patch.meta;
  if (patch.to != null) draft.to = patch.to;
  if (patch.body != null) draft.body = patch.body;
  saveState(state);
  return draft;
}

export function sendChannelDraft(id: string): { ok: true; message: string } | null {
  const state = loadState();
  const draft = state.channelDrafts.find((d) => d.id === id);
  if (!draft) return null;
  draft.sent = true;
  saveState(state);
  return { ok: true, message: `Sent ${draft.title} (simulated)` };
}

export function getMailConnection(): MailConnection | null {
  const raw = loadState().mailConnection;
  if (!raw || typeof raw !== "object") return null;
  const address = typeof raw.address === "string" ? raw.address.trim() : "";
  if (!address) return null;
  const kind = raw.kind === "gmail" ? "gmail" : raw.kind === "imap" ? "imap" : null;
  if (!kind) return null;
  return {
    kind,
    address,
    label: typeof raw.label === "string" ? raw.label.trim() : undefined,
    host: typeof raw.host === "string" ? raw.host.trim() : undefined,
    port: typeof raw.port === "number" && raw.port > 0 ? raw.port : undefined,
    user: typeof raw.user === "string" ? raw.user.trim() : undefined,
    password: typeof raw.password === "string" ? raw.password : undefined,
    secure: typeof raw.secure === "boolean" ? raw.secure : undefined,
    authMethod: raw.authMethod === "oauth" ? "oauth" : "password",
    oauthRefreshToken:
      typeof raw.oauthRefreshToken === "string" && raw.oauthRefreshToken.trim()
        ? raw.oauthRefreshToken.trim()
        : undefined,
    oauthAccessToken:
      typeof raw.oauthAccessToken === "string" && raw.oauthAccessToken.trim()
        ? raw.oauthAccessToken.trim()
        : undefined,
    oauthExpiresAt:
      typeof raw.oauthExpiresAt === "number" && Number.isFinite(raw.oauthExpiresAt)
        ? raw.oauthExpiresAt
        : undefined,
  };
}

export function setMailConnection(conn: MailConnection | null): void {
  const state = loadState();
  if (conn == null) {
    delete state.mailConnection;
  } else {
    state.mailConnection = conn;
  }
  saveState(state);
}

export function getSelectedModelId(): string | null {
  const id = loadState().selectedModel;
  return id != null && String(id).trim() ? String(id).trim() : null;
}

export function setSelectedModelId(selectedModelId: string | null): string | null {
  const state = loadState();
  state.selectedModel = selectedModelId && selectedModelId.trim() ? selectedModelId.trim() : undefined;
  saveState(state);
  return getSelectedModelId();
}

function normalizeModelIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const id = String(item ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Browse Models multi-select pool used by Agent assignments. */
export function getSelectedModelPool(): string[] {
  return normalizeModelIdList(loadState().selectedModelPool);
}

export function setSelectedModelPool(ids: string[]): string[] {
  const state = loadState();
  const next = normalizeModelIdList(ids);
  if (next.length === 0) delete state.selectedModelPool;
  else state.selectedModelPool = next;
  // Keep cascade order aligned with the assignment pool.
  const cascade = normalizeModelCascade(state.modelCascade, next);
  if (!cascade.enabled && cascade.order.length === 0) delete state.modelCascade;
  else state.modelCascade = cascade;
  saveState(state);
  return getSelectedModelPool();
}

export type ModelCascadePrefs = { enabled: boolean; order: string[] };

function normalizeModelCascade(
  raw: unknown,
  pool: string[] = getSelectedModelPool()
): ModelCascadePrefs {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as { enabled?: unknown; order?: unknown })
      : {};
  const enabled = src.enabled === true;
  const savedOrder = normalizeModelIdList(src.order);
  const poolSet = new Set(pool);
  const order: string[] = [];
  const seen = new Set<string>();
  for (const id of savedOrder) {
    if (!poolSet.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  for (const id of pool) {
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  return { enabled, order };
}

/** Cascade failover prefs — ordered subset/reorder of `selectedModelPool`. */
export function getModelCascadePrefs(): ModelCascadePrefs {
  const state = loadState();
  return normalizeModelCascade(state.modelCascade, getSelectedModelPool());
}

export function setModelCascadePrefs(patch: {
  enabled?: boolean;
  order?: string[];
}): ModelCascadePrefs {
  const state = loadState();
  const pool = getSelectedModelPool();
  const prev = normalizeModelCascade(state.modelCascade, pool);
  const next = normalizeModelCascade(
    {
      enabled: "enabled" in patch ? patch.enabled === true : prev.enabled,
      order: "order" in patch ? patch.order : prev.order,
    },
    pool
  );
  if (!next.enabled && next.order.length === 0) delete state.modelCascade;
  else state.modelCascade = next;
  saveState(state);
  return getModelCascadePrefs();
}

export function patchAgentModelAssignment(
  agentId: string,
  patch: {
    primaryModelId?: string | null;
    secondaryModelId?: string | null;
    routePref?: string | null;
  }
): { primaryModelId: string | null; secondaryModelId: string | null; routePref: string | null } | null {
  const id = agentId.trim();
  if (!id) return null;
  if (
    "routePref" in patch &&
    patch.routePref != null &&
    patch.routePref !== "" &&
    !normalizeAgentRoutePref(patch.routePref)
  ) {
    return null;
  }
  const state = loadState();
  const map = { ...(state.agentModelAssignments ?? {}) };
  const prev = map[id] ?? {};
  const next = { ...prev };
  if ("primaryModelId" in patch) {
    const p = patch.primaryModelId;
    if (p == null || p === "") delete next.primary;
    else next.primary = String(p);
  }
  if ("secondaryModelId" in patch) {
    const s = patch.secondaryModelId;
    if (s == null || s === "") delete next.secondary;
    else next.secondary = String(s);
  }
  if (!next.primary && !next.secondary) delete map[id];
  else map[id] = next;
  state.agentModelAssignments = map;
  saveState(state);
  let routePref: string | null = null;
  if ("routePref" in patch) {
    const routed = patchAgentRouting(id, patch.routePref);
    if (patch.routePref != null && patch.routePref !== "" && !routed) return null;
    routePref = routed?.routePref ?? null;
  } else {
    routePref = getAgentRoutingPref(id) ?? null;
  }
  return {
    primaryModelId: next.primary ?? null,
    secondaryModelId: next.secondary ?? null,
    routePref,
  };
}

export function getAgentModelAssignment(agentId: string): { primary?: string; secondary?: string } {
  return loadState().agentModelAssignments?.[agentId] ?? {};
}

export type AgentModelAssignmentMap = Record<string, { primary?: string; secondary?: string }>;

export function listAgentModelAssignments(): AgentModelAssignmentMap {
  const raw = loadState().agentModelAssignments ?? {};
  return { ...raw };
}

/** Replace persisted per-agent primary/secondary overrides (registry file is not rewritten). */
export function putAgentModelAssignments(incoming: AgentModelAssignmentMap): AgentModelAssignmentMap {
  const state = loadState();
  const map: AgentModelAssignmentMap = {};
  for (const [agentId, row] of Object.entries(incoming ?? {})) {
    const id = agentId.trim();
    if (!id || !row || typeof row !== "object") continue;
    const primary = row.primary != null && String(row.primary).trim() ? String(row.primary).trim() : undefined;
    const secondary =
      row.secondary != null && String(row.secondary).trim() ? String(row.secondary).trim() : undefined;
    if (!primary && !secondary) continue;
    map[id] = {};
    if (primary) map[id].primary = primary;
    if (secondary) map[id].secondary = secondary;
  }
  state.agentModelAssignments = map;
  saveState(state);
  return listAgentModelAssignments();
}

function isValidAgentRoutePref(raw: string): boolean {
  const s = raw.trim();
  if (s === "local" || s === "cloud") return true;
  const idx = s.indexOf(":");
  if (idx <= 0) return false;
  return Boolean(s.slice(0, idx).trim() && s.slice(idx + 1).trim());
}

export function normalizeAgentRoutePref(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  return isValidAgentRoutePref(s) ? s : null;
}

export function getAgentRoutingPref(agentId: string): string | undefined {
  const v = loadState().agentRouting?.[agentId.trim()];
  return v != null && String(v).trim() ? String(v).trim() : undefined;
}

export type AgentRoutingMap = Record<string, string>;

export function listAgentRouting(): AgentRoutingMap {
  const raw = loadState().agentRouting ?? {};
  return { ...raw };
}

export function putAgentRouting(incoming: AgentRoutingMap): AgentRoutingMap {
  const state = loadState();
  const map: AgentRoutingMap = {};
  for (const [agentId, pref] of Object.entries(incoming ?? {})) {
    const id = agentId.trim();
    const normalized = normalizeAgentRoutePref(pref);
    if (!id || !normalized) continue;
    map[id] = normalized;
  }
  state.agentRouting = map;
  saveState(state);
  return listAgentRouting();
}

export function patchAgentRouting(
  agentId: string,
  routePref: unknown
): { routePref: string | null } | null {
  const id = agentId.trim();
  if (!id) return null;
  const state = loadState();
  const map = { ...(state.agentRouting ?? {}) };
  if (routePref == null || routePref === "") {
    delete map[id];
    state.agentRouting = Object.keys(map).length ? map : undefined;
    saveState(state);
    return { routePref: null };
  }
  const normalized = normalizeAgentRoutePref(routePref);
  if (!normalized) return null;
  map[id] = normalized;
  state.agentRouting = map;
  saveState(state);
  return { routePref: normalized };
}

export function getAgentDisplayName(agentId: string): string | null {
  const raw = loadState().agentDisplayNames?.[agentId.trim()];
  const name = typeof raw === "string" ? raw.trim() : "";
  return name || null;
}

/** Persist a display-name override (registry file unchanged). Empty clears. */
export function setAgentDisplayName(agentId: string, name: string | null): string | null {
  const id = agentId.trim();
  if (!id) return null;
  const state = loadState();
  const map = { ...(state.agentDisplayNames ?? {}) };
  const trimmed = name?.trim() ?? "";
  if (!trimmed) {
    delete map[id];
    state.agentDisplayNames = map;
    saveState(state);
    return null;
  }
  map[id] = trimmed.slice(0, 64);
  state.agentDisplayNames = map;
  saveState(state);
  return map[id];
}

/** Staff role label for Chief (`chief` | `secretary` | `buddy`). */
export function getAgentRoleLabel(agentId: string): string | null {
  const raw = loadState().agentRoleLabels?.[agentId.trim()];
  const label = typeof raw === "string" ? raw.trim() : "";
  return label || null;
}

/** Persist staff role-label override. Empty clears (falls back to chief). */
export function setAgentRoleLabel(agentId: string, label: string | null): string | null {
  const id = agentId.trim();
  if (!id) return null;
  const state = loadState();
  const map = { ...(state.agentRoleLabels ?? {}) };
  const trimmed = label?.trim() ?? "";
  if (!trimmed) {
    delete map[id];
    state.agentRoleLabels = map;
    saveState(state);
    return null;
  }
  map[id] = trimmed.slice(0, 32);
  state.agentRoleLabels = map;
  saveState(state);
  return map[id];
}

export function getImportedSkills(agentId: string): string[] {
  const list = loadState().agentImportedSkills?.[agentId];
  return Array.isArray(list) ? list.filter((s) => typeof s === "string" && s.trim()) : [];
}

/** Attach a skill id for a registry agent (fail-closed: no Chief, no empty skill). */
export function attachImportedSkill(agentId: string, skill: string): string[] | null {
  const id = agentId.trim();
  const skillId = skill.trim();
  if (!id || !skillId || isChiefId(id)) return null;
  const state = loadState();
  const map = { ...(state.agentImportedSkills ?? {}) };
  const prev = map[id] ?? [];
  if (prev.includes(skillId)) return prev;
  map[id] = [...prev, skillId];
  state.agentImportedSkills = map;
  saveState(state);
  return map[id];
}

export function detachImportedSkill(agentId: string, skill: string): string[] | null {
  const id = agentId.trim();
  const skillId = skill.trim();
  if (!id || !skillId) return null;
  const state = loadState();
  const map = { ...(state.agentImportedSkills ?? {}) };
  const prev = map[id] ?? [];
  const next = prev.filter((s) => s !== skillId);
  if (next.length === 0) delete map[id];
  else map[id] = next;
  state.agentImportedSkills = map;
  saveState(state);
  return next;
}

export function getAgentAmsSkillIds(agentId: string): string[] {
  const list = loadState().agentAmsSkills?.[agentId.trim()];
  return Array.isArray(list) ? list.filter((s) => typeof s === "string" && s.trim()) : [];
}

/** Replace AMS catalog picks for an agent (ids should already be catalog-validated). Chief allowed. */
export function putAgentAmsSkillIds(agentId: string, skillIds: string[]): string[] | null {
  const id = agentId.trim();
  if (!id) return null;
  const state = loadState();
  const map = { ...(state.agentAmsSkills ?? {}) };
  const next = skillIds.map((s) => s.trim()).filter(Boolean);
  if (next.length === 0) delete map[id];
  else map[id] = next;
  state.agentAmsSkills = map;
  saveState(state);
  return getAgentAmsSkillIds(id);
}

const VALID_PROVIDER_IDS = new Set(PROVIDER_REGISTRY.map((p) => p.id));

/** Lane toggles + every registry provider id (Settings → Connections). */
export const PROVIDER_TOGGLE_IDS = ["local", "relay", ...PROVIDER_REGISTRY.map((p) => p.id)] as const;
const PROVIDER_TOGGLE_ID_SET = new Set<string>(PROVIDER_TOGGLE_IDS);
const LOCKED_PROVIDER_TOGGLES = new Set<string>(["local"]);

export function defaultProviderEnabled(): Record<string, boolean> {
  const out: Record<string, boolean> = { local: true, relay: true };
  for (const p of PROVIDER_REGISTRY) out[p.id] = false;
  return out;
}

export function normalizeProviderEnabled(raw: unknown): Record<string, boolean> {
  const base = defaultProviderEnabled();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  for (const id of PROVIDER_TOGGLE_IDS) {
    if (LOCKED_PROVIDER_TOGGLES.has(id)) {
      base[id] = true;
      continue;
    }
    if (id in o) base[id] = o[id] === true;
  }
  return base;
}

export function getProviderEnabledMap(): Record<string, boolean> {
  return normalizeProviderEnabled(loadState().providerEnabled);
}

export function isProviderEnabled(providerId: string): boolean {
  const id = providerId.trim();
  if (!PROVIDER_TOGGLE_ID_SET.has(id)) return false;
  return getProviderEnabledMap()[id] === true;
}

export function setProviderEnabled(providerId: string, enabled: boolean): Record<string, boolean> {
  const id = providerId.trim();
  if (!PROVIDER_TOGGLE_ID_SET.has(id)) throw new Error("unknown provider");
  if (LOCKED_PROVIDER_TOGGLES.has(id)) return getProviderEnabledMap();
  const state = loadState();
  const map = normalizeProviderEnabled(state.providerEnabled);
  map[id] = enabled === true;
  state.providerEnabled = map;
  saveState(state);
  return map;
}

export function getProviderApiKey(providerId: string): string | null {
  const id = providerId.trim();
  if (!VALID_PROVIDER_IDS.has(id)) return null;
  const raw = loadState().providerApiKeys?.[id];
  return raw != null && String(raw).trim() ? String(raw).trim() : null;
}

export function setProviderApiKey(providerId: string, apiKey: string | null): void {
  const id = providerId.trim();
  if (!VALID_PROVIDER_IDS.has(id)) return;
  const state = loadState();
  const map = { ...(state.providerApiKeys ?? {}) };
  if (apiKey == null || !String(apiKey).trim()) delete map[id];
  else map[id] = String(apiKey).trim();
  state.providerApiKeys = map;
  saveState(state);
}

export function listProviderKeyStatus(): Record<string, { configured: boolean; last4?: string }> {
  const keys = loadState().providerApiKeys ?? {};
  const out: Record<string, { configured: boolean; last4?: string }> = {};
  for (const p of PROVIDER_REGISTRY) {
    const raw = keys[p.id];
    if (raw != null && String(raw).trim()) {
      const s = String(raw).trim();
      out[p.id] = { configured: true, last4: s.slice(-4) };
    } else {
      out[p.id] = { configured: false };
    }
  }
  return out;
}

const TASK_STATUSES = new Set<TaskStatus>(["pending", "ongoing", "completed", "blocked"]);

/** Map legacy open/done → pending/completed; unknown → pending. */
function normalizeTaskStatus(status: unknown): TaskStatus {
  if (typeof status !== "string") return "pending";
  if (status === "open") return "pending";
  if (status === "done") return "completed";
  return TASK_STATUSES.has(status as TaskStatus) ? (status as TaskStatus) : "pending";
}

function migrateTasks(tasks: unknown): AgentTask[] {
  if (!Array.isArray(tasks)) return [];
  return tasks.map((raw) => {
    const t = raw as AgentTask;
    return {
      ...t,
      status: normalizeTaskStatus(t?.status),
    };
  });
}

export function listTasks(): AgentTask[] {
  return migrateTasks(loadState().tasks ?? []);
}

export function createTask(input: {
  title: string;
  agentId: string;
  status?: TaskStatus;
  due?: string;
  researchId?: string;
  step?: string;
  note?: string;
  category?: AgentTask["category"];
  priority?: AgentTask["priority"];
  origin?: AgentTask["origin"];
}): AgentTask {
  const state = loadState();
  const task: AgentTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title.trim(),
    agentId: input.agentId.trim(),
    status: normalizeTaskStatus(input.status),
    due: input.due?.trim() || undefined,
    researchId: input.researchId?.trim() || undefined,
    step: input.step?.trim() || undefined,
    note: input.note?.trim() || undefined,
    category: input.category,
    priority: input.priority ?? "normal",
    origin: input.origin,
  };
  state.tasks = [...(state.tasks ?? []), task];
  saveState(state);
  return task;
}

export function patchTask(
  id: string,
  patch: Partial<
    Pick<
      AgentTask,
      "title" | "agentId" | "status" | "due" | "researchId" | "step" | "note" | "category" | "priority" | "origin"
    >
  >
): AgentTask | null {
  const state = loadState();
  const task = (state.tasks ?? []).find((t) => t.id === id);
  if (!task) return null;
  if (patch.title != null) task.title = patch.title.trim();
  if (patch.agentId != null) task.agentId = patch.agentId.trim();
  if (patch.status != null) task.status = normalizeTaskStatus(patch.status);
  if ("due" in patch) task.due = patch.due?.trim() || undefined;
  if ("researchId" in patch) task.researchId = patch.researchId?.trim() || undefined;
  if ("step" in patch) task.step = patch.step?.trim() || undefined;
  if ("note" in patch) task.note = patch.note?.trim() || undefined;
  if ("category" in patch) task.category = patch.category;
  if ("priority" in patch) task.priority = patch.priority;
  if ("origin" in patch) task.origin = patch.origin;
  saveState(state);
  return { ...task };
}

export function deleteTask(id: string): boolean {
  const state = loadState();
  const prev = state.tasks ?? [];
  const next = prev.filter((t) => t.id !== id);
  if (next.length === prev.length) return false;
  state.tasks = next;
  saveState(state);
  return true;
}

export function getTask(id: string): AgentTask | null {
  const task = (loadState().tasks ?? []).find((t) => t.id === id);
  if (!task) return null;
  return {
    ...task,
    comments: task.comments ? [...task.comments] : [],
    attachments: task.attachments ? [...task.attachments] : [],
  };
}

export function listTaskComments(taskId: string): TaskComment[] | null {
  const task = (loadState().tasks ?? []).find((t) => t.id === taskId);
  if (!task) return null;
  return [...(task.comments ?? [])];
}

/** Extract `@token` mentions; resolve against known agent ids (case-sensitive id match). */
export function resolveCommentMentions(text: string, knownAgentIds: string[]): string[] {
  const known = new Set(knownAgentIds.map((id) => id.trim()).filter(Boolean));
  const found: string[] = [];
  const re = /@([a-zA-Z0-9_.:-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const id = m[1];
    if (known.has(id) && !found.includes(id)) found.push(id);
  }
  return found;
}

export function addTaskComment(
  taskId: string,
  input: { author?: string; text: string; mentionAgentIds?: string[] }
): { task: AgentTask; comment: TaskComment; mentions: string[] } | null {
  const state = loadState();
  const task = (state.tasks ?? []).find((t) => t.id === taskId);
  if (!task) return null;
  const text = input.text.trim();
  if (!text) return null;
  const mentions = (input.mentionAgentIds ?? []).map((id) => id.trim()).filter(Boolean);
  const comment: TaskComment = {
    id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    author: (input.author?.trim() || "you").slice(0, 64),
    text: text.slice(0, 4000),
    at: new Date().toISOString(),
    mentions: mentions.length ? mentions : undefined,
  };
  task.comments = [...(task.comments ?? []), comment];

  if (mentions.length) {
    const notes: MentionNotification[] = mentions.map((agentId) => ({
      id: `mention-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "mention" as const,
      agentId,
      taskId: task.id,
      commentId: comment.id,
      fromAuthor: comment.author,
      text: comment.text.slice(0, 280),
      at: comment.at,
      read: false,
    }));
    state.mentionNotifications = [...notes, ...(state.mentionNotifications ?? [])].slice(0, MENTION_CAP);
  }

  saveState(state);
  return {
    task: {
      ...task,
      comments: [...(task.comments ?? [])],
      attachments: task.attachments ? [...task.attachments] : [],
    },
    comment,
    mentions,
  };
}

/** Boss inbox-style alert (reuses mentionNotifications with agentId = boss). */
export function pushBossTaskAlert(input: {
  taskId: string;
  text: string;
  fromAuthor?: string;
  commentId?: string;
}): MentionNotification {
  const state = loadState();
  const note: MentionNotification = {
    id: `mention-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: "mention",
    agentId: BOSS_ID,
    taskId: input.taskId,
    commentId: input.commentId?.trim() || `alert-${Date.now()}`,
    fromAuthor: (input.fromAuthor?.trim() || "system").slice(0, 64),
    text: input.text.trim().slice(0, 280),
    at: new Date().toISOString(),
    read: false,
  };
  state.mentionNotifications = [note, ...(state.mentionNotifications ?? [])].slice(0, MENTION_CAP);
  saveState(state);
  return { ...note };
}

export function listMentionNotifications(opts?: { agentId?: string; unreadOnly?: boolean }): MentionNotification[] {
  let list = [...(loadState().mentionNotifications ?? [])];
  if (opts?.agentId) list = list.filter((n) => n.agentId === opts.agentId);
  if (opts?.unreadOnly) list = list.filter((n) => !n.read);
  return list;
}

export function markMentionRead(id: string): MentionNotification | null {
  const state = loadState();
  const n = (state.mentionNotifications ?? []).find((x) => x.id === id);
  if (!n) return null;
  n.read = true;
  saveState(state);
  return { ...n };
}

function uploadsRoot(): string {
  const root = path.join(dataDir(), "uploads");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function sanitizeFilename(name: string): string {
  const base = path.basename(String(name || "file").trim() || "file").replace(/[^\w.\-()+ ]+/g, "_");
  return base.slice(0, 120) || "file";
}

export function listTaskAttachments(taskId: string): TaskAttachment[] | null {
  const task = (loadState().tasks ?? []).find((t) => t.id === taskId);
  if (!task) return null;
  return [...(task.attachments ?? [])];
}

export function addTaskAttachment(
  taskId: string,
  input: {
    name: string;
    mime?: string;
    dataBase64: string;
    uploadedBy?: string;
  }
): { task: AgentTask; attachment: TaskAttachment } | { error: string } {
  const state = loadState();
  const task = (state.tasks ?? []).find((t) => t.id === taskId);
  if (!task) return { error: "not found" };

  let buf: Buffer;
  try {
    const raw = String(input.dataBase64 ?? "").replace(/^data:[^;]+;base64,/, "").trim();
    buf = Buffer.from(raw, "base64");
  } catch {
    return { error: "invalid base64" };
  }
  if (!buf.length) return { error: "empty file" };
  if (buf.length > TASK_ATTACHMENT_MAX_BYTES) {
    return { error: `file exceeds ${TASK_ATTACHMENT_MAX_BYTES} bytes` };
  }

  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeName = sanitizeFilename(input.name);
  const relativePath = path.join("uploads", "tasks", taskId, `${id}-${safeName}`);
  const abs = path.join(dataDir(), relativePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);

  const attachment: TaskAttachment = {
    id,
    name: safeName,
    mime: (input.mime?.trim() || "application/octet-stream").slice(0, 120),
    size: buf.length,
    relativePath: relativePath.replace(/\\/g, "/"),
    uploadedAt: new Date().toISOString(),
    uploadedBy: input.uploadedBy?.trim() || undefined,
  };
  task.attachments = [...(task.attachments ?? []), attachment];
  saveState(state);
  return {
    task: {
      ...task,
      comments: task.comments ? [...task.comments] : [],
      attachments: [...(task.attachments ?? [])],
    },
    attachment,
  };
}

export function getTaskAttachmentFile(
  taskId: string,
  attachmentId: string
): { attachment: TaskAttachment; absolutePath: string } | null {
  const task = (loadState().tasks ?? []).find((t) => t.id === taskId);
  if (!task) return null;
  const attachment = (task.attachments ?? []).find((a) => a.id === attachmentId);
  if (!attachment) return null;
  const abs = path.join(dataDir(), attachment.relativePath);
  if (!abs.startsWith(uploadsRoot()) && !abs.startsWith(path.join(dataDir(), "uploads"))) {
    return null;
  }
  if (!fs.existsSync(abs)) return null;
  return { attachment, absolutePath: abs };
}

export function deleteTaskAttachment(taskId: string, attachmentId: string): boolean {
  const state = loadState();
  const task = (state.tasks ?? []).find((t) => t.id === taskId);
  if (!task) return false;
  const prev = task.attachments ?? [];
  const target = prev.find((a) => a.id === attachmentId);
  if (!target) return false;
  task.attachments = prev.filter((a) => a.id !== attachmentId);
  try {
    const abs = path.join(dataDir(), target.relativePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* ignore disk errors */
  }
  saveState(state);
  return true;
}

function computeNextRunAt(routine: Pick<CronRoutine, "everyMinutes" | "cronExpr">, fromMs: number): string {
  const expr = routine.cronExpr?.trim();
  if (expr && isValidCronExpression(expr)) {
    const iso = nextCronRunIso(expr, fromMs);
    if (iso) return iso;
  }
  const every = Math.max(1, Math.floor(routine.everyMinutes) || 60);
  return new Date(fromMs + every * 60_000).toISOString();
}

export function listCronRoutines(): CronRoutine[] {
  return [...(loadState().cronRoutines ?? [])];
}

export function createCronRoutine(input: {
  title: string;
  agentId: string;
  everyMinutes?: number;
  cronExpr?: string;
  enabled?: boolean;
  note?: string;
}): CronRoutine {
  const state = loadState();
  const cronExpr = input.cronExpr?.trim() || undefined;
  if (cronExpr && !isValidCronExpression(cronExpr)) {
    throw new Error("invalid cronExpr — expected 5 fields (minute hour dom month dow)");
  }
  const everyMinutes = Math.max(1, Math.min(60 * 24 * 30, Math.floor(input.everyMinutes ?? 60) || 60));
  const now = Date.now();
  const routine: CronRoutine = {
    id: `cron-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title.trim(),
    agentId: input.agentId.trim(),
    everyMinutes,
    cronExpr,
    enabled: input.enabled !== false,
    note: input.note?.trim() || undefined,
    createdAt: new Date(now).toISOString(),
    nextRunAt: computeNextRunAt({ everyMinutes, cronExpr }, now),
  };
  state.cronRoutines = [...(state.cronRoutines ?? []), routine];
  saveState(state);
  return { ...routine };
}

export function patchCronRoutine(
  id: string,
  patch: Partial<
    Pick<CronRoutine, "title" | "agentId" | "everyMinutes" | "cronExpr" | "enabled" | "note" | "lastRunAt" | "nextRunAt">
  >
): CronRoutine | null {
  const state = loadState();
  const routine = (state.cronRoutines ?? []).find((r) => r.id === id);
  if (!routine) return null;
  if (patch.title != null) routine.title = patch.title.trim();
  if (patch.agentId != null) routine.agentId = patch.agentId.trim();
  if (patch.everyMinutes != null) {
    routine.everyMinutes = Math.max(1, Math.min(60 * 24 * 30, Math.floor(patch.everyMinutes) || 60));
  }
  if ("cronExpr" in patch) {
    const next = patch.cronExpr?.trim() || undefined;
    if (next && !isValidCronExpression(next)) return null;
    routine.cronExpr = next;
  }
  if (patch.enabled != null) routine.enabled = Boolean(patch.enabled);
  if ("note" in patch) routine.note = patch.note?.trim() || undefined;
  if ("lastRunAt" in patch) routine.lastRunAt = patch.lastRunAt;
  if ("nextRunAt" in patch) routine.nextRunAt = patch.nextRunAt;
  else if (patch.everyMinutes != null || "cronExpr" in patch || patch.enabled === true) {
    routine.nextRunAt = computeNextRunAt(routine, Date.now());
  }
  saveState(state);
  return { ...routine };
}

export function deleteCronRoutine(id: string): boolean {
  const state = loadState();
  const prev = state.cronRoutines ?? [];
  const next = prev.filter((r) => r.id !== id);
  if (next.length === prev.length) return false;
  state.cronRoutines = next;
  saveState(state);
  return true;
}

/** Mark a routine as run and schedule next fire (cronExpr or everyMinutes fallback). */
export function markCronRoutineRan(id: string): CronRoutine | null {
  const state = loadState();
  const routine = (state.cronRoutines ?? []).find((r) => r.id === id);
  if (!routine) return null;
  const now = Date.now();
  routine.lastRunAt = new Date(now).toISOString();
  routine.nextRunAt = computeNextRunAt(routine, now);
  saveState(state);
  return { ...routine };
}

export function listAdapters(): AdapterEntry[] {
  return [...(loadState().adapters ?? [])];
}

export function getAdapter(id: string): AdapterEntry | null {
  const key = id.trim();
  if (!key) return null;
  const row = (loadState().adapters ?? []).find((a) => a.id === key);
  return row ? { ...row, args: row.args ? [...row.args] : undefined } : null;
}

export function createAdapter(input: {
  name: string;
  kind: AdapterKind;
  command?: string;
  args?: string[];
  url?: string;
  enabled?: boolean;
}): AdapterEntry {
  const state = loadState();
  const now = Date.now();
  const entry: AdapterEntry = {
    id: `adap-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    kind: input.kind,
    command: input.command?.trim() || undefined,
    args: Array.isArray(input.args) ? input.args.map((a) => String(a)) : undefined,
    url: input.url?.trim() || undefined,
    enabled: input.enabled === true,
    createdAt: new Date(now).toISOString(),
  };
  state.adapters = [...(state.adapters ?? []), entry];
  saveState(state);
  return { ...entry, args: entry.args ? [...entry.args] : undefined };
}

export function patchAdapter(
  id: string,
  patch: Partial<Pick<AdapterEntry, "name" | "kind" | "command" | "args" | "url" | "enabled" | "lastInvokedAt">> & {
    clearCommand?: boolean;
    clearUrl?: boolean;
    clearArgs?: boolean;
  }
): AdapterEntry | null {
  const state = loadState();
  const entry = (state.adapters ?? []).find((a) => a.id === id);
  if (!entry) return null;
  if (patch.name != null) entry.name = patch.name.trim();
  if (patch.kind != null) entry.kind = patch.kind;
  if (patch.clearCommand) entry.command = undefined;
  else if (patch.command != null) entry.command = patch.command.trim() || undefined;
  if (patch.clearArgs) entry.args = undefined;
  else if (patch.args != null) entry.args = Array.isArray(patch.args) ? patch.args.map((a) => String(a)) : undefined;
  if (patch.clearUrl) entry.url = undefined;
  else if (patch.url != null) entry.url = patch.url.trim() || undefined;
  if (patch.enabled != null) entry.enabled = Boolean(patch.enabled);
  if (patch.lastInvokedAt != null) entry.lastInvokedAt = patch.lastInvokedAt;
  saveState(state);
  return { ...entry, args: entry.args ? [...entry.args] : undefined };
}

export function deleteAdapter(id: string): boolean {
  const state = loadState();
  const prev = state.adapters ?? [];
  const next = prev.filter((a) => a.id !== id);
  if (next.length === prev.length) return false;
  state.adapters = next;
  saveState(state);
  return true;
}

/** All per-agent AMS catalog picks (for skill graph edges). */
export function listAllAgentAmsSkills(): Record<string, string[]> {
  const map = loadState().agentAmsSkills ?? {};
  const out: Record<string, string[]> = {};
  for (const [agentId, ids] of Object.entries(map)) {
    if (!Array.isArray(ids)) continue;
    const clean = ids.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim());
    if (clean.length) out[agentId] = clean;
  }
  return out;
}

export function getAgentApiKeyRecord(agentId: string): AgentApiKeyRecord | null {
  const id = agentId.trim();
  if (!id) return null;
  const rec = loadState().agentApiKeys?.[id];
  if (!rec) return null;
  return {
    ...rec,
    scopes: normalizeApiKeyScopes(rec.scopes),
  };
}

export function normalizeApiKeyScopes(raw: unknown): AgentApiKeyScope[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_API_KEY_SCOPES];
  const out: AgentApiKeyScope[] = [];
  for (const s of raw) {
    const v = String(s).trim() as AgentApiKeyScope;
    if (ALLOWED_API_KEY_SCOPES.has(v) && !out.includes(v)) out.push(v);
  }
  return out.length ? out : [...DEFAULT_API_KEY_SCOPES];
}

export function agentApiKeyHasScope(rec: AgentApiKeyRecord | null, scope: AgentApiKeyScope): boolean {
  if (!rec) return false;
  return normalizeApiKeyScopes(rec.scopes).includes(scope);
}

export function setAgentApiKey(
  agentId: string,
  token: string,
  scopes?: AgentApiKeyScope[]
): AgentApiKeyRecord {
  const id = agentId.trim();
  const state = loadState();
  const t = token.trim();
  const rec: AgentApiKeyRecord = {
    token: t,
    createdAt: new Date().toISOString(),
    last4: t.slice(-4),
    scopes: normalizeApiKeyScopes(scopes),
  };
  state.agentApiKeys = { ...(state.agentApiKeys ?? {}), [id]: rec };
  saveState(state);
  return { ...rec, scopes: [...(rec.scopes ?? [])] };
}

export function clearAgentApiKey(agentId: string): boolean {
  const id = agentId.trim();
  const state = loadState();
  const map = { ...(state.agentApiKeys ?? {}) };
  if (!(id in map)) return false;
  delete map[id];
  state.agentApiKeys = map;
  saveState(state);
  return true;
}

export function listAgentApiKeyMeta(): Record<
  string,
  { configured: boolean; last4?: string; createdAt?: string; scopes?: AgentApiKeyScope[] }
> {
  const keys = loadState().agentApiKeys ?? {};
  const out: Record<
    string,
    { configured: boolean; last4?: string; createdAt?: string; scopes?: AgentApiKeyScope[] }
  > = {};
  for (const [id, rec] of Object.entries(keys)) {
    out[id] = {
      configured: true,
      last4: rec.last4,
      createdAt: rec.createdAt,
      scopes: normalizeApiKeyScopes(rec.scopes),
    };
  }
  return out;
}

/** Rough cloud USD estimate (per 1M tokens); local/unknown → honest 0. */
function estimateCostUsd(
  via: string,
  providerId: string | undefined,
  promptTokens: number | undefined,
  completionTokens: number | undefined
): number {
  if (via !== "cloud" && !providerId) return 0;
  const inTok = promptTokens ?? 0;
  const outTok = completionTokens ?? 0;
  if (inTok + outTok <= 0) return 0;
  // Conservative generic rates — audit trail, not billing.
  const inPerM = 0.5;
  const outPerM = 1.5;
  const usd = (inTok / 1_000_000) * inPerM + (outTok / 1_000_000) * outPerM;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export function appendProviderSpendEvent(input: {
  via: string;
  providerId?: string;
  model?: string;
  agentId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}): ProviderSpendEvent {
  const state = loadState();
  const promptTokens = input.promptTokens;
  const completionTokens = input.completionTokens;
  const totalTokens =
    input.totalTokens ??
    (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : undefined);
  const event: ProviderSpendEvent = {
    id: `spend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    via: input.via,
    providerId: input.providerId,
    model: input.model,
    agentId: input.agentId,
    promptTokens,
    completionTokens,
    totalTokens,
    latencyMs: input.latencyMs,
    estimatedCostUsd: estimateCostUsd(input.via, input.providerId, promptTokens, completionTokens),
  };
  state.providerSpendLog = [event, ...(state.providerSpendLog ?? [])].slice(0, SPEND_LOG_CAP);
  saveState(state);
  return { ...event };
}

export function listProviderSpendLog(limit = 50): ProviderSpendEvent[] {
  const n = Math.max(1, Math.min(SPEND_LOG_CAP, Math.floor(limit) || 50));
  return [...(loadState().providerSpendLog ?? [])].slice(0, n);
}

export function pushRoutingDecision(
  input: Omit<RoutingDecisionEvent, "id" | "at"> & { at?: string }
): RoutingDecisionEvent {
  const state = loadState();
  const event: RoutingDecisionEvent = {
    id: `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: input.at ?? new Date().toISOString(),
    threadKey: input.threadKey,
    textPreview: input.textPreview.slice(0, 120),
    category: input.category,
    target: input.target,
    action: input.action,
    compound: input.compound,
    confidence: input.confidence,
    via: input.via,
    gated: input.gated,
  };
  state.routingDecisionLog = [event, ...(state.routingDecisionLog ?? [])].slice(0, ROUTING_LOG_CAP);
  saveState(state);
  return { ...event };
}

export function listRoutingDecisions(limit = 40): RoutingDecisionEvent[] {
  const n = Math.max(1, Math.min(ROUTING_LOG_CAP, Math.floor(limit) || 40));
  return [...(loadState().routingDecisionLog ?? [])].slice(0, n);
}

export function getClarifyMissCount(threadKey: string): number {
  const key = threadKey.trim();
  if (!key) return 0;
  const n = loadState().clarifyMissesByThread?.[key];
  return typeof n === "number" && n > 0 ? Math.floor(n) : 0;
}

export function bumpClarifyMiss(threadKey: string): number {
  const key = threadKey.trim();
  if (!key) return 0;
  const state = loadState();
  const map = { ...(state.clarifyMissesByThread ?? {}) };
  const next = (typeof map[key] === "number" ? map[key]! : 0) + 1;
  map[key] = next;
  state.clarifyMissesByThread = map;
  saveState(state);
  return next;
}

export function resetClarifyMiss(threadKey: string): void {
  const key = threadKey.trim();
  if (!key) return;
  const state = loadState();
  const map = { ...(state.clarifyMissesByThread ?? {}) };
  if (!(key in map)) return;
  delete map[key];
  state.clarifyMissesByThread = map;
  saveState(state);
}

export function getAgentThreadMessages(agentId: string): ChatMessage[] {
  const id = agentId.trim();
  if (!id) return [];
  const list = loadState().agentThreads?.[id];
  return Array.isArray(list) ? [...list] : [];
}

/** Clear Chief 1:1 thread messages (keeps primary/secondary). */
export function clearChiefThreadMessages(): ChatMessage[] {
  const state = loadState();
  state.chiefThread = [];
  clearIntentPending("chief");
  saveState(state);
  return [];
}

/** Clear a registry agent 1:1 thread. Returns null if agentId empty. */
export function clearAgentThreadMessages(agentId: string): ChatMessage[] | null {
  const id = agentId.trim();
  if (!id) return null;
  const state = loadState();
  const map = { ...(state.agentThreads ?? {}) };
  map[id] = [];
  state.agentThreads = map;
  clearIntentPending(`agent:${id}`);
  saveState(state);
  return [];
}

/** Clear a Pro specialist thread. Returns null if proId empty. */
export function clearProThreadMessages(proId: string): ChatMessage[] | null {
  const id = proId.trim();
  if (!id) return null;
  const state = loadState();
  const map = { ...(state.proThreads ?? {}) };
  map[id] = [];
  state.proThreads = map;
  clearIntentPending(`pro:${id}`);
  saveState(state);
  return [];
}

export function pushChiefThreadMessages(messages: ChatMessage[]): void {
  if (!messages.length) return;
  const state = loadState();
  state.chiefThread = [...state.chiefThread, ...messages];
  saveState(state);
}

export function pushAgentThreadMessages(agentId: string, messages: ChatMessage[]): void {
  const id = agentId.trim();
  if (!id || !messages.length) return;
  const state = loadState();
  const map = { ...(state.agentThreads ?? {}) };
  const prev = map[id] ?? [];
  map[id] = [...prev, ...messages];
  state.agentThreads = map;
  saveState(state);
}

export function setAgentThreadPrimary(agentId: string, primary: string): void {
  const id = agentId.trim();
  if (!id || !primary.trim()) return;
  const state = loadState();
  state.agentThreadPrimary = { ...(state.agentThreadPrimary ?? {}), [id]: primary.trim() };
  saveState(state);
}

export function getProThreadMessages(proId: string): ChatMessage[] {
  const id = proId.trim();
  if (!id) return [];
  const list = loadState().proThreads?.[id];
  return Array.isArray(list) ? [...list] : [];
}

export function getProThreadPrimary(proId: string): string | null {
  const id = proId.trim();
  if (!id) return null;
  const p = loadState().proThreadPrimary?.[id]?.trim();
  return p || null;
}

export function pushProThreadMessages(proId: string, messages: ChatMessage[]): void {
  const id = proId.trim();
  if (!id || !messages.length) return;
  const state = loadState();
  const map = { ...(state.proThreads ?? {}) };
  const prev = map[id] ?? [];
  map[id] = [...prev, ...messages];
  state.proThreads = map;
  saveState(state);
}

export function setProThreadPrimary(proId: string, primary: string): void {
  const id = proId.trim();
  if (!id || !primary.trim()) return;
  const state = loadState();
  state.proThreadPrimary = { ...(state.proThreadPrimary ?? {}), [id]: primary.trim() };
  saveState(state);
}

const PENDING_TTL_MS = 5 * 60 * 1000;

export function getIntentPending(threadKey: string) {
  const key = threadKey.trim();
  if (!key) return null;
  const row = loadState().intentPendingByThread?.[key];
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    clearIntentPending(key);
    return null;
  }
  return row;
}

export function setIntentPending(
  threadKey: string,
  pending: { intentId: string; handler: string; slots: Record<string, string> }
): void {
  const key = threadKey.trim();
  if (!key) return;
  const state = loadState();
  const map = { ...(state.intentPendingByThread ?? {}) };
  map[key] = {
    ...pending,
    expiresAt: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
  };
  state.intentPendingByThread = map;
  saveState(state);
}

export function clearIntentPending(threadKey: string): void {
  const key = threadKey.trim();
  if (!key) return;
  const state = loadState();
  const map = { ...(state.intentPendingByThread ?? {}) };
  delete map[key];
  state.intentPendingByThread = map;
  saveState(state);
}

export function appendGroupMessage(input: {
  who: string;
  text: string;
  at?: string;
  decide?: boolean;
  final?: boolean;
  meta?: ChatMessage["meta"];
}): GroupMessage {
  const state = loadState();
  const message: GroupMessage = {
    id: `gm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    who: input.who,
    text: input.text,
    at: input.at ?? new Date().toISOString(),
    decide: input.decide,
    final: input.final === true ? true : undefined,
    meta: input.meta,
  };
  state.groupMessages = [...(state.groupMessages ?? []), message];
  const chats = Array.isArray(state.groupChats) ? [...state.groupChats] : [];
  const activeId = typeof state.activeGroupId === "string" ? state.activeGroupId.trim() : "";
  const idx = chats.findIndex((g) => g && g.id === (activeId || chats[0]?.id));
  if (idx >= 0 && chats[idx]) {
    chats[idx] = {
      ...chats[idx]!,
      messages: [...(chats[idx]!.messages ?? []), message],
    };
    state.groupChats = chats;
  }
  saveState(state);
  return message;
}

