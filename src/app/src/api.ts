export type PanelId =
  | "home"
  | "models"
  | "inbox"
  | "group"
  | "desk"
  | "permissions"
  | "channels"
  | "settings";

export interface ChatMessage {
  id: string;
  role: "user" | "chief" | "agent" | "system" | "handoff";
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
    intentId?: string;
    source?: ChatMessageSource;
    confidence?: number;
    clientActions?: string;
    /** Fan-out slot decisions (hey-jev routing transparency). */
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
    estimatedCostUsd?: number;
    costTrace?: {
      stages: Array<{
        stage: string;
        latencyMs: number;
        estimatedCostUsd: number;
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
        via?: string;
      }>;
      totalLatencyMs: number;
      totalEstimatedCostUsd: number;
      totalTokens: number;
    };
  };
}

export type ChatMessageSource = "in-app" | "ams" | "llm" | "browser";

export type ThreadAppendEntry = {
  role: ChatMessage["role"];
  text: string;
  intentId?: string;
  source?: ChatMessageSource;
};

export interface ModelCard {
  id: string;
  name: string;
  source: string;
  meta: string;
  tags: string[];
  paid: boolean;
  recommended?: boolean;
  kind?: "scanned" | "catalog" | "api";
  /** Provider id from Settings → Providers when routed via a cloud API. */
  provider?: string;
  /** Parameter size when known (e.g. `4B` from Ollama details / AMS catalog). */
  params?: string;
  /** Rough expected RAM at load (heuristic or catalog hint). */
  ramHint?: string;
}

export interface ModelsScanMeta {
  /** Artifacts under models/router/ — not the same as process live. */
  routerReady: boolean;
  /** True only when GET :7821/health (or ASI_ROUTER_URL) answers OK. */
  routerLive?: boolean;
  /** Process off / stub — inverse of routerLive. */
  routerStub?: boolean;
  probes: {
    ollama: { host: string; reachable: boolean; count: number; error?: string };
    llamacpp: { configured: boolean; base: string | null; reachable: boolean; count: number; error?: string };
    customGguf: number;
    /** AMS `models/ams/` — recipe count vs real `.gguf` / `.onnx` on disk. */
    ams?: { catalogTotal: number; catalogShown: number; installedGguf: number; installedOnnx?: number };
    api: {
      configuredProviderIds: string[];
      totalCount: number;
      providerCounts: Record<string, number>;
    };
  };
}

export interface ModelsApiResponse {
  models: ModelCard[];
  meta?: ModelsScanMeta;
  /** False when no HTTP response could be read (fail-closed empty). */
  ok: boolean;
}

export interface CapabilityCatalogModel {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  contextLength?: number;
  pricingHint?: "free" | "paid" | "unknown";
  modality?: string;
  notes?: string;
}

export interface ModelsCatalogResponse {
  source: "openrouter" | "curated";
  label: string;
  fetchedAt: string;
  total: number;
  limit: number;
  error?: string;
  models: CapabilityCatalogModel[];
}

export interface ModelDownloadItem {
  id: string;
  name: string;
  kind: string;
  capabilities: string[];
  method: "ollama" | "gguf" | "pip";
  command?: string;
  pathHint?: string;
  docsUrl?: string;
  notes?: string;
  suggestedFileName?: string;
  diskSizeHint?: string;
  ramHint?: string;
  hardwareHint?: string;
  installSteps?: string[];
  /** AMS only after disk probe. */
  status?: "recipe" | "installed";
  matchedFile?: string;
  /** Honest weight format when AMS status is installed. */
  weightFormat?: "gguf" | "onnx";
  /** Hugging Face org or model page when known. */
  hfUrl?: string;
  /** Ollama pull tag when method is ollama (parsed from command when needed). */
  ollamaTag?: string;
}

export type OllamaPullProgressEvent = {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  ok?: boolean;
  error?: string;
  tag?: string;
  host?: string;
};

export interface ModelDownloadsResponse {
  label: string;
  items: ModelDownloadItem[];
  ams?: {
    catalogTotal: number;
    recipeCount: number;
    installedCount: number;
    installedGgufFiles: number;
    installedOnnxFiles?: number;
    amsDir: string;
  };
}

export interface AmsInstallRow {
  id: string;
  name: string;
  role?: string;
  tier?: string;
  params?: string;
  default?: boolean;
  tags: string[];
  pathHint: string;
  weightHints: string[];
  suggestedFileName?: string;
  diskSizeHint?: string;
  ramHint?: string;
  hardwareHint?: string;
  obtainHint?: string;
  installSteps: string[];
  notes?: string;
  status: "recipe" | "installed";
  matchedFile?: string;
  matchedDir?: "ams" | "custom";
  weightFormat?: "gguf" | "onnx";
  suggestedOnnxFileName?: string;
}

export interface AmsInstallSnapshot {
  label: string;
  installRoot: string;
  amsDir: string;
  catalogTotal: number;
  recipeCount: number;
  installedCount: number;
  installedGgufFiles: number;
  installedOnnxFiles?: number;
  recipes: AmsInstallRow[];
}

export interface RecommendedTool {
  id: string;
  name: string;
  category: string;
  summary: string;
  installUrl?: string;
  docsUrl?: string;
  command?: string;
  verifyCommand?: string;
}

export interface RecommendedToolsResponse {
  label: string;
  tools: RecommendedTool[];
}

export interface AmsSkillEntry {
  id: string;
  name: string;
  group: string;
  description?: string;
}

export interface SkillsCatalogResponse {
  source: "config";
  label: string;
  fetchedAt: string;
  total: number;
  limit: number;
  skills: AmsSkillEntry[];
}

export interface AgentAmsSkillRow extends AmsSkillEntry {
  source: "catalog" | "registry";
  enabled: boolean;
}

export interface AgentAmsSnapshot {
  agentId: string;
  catalogLabel: string;
  catalogTotal: number;
  enabledSkillIds: string[];
  registrySkillIds: string[];
  skills: AgentAmsSkillRow[];
  singleSkillRunEnabled: boolean;
}

export interface ProviderPublicMeta {
  id: string;
  displayName: string;
  signupUrl: string;
  docsUrl: string;
  supportsFreeTier: boolean;
}

export interface ProviderKeyStatus {
  configured: boolean;
  last4?: string;
}

/** Loopback API port — matches server default (ASI_SERVER_PORT / ASI_ENGINE_PORT). */
export const ASI_API_LOOPBACK_PORT = 3445;

function apiLoopbackUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `http://127.0.0.1:${ASI_API_LOOPBACK_PORT}${p}`;
}

/** Same-origin first; direct loopback when UI has no /api proxy (see fetchDeskStatus). */
export function apiFetchUrls(path: string): string[] {
  const p = path.startsWith("/") ? path : `/${path}`;
  return [p, apiLoopbackUrl(p)];
}

function shouldRetryApiFallback(status: number): boolean {
  return status === 404 || status === 408 || status >= 500;
}

async function fetchWithApiFallback(path: string, init?: RequestInit): Promise<Response> {
  const urls = apiFetchUrls(path);
  let lastError: unknown;
  let lastRes: Response | undefined;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      // Spread init each attempt so POST bodies are not left consumed after a failed try.
      const res = await fetch(url, init ? { ...init } : undefined);
      if (res.ok) return res;
      lastRes = res;
      const isLast = i === urls.length - 1;
      if (isLast || !shouldRetryApiFallback(res.status)) return res;
    } catch (err) {
      lastError = err;
      if (i === urls.length - 1) break;
    }
  }
  if (lastRes) return lastRes;
  throw lastError ?? new Error(`Could not reach API ${path}`);
}

