import type { BoardStancesMap } from "./board.js";

export type ServiceKind = "app" | "desktop" | "runtime" | "router" | "custom";

export interface ServiceEntry {
  id: string;
  name: string;
  baseUrl: string;
  healthPath: string;
  kind: ServiceKind;
  status: "live" | "slow" | "off";
  lastSeen?: string;
  controls?: { restart?: boolean; clearRam?: boolean; start?: boolean };
}

export type ChatRole = "user" | "chief" | "agent" | "system" | "handoff";

/** How a thread turn was produced (stored on message meta, local app-state only). */
export type ChatMessageSource = "in-app" | "ams" | "llm" | "browser";

/** Per-stage ms / $ for one chat or group turn (intent → AMS → classifier → LLM). */
export interface TurnStageCost {
  stage: "intent" | "ams" | "classifier" | "llm";
  latencyMs: number;
  estimatedCostUsd: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  via?: string;
}

export interface TurnCostTrace {
  stages: TurnStageCost[];
  totalLatencyMs: number;
  totalEstimatedCostUsd: number;
  totalTokens: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  at: string;
  meta?: {
    primary?: string;
    secondary?: string;
    reason?: string;
    agentId?: string;
    upstreamModel?: string;
    via?: string;
    latencyMs?: number;
    promptTokens?: number;
    completionTokens?: number;
    tokensPerSecond?: number;
    /** Total estimated USD for the turn; 0 when unknown / local. */
    estimatedCostUsd?: number;
    /** Per-stage cost / latency breakdown for this turn. */
    costTrace?: TurnCostTrace;
    /** In-app router or AMS skill id when this turn was handled locally or via AMS preview. */
    intentId?: string;
    source?: ChatMessageSource;
    confidence?: number;
    /** JSON-serializable client actions (navigation, panic, etc.). */
    clientActions?: string;
    /** Hey Jev–inspired fan-out slot decisions for this turn (transparent routing). */
    decisionTrace?: {
      category?: string;
      target?: string;
      action?: string;
      compound?: boolean;
      confidence: number;
      via?: "rules" | "ams" | "rules+ams";
      gated?: string;
      firstAction?: string;
      secondAction?: string;
    };
  };
}

/** Ring-buffer row for Settings → Audits (fan-out routing). */
export interface RoutingDecisionEvent {
  id: string;
  at: string;
  threadKey: string;
  textPreview: string;
  category?: string;
  target?: string;
  action?: string;
  compound?: boolean;
  confidence: number;
  via?: "rules" | "ams" | "rules+ams";
  gated?: string;
}

export interface PermissionItem {
  id: string;
  title: string;
  description: string;
  kind: "shell" | "spend" | "skill" | "ops" | "other";
  status: "pending" | "approved" | "denied" | "always";
}

export type PermissionPolicy = "ask" | "always" | "never";

export interface StandingPermissionRule {
  id: string;
  category: "spend" | "shell" | "skill" | "ops";
  label: string;
  detail: string;
  policy: PermissionPolicy;
}

export interface ChannelDraft {
  id: string;
  channel: "gmail" | "github" | "telegram";
  title: string;
  meta: string;
  to: string;
  body: string;
  sent: boolean;
}

export interface GroupMessage {
  id: string;
  who: string;
  text: string;
  at: string;
  decide?: boolean;
  /** Distinct Final / converged answer in the thread. */
  final?: boolean;
  /** Optional generate metrics / cost trace (same family as ChatMessage.meta). */
  meta?: ChatMessage["meta"];
}

export type GroupSessionState = "open" | "closed";

export type GroupProposalDecision = "open" | "approved" | "rejected";

export interface GroupProposal {
  title: string;
  by: string;
  model: string;
  points: string[];
  note: string;
}

/**
 * Who synthesizes / posts the Final answer.
 * `"user"` = you moderate; otherwise a voting member agent id (default Chief).
 */
export type GroupModeratorId = "user" | string;

