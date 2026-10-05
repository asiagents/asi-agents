const PREFIX = 'asi.default.';

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(`${PREFIX}${key}`);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(`${PREFIX}${key}`, value);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readFlag(key: string): boolean {
  return readStorage(key) === '1';
}

export function writeFlag(key: string, on: boolean): void {
  writeStorage(key, on ? '1' : '0');
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = readStorage(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  writeStorage(key, JSON.stringify(value));
}

export const STORAGE_KEYS = {
  modelsOnboardingDone: 'modelsOnboardingDone',
  activeProSetId: 'activeProSetId',
  recommendedModels: 'recommendedModels',
  /** Browse Models multi-select pool for Agent assignments. */
  selectedModelPool: 'selectedModelPool',
  /** Cascade failover prefs cache `{ enabled, order }` — server is source of truth. */
  modelCascade: 'modelCascade',
  /** Home desk hero banner visibility (user toggle on Home or Settings → Performance). */
  homeHeroVisible: 'homeHeroVisible',
  /** Chat: show per-message timing / cost footer (1=on). Default off when unset. */
  showMessageTiming: 'showMessageTiming',
  /** Local TTS warm-cache timestamps for scripted lines. */
  ttsWarmCache: 'ttsWarmCache',
  /** Chat agent details right rail (1=open, 0=collapsed). Default collapsed. */
  agentPanelOpen: 'agentPanelOpen',
  /** Group council members right rail (1=open, 0=collapsed). Default open on lg+. */
  groupRailOpen: 'groupRailOpen',
  /** Visual signup profile: work | personal + optional company. */
  onboardingProfile: 'onboardingProfile',
  /** Settings hub block order + hidden ids + optional spans (`{ order, hidden, spans }`). */
  settingsHubLayout: 'settingsHubLayout',
  /** Home widget layout (`WidgetInstance[]`) — order, type, cols×rows. */
  homeWidgets: 'homeWidgets',
  /** Lock screen widget layout (`WidgetInstance[]`) — same catalog as Home. */
  lockWidgets: 'lockWidgets',
  /** Lock screen layout comfort: `normal` | `roomy`. */
  lockLayout: 'lockLayout',
  /** Boss display name (persists across reload so unlock survives hard refresh). */
  displayName: 'displayName',
  /** Lock engaged (1=locked). Cleared on unlock; set from Lock / Ctrl+Shift+L. */
  locked: 'locked',
  /** Companion on lock screen (1=on). Requires Modules Show Squari. Prod default off; test bed on when unset. */
  squariOnLock: 'squariOnLock',
  /** Header / profile avatar emoji (single grapheme). */
  avatarEmoji: 'avatarEmoji',
  /** Home Time widget: style + up to two world clock zones + optional city override. */
  clockPrefs: 'clockPrefs',
  /** @deprecated Legacy corner mascot — migrated to showSquari. */
  mascotModule: 'mascotModule',
  /** Squari Companion — Show Squari (1=on). Prod default off; localhost/test bed on when unset. */
  showSquari: 'showSquari',
  /** Companion size: sm | md (lock uses larger fixed scale). */
  squariSize: 'squariSize',
  /** Pointer look-at (1=on). Default on when unset. */
  squariLookAt: 'squariLookAt',
  /** Celebration jump on task done (1=on). Default on when unset. */
  squariJump: 'squariJump',
  /** Companion skin id: squari | drakko | mochi | paperclip-x | capsule | nekowire | pixel-knight. */
  squariSkin: 'squariSkin',
  /** Last /chat/:threadId for companion click → focus. */
  lastChatThread: 'lastChatThread',
  /** Bottom-menu order: catalog NavIds + custom-* ids. */
  navItems: 'navItems',
  /** Manual nav links `{ id, label, to, surfaces }[]`. */
  customNavLinks: 'customNavLinks',
  /** Desk companion hub: last active tab id. */
  companionHubTab: 'companionHubTab',
  /** Desk companion sticky note (plain text). */
  companionStickyNote: 'companionStickyNote',
  /** Desk companion countdown prefs `{ minutes, label, notify }`. */
  companionCountdown: 'companionCountdown',
  /** Desk companion focus timer prefs `{ minutes }`. */
  companionFocus: 'companionFocus',
  /**
   * Home Wi‑Fi vault — AES-GCM ciphertext only (never plaintext password).
   * Shape: `{ v:1, ssid, last4, cipher, iv }` — see companion/wifiVault.ts.
   */
  companionWifiVault: 'companionWifiVault',
  /** Random AES key material for companion Wi‑Fi vault (base64). Local-only. */
  companionWifiVaultKey: 'companionWifiVaultKey',
} as const;

export type ClockStyle = 'digital' | 'analog' | 'mechanical';

export type ClockPrefs = {
  style: ClockStyle;
  /** Up to two IANA zones for extra world clocks. */
  worldZones: string[];
  /** Optional city label for Local; empty = geolocation / weather / net city. */
  localCity: string;
};

export const DEFAULT_AVATAR_EMOJI = '🧑‍💼';

export const DEFAULT_CLOCK_PREFS: ClockPrefs = {
  style: 'digital',
  /** London + Singapore — align with Home Time / world map suggestions. */
  worldZones: ['Europe/London', 'Asia/Singapore'],
  localCity: '',
};

/** Shared world-clock / map city suggestions (IANA + display label). */
export const WORLD_CLOCK_SUGGESTIONS: { zone: string; label: string }[] = [
  { zone: 'Europe/London', label: 'London' },
  { zone: 'Asia/Singapore', label: 'Singapore' },
  { zone: 'Asia/Dubai', label: 'Dubai' },
  { zone: 'Europe/Amsterdam', label: 'Amsterdam' },
  { zone: 'America/Los_Angeles', label: 'Silicon Valley' },
];

/** Default Home weather place when Settings location is empty. */
export const DEFAULT_WEATHER_LOCATION = 'Silicon Valley';

export type OnboardingProfileKind = 'work' | 'personal';

export type OnboardingProfile = {
  kind: OnboardingProfileKind;
  companyName?: string;
  companyAbout?: string;
};

/** Default open on desktop (lg ≥ 1024); respect stored preference when present. */
export function readSidebarOpenPref(key: string, defaultOpenDesktop = true): boolean {
  const raw = readStorage(key);
  if (raw === '0') return false;
  if (raw === '1') return true;
  if (!defaultOpenDesktop) return false;
  try {
    return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  } catch {
    return true;
  }
}