async function fetchJsonWithApiFallback<T>(path: string): Promise<T | null> {
  try {
    const res = await fetchWithApiFallback(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Fail-closed model list for Settings scanner — empty on error or missing payload. */
export async function scanModels(): Promise<ModelsApiResponse> {
  const data = await fetchJsonWithApiFallback<{ models?: ModelCard[]; meta?: ModelsScanMeta }>("/api/models");
  if (!data) return { models: [], ok: false };
  const models = Array.isArray(data.models) ? data.models : [];
  return {
    models,
    meta: data.meta,
    ok: true,
  };
}

async function fetchHealth(): Promise<HealthResponse> {
  // Prefer /health; also try /api/health for clients that only proxy /api/*.
  const data =
    (await fetchJsonWithApiFallback<HealthResponse>("/health")) ??
    (await fetchJsonWithApiFallback<HealthResponse>("/api/health"));
  if (!data) throw new Error("health unreachable");
  return data;
}

export interface ServiceEntry {
  id: string;
  name: string;
  baseUrl: string;
  status: "live" | "slow" | "off";
}


export interface RegistryAgent {
  id: string;
  name: string;
  role: string;
  status: string;
  modelId: string | null;
  secondaryModelId?: string | null;
  skills: string[];
  source?: string;
  updatedAt?: string | null;
  roleTag?: string;
  initials?: string;
  cube?: string;
  avatar?: string;
  isChief?: boolean;
  currentTask?: string;
  /** Org chart manager id. null/omit = flat peer (default on hire). */
  reportsTo?: string | null;
}

export type UserProfileId = "work" | "personal";
export type ProfileHomeMode = "super" | "multi" | "pro";

export interface ProfilePrefsSlice {
  favoriteAgentIds: string[];
  homeMode: ProfileHomeMode;
  displayContext: string;
}

export interface UserPrefs {
  activeProfile: UserProfileId;
  profiles: Record<UserProfileId, ProfilePrefsSlice>;
  /** Default true — English-only model replies (Settings → Language). */
  englishOnlyReplies: boolean;
}

export type VoiceDictionaryKind = "agent" | "skill" | "app" | "other";

export interface VoiceDictionaryEntry {
  heardAs: string;
  canonical: string;
  kind: VoiceDictionaryKind;
}

/** Settings → Logs & Recycle bin retention (0 = Immediately). */
export type RecycleRetentionDays = 0 | 1 | 3 | 7 | 15 | 30 | 45 | 90;

export type RecycleItemKind = "cleared_chat" | "cleared_group" | "deleted_agent" | "deleted_log";

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
    threadKey?: string;
    messages?: ChatMessage[];
    groupId?: string;
    groupName?: string;
    groupMessages?: GroupMessage[];
    agent?: RegistryAgent;
    agentThread?: ChatMessage[];
    customPro?: boolean;
    logEntries?: RecycleLogEntry[];
  };
}

export interface RecycleBinResponse {
  items: RecycleBinItem[];
  retentionDays: RecycleRetentionDays;
  purged?: number;
  retentionOptions?: RecycleRetentionDays[];
}

export interface AgentsApiResponse {
  agents: RegistryAgent[];
  lastScanAt: string | null;
  sources?: unknown;
}

/** GET /api/hardware — capacity + live usage; null fields = probe missing (fail-closed). */
export interface HardwareSnapshot {
  cpuThreads: number | null;
  cpuPercent: number | null;
  ramGb: number;
  ramUsedGb: number | null;
  ramUsedPct: number | null;
  vramGb: number | null;
  vramUsedGb: number | null;
  vramUsedPct: number | null;
  gpuPercent: number | null;
  notes?: string[];
}

export type PermissionPolicy = "ask" | "always" | "never";

export interface StandingPermissionRule {
  id: string;
  category: "spend" | "shell" | "skill" | "ops";
  label: string;
  detail: string;
  policy: PermissionPolicy;
}

export interface PermissionItem {
  id: string;
  title: string;
  description: string;
  kind: "shell" | "spend" | "skill" | "ops" | "other";
  status: "pending" | "approved" | "denied" | "always";
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

export interface InboxEmailMessage {
  id: string;
  from: string;
  address: string;
  subject: string;
  time: string;
  unread: boolean;
  body: string;
  suggest: string;
}

export interface InboxEmailStatus {
  configured: boolean;
  mode: "none" | "imap" | "gmail";
  source: "env" | "state" | null;
  authMethod: "password" | "oauth" | null;
  label?: string | null;
  address?: string | null;
  host?: string;
  port?: number;
  secure?: boolean;
  setup?: string;
  gmailOAuthReady?: boolean;
  gmailOAuthSource?: "env" | "state" | null;
  gmailOAuthLast4?: string;
  gmailRedirectUri?: string;
  pop3Supported?: boolean;
  pop3Note?: string;
  envPartial?: { hasHost: boolean; hasUser: boolean; hasPass: boolean } | null;
}

export type OAuthClientSlot = "gmail" | "google_calendar" | "google_drive" | "microsoft";

export interface OAuthClientPublicStatus {
  slot: OAuthClientSlot;
  configured: boolean;
  source: "env" | "state" | null;
  clientIdHint?: string;
  last4?: string;
  redirectUri: string;
  envKeys: string[];
}

export interface DriveStatus {
  oauthConfigured: boolean;
  oauthSource: "env" | "state" | null;
  last4?: string;
  redirectUri: string;
  connected: boolean;
  accountLabel: string | null;
  scopes: string[];
  message: string;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  folder: boolean;
}

export interface LocalFileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  mtime: string;
}

export interface InboxEmailMessagesResponse {
  configured: boolean;
  messages: InboxEmailMessage[];
  hint?: string;
  error?: string;
  message?: string;
  setup?: string;
}

export interface InboxEmailSendResponse {
  ok: boolean;
  messageId?: string | null;
  error?: string;
  message?: string;
  setup?: string;
}

/** Live task statuses. Legacy `open`/`done` map to `pending`/`completed`. */
export type TaskStatus = "pending" | "ongoing" | "completed" | "blocked";

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  at: string;
  mentions?: string[];
}

export interface TaskAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  relativePath: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export type TaskCategory =
  | "work"
  | "personal"
  | "ops"
  | "research"
  | "finance"
  | "general";

export type TaskPriority = "low" | "normal" | "high";

export type TaskOrigin = "todo" | "research" | "cron" | "board" | "api";

export type TodoAssignMode = "chief" | "auto" | "agent" | "personal";

export interface AgentTask {
  id: string;
  title: string;
  agentId: string;
  status: TaskStatus;
  due?: string;
  researchId?: string;
  step?: string;
  note?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  origin?: TaskOrigin;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
}

export interface CronRoutine {
  id: string;
  title: string;
  agentId: string;
  everyMinutes: number;
  cronExpr?: string;
  enabled: boolean;
  note?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

export type AgentApiKeyScope = "chat" | "tasks:read";

export interface MentionNotification {
  id: string;
  kind: "mention";
  agentId: string;
  taskId: string;
  commentId: string;
  fromAuthor: string;
  text: string;
  at: string;
  read: boolean;
}

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
  estimatedCostUsd?: number;
}

export type AdapterKind = "subprocess" | "http";

export interface AdapterEntry {
  id: string;
  name: string;
  kind: AdapterKind;
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
  createdAt: string;
  lastInvokedAt?: string;
}

export interface SkillGraphNode {
  id: string;
  kind: "skill" | "group" | "agent";
  label: string;
  group?: string;
  description?: string;
}

export interface SkillGraphEdge {
  id: string;
  from: string;
  to: string;
  kind: "group" | "agent";
}

export interface SkillsGraphResponse {
  shipped: true;
  studio: false;
  note: string;
  label: string;
  catalogTotal: number;
  nodes: SkillGraphNode[];
  edges: SkillGraphEdge[];
}

export interface SkillTemplate {
  id: string;
  label: string;
  description: string;
  defaultCount: number;
  agentCount: number;
  agents: { name: string; role: string }[];
}

export interface CompanyOpsItem {
  id: string;
  title: string;
  status: "shipped" | "not_shipped" | "partial" | string;
  summary: string;
  roadmap: string;
}

export interface ControlPlaneSnapshot {
  version: number;
  exportedAt: string;
  tasks: AgentTask[];
  lessons: Lesson[];
  agentTraining: Record<string, unknown>;
  cronRoutines: CronRoutine[];
  companyBriefing: CompanyBriefing | null;
}

export interface PostgresModuleStatus {
  usePostgres: boolean;
  dualWrite: boolean;
  connected: boolean;
  configured: boolean;
  last4?: string;
  setupRequired: boolean;
  activeStore: "file" | "postgres";
  envOverrides: {
    usePostgres: boolean;
    dualWrite: boolean;
    databaseUrl: boolean;
  };
  note: string;
}

export interface CompanyBriefing {
  text: string;
  source: "url" | "paste";
  sourceUrl?: string;
  title?: string;
  fetchedAt: string;
  charCount: number;
}

export type BriefingFreshnessLevel = "fresh" | "aging" | "stale" | "missing";

export interface BriefingFreshness {
  level: BriefingFreshnessLevel;
  ageDays: number | null;
  label: string;
}

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

export interface TrainingStatusResponse {
  briefing: CompanyBriefing | null;
  freshness: BriefingFreshness;
  trainedCount: number;
  lastTrainedAt: string | null;
  agents: { id: string; trainedAt: string | null; learningsCount: number; role: string | null }[];
  groupFinalLessons: Lesson[];
  pinnedLessonCount: number;
}

export interface SendAllTrainingResponse {
  ok: true;
  trainedCount: number;
  agentIds: string[];
  trainedAt: string;
  briefingChars: number;
  briefingSource: "url" | "paste";
  briefingUrl?: string;
  diff: TrainingDiffReport;
}

export type LessonSource = "research" | "training" | "group_final" | "manual";

export interface Lesson {
  id: string;
  title: string;
  body: string;
  source: LessonSource;
  agentIds: string[];
  createdAt: string;
  pinned?: boolean;
}

export type ResearchBriefType =
  | "quick"
  | "deep"
  | "predictive"
  | "literature"
  | "factcheck"
  | "compare";