/** Named council group (multi-group CRUD). Legacy single-group fields mirror the active group. */
export interface NamedGroupChat {
  id: string;
  name: string;
  /** Optional discussion topic (editable in header; independent of message history). */
  topic?: string;
  memberIds: string[];
  /** Non-voting attendees — present in Meeting room, excluded from council generate. */
  observerIds?: string[];
  messages: GroupMessage[];
  session: GroupSessionState;
  proposal: GroupProposal;
  proposalDecision: GroupProposalDecision;
  /** Moderator: `"user"` or a member agent id. Defaults to Chief. */
  moderatorId: GroupModeratorId;
  /**
   * Hard cap on debate length (minutes). `null`/omit = unlimited.
   * Counted from `sessionStartedAt` while session is open.
   */
  maxDurationMinutes?: number | null;
  /** ISO timestamp when the current open session began (for max-duration countdown). */
  sessionStartedAt?: string | null;
}

/** Live task statuses. Legacy `open`/`done` migrate to `pending`/`completed` on load. */
export type TaskStatus = "pending" | "ongoing" | "completed" | "blocked";

/** Comment on a task ticket thread (persisted in app-state). */
export interface TaskComment {
  id: string;
  /** Display author: "you", agent id, or free label. */
  author: string;
  text: string;
  at: string;
  /** Resolved agent ids from `@agentId` tokens in `text`. */
  mentions?: string[];
}

/** File attachment metadata on a task (bytes live under app-state uploads/). */
export interface TaskAttachment {
  id: string;
  /** Original filename (sanitized for display). */
  name: string;
  mime: string;
  size: number;
  /** Relative path under dataDir uploads/ (never absolute client paths). */
  relativePath: string;
  uploadedAt: string;
  uploadedBy?: string;
}

/** User-facing classification for Home todos + Tasks (extensible). */
export type TaskCategory =
  | "work"
  | "personal"
  | "ops"
  | "research"
  | "finance"
  | "general";

export type TaskPriority = "low" | "normal" | "high";

/** Where a task was created — Home widget /todos use "todo". */
export type TaskOrigin = "todo" | "research" | "cron" | "board" | "api";

export interface AgentTask {
  id: string;
  title: string;
  /**
   * Owner agent id, or sentinel `boss` for Personal (Boss) items with no agent.
   * Default for new Home todos: `chief`.
   */
  agentId: string;
  status: TaskStatus;
  due?: string;
  /** Links a pipeline of research steps created from a Research brief. */
  researchId?: string;
  /** Pipeline step id: scope | gather | draft | review | report | participate */
  step?: string;
  /** Short detail shown on Tasks (e.g. question snippet). */
  note?: string;
  /** Classification tag (Work / Personal / Ops / …). */
  category?: TaskCategory;
  /** Light priority for Home / Tasks sorting. */
  priority?: TaskPriority;
  /** Creation source — Home todos set `todo`. */
  origin?: TaskOrigin;
  /** Optional ticket thread; omitted or [] when unused. */
  comments?: TaskComment[];
  /** Optional file attachments (metadata only in app-state). */
  attachments?: TaskAttachment[];
}

/**
 * Scheduled routine that creates a task when due.
 * Prefer `cronExpr` (5-field) when set; otherwise fall back to `everyMinutes`.
 */
export interface CronRoutine {
  id: string;
  title: string;
  agentId: string;
  /** Fallback interval in minutes (min 1) when cronExpr is absent/invalid. */
  everyMinutes: number;
  /** Optional standard 5-field crontab (minute hour dom month dow). */
  cronExpr?: string;
  enabled: boolean;
  note?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

/** Allowlisted BYO connector — invoke only via registry id (never free-form shell from chat). */
export type AdapterKind = "subprocess" | "http";

export interface AdapterEntry {
  id: string;
  name: string;
  kind: AdapterKind;
  /** Subprocess: executable path/name only (no shell). Paired with `args`. */
  command?: string;
  /** Subprocess: fixed argv after command. */
  args?: string[];
  /** HTTP: exact allowlisted URL (http/https). */
  url?: string;
  enabled: boolean;
  createdAt: string;
  lastInvokedAt?: string;
}

/** Scopes for per-agent API keys. */
export type AgentApiKeyScope = "chat" | "tasks:read";

/** Per-agent API token metadata (full token stored server-side only). */
export interface AgentApiKeyRecord {
  token: string;
  createdAt: string;
  last4: string;
  /** Allowed scopes; default `["chat","tasks:read"]` when missing (legacy keys). */
  scopes?: AgentApiKeyScope[];
}

/** In-app mention notification from a ticket comment. */
export interface MentionNotification {
  id: string;
  kind: "mention";
  /** Mentioned agent id. */
  agentId: string;
  taskId: string;
  commentId: string;
  fromAuthor: string;
  text: string;
  at: string;
  read: boolean;
}

/** Append-only provider call / spend audit event (from generate path). */
export interface ProviderSpendEvent {
  id: string;
  at: string;
  via: string;
  providerId?: string;
  model?: string;
  agentId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  /** Rough USD estimate; 0 when local / unknown (honest zero). */
  estimatedCostUsd?: number;
}

export type CalendarConnector = "google" | "microsoft" | "apple" | "caldav";

/** User-facing calendar connector preference (tokens stored separately). */
export interface CalendarPrefs {
  enabled: boolean;
  connector: CalendarConnector | null;
  accountLabel?: string;
}

/** Google Calendar OAuth tokens in app-state (never returned on public GET). */
export interface GoogleCalendarAuth {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when `accessToken` expires. */
  expiryMs?: number;
  email?: string;
}

/** Microsoft Graph OAuth tokens (calendar / mail) — never returned on public GET. */
export interface MicrosoftGraphAuth {
  accessToken: string;
  refreshToken?: string;
  expiryMs?: number;
  email?: string;
  /** Space-separated scopes granted. */
  scope?: string;
}

/** Google Drive OAuth tokens — separate from Gmail; never returned on public GET. */
export interface GoogleDriveAuth {
  accessToken: string;
  refreshToken?: string;
  expiryMs?: number;
  email?: string;
}

/** OAuth app client id/secret saved in Connections (Secret saved + last4). Env wins when set. */
export interface OAuthClientCredsStored {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export type OAuthClientSlotId = "gmail" | "google_calendar" | "google_drive" | "microsoft";

export interface CalendarEventItem {
  id: string;
  time: string;
  end?: string;
  title: string;
  place?: string;
  pending?: boolean;
}

export type MailConnectionKind = "imap" | "gmail";

/** Stored inbox connection — password never returned on GET status. */
export interface MailConnection {
  kind: MailConnectionKind;
  label?: string;
  address: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  secure?: boolean;
  authMethod?: "password" | "oauth";
  /** Gmail OAuth — stored server-side only; never returned on GET status. */
  oauthRefreshToken?: string;
  oauthAccessToken?: string;
  /** Unix ms when `oauthAccessToken` expires. */
  oauthExpiresAt?: number;
}

/** Work vs Personal — same user, separate prefs slices in app-state. */
export type UserProfileId = "work" | "personal";

export type ProfileHomeMode = "super" | "multi" | "pro";

/** Per-profile prefs (favorites, home mode, display context). */
export interface ProfilePrefsSlice {
  favoriteAgentIds: string[];
  homeMode: ProfileHomeMode;
  /** Short label / context shown with the profile (e.g. "Office", "Home desk"). */
  displayContext: string;
}

export interface UserPrefs {
  activeProfile: UserProfileId;
  profiles: Record<UserProfileId, ProfilePrefsSlice>;
  /**
   * When true (default), generate/chat/council system prompts ask for English-only
   * final answers and strip Chinese CoT / thinking tags from model output.
   */
  englishOnlyReplies: boolean;
}

/**
 * Optional Postgres control-plane module prefs (`docs/OPTIONAL-POSTGRES-MODULE.md`).
 * Default OFF — FileStore / app-state.json remains primary.
 */
export interface PostgresModulePrefs {
  usePostgres: boolean;
  /** Files primary; mirror ops to postgres module sink when on (stub until driver). */
  dualWrite: boolean;
  /** Server-only connection string; never returned fully on GET (last4 only). */
  connectionString?: string;
}

/** Kind of dictionary vocab row (Settings → Voice / Dictionary). */
export type VoiceDictionaryKind = "agent" | "skill" | "app" | "other";

/** Misheard / alias → canonical term for intent normalize + STT. */
export interface VoiceDictionaryEntry {
  heardAs: string;
  canonical: string;
  kind: VoiceDictionaryKind;
}

export interface AppState {
  chiefThread: ChatMessage[];
  chiefPrimary: string;
  chiefSecondary: string;
  permissions: PermissionItem[];
  /** User overrides for standing-rule policies (catalog ids → policy). */
  standingPermissionPolicies?: Record<string, PermissionPolicy>;
  /**
   * Work vs Personal profile prefs (`GET`/`PUT /api/prefs`).
   * Separate slices for favorites, home mode, display context.
   */
  prefs?: UserPrefs;
  /**
   * Optional Postgres module (`GET`/`PUT /api/postgres/prefs`).
   * Env `ASI_USE_POSTGRES` / `ASI_DATABASE_URL` / `ASI_POSTGRES_DUAL_WRITE` can override.
   */
  postgresPrefs?: PostgresModulePrefs;
  channelDrafts: ChannelDraft[];
  groupMessages: GroupMessage[];
  selectedModel?: string;
  /** Multi-select pool for Agent assignments (Browse Models checkboxes). Distinct from desk `selectedModel`. */
  selectedModelPool?: string[];
  /**
   * Ordered model failover (Cascade tab). When `enabled`, `routeGenerate` tries
   * agent primary → cascade `order` → agent secondary (unique). Not Micro→Hybrid staging.
   */
  modelCascade?: { enabled?: boolean; order?: string[] };
  onboardingComplete?: boolean;
  onboardingPath?: "chat" | "manual";
  /** Multi-mode council board; Chief is always present (normalized on read/write). */
  boardIds?: string[];
  /** Current decision / question for the board (`GET`/`PUT /api/board`). */
  boardTopic?: string;
  /** Per-agent stance on the current board decision (`GET`/`PUT /api/board`). */
  boardStances?: BoardStancesMap;
  /** Council session gate; members always mirror boardIds. */
  groupSession?: GroupSessionState;
  /** Active council proposal card (default seeded on first run). */
  groupProposal?: GroupProposal;
  /** User decision on the proposal card; resets to open when a new session opens. */
  groupProposalDecision?: GroupProposalDecision;
  /** Named group chats (CRUD). When empty, migrated from legacy group* + boardIds. */
  groupChats?: NamedGroupChat[];
  /** Active named group id for legacy `/api/group/*` and default UI. */
  activeGroupId?: string;
  /**
   * Last desk mode applied to the active council (`POST /api/group/council-mode`).
   * Mode switches start a fresh council session; only Chief is shared across modes.
   */
  councilMode?: ProfileHomeMode;
  /**
   * Per-mode council seats (multi / pro). Super is read-only over the prior thread.
   * Chief is always present; other members do not carry across modes.
   */
  councilRostersByMode?: Partial<
    Record<"multi" | "pro", { memberIds: string[]; observerIds?: string[] }>
  >;
  /**
   * 1:1 chat sidebar roster (non-Chief agents). Undefined = all registry agents.
   * Chief is always shown separately and cannot be removed.
   */
  chatRosterIds?: string[];
  /** User-built Pro set roster; Chief cannot be removed. */
  customProAgentIds?: string[];
  activeProSetId?: string;
  /** Per-agent primary/secondary overrides (registry file is not rewritten from UI). */
  agentModelAssignments?: Record<string, { primary?: string; secondary?: string }>;
  /** Per-agent generate path preference: `local` | `cloud` | `providerId:upstreamModel`. */
  agentRouting?: Record<string, string>;
  /** Skills attached from other agents/sets (merged on GET /api/agents; registry file unchanged). */
  agentImportedSkills?: Record<string, string[]>;
  /** AMS catalog skill ids enabled per registry agent (`GET/PUT /api/agents/:id/ams`). */
  agentAmsSkills?: Record<string, string[]>;
  /** Cloud inference API keys by provider id (never returned on GET). */
  providerApiKeys?: Record<string, string>;
  /**
   * Provider enable toggles (Settings → Connections). Persisted in app-state, not session-only.
   * Keys: registry provider ids plus lane toggles `local` / `relay`.
   */
  providerEnabled?: Record<string, boolean>;
  /** Agent work queue persisted from GET/POST/PATCH/DELETE /api/tasks. */
  tasks?: AgentTask[];
  /** Interval / crontab task creators (`GET/POST/PATCH/DELETE /api/cron`). */
  cronRoutines?: CronRoutine[];
  /** Allowlisted subprocess/HTTP adapters (`GET/POST/PATCH/DELETE /api/adapters`). */
  adapters?: AdapterEntry[];
  /** Per-agent Bearer tokens for POST /api/agents/:id/chat (external callers). */
  agentApiKeys?: Record<string, AgentApiKeyRecord>;
  /** Ticket @mention notifications (agent-linked). */
  mentionNotifications?: MentionNotification[];
  /** Provider generate spend / token audit (capped ring buffer). */
  providerSpendLog?: ProviderSpendEvent[];
  /** Fan-out routing decisions (capped ring buffer) for Settings → Audits. */
  routingDecisionLog?: RoutingDecisionEvent[];
  /** Consecutive low-confidence clarify misses per thread (reset on success). */
  clarifyMissesByThread?: Record<string, number>;
  /** Inbox IMAP/Gmail (app password or OAuth tokens). Env `ASI_IMAP_*` overrides when set. */
  mailConnection?: MailConnection;
  /** Calendar connector preference (`GET`/`PUT /api/calendar/prefs`). */
  calendar?: CalendarPrefs;
  /**
   * heard_as vocabulary (`GET`/`PUT /api/voice/dictionary`).
   * Alias → canonical for intent normalize and client STT.
   */
  voiceDictionary?: VoiceDictionaryEntry[];
  /** Google Calendar OAuth (`calendar` connector === `google` only). */
  calendarGoogleAuth?: GoogleCalendarAuth;
  /** Microsoft Graph OAuth (calendar connector === `microsoft`). */
  calendarMicrosoftAuth?: MicrosoftGraphAuth;
  /** Google Drive (opt-in; separate from Gmail scopes). */
  googleDriveAuth?: GoogleDriveAuth;
  /**
   * OAuth app client credentials (Gmail / Calendar / Drive / Microsoft).
   * Secrets never returned fully — status APIs expose last4 only.
   */
  oauthClients?: Partial<Record<OAuthClientSlotId, OAuthClientCredsStored>>;
  /** Per-agent chat threads (registry agents; Chief uses chiefThread). */
  agentThreads?: Record<string, ChatMessage[]>;
  /** Last primary model id used per agent thread. */
  agentThreadPrimary?: Record<string, string>;
  /** Pro specialist chat threads keyed by specialist id (`p-*`, custom `c-*`). */
  proThreads?: Record<string, ChatMessage[]>;
  /** Last primary model id per Pro specialist thread. */
  proThreadPrimary?: Record<string, string>;
  /** Pending destructive intent confirm per thread key (`chief`, `agent:id`, `pro:id`). */
  intentPendingByThread?: Record<
    string,
    {
      intentId: string;
      handler: string;
      slots: Record<string, string>;
      expiresAt: string;
    }
  >;
  /** Display-name overrides for registry agents (registry file is not rewritten). */
  agentDisplayNames?: Record<string, string>;
  /**
   * Staff role-label overrides for Chief (`chief` | `secretary` | `buddy`).
   * Registry `role` stays "Chief of staff"; UI shows `Name (roleLabel)`.
   */
  agentRoleLabels?: Record<string, string>;
  /**
   * Soft-deleted items (cleared chats, deleted agents, deleted logs, etc.).
   * Purged by retention job (`recycleRetentionDays`, default 90).
   */
  recycleBin?: RecycleBinItem[];
  /** Days to keep recycle-bin items: 0 = Immediately, or 1/3/7/15/30/45/90. Default 90. */
  recycleRetentionDays?: number;
  /** Company About Us briefing (Settings → Company / Training). */
  companyBriefing?: CompanyBriefing;
  /** Per-agent training memory from “Send all agents to training”. */
  agentTraining?: AgentTrainingMap;
  /**
   * Lessons — learning-process store of research reports, training pushes,
   * group Finals, and manual takeaways (`GET`/`POST` `/api/lessons`).
   */
  lessons?: Lesson[];
}

/** Origin of a Lesson entry (not generic file storage). Auto-tagged on create. */
export type LessonSource = "research" | "training" | "group_final" | "manual";

/** Persisted takeaway the team learned (Settings → Lessons / `/lessons`). */
export interface Lesson {
  id: string;
  title: string;
  body: string;
  /** Auto-tag from origin: research | training | group_final | manual. */
  source: LessonSource;
  agentIds: string[];
  createdAt: string;
  /** When true, always injected into agent training context (before recent unpinned). */
  pinned?: boolean;
}

/** Briefing age badge for Settings → Company / Training. */
export type BriefingFreshnessLevel = "fresh" | "aging" | "stale" | "missing";

export interface BriefingFreshness {
  level: BriefingFreshnessLevel;
  /** Whole days since `fetchedAt`; null when no briefing. */
  ageDays: number | null;
  label: string;
}

/** What changed when “Send all agents to training” ran. */
export interface TrainingDiffReport {
  newlyTrainedIds: string[];
  retrainedIds: string[];
  previousTrainedCount: number;
  trainedCount: number;
  previousBriefingChars: number | null;
  briefingChars: number;
  briefingChanged: boolean;
  summary: string;
}

/** Persisted company About Us text (paste or fetched URL). */
export interface CompanyBriefing {
  text: string;
  source: "url" | "paste";
  sourceUrl?: string;
  title?: string;
  fetchedAt: string;
  charCount: number;
}

/** Per-agent training payload injected into chat/council system context. */
export interface AgentTrainingEntry {
  trainedAt: string;
  role: string;
  learnings: string[];
  briefingChars: number;
}

export type AgentTrainingMap = Record<string, AgentTrainingEntry>;

/** Soft-deleted vault entries (Settings → Logs & Recycle bin). */
export type RecycleItemKind = "cleared_chat" | "cleared_group" | "deleted_agent" | "deleted_log";

export type RecycleThreadKey = "chief" | `agent:${string}` | `pro:${string}`;

export interface RecycleLogEntry {
  id: string;
  time: string;
  actor: string;
  agentId?: string;
  text: string;
  tone: "neutral" | "success" | "warn" | "danger";
}

export interface RecycleBinItem {
  id: string;
  kind: RecycleItemKind;
  label: string;
  deletedAt: string;
  expiresAt: string | null;
  payload: {
    threadKey?: RecycleThreadKey;
    messages?: ChatMessage[];
    groupId?: string;
    groupName?: string;
    groupMessages?: GroupMessage[];
    /** Registry / Pro agent snapshot (loose — avoid circular import with agents.ts). */
    agent?: {
      id: string;
      name: string;
      role: string;
      status?: string;
      modelId?: string | null;
      skills?: string[];
      source?: string;
      updatedAt?: string | null;
      avatar?: string | null;
      roleTag?: string | null;
      initials?: string | null;
      isChief?: boolean;
      currentTask?: string | null;
      routePref?: string | null;
      secondaryModelId?: string | null;
    };
    agentThread?: ChatMessage[];
    customPro?: boolean;
    logEntries?: RecycleLogEntry[];
  };
}
