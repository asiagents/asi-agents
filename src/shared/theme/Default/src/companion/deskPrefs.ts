/**
 * Desk companion hub prefs — sticky note, countdown defaults, focus length, last tab.
 * Plain text only (no secrets). Wi‑Fi lives in wifiVault.ts.
 */
import { readJson, writeJson, readStorage, writeStorage, STORAGE_KEYS } from '../utils/storage';

export const HUB_TABS = [
  'todos',
  'countdown',
  'clocks',
  'wifi',
  'note',
  'focus',
] as const;

export type HubTabId = (typeof HUB_TABS)[number];

export const HUB_TAB_LABELS: Record<HubTabId, string> = {
  todos: 'To-dos',
  countdown: 'Countdown',
  clocks: 'Clocks',
  wifi: 'Wi‑Fi',
  note: 'Note',
  focus: 'Focus',
};

export type CountdownPrefs = {
  minutes: number;
  label: string;
  notify: boolean;
};

export type FocusPrefs = {
  minutes: number;
};

const DEFAULT_COUNTDOWN: CountdownPrefs = {
  minutes: 5,
  label: '',
  notify: true,
};

const DEFAULT_FOCUS: FocusPrefs = {
  minutes: 25,
};

export function isHubTabId(v: string | null | undefined): v is HubTabId {
  return Boolean(v && (HUB_TABS as readonly string[]).includes(v));
}

export function readHubTab(): HubTabId {
  const raw = readStorage(STORAGE_KEYS.companionHubTab);
  return isHubTabId(raw) ? raw : 'todos';
}

export function writeHubTab(tab: HubTabId): void {
  writeStorage(STORAGE_KEYS.companionHubTab, tab);
}

export function readStickyNote(): string {
  return readStorage(STORAGE_KEYS.companionStickyNote) ?? '';
}

export function writeStickyNote(text: string): void {
  writeStorage(STORAGE_KEYS.companionStickyNote, text);
}

export function readCountdownPrefs(): CountdownPrefs {
  const raw = readJson<Partial<CountdownPrefs>>(STORAGE_KEYS.companionCountdown, {});
  const minutes = Math.max(1, Math.min(180, Number(raw.minutes) || DEFAULT_COUNTDOWN.minutes));
  return {
    minutes,
    label: typeof raw.label === 'string' ? raw.label.slice(0, 80) : '',
    notify: raw.notify === undefined ? DEFAULT_COUNTDOWN.notify : Boolean(raw.notify),
  };
}

export function writeCountdownPrefs(prefs: CountdownPrefs): void {
  writeJson(STORAGE_KEYS.companionCountdown, {
    minutes: Math.max(1, Math.min(180, prefs.minutes)),
    label: prefs.label.trim().slice(0, 80),
    notify: Boolean(prefs.notify),
  });
}

export function readFocusPrefs(): FocusPrefs {
  const raw = readJson<Partial<FocusPrefs>>(STORAGE_KEYS.companionFocus, {});
  return {
    minutes: Math.max(1, Math.min(120, Number(raw.minutes) || DEFAULT_FOCUS.minutes)),
  };
}

export function writeFocusPrefs(prefs: FocusPrefs): void {
  writeJson(STORAGE_KEYS.companionFocus, {
    minutes: Math.max(1, Math.min(120, prefs.minutes)),
  });
}
