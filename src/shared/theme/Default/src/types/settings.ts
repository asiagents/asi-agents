import type { ModelLane } from './models';

export type DeskMode = 'super' | 'multi' | 'pro';
export type RouterChoice = 'micro' | 'hybrid';
export type VoiceEngine = 'local' | 'elevenlabs';
export type Policy = 'ask' | 'always' | 'never';
export type PermissionCategory = 'spend' | 'shell' | 'skill' | 'ops';
export type Theme = 'light' | 'dark';
export type MuteMode = 'unmuted' | 'agents' | 'muted';
export type NetInterval = 'off' | '30s' | '5m' | '1h' | '1d' | 'custom';
export type Language = 'en' | 'hinglish';
export type ClockStyle = 'digital' | 'analog' | 'mechanical';

export type WidgetType =
'agents' |
'todos' |
'spend' |
'net' |
'weather' |
'time' |
'hardware' |
'vd' |
'calendar' |
'approvals' |
'panic' |
'model' |
'nextup' |
'run-activity' |
'tasks-status' |
'task-outcomes' |
'neural-brain';

export type WidgetSize = 'S' | 'M' | 'L';
/** Home grid column span (1–4). Clamped to available tracks on narrow viewports. */
export type WidgetColSpan = 1 | 2 | 3 | 4;
/** Home grid row span (1–3). Each row ≈ 168px. */
export type WidgetRowSpan = 1 | 2 | 3;

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  /** Content density hint (derived from cols×rows when resizing). */
  size: WidgetSize;
  /** Grid width in columns. */
  cols: WidgetColSpan;
  /** Grid height in rows. */
  rows: WidgetRowSpan;
}

export interface WidgetMeta {
  type: WidgetType;
  label: string;
  description: string;
  /** Preset sizes offered as quick cycles (mapped to cols×rows). */
  sizes: WidgetSize[];
  defaultSize: WidgetSize;
  /** Max width the user can stretch to in Edit layout (default 4). */
  maxCols?: WidgetColSpan;
  /** Max height the user can stretch to in Edit layout (default 3). */
  maxRows?: WidgetRowSpan;
}

export interface LockItems {
  counts: boolean;
  vcs: boolean;
  time: boolean;
  weather: boolean;
  panic: boolean;
}

export interface NotifyPrefs {
  approval: boolean;
  redAlert: boolean;
  agentDone: boolean;
  router: boolean;
  mail: boolean;
  /** Silence notification toasts. Items still collect in the tray. Not the same as Mute all audio or Panic. */
  quiet: boolean;
  os: boolean;
}

export type EmailKind = 'gmail' | 'imap' | 'pop3';

export interface EmailProfile {
  id: string;
  kind: EmailKind;
  label: string;
  address: string;
  keyId?: string;
}

/** Default local display name when none is set (first unlock / menu fallback). */
export const DEFAULT_DISPLAY_NAME = 'Boss';