export type ResearchBriefDepth = "5m" | "15m" | "30m" | "thorough";
export type ResearchBriefSelection = "cited" | "consensus" | "newest" | "balanced";
export type ResearchBriefFormat = "bullets" | "memo" | "citations" | "executive";

export interface ResearchBriefBody {
  question: string;
  agentId: string;
  type: ResearchBriefType | string;
  depth: ResearchBriefDepth | string;
  selection: ResearchBriefSelection | string;
  format: ResearchBriefFormat | string;
  participate?: boolean;
  /** Cap for deep / predictive virtual-agent fan-out. */
  maxVirtualAgents?: number;
  /** Override auto multi-agent for deep/predictive. */
  multiAgent?: boolean;
  /** Prefer Free OpenRouter + Ollama before paid (default true). */
  preferFree?: boolean;
  /** Fetch live pages via Virtual Desk browser when true. */
  liveWeb?: boolean;
}

export interface ResearchPipelineStepResult {
  step: "gather" | "draft" | "review" | "report" | "fanout" | string;
  ok: boolean;
  error?: string;
  via?: string;
  detail?: string;
}

export interface ResearchVirtualAgentSlot {
  slotId: string;
  modelId: string;
  label: string;
  angle: string;
  tier: "local" | "free" | "paid" | string;
}

export interface ResearchVirtualPoolPreview {
  agents: ResearchVirtualAgentSlot[];
  poolSize: number;
  usableCount: number;
  maxAgents: number;
  concurrency: number;
  usedPaid: boolean;
  preferFree: boolean;
  ollamaReachable: boolean;
  openRouterConfigured: boolean;
  source: string;
  emptyReason?: string;
  defaultMaxVirtualAgents?: number;
  resolvedMax?: number;
}

export interface ResearchTasksResponse {
  researchId: string;
  tasks: AgentTask[];
  brief: {
    type: string;
    depth: string;
    selection: string;
    format: string;
    participate: boolean;
    maxVirtualAgents?: number;
    multiAgent?: boolean;
    preferFree?: boolean;
    liveWeb?: boolean;
  };
  /** @deprecated Pipeline now runs gather→draft→report; always false when wired. */
  stub?: boolean;
  /**
   * True when report was generated and posted; false = fail-closed (no invented report).
   * Null/undefined while pipelineRunning (async kickoff).
   */
  pipelineOk?: boolean | null;
  /** True when POST returned before gather→draft→report finished — watch agent chat. */
  pipelineRunning?: boolean;
  /** Agent that owns the research thread (navigate here for live progress). */
  agentId?: string;
  /** Suggested chat path for the research thread. */
  chatPath?: string;
  webSearchAvailable?: boolean | null;
  liveWebRequested?: boolean;
  deskLive?: boolean;
  disclaimer?: string;
  report?: string;
  steps?: ResearchPipelineStepResult[];
  error?: string;
  message?: string;
  virtualPool?: ResearchVirtualPoolPreview;
  multiAgent?: boolean;
}

/** GET/POST /api/audit — local file-backed findings (no SQL DB). */
export type AuditSeverity = "info" | "warn" | "risk";
export type AuditArea =
  | "app-state"
  | "registry"
  | "agents"
  | "models"
  | "providers"
  | "research"
  | "desk"
  | "permissions";

export interface AuditFinding {
  id: string;
  severity: AuditSeverity;
  area: AuditArea;
  title: string;
  detail: string;
  evidence?: string;
}

export interface AuditAssumption {
  id: string;
  assumption: string;
  risk: string;
  basedOn: string[];
}

export interface AuditFailEvent {
  id: string;
  at: string;
  agentId: string;
  agentLabel: string;
  reason: string;
  text: string;
  kind: "chat_fail_closed";
}

export interface AuditPatternCount {
  key: string;
  label: string;
  count: number;
}

export interface AuditPatterns {
  sparse: boolean;
  note: string;
  failClosedCount: number;
  topFailReasons: AuditPatternCount[];
  frequentAgents: AuditPatternCount[];
  failByDay: { day: string; count: number }[];
  events: AuditFailEvent[];
}

export interface AuditReport {
  ok: true;
  scope: "local-files";
  ranAt: string;
  stateFile: string;
  findings: AuditFinding[];
  assumptions: AuditAssumption[];
  /** Recent fan-out routing decisions (also on chat message meta). */
  routingDecisions?: RoutingDecisionEvent[];
  /** Fail-closed + agent frequency patterns from live threads. */
  patterns?: AuditPatterns;
  summary: {
    findings: number;
    risks: number;
    warns: number;
    infos: number;
    assumptions: number;
    failClosed?: number;
  };
}

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

export interface GroupProposal {
  title: string;
  by: string;
  model: string;
  points: string[];
  note: string;
}

export type GroupProposalDecision = "open" | "approved" | "rejected";

export interface GroupSessionSnapshot {
  id?: string;
  name?: string;
  topic?: string;
  session: "open" | "closed";
  memberIds: string[];
  /** Non-voting attendees (Meeting room). */
  observerIds: string[];
  boardIds: string[];
  councilIds: string[];
  defaultBoardIds: string[];
  proposal: GroupProposal;
  proposalDecision: GroupProposalDecision;
  /** `"user"` or voting member agent id (default chief). */
  moderatorId: string;
  /** Hard cap in minutes; null = unlimited. */
  maxDurationMinutes: number | null;
  /** When the open session started (ISO); null if closed / unset. */
  sessionStartedAt: string | null;
  /** ISO end time when max duration applies; null if unlimited. */
  sessionExpiresAt: string | null;
  /** True when open session has passed max duration. */
  sessionExpired: boolean;
}

export interface GroupChatSummary {
  id: string;
  name: string;
  topic?: string;
  memberIds: string[];
  observerIds?: string[];
  session: "open" | "closed";
  messageCount: number;
  proposalDecision: GroupProposalDecision;
  moderatorId?: string;
  maxDurationMinutes?: number | null;
}

export type GroupConcludeResult = {
  messages: GroupMessage[];
  finalMessage: GroupMessage | null;
  draft?: string;
  label: string;
  moderatorId: string;
  ok: boolean;
  error?: string;
};

export type BoardStance = "for" | "info" | "against";

export interface BoardAgentStance {
  stance: BoardStance;
  note: string;
}

export interface BoardApiResponse {
  boardIds: string[];
  defaultBoardIds: string[];
  councilIds: string[];
  stances: Record<string, BoardAgentStance>;
  topic: string;
}

export type PutBoardPayload =
  | string[]
  | {
      boardIds?: string[];
      stances?: Record<string, BoardAgentStance>;
      topic?: string;
    };

export type BoardAskMemberResult = {
  agentId: string;
  name: string;
  ok: boolean;
  modelId: string;
  via?: string;
  stance?: BoardStance;
  note?: string;
  error?: string;
};

export type BoardAskResult = BoardApiResponse & {
  results: BoardAskMemberResult[];
  label: string;
};

export type CalendarConnector = "google" | "microsoft" | "apple" | "caldav";

export interface CalendarPrefs {
  enabled: boolean;
  connector: CalendarConnector | null;
  accountLabel?: string;
}

export interface CalendarStatus {
  configured: boolean;
  enabled: boolean;
  connector: CalendarConnector | null;
  accountLabel: string | null;
  live: boolean;
  syncReady: boolean;
  oauthConfigured?: boolean;
  googleConnected?: boolean;
  microsoftConnected?: boolean;
  microsoftOAuthConfigured?: boolean;
  microsoftShipped?: boolean;
  googleOAuthLast4?: string;
  googleRedirectUri?: string;
  microsoftOAuthLast4?: string;
  microsoftRedirectUri?: string;
  message: string;
}

export interface CalendarEventItem {
  id: string;
  time: string;
  end?: string;
  title: string;
  place?: string;
  pending?: boolean;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithApiFallback(path, init);
  if (!res.ok) {
    let detail = `${res.status} ${path}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export type HealthResponse = {
  ok: boolean;
  service?: string;
  port?: number;
  router?: {
    port: number;
    stub: boolean;
    artifactsReady: boolean;
    status: "live" | "off";
    /** Present when status is off — how to start the process (never claims live). */
    startHint?: string;
  };
};

export const api = {
  health: () => fetchHealth(),
  chiefThread: () => json<{ messages: ChatMessage[]; primary: string; secondary: string }>("/api/chief/thread"),
  /** DELETE clears Chief thread messages (fail-closed if API unavailable). */
  clearChiefThread: async () => {
    const res = await fetchWithApiFallback("/api/chief/thread", { method: "DELETE" });
    if (!res.ok) throw new Error(`Clear Chief thread failed (${res.status})`);
    return res.json() as Promise<{ ok: true; messages: ChatMessage[] }>;
  },
  /** POST body `{ text, modelId? }` → `{ messages }` (user + chief for this turn). 503 when generate fails (fail-closed). */
  chiefChat: async (text: string, modelId?: string) => {
    const res = await fetchWithApiFallback("/api/chief/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(modelId ? { text, modelId } : { text }),
    });
    if (!res.ok) {
      let detail = `Chief chat failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) detail = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    return res.json() as Promise<{ messages: ChatMessage[] }>;
  },
  chiefThreadAppend: async (entries: ThreadAppendEntry[]) => {
    const res = await fetchWithApiFallback("/api/chief/thread/append", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) throw new Error(`Chief thread append failed (${res.status})`);
    return res.json() as Promise<{ messages: ChatMessage[] }>;
  },
  agentThread: (agentId: string) =>
    json<{
      messages: ChatMessage[];
      primary: string | null;
      secondary: string | null;
      routePref?: string;
      routeSource?: "override" | "registry" | "default";
    }>(`/api/agents/${encodeURIComponent(agentId)}/thread`),
  clearAgentThread: async (agentId: string) => {
    const res = await fetchWithApiFallback(`/api/agents/${encodeURIComponent(agentId)}/thread`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Clear agent thread failed (${res.status})`);
    return res.json() as Promise<{ ok: true; messages: ChatMessage[] }>;
  },
  agentChat: async (agentId: string, text: string, modelId?: string) => {
    const res = await fetchWithApiFallback(`/api/agents/${encodeURIComponent(agentId)}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(modelId ? { text, modelId } : { text }),
    });
    if (!res.ok) {
      let detail = `Agent chat failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) detail = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    return res.json() as Promise<{ messages: ChatMessage[] }>;
  },
  agentThreadAppend: async (agentId: string, entries: ThreadAppendEntry[]) => {
    const res = await fetchWithApiFallback(`/api/agents/${encodeURIComponent(agentId)}/thread/append`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) throw new Error(`Agent thread append failed (${res.status})`);
    return res.json() as Promise<{ messages: ChatMessage[] }>;
  },
  proThread: (proId: string) =>
    json<{
      messages: ChatMessage[];
      primary: string | null;
      secondary: string | null;
      routePref?: string;
      routeSource?: "override" | "registry" | "default";
    }>(`/api/pro/agents/${encodeURIComponent(proId)}/thread`),
  clearProThread: async (proId: string) => {
    const res = await fetchWithApiFallback(`/api/pro/agents/${encodeURIComponent(proId)}/thread`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Clear pro thread failed (${res.status})`);
    return res.json() as Promise<{ ok: true; messages: ChatMessage[] }>;
  },
  /** POST body `{ text, modelId? }` → `{ messages }`. 503 when generate fails (fail-closed). */
  proChat: async (proId: string, text: string, modelId?: string) => {
    const res = await fetchWithApiFallback(`/api/pro/agents/${encodeURIComponent(proId)}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(modelId ? { text, modelId } : { text }),
    });
    if (!res.ok) {
      let detail = `Pro chat failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) detail = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    return res.json() as Promise<{ messages: ChatMessage[] }>;
  },
  proThreadAppend: async (proId: string, entries: ThreadAppendEntry[]) => {
    const res = await fetchWithApiFallback(`/api/pro/agents/${encodeURIComponent(proId)}/thread/append`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) throw new Error(`Pro thread append failed (${res.status})`);
    return res.json() as Promise<{ messages: ChatMessage[] }>;
  },
  models: () => json<ModelsApiResponse>("/api/models"),
  modelsCatalog: (opts?: {
    q?: string;
    capabilities?: string[];
    browse?: ("free" | "local" | "api")[];
    offset?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (opts?.q) params.set("q", opts.q);
    if (opts?.capabilities?.length) params.set("capabilities", opts.capabilities.join(","));
    if (opts?.browse?.length) params.set("browse", opts.browse.join(","));
    if (opts?.offset != null) params.set("offset", String(opts.offset));
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return json<ModelsCatalogResponse>(`/api/models/catalog${qs ? `?${qs}` : ""}`);
  },
  skillsCatalog: (opts?: { q?: string; group?: string; offset?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.q) params.set("q", opts.q);
    if (opts?.group) params.set("group", opts.group);
    if (opts?.offset != null) params.set("offset", String(opts.offset));
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return json<SkillsCatalogResponse>(`/api/skills/catalog${qs ? `?${qs}` : ""}`);
  },
  modelDownloads: () => json<ModelDownloadsResponse>("/api/models/downloads"),
  /**
   * Pull an Ollama tag via `POST /api/models/ollama/pull` (NDJSON progress stream).
   * Calls `onProgress` for each status line; resolves when `{ ok: true }` arrives.
   */
  ollamaPull: async (
    tag: string,
    onProgress?: (ev: OllamaPullProgressEvent) => void
  ): Promise<{ ok: true; tag: string; host: string }> => {
    const res = await fetchWithApiFallback("/api/models/ollama/pull", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/x-ndjson" },
      body: JSON.stringify({ tag }),
    });
    if (!res.ok) {
      let detail = `Ollama pull failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) detail = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    if (!res.body) throw new Error("Ollama pull returned empty body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let final: { ok: true; tag: string; host: string } | null = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: OllamaPullProgressEvent;
        try {
          parsed = JSON.parse(trimmed) as OllamaPullProgressEvent;
        } catch {
          continue;
        }
        onProgress?.(parsed);
        if (parsed.error && parsed.ok === false) {
          throw new Error(parsed.error);
        }
        if (parsed.ok === true && parsed.tag) {
          final = { ok: true, tag: parsed.tag, host: parsed.host ?? "" };
        }
      }
    }
    if (buf.trim()) {
      try {
        const parsed = JSON.parse(buf.trim()) as OllamaPullProgressEvent;
        onProgress?.(parsed);
        if (parsed.error && parsed.ok === false) throw new Error(parsed.error);
        if (parsed.ok === true && parsed.tag) {
          final = { ok: true, tag: parsed.tag, host: parsed.host ?? "" };
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
      }
    }
    if (!final) throw new Error("Ollama pull finished without success");
    return final;
  },
  amsModels: () => json<AmsInstallSnapshot>("/api/models/ams"),
  /** Pull ship AMS GGUFs into models/ams/ (HF_TOKEN for gated repos). */
  amsDownload: (recipeId?: string) =>
    json<{
      ok: boolean;
      amsDir: string;
      tokenPresent: boolean;
      results: Array<{
        id: string;
        name?: string;
        status: string;
        matchedFile?: string;
        weightFormat?: "gguf" | "onnx";
        downloaded?: boolean;
        error?: string;
        note?: string;
        hfPage?: string;
      }>;
      snapshot: AmsInstallSnapshot;
      error?: string;
    }>("/api/models/ams/download", {
      method: "POST",
      body: JSON.stringify(recipeId ? { recipeId } : {}),
    }),
  placeAmsGguf: (body: { sourcePath: string; recipeId?: string; fileName?: string }) =>
    json<{
      ok: true;
      destPath: string;
      fileName: string;
      recipeId?: string;
      statusAfter: "recipe" | "installed";
      snapshot: AmsInstallSnapshot;
    }>("/api/models/ams/place", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  recommendedTools: () => json<RecommendedToolsResponse>("/api/tools/recommended"),
  scanModels,
  providers: () =>
    json<{ providers: ProviderPublicMeta[]; enabled?: Record<string, boolean> }>("/api/providers"),
  providerEnabled: () => json<{ enabled: Record<string, boolean> }>("/api/providers/enabled"),
  putProviderEnabled: (id: string, enabled: boolean) =>
    json<{ enabled: Record<string, boolean> }>("/api/providers/enabled", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    }),
  providerKeys: () => json<{ keys: Record<string, { configured: boolean; last4?: string }> }>("/api/providers/keys"),
  putProviderKey: (providerId: string, apiKey: string) =>
    json<{ providerId: string; configured: boolean; last4?: string }>("/api/providers/keys", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId, apiKey }),
    }),
  testProviderKey: (providerId: string, opts?: { apiKey?: string; model?: string }) =>
    json<{
      ok: boolean;
      working: boolean;
      reply?: string;
      error?: string;
      status?: number;
      model: string;
    }>("/api/providers/keys/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        ...(opts?.apiKey ? { apiKey: opts.apiKey } : {}),
        ...(opts?.model ? { model: opts.model } : {}),
      }),
    }),
  providerModels: (providerId: string) =>
    json<{ models: { id: string; name?: string }[]; error?: string }>(
      `/api/providers/${encodeURIComponent(providerId)}/models`
    ),
  modelsSelection: () =>
    json<{ selectedModelId: string | null; selectedModelIds: string[] }>("/api/models/selection"),
  patchModelsSelection: (patch: {
    selectedModelId?: string | null;
    selectedModelIds?: string[];
  }) =>
    json<{ selectedModelId: string | null; selectedModelIds: string[] }>("/api/models/selection", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  modelsCascade: () => json<{ enabled: boolean; order: string[] }>("/api/models/cascade"),
  patchModelsCascade: (patch: { enabled?: boolean; order?: string[] }) =>
    json<{ enabled: boolean; order: string[] }>("/api/models/cascade", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  agentModelAssignments: () =>
    json<{ assignments: Record<string, { primary?: string; secondary?: string }> }>(
      "/api/agents/model-assignments"
    ),
  agentRouting: () => json<{ routing: Record<string, string> }>("/api/agents/routing"),
  putAgentRouting: (routing: Record<string, string>) =>
    json<{ routing: Record<string, string> }>("/api/agents/routing", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ routing }),
    }),
  putAgentModelAssignments: (assignments: Record<string, { primary?: string; secondary?: string }>) =>
    json<{ assignments: Record<string, { primary?: string; secondary?: string }> }>(
      "/api/agents/model-assignments",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments }),
      }
    ),
  patchAgentModels: (
    agentId: string,
    patch: {
      primaryModelId?: string | null;
      secondaryModelId?: string | null;
      routePref?: string | null;
    }
  ) =>
    json<{
      agentId: string;
      primaryModelId: string | null;
      secondaryModelId: string | null;
      routePref: string | null;
    }>(`/api/agents/${encodeURIComponent(agentId)}/models`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }
    ),
  patchAgentSkills: (agentId: string, skill: string, action: "attach" | "detach" = "attach") =>
    json<{ agentId: string; skills: string[] }>(`/api/agents/${encodeURIComponent(agentId)}/skills`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skill, action }),
    }),
  agentAms: (agentId: string) =>
    json<AgentAmsSnapshot>(`/api/agents/${encodeURIComponent(agentId)}/ams`),
  putAgentAms: (agentId: string, enabledSkillIds: string[]) =>
    json<AgentAmsSnapshot>(`/api/agents/${encodeURIComponent(agentId)}/ams`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabledSkillIds }),
    }),
  /** POST `{ skillId, text, modelId? }` — single-skill generate with agent context. 501 when gated off; 503 when no LLM. */
  runAgentAms: async (
    agentId: string,
    body: { skillId: string; text: string; modelId?: string },
  ): Promise<{
    agentId: string;
    skillId: string;
    text: string;
    via?: string;
    modelId: string;
    note?: string;
    messages?: ChatMessage[];
  }> => {
    const res = await fetchWithApiFallback(`/api/agents/${encodeURIComponent(agentId)}/ams/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = `AMS skill run failed (${res.status})`;
      try {
        const errBody = (await res.json()) as { error?: string; code?: string };
        if (errBody.error) detail = errBody.error;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    return res.json() as Promise<{
      agentId: string;
      skillId: string;
      text: string;
      via?: string;
      modelId: string;
      note?: string;
      messages?: ChatMessage[];
    }>;
  },
  registry: () => json<{ services: ServiceEntry[] }>("/registry"),
  permissions: () => json<{ items: PermissionItem[] }>("/api/permissions"),
  permAction: (id: string, action: "approve" | "deny" | "always") =>
    json<{ ok: boolean }>(`/api/permissions/${id}/${action}`, { method: "POST" }),
  standingPermissions: () => json<{ rules: StandingPermissionRule[] }>("/api/permissions/standing"),
  putStandingPermissions: (rules: { id: string; policy: PermissionPolicy }[]) =>
    json<{ rules: StandingPermissionRule[] }>("/api/permissions/standing", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rules }),
    }),
  channelDrafts: () => json<{ drafts: ChannelDraft[] }>("/api/channels/drafts"),
  createChannelDraft: (body: {
    channel: ChannelDraft["channel"];
    title: string;
    meta?: string;
    to?: string;
    body?: string;
  }) =>
    json<{ draft: ChannelDraft }>("/api/channels/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  patchChannelDraft: (id: string, patch: Partial<Pick<ChannelDraft, "channel" | "title" | "meta" | "to" | "body">>) =>
    json<{ draft: ChannelDraft }>(`/api/channels/drafts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  sendDraft: (id: string) => json<{ ok: boolean; message: string }>(`/api/channels/drafts/${id}/send`, { method: "POST" }),
  inboxEmailStatus: () => json<InboxEmailStatus>("/api/inbox/email/status"),
  testInboxEmailConnection: () =>
    json<{
      ok: boolean;
      host?: string;
      port?: number;
      mailbox?: string;
      messageCount?: number;
      authMethod?: string;
      error?: string;
      message?: string;
    }>("/api/inbox/email/test", { method: "POST" }),
  oauthClients: () =>
    json<{ clients: Record<OAuthClientSlot, OAuthClientPublicStatus> }>("/api/connections/oauth-clients"),
  oauthClient: (slot: OAuthClientSlot) =>
    json<OAuthClientPublicStatus>(`/api/connections/oauth-clients/${encodeURIComponent(slot)}`),
  putOAuthClient: (
    slot: OAuthClientSlot,
    body: { clientId?: string; clientSecret?: string; redirectUri?: string | null; clear?: boolean } | null
  ) =>
    json<OAuthClientPublicStatus>(`/api/connections/oauth-clients/${encodeURIComponent(slot)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }),
  driveStatus: () => json<DriveStatus>("/api/drive/status"),
  driveFiles: (folderId?: string) => {
    const q = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
    return json<{ connected: boolean; files: DriveFileItem[]; folderId?: string; message?: string; error?: string }>(
      `/api/drive/files${q}`
    );
  },
  driveConnect: () => {
    window.location.assign("/api/drive/oauth/google/start");
  },
  driveDisconnect: () =>
    json<{ ok: boolean; status: DriveStatus }>("/api/drive/oauth/google/disconnect", { method: "POST" }),
  filesStatus: () =>
    json<{
      roots: { id: string; label: string; path: string }[];
      dataDir: string;
      maxUploadBytes: number;
      note: string;
    }>("/api/files/status"),
  filesList: (root: string, path = "") => {
    const q = new URLSearchParams({ root, path });
    return json<{ root: string; path: string; entries: LocalFileEntry[] }>(`/api/files/list?${q}`);
  },
  filesDownloadUrl: (root: string, path: string) => {
    const q = new URLSearchParams({ root, path });
    return `/api/files/download?${q}`;
  },
  filesMkdir: (root: string, path: string, name: string) =>
    json<{ ok: boolean; path: string }>("/api/files/mkdir", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ root, path, name }),
    }),
  filesUpload: (root: string, path: string, name: string, dataBase64: string) =>
    json<{ ok: boolean; path: string; size: number }>("/api/files/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ root, path, name, dataBase64 }),
    }),
  filesDelete: (root: string, path: string) =>
    json<{ ok: boolean }>("/api/files", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ root, path }),
    }),
  inboxEmailMessages: async (): Promise<InboxEmailMessagesResponse> => {
    const res = await fetch("/api/inbox/email/messages");
    const data = (await res.json()) as InboxEmailMessagesResponse;
    if (res.status === 501) {
      return {
        configured: false,
        messages: [],
        error: "not_implemented",
        message: data.message,
        setup: data.setup,
      };
    }
    if (!res.ok) {
      return {
        configured: Boolean(data.configured),
        messages: Array.isArray(data.messages) ? data.messages : [],
        error: data.error ?? "fetch_failed",
        message: data.message,
      };
    }
    return {
      configured: Boolean(data.configured),
      messages: Array.isArray(data.messages) ? data.messages : [],
      hint: data.hint,
    };
  },
  putInboxEmailConnection: (body: Record<string, unknown> | null) =>
    json<InboxEmailStatus>("/api/inbox/email/connection", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }),
  inboxEmailOAuthStartUrl: (params?: { address?: string; label?: string }) => {
    const q = new URLSearchParams();
    if (params?.address?.trim()) q.set("address", params.address.trim());
    if (params?.label?.trim()) q.set("label", params.label.trim());
    const suffix = q.toString();
    return suffix ? `/api/inbox/email/oauth/start?${suffix}` : "/api/inbox/email/oauth/start";
  },
  sendInboxEmail: async (body: {
    to: string;
    subject: string;
    text?: string;
    body?: string;
    inReplyTo?: string;
    references?: string;
  }): Promise<InboxEmailSendResponse> => {
    const res = await fetch("/api/inbox/email/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as InboxEmailSendResponse;
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? "send_failed",
        message: data.message,
        setup: data.setup,
      };
    }
    return { ok: true, messageId: data.messageId ?? null };
  },
  tasks: () => json<{ tasks: AgentTask[] }>("/api/tasks"),
  createTask: (body: {
    title: string;
    agentId?: string;
    status?: TaskStatus;
    due?: string;
    researchId?: string;
    step?: string;
    note?: string;
    category?: TaskCategory;
    priority?: TaskPriority;
    origin?: TaskOrigin;
    assignMode?: TodoAssignMode;
    suggestCategory?: boolean;
    /** Seed agent chat + Boss ping when assigned (default true for todos). */
    startWork?: boolean;
  }) =>
    json<{
      task: AgentTask;
      assign?: { mode: TodoAssignMode; matched: boolean; score: number };
      kickoff?: { kicked: boolean; chatSeeded: boolean; bossPinged: boolean; reason?: string };
    }>(
      "/api/tasks",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
  /** Preview assignee + category for Home To-do (no write). */
  assignPreview: (body: {
    title?: string;
    text?: string;
    assignMode?: TodoAssignMode;
    category?: TaskCategory;
    agentId?: string;
  }) =>
    json<{
      agentId: string;
      matched: boolean;
      score: number;
      category: TaskCategory;
      assignMode: TodoAssignMode;
      bossId: string;
      chiefId: string;
    }>("/api/tasks/assign-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  createResearchTasks: (body: ResearchBriefBody) =>
    json<ResearchTasksResponse>("/api/tasks/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  /** Preview virtual agents for deep / predictive research from selectedModelPool. */
  researchPoolPreview: (opts?: {
    maxVirtualAgents?: number;
    mode?: "deep" | "predictive";
    preferFree?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (opts?.maxVirtualAgents != null) q.set("maxVirtualAgents", String(opts.maxVirtualAgents));
    if (opts?.mode) q.set("mode", opts.mode);
    if (opts?.preferFree === false) q.set("preferFree", "0");
    const qs = q.toString();
    return json<ResearchVirtualPoolPreview>(
      `/api/tasks/research/pool-preview${qs ? `?${qs}` : ""}`
    );
  },
  patchTask: (
    id: string,
    patch: Partial<
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
    > & { startWork?: boolean }
  ) =>
    json<{
      task: AgentTask;
      kickoff?: { kicked: boolean; chatSeeded: boolean; bossPinged: boolean; reason?: string };
    }>(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  deleteTask: (id: string) =>
    json<{ ok: true }>(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }),
  taskComments: (id: string) =>
    json<{ comments: TaskComment[] }>(`/api/tasks/${encodeURIComponent(id)}/comments`),
  addTaskComment: (id: string, body: { text: string; author?: string }) =>
    json<{ comment: TaskComment; task: AgentTask; mentions: string[] }>(
      `/api/tasks/${encodeURIComponent(id)}/comments`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
  taskAttachments: (id: string) =>
    json<{ attachments: TaskAttachment[]; maxBytes: number }>(
      `/api/tasks/${encodeURIComponent(id)}/attachments`
    ),
  addTaskAttachment: (
    id: string,
    body: { name: string; dataBase64: string; mime?: string; uploadedBy?: string }
  ) =>
    json<{ attachment: TaskAttachment; task: AgentTask }>(
      `/api/tasks/${encodeURIComponent(id)}/attachments`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
  deleteTaskAttachment: (taskId: string, attId: string) =>
    json<{ ok: true }>(
      `/api/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attId)}`,
      { method: "DELETE" }
    ),
  mentions: (opts?: { agentId?: string; unread?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.agentId) q.set("agentId", opts.agentId);
    if (opts?.unread) q.set("unread", "1");
    const suffix = q.toString();
    return json<{ mentions: MentionNotification[] }>(
      suffix ? `/api/mentions?${suffix}` : "/api/mentions"
    );
  },
  markMentionRead: (id: string) =>
    json<{ mention: MentionNotification }>(`/api/mentions/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    }),
  cronRoutines: () =>
    json<{ routines: CronRoutine[]; shipped: boolean; engine: string; note?: string }>("/api/cron"),
  createCronRoutine: (body: {
    title: string;
    agentId: string;
    everyMinutes?: number;
    cronExpr?: string;
    enabled?: boolean;
    note?: string;
  }) =>
    json<{ routine: CronRoutine }>("/api/cron", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  patchCronRoutine: (
    id: string,
    patch: Partial<Pick<CronRoutine, "title" | "agentId" | "everyMinutes" | "cronExpr" | "enabled" | "note">>
  ) =>
    json<{ routine: CronRoutine }>(`/api/cron/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  deleteCronRoutine: (id: string) =>
    json<{ ok: true }>(`/api/cron/${encodeURIComponent(id)}`, { method: "DELETE" }),
  adapters: () =>
    json<{
      adapters: AdapterEntry[];
      shipped: boolean;
      invokeGatedBy: string;
      singleSkillRunEnabled: boolean;
      note?: string;
    }>("/api/adapters"),
  createAdapter: (body: {
    name: string;
    kind: AdapterKind;
    command?: string;
    args?: string[];
    url?: string;
    enabled?: boolean;
  }) =>
    json<{ adapter: AdapterEntry }>("/api/adapters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  patchAdapter: (
    id: string,
    patch: Partial<Pick<AdapterEntry, "name" | "kind" | "command" | "args" | "url" | "enabled">>
  ) =>
    json<{ adapter: AdapterEntry }>(`/api/adapters/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  deleteAdapter: (id: string) =>
    json<{ ok: true }>(`/api/adapters/${encodeURIComponent(id)}`, { method: "DELETE" }),
  invokeAdapter: async (id: string, body?: { input?: string; text?: string }) => {
    const res = await fetchWithApiFallback(`/api/adapters/${encodeURIComponent(id)}/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      let detail = `Adapter invoke failed (${res.status})`;
      try {
        const err = (await res.json()) as { error?: string };
        if (err?.error) detail = err.error;
      } catch {
        /* keep status detail */
      }
      throw new Error(detail);
    }
    return res.json() as Promise<{
      adapterId: string;
      kind: AdapterKind;
      stdout?: string;
      stderr?: string;
      exitCode?: number | null;
      status?: number;
      body?: string;
      note?: string;
    }>;
  },
  skillsGraph: () => json<SkillsGraphResponse>("/api/skills/graph"),
  knowledgeGraph: () =>
    json<{
      shipped: true;
      engine: string;
      note: string;
      moduleId: string;
      updatedAt: string;
      nodes: { id: string; kind: string; label: string; props?: Record<string, unknown> }[];
      edges: { id: string; from: string; to: string; kind: string }[];
      counts: { agent: number; skill: number; task: number; lesson: number; edges: number };
    }>("/api/kg"),
  knowledgeGraphQuery: (q: string, limit = 40) =>
    json<{
      q: string;
      matchedNodes: { id: string; kind: string; label: string }[];
      matchedEdges: { id: string; from: string; to: string; kind: string }[];
      neighborNodes: { id: string; kind: string; label: string }[];
    }>(`/api/kg/query?q=${encodeURIComponent(q)}&limit=${limit}`),
  agentApiKey: (agentId: string) =>
    json<{ configured: boolean; last4?: string; createdAt?: string; scopes?: AgentApiKeyScope[] }>(
      `/api/agents/${encodeURIComponent(agentId)}/api-key`
    ),
  createAgentApiKey: (agentId: string, body?: { scopes?: AgentApiKeyScope[] }) =>
    json<{
      configured: boolean;
      token: string;
      last4: string;
      createdAt: string;
      scopes?: AgentApiKeyScope[];
      hint?: string;
    }>(`/api/agents/${encodeURIComponent(agentId)}/api-key`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }),
  revokeAgentApiKey: (agentId: string) =>
    json<{ ok: true; configured: boolean }>(`/api/agents/${encodeURIComponent(agentId)}/api-key`, {
      method: "DELETE",
    }),
  skillTemplates: () =>
    json<{ templates: SkillTemplate[]; studio: boolean; note?: string }>("/api/skill-templates"),
  applySkillTemplate: (id: string, body?: { count?: number }) =>
    json<{
      templateId: string;
      created: unknown[];
      agents: unknown[];
      studio: boolean;
      note?: string;
    }>(`/api/skill-templates/${encodeURIComponent(id)}/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }),
  companyOps: () => json<{ items: CompanyOpsItem[] }>("/api/company-ops"),
  postgresPrefs: () => json<PostgresModuleStatus>("/api/postgres/prefs"),
  putPostgresPrefs: (body: {
    usePostgres?: boolean;
    dualWrite?: boolean;
    connectionString?: string | null;
  }) =>
    json<PostgresModuleStatus>("/api/postgres/prefs", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  exportControlPlane: () => json<ControlPlaneSnapshot>("/api/control-plane/export"),
  importControlPlane: (snapshot: ControlPlaneSnapshot | Record<string, unknown>) =>
    json<{ ok: true; snapshot: ControlPlaneSnapshot }>("/api/control-plane/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(snapshot),
    }),
  trainStatus: () =>
    json<{ shipped: boolean; status: string; jobs: unknown[]; message: string }>("/api/train/status"),
  /** Alias of `GET /api/group` — same payload as `groupSession()`. */
  groupCouncil: () => json<GroupSessionSnapshot>("/api/group"),
  groupMessages: (groupId?: string) =>
    json<{ messages: GroupMessage[] }>(
      groupId
        ? `/api/groups/${encodeURIComponent(groupId)}/messages`
        : "/api/group/messages"
    ),
  clearGroupMessages: async (groupId?: string) => {
    const path = groupId
      ? `/api/groups/${encodeURIComponent(groupId)}/messages`
      : "/api/group/messages";
    const res = await fetchWithApiFallback(path, { method: "DELETE" });
    if (!res.ok) throw new Error(`Clear group messages failed (${res.status})`);
    return res.json() as Promise<{ ok: true; messages: GroupMessage[] }>;
  },
  groupDecide: (
    action: "approve" | "ask" | "reject" | "reopen" | "message" | (string & {}),
    opts?: { text?: string; groupId?: string }
  ) => {
    const path = opts?.groupId
      ? `/api/groups/${encodeURIComponent(opts.groupId)}/decide`
      : "/api/group/decide";
    return json<{ label: string; proposalDecision?: GroupProposalDecision }>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts?.text ? { action, text: opts.text } : { action }),
    });
  },
  /** One council LLM round — optional `text` posts a user message first, then each voting member replies. */
  groupGenerate: async (opts?: { text?: string; groupId?: string }) => {
    const path = opts?.groupId
      ? `/api/groups/${encodeURIComponent(opts.groupId)}/generate`
      : "/api/group/generate";
    const bodyText = opts?.text?.trim();
    const res = await fetchWithApiFallback(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bodyText ? { text: bodyText } : {}),
    });
    const body = (await res.json().catch(() => ({}))) as {
      messages?: GroupMessage[];
      results?: {
        agentId: string;
        name: string;
        ok: boolean;
        modelId: string;
        via?: string;
        error?: string;
      }[];
      label?: string;
      error?: string;
      message?: string;
      sessionExpired?: boolean;
    };
    if (!res.ok) {
      const err = new Error(
        body.message || body.error || `${res.status} ${path}`
      ) as Error & { sessionExpired?: boolean; payload?: typeof body };
      err.sessionExpired = body.sessionExpired === true || body.error === "session_expired";
      err.payload = body;
      throw err;
    }
    return {
      messages: body.messages ?? [],
      results: body.results ?? [],
      label: body.label ?? "",
      sessionExpired: body.sessionExpired === true,
      error: body.error,
    };
  },
  /**
   * Conclude debate → Final message.
   * Agent moderator: synthesis pass. User moderator: pass `verdict` (+ optional shortlist);
   * `draftOnly: true` asks Chief for an editable draft without posting Final.
   */
  groupConclude: (opts?: {
    groupId?: string;
    verdict?: string;
    shortlist?: string[];
    draftOnly?: boolean;
  }) => {
    const path = opts?.groupId
      ? `/api/groups/${encodeURIComponent(opts.groupId)}/conclude`
      : "/api/group/conclude";
    const body: Record<string, unknown> = {};
    if (opts?.verdict != null) body.verdict = opts.verdict;
    if (opts?.shortlist) body.shortlist = opts.shortlist;
    if (opts?.draftOnly) body.draftOnly = true;
    return json<GroupConcludeResult>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  groupSession: (groupId?: string) =>
    json<GroupSessionSnapshot>(
      groupId ? `/api/groups/${encodeURIComponent(groupId)}` : "/api/group/session"
    ),
  patchGroupSession: (session: "open" | "closed", groupId?: string) =>
    json<GroupSessionSnapshot>(
      groupId ? `/api/groups/${encodeURIComponent(groupId)}` : "/api/group/session",
      {
        method: groupId ? "PATCH" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session }),
      }
    ),
  /**
   * Apply desk mode to Group council: Multi/Pro seats are mode-specific (Chief shared).
   * Fresh topic/votes/moderator when entering Multi/Pro; messages kept for read-back.
   */
  switchCouncilMode: (mode: "super" | "multi" | "pro", previousMode?: "super" | "multi" | "pro") =>
    json<{ switched: boolean; mode: "super" | "multi" | "pro"; group: GroupSessionSnapshot }>(
      "/api/group/council-mode",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(previousMode ? { mode, previousMode } : { mode }),
      }
    ),
  listGroups: () => json<{ groups: GroupChatSummary[]; activeGroupId: string }>("/api/groups"),
  createGroup: (body: { name: string; memberIds?: string[]; activate?: boolean }) =>
    json<{ group: GroupSessionSnapshot; groups: GroupChatSummary[]; activeGroupId: string }>(
      "/api/groups",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
  patchGroup: (
    groupId: string,
    patch: {
      name?: string;
      topic?: string | null;
      announceTopic?: boolean;
      session?: "open" | "closed";
      activate?: boolean;
      moderatorId?: string;
      maxDurationMinutes?: number | null;
    }
  ) =>
    json<GroupSessionSnapshot>(`/api/groups/${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  deleteGroup: (groupId: string) =>
    json<{ ok: true; groups: GroupChatSummary[]; activeGroupId: string }>(
      `/api/groups/${encodeURIComponent(groupId)}`,
      { method: "DELETE" }
    ),
  activateGroup: (groupId: string) =>
    json<GroupSessionSnapshot>(`/api/groups/${encodeURIComponent(groupId)}/activate`, {
      method: "POST",
    }),
  putGroupMembers: (memberIds: string[], groupId?: string) =>
    json<GroupSessionSnapshot>(
      groupId ? `/api/groups/${encodeURIComponent(groupId)}/members` : "/api/group/members",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberIds }),
      }
    ),
  addGroupMember: (agentId: string, groupId?: string) =>
    json<GroupSessionSnapshot>(
      groupId ? `/api/groups/${encodeURIComponent(groupId)}/members` : "/api/group/members",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId }),
      }
    ),
  removeGroupMember: (agentId: string, groupId?: string) =>
    json<GroupSessionSnapshot>(
      groupId
        ? `/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(agentId)}`
        : `/api/group/members/${encodeURIComponent(agentId)}`,
      { method: "DELETE" }
    ),
  addGroupObserver: (agentId: string, groupId?: string) =>
    json<GroupSessionSnapshot>(
      groupId ? `/api/groups/${encodeURIComponent(groupId)}/observers` : "/api/group/observers",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId }),
      }
    ),
  removeGroupObserver: (agentId: string, groupId?: string) =>
    json<GroupSessionSnapshot>(
      groupId
        ? `/api/groups/${encodeURIComponent(groupId)}/observers/${encodeURIComponent(agentId)}`
        : `/api/group/observers/${encodeURIComponent(agentId)}`,
      { method: "DELETE" }
    ),
  chatRoster: () => json<{ agentIds: string[]; filtered: boolean }>("/api/chat/roster"),
  putChatRoster: (agentIds: string[]) =>
    json<{ agentIds: string[]; filtered: boolean }>("/api/chat/roster", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentIds }),
    }),
  addChatRosterMember: (agentId: string) =>
    json<{ agentIds: string[]; filtered: boolean }>("/api/chat/roster/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId }),
    }),
  removeChatRosterMember: (agentId: string) =>
    json<{ agentIds: string[]; filtered: boolean }>(
      `/api/chat/roster/members/${encodeURIComponent(agentId)}`,
      { method: "DELETE" }
    ),
  hardware: () => json<HardwareSnapshot>("/api/hardware"),
  network: () =>
    json<{
      online: boolean;
      connType: string | null;
      productName: string | null;
      linkSpeedMbps: number | null;
      localIp: string | null;
      ipv6: string | null;
      gateway: string | null;
      dns: string[];
      publicIp: string | null;
      isp: string | null;
      org: string | null;
      city: string | null;
      region: string | null;
      country: string | null;
      checkedAt: string;
      sources: { os: boolean; publicLookup: boolean };
      notes: string[];
    }>("/api/network"),
  networkSpeed: () =>
    json<{
      downloadMbps: number | null;
      provider: "fast.com";
      checkedAt: string;
      notes: string[];
    }>("/api/network/speed"),
  unloadModels: () => json<{ ok: boolean }>("/ctl/models/unload", { method: "POST" }),
  onboarding: () => json<{ complete: boolean; path: "chat" | "manual" | null }>("/api/onboarding"),
  completeOnboarding: (path?: "chat" | "manual") =>
    json<{ ok: boolean; complete: boolean; path: "chat" | "manual" | null }>("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(path ? { path } : {}),
    }),
  gamesCatalog: () =>
    json<{
      version: number;
      module: string;
      count: number;
      games: { id: string; title: string; description: string; tags: string[]; route: string }[];
    }>("/api/games/catalog"),
  agents: async () => {
    const data = await fetchJsonWithApiFallback<AgentsApiResponse>("/api/agents");
    if (!data) throw new Error("agents unreachable");
    return {
      agents: Array.isArray(data.agents) ? data.agents : [],
      lastScanAt: data.lastScanAt ?? null,
      sources: data.sources,
    };
  },
  /** POST /api/agents — persist into agents.registry.json (same as Chief create-agent intents).
   * Default hire is flat: omit `reportsTo` (do not invent a tree).
   */
  createAgents: (payload: {
    name?: string;
    role?: string;
    /** What the agent will do — local skill/model heuristics (no LLM). */
    brief?: string;
    count?: number;
    /** AMS catalog skill ids — validated server-side against config/ams-skills.catalog.json. */
    skills?: string[];
    /** Optional manager. Omit / null = flat peer (default). */
    reportsTo?: string | null;
    /** Manual primary from Browse pool; omit = auto from pool heuristics. */
    primaryModelId?: string | null;
    secondaryModelId?: string | null;
    /** Skip Browse-pool auto-assign (still applies explicit primaryModelId). */
    skipAutoModel?: boolean;
    seedWelcome?: boolean;
    agents?: {
      name?: string;
      role?: string;
      roleTag?: string;
      brief?: string;
      skills?: string[];
      reportsTo?: string | null;
      primaryModelId?: string | null;
      secondaryModelId?: string | null;
    }[];
  }) =>
    json<{ created: RegistryAgent[]; agents: RegistryAgent[] }>("/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  /** PATCH /api/agents/:id — set or clear reportsTo (null = flat peer). */
  patchAgent: (agentId: string, patch: { reportsTo: string | null }) =>
    json<{ agent: RegistryAgent; agents: RegistryAgent[] }>(
      `/api/agents/${encodeURIComponent(agentId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }
    ),
  /** Work vs Personal prefs (app-state). */
  prefs: () => json<{ prefs: UserPrefs }>("/api/prefs"),
  putPrefs: (patch: {
    activeProfile?: UserProfileId;
    favoriteAgentIds?: string[];
    homeMode?: ProfileHomeMode;
    displayContext?: string;
    englishOnlyReplies?: boolean;
    profiles?: Partial<Record<UserProfileId, Partial<ProfilePrefsSlice>>>;
  }) =>
    json<{ prefs: UserPrefs }>("/api/prefs", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  /** heard_as dictionary (Settings → Voice). */
  voiceDictionary: () =>
    json<{ entries: VoiceDictionaryEntry[]; defaults: VoiceDictionaryEntry[] }>("/api/voice/dictionary"),
  putVoiceDictionary: (entries: VoiceDictionaryEntry[]) =>
    json<{ entries: VoiceDictionaryEntry[] }>("/api/voice/dictionary", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries }),
    }),
  board: () => json<BoardApiResponse>("/api/board"),
  putBoard: (payload: PutBoardPayload) => {
    const body = Array.isArray(payload) ? { boardIds: payload } : payload;
    return json<BoardApiResponse>("/api/board", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  /** Ask each board agent to take a stance on the decision topic (routeGenerate per agent). */
  askBoard: (opts?: { topic?: string }) =>
    json<BoardAskResult>("/api/board/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts?.topic != null ? { topic: opts.topic } : {}),
    }),
  /** One-click Tasks ticket from current board decision + stances. */
  createBoardTicket: (body?: { agentId?: string }) =>
    json<{ task: AgentTask }>("/api/board/ticket", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }),
  proSets: () => json<{ sets: { id: string; name: string; agentIds: string[] }[] }>("/api/pro/sets"),
  proSetMembers: (setId: string) =>
    json<{ setId: string; agentIds: string[] }>(`/api/pro/sets/${encodeURIComponent(setId)}/members`),
  putProCustom: (agentIds: string[]) =>
    json<{ agentIds: string[] }>("/api/pro/custom", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentIds }),
    }),
  patchProActive: (setId: string) =>
    json<{ activeProSetId: string }>("/api/pro/active", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setId }),
    }),
  calendarStatus: () => json<CalendarStatus>("/api/calendar/status"),
  calendarEvents: () =>
    json<{ events: CalendarEventItem[]; configured: boolean; live: boolean; message?: string }>(
      "/api/calendar/events",
    ),
  calendarPrefs: () => json<{ prefs: CalendarPrefs }>("/api/calendar/prefs"),
  putCalendarPrefs: (patch: Partial<CalendarPrefs>) =>
    json<{ prefs: CalendarPrefs; status: CalendarStatus }>("/api/calendar/prefs", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  /** Full-page redirect to Google OAuth (server :3445). */
  calendarGoogleConnect: () => {
    window.location.assign("/api/calendar/oauth/google/start");
  },
  calendarGoogleDisconnect: () =>
    json<{ ok: boolean; status: CalendarStatus }>("/api/calendar/oauth/google/disconnect", {
      method: "POST",
    }),
  calendarMicrosoftConnect: () => {
    window.location.assign("/api/calendar/oauth/microsoft/start");
  },
  calendarMicrosoftDisconnect: () =>
    json<{ ok: boolean; status: CalendarStatus }>("/api/calendar/oauth/microsoft/disconnect", {
      method: "POST",
    }),
  browserStatus: () =>
    json<{ ok?: boolean; live?: boolean; deskLive?: boolean; error?: string; sessions?: number }>(
      "/api/browser/status",
    ),
  browserPanic: () =>
    json<{ ok?: boolean }>("/api/browser/panic", { method: "POST", body: "{}" }),
  browserCreateSession: (agentId: string, threadId?: string) =>
    json<{ ok?: boolean; sessionId?: string; error?: string; tabs?: { index: number; url: string; title: string }[] }>(
      "/api/browser/sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId, threadId }),
      },
    ),
  browserTool: (sessionId: string, tool: string, args?: Record<string, unknown>) =>
    json<Record<string, unknown>>(`/api/browser/sessions/${encodeURIComponent(sessionId)}/tools`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool, args: args ?? {} }),
    }),
  /** Local file-backed audit (app-state / registry / agents / models). */
  audit: () => json<AuditReport>("/api/audit"),
  runAudit: () => json<AuditReport>("/api/audit/run", { method: "POST" }),
  auditSpend: (limit = 50) =>
    json<{ events: ProviderSpendEvent[]; note?: string }>(`/api/audit/spend?limit=${limit}`),
  auditRouting: (limit = 40) =>
    json<{ events: RoutingDecisionEvent[]; note?: string }>(`/api/audit/routing?limit=${limit}`),

  /** Settings → Company / Training */
  companyBriefing: () => json<{ briefing: CompanyBriefing | null }>("/api/company/briefing"),
  putCompanyBriefing: (text: string) =>
    json<{ briefing: CompanyBriefing }>("/api/company/briefing", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  fetchCompanyBriefing: (url: string) =>
    json<{ briefing: CompanyBriefing }>("/api/company/briefing/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  clearCompanyBriefing: () =>
    json<{ ok: true; briefing: null }>("/api/company/briefing", { method: "DELETE" }),
  agentsTraining: () => json<TrainingStatusResponse>("/api/agents/training"),
  sendAllAgentsToTraining: () =>
    json<SendAllTrainingResponse>("/api/agents/training/send-all", { method: "POST" }),

  /** Lessons — takeaways (research, training, group Final, manual). Auto-tagged by source. */
  lessons: () => json<{ lessons: Lesson[] }>("/api/lessons"),
  createLesson: (body: {
    title: string;
    body: string;
    source?: LessonSource;
    agentIds?: string[];
    pinned?: boolean;
  }) =>
    json<{ lesson: Lesson }>("/api/lessons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  patchLesson: (id: string, patch: { pinned?: boolean; title?: string; body?: string }) =>
    json<{ lesson: Lesson; lessons: Lesson[] }>(`/api/lessons/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  deleteLesson: (id: string) =>
    json<{ ok: true; lessons: Lesson[] }>(`/api/lessons/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  /** Soft-delete registry agent → recycle bin (Settings → Logs & Recycle bin). */
  deleteAgent: (agentId: string) =>
    json<{ ok: true; recycled: boolean; item: RecycleBinItem | null }>(
      `/api/agents/${encodeURIComponent(agentId)}`,
      { method: "DELETE" }
    ),

  recycleBin: () =>
    json<RecycleBinResponse>("/api/recycle"),
  setRecycleRetention: (days: RecycleRetentionDays) =>
    json<RecycleBinResponse>("/api/recycle/retention", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ days }),
    }),
  purgeRecycleBin: () =>
    json<{ ok: true; purged: number } & RecycleBinResponse>("/api/recycle/purge", {
      method: "POST",
    }),
  emptyRecycleBin: () =>
    json<{ ok: true; removed: number; items: RecycleBinItem[]; retentionDays: RecycleRetentionDays }>(
      "/api/recycle/empty",
      { method: "POST" }
    ),
  restoreRecycleItem: (id: string) =>
    json<{ ok: true; item: RecycleBinItem } & RecycleBinResponse>(
      `/api/recycle/${encodeURIComponent(id)}/restore`,
      { method: "POST" }
    ),
  deleteRecycleItem: (id: string) =>
    json<RecycleBinResponse>(`/api/recycle/${encodeURIComponent(id)}`, { method: "DELETE" }),
  softDeleteLogs: (entries: RecycleLogEntry[], label?: string) =>
    json<{ ok: true; recycled: boolean; item: RecycleBinItem | null } & RecycleBinResponse>(
      "/api/recycle/logs",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries, label }),
      }
    ),
  softDeleteCustomPro: (agent: RegistryAgent, thread?: ChatMessage[]) =>
    json<{ ok: true; recycled: boolean; item: RecycleBinItem | null } & RecycleBinResponse>(
      "/api/recycle/custom-pro",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent, thread }),
      }
    ),
};