export interface AppSettings {
  displayName: string | null;
  onboarded: boolean;
  locked: boolean;
  /** Optional local lock password (demo — kept in memory only). */
  lockPassword: string | null;
  widgets: WidgetInstance[];
  /** Lock screen Home-parity widgets (same catalog as Home). Persisted separately. */
  lockWidgets: WidgetInstance[];
  liveVisuals: boolean;
  lowEnd: boolean;
  footerStrip: boolean;
  /** Header API / registry strip under the main nav. */
  serviceStrip: boolean;
  /** Yellow council upgrade strip on Group when in Super mode. */
  showTeamBanner: boolean;
  /** Neon tower sign on the Office live floor. */
  officeSign: boolean;
  /** Lighting / plants controls on the Office floor. */
  officeToolbar: boolean;
  /** Primary bottom nav while viewing Office. */
  officeBottomNav: boolean;
  /** Home top hero image (desk firehead). Off by default so it does not block content; toggle on Home or Settings → Performance. */
  homeHeroImage: boolean;
  hwTracking: boolean;
  muteMode: MuteMode;
  micMuted: boolean;
  tts: boolean;
  stt: boolean;
  volume: number;
  speakHandoffs: boolean;
  defaultVoice: string;
  agentVoices: Record<string, string>;
  voiceProviders: Record<string, boolean>;
  netInterval: NetInterval;
  netCustomMin: number;
  lockItems: LockItems;
  /** Lock glimpse density: roomy = larger type / wider max width. */
  lockLayout: 'normal' | 'roomy';
  snapshotMin: number;
  snapshotKeep: number;
  notify: NotifyPrefs;
  language: Language;
  sttLocale: string;
  weatherLocation: string;
  tempUnit: 'C' | 'F';
  presence: 'home' | 'away';
  homeZone: string;
  /** Header / profile avatar — single emoji grapheme. Persisted in localStorage. */
  avatarEmoji: string;
  /** Home Time widget face style. Persisted in localStorage. */
  clockStyle: ClockStyle;
  /** Up to two extra world-clock IANA zones. Persisted in localStorage. */
  worldClockZones: string[];
  /** Optional Local city label; empty uses geo / weather / net when known. */
  localCity: string;
  redAlertStyle: 'page' | 'popup';
  officeLight: 'auto' | 'bright' | 'dim';
  greenery: boolean;
  /** Models → detail: animate the neural map flow. Set in Settings → Performance. */
  mapViz: boolean;
  /** Models → detail: show skipped hops (router / encryption) as dashed bypass lines. */
  mapShowBypass: boolean;
  /** Chat bubbles: show duration / token / cost footer. Off by default — we don't meter local intent. */
  showMessageTiming: boolean;
}

export interface NetState {
  status: 'ok' | 'checking' | 'down';
  lastChecked: string | null;
  /** Adapter media when known (wifi/ethernet/…); null/unknown only if OS did not report it. */
  connType: string;
  productName: string | null;
  linkSpeedMbps: number | null;
  localIp: string | null;
  publicIp: string | null;
  isp: string | null;
  gateway: string | null;
  dns: string[];
  city: string | null;
  region: string | null;
  country: string | null;
  notes: string[];
}

export interface HardwareInfo {
  cores: number | null;
  memoryGb: number | null;
  vramGb: number | null;
  gpu: string | null;
  /** Live CPU busy % from server sample; null when unavailable. */
  cpuPercent: number | null;
  /** Used system RAM (GB); null when unavailable. */
  ramUsedGb: number | null;
  /** Used system RAM %; null when unavailable. */
  ramUsedPct: number | null;
  /** Used VRAM (GB); null when GPU probe missing. */
  vramUsedGb: number | null;
  /** Used VRAM %; null when GPU probe missing. */
  vramUsedPct: number | null;
  /** GPU util % from nvidia-smi; null when unavailable. */
  gpuPercent: number | null;
  scannedAt: string;
}

export interface RedAlert {
  id: string;
  kind: 'permission' | 'intrusion' | 'injection';
  title: string;
  detail: string;
  agentId: string;
  time: string;
}

export interface PermissionRequest {
  id: string;
  category: PermissionCategory;
  agentId: string;
  title: string;
  detail: string;
  time: string;
}

export interface PermissionRule {
  id: string;
  category: PermissionCategory;
  label: string;
  detail: string;
  policy: Policy;
}

export interface ServiceStatus {
  id: string;
  label: string;
  detail: string;
  state: 'online' | 'standby' | 'off';
}

export interface Provider {
  id: string;
  name: string;
  lane: ModelLane;
  description: string;
  enabled: boolean;
  locked?: boolean;
  signupUrl?: string;
  docsUrl?: string;
  supportsFreeTier?: boolean;
}

export interface ProviderKeyStatus {
  configured: boolean;
  last4?: string;
}

export interface ApiKey {
  id: string;
  provider: string;
  label: string;
  last4: string;
  active: boolean;
  added: string;
}

export type IntegrationId = 'gmail' | 'imap' | 'elevenlabs' | 'cloud';

export interface IntegrationState {
  enabled: boolean;
  connected: boolean;
}

export interface SurfaceOverride {
  bg: string;
  card: string;
}