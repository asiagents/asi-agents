/**
 * Squari Companion module prefs.
 *
 * Prod default: OFF (no overlay / lock companion / asset load until enabled).
 * Test bed / local iterate: ON when unset — ASI_COMPANION_TEST / VITE_ASI_COMPANION_TEST,
 * Vite DEV, or localhost/127.0.0.1. Explicit localStorage always wins.
 */
import { readFlag, writeFlag, readStorage, writeStorage, STORAGE_KEYS } from '../utils/storage';
import {
  COMPANION_SKINS,
  DEFAULT_COMPANION_SKIN,
  isCompanionSkinId,
  type CompanionSkinId,
} from './assets';

export const COMPANION_TOGGLE_EVENT = 'asi:companion-toggle';
export const COMPANION_TYPING_EVENT = 'asi:companion-typing';
export const COMPANION_SETTINGS_EVENT = 'asi:companion-settings';

export type { CompanionSkinId };
export type CompanionSize = 'sm' | 'md';

export type CompanionSettings = {
  showSquari: boolean;
  /** Show companion while locked. Ignored when Modules Show Squari is off. */
  showSquariOnLock: boolean;
  skin: CompanionSkinId;
  size: CompanionSize;
  lookAt: boolean;
  celebrationJump: boolean;
};

/**
 * Test-bed / local iterate defaults.
 * - `VITE_ASI_COMPANION_TEST=1` (build-time) or `import.meta.env.DEV`
 * - hostname localhost / 127.0.0.1 / ::1 (current :3445 local build)
 * Prod / remote host → false (companion OFF until user enables).
 *
 * Server env `ASI_COMPANION_TEST=1` is documented for parity; wire via Vite as
 * `VITE_ASI_COMPANION_TEST` when baking a test build.
 */
export function isCompanionTestBed(): boolean {
  try {
    const env = import.meta.env as { DEV?: boolean; VITE_ASI_COMPANION_TEST?: string };
    const flag = env?.VITE_ASI_COMPANION_TEST;
    if (flag === '1' || flag === 'true') return true;
    if (env?.DEV) return true;
  } catch {
    /* ignore */
  }
  try {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true;
  } catch {
    /* ignore */
  }
  return false;
}

const DEFAULTS: CompanionSettings = {
  showSquari: false,
  showSquariOnLock: false,
  skin: DEFAULT_COMPANION_SKIN,
  size: 'md',
  lookAt: true,
  celebrationJump: true,
};

/** Migrate legacy corner-mascot flag once if present and Squari unset. */
function migrateLegacy(): void {
  try {
    const squariSet = readStorage(STORAGE_KEYS.showSquari);
    if (squariSet !== null) return;
    const legacy = readStorage(STORAGE_KEYS.mascotModule);
    if (legacy === '1') {
      writeFlag(STORAGE_KEYS.showSquari, true);
    }
  } catch {
    /* ignore */
  }
}

function readShowFlag(key: string, testBedDefault: boolean): boolean {
  const raw = readStorage(key);
  if (raw === null) return testBedDefault;
  return raw === '1';
}

export function readCompanionSettings(): CompanionSettings {
  migrateLegacy();
  const testBed = isCompanionTestBed();
  const sizeRaw = readStorage(STORAGE_KEYS.squariSize);
  const size: CompanionSize = sizeRaw === 'sm' ? 'sm' : 'md';
  const skinRaw = readStorage(STORAGE_KEYS.squariSkin);
  const skin: CompanionSkinId = isCompanionSkinId(skinRaw) ? skinRaw : DEFAULT_COMPANION_SKIN;
  return {
    // Prod OFF; test bed / local ON when unset so iterate without hunting the toggle.
    showSquari: readShowFlag(STORAGE_KEYS.showSquari, testBed),
    showSquariOnLock: readShowFlag(STORAGE_KEYS.squariOnLock, testBed),
    skin,
    size,
    lookAt: readStorage(STORAGE_KEYS.squariLookAt) === null ? DEFAULTS.lookAt : readFlag(STORAGE_KEYS.squariLookAt),
    celebrationJump:
      readStorage(STORAGE_KEYS.squariJump) === null
        ? DEFAULTS.celebrationJump
        : readFlag(STORAGE_KEYS.squariJump),
  };
}

export function isSquariEnabled(): boolean {
  return readCompanionSettings().showSquari;
}

/** Master Modules Show Squari must be on; then lock-specific flag gates the Lock screen. */
export function isSquariVisibleOnLock(): boolean {
  const s = readCompanionSettings();
  return s.showSquari && s.showSquariOnLock;
}

export function setSquariEnabled(on: boolean): void {
  writeFlag(STORAGE_KEYS.showSquari, on);
  window.dispatchEvent(new CustomEvent(COMPANION_TOGGLE_EVENT, { detail: { on } }));
  window.dispatchEvent(new CustomEvent(COMPANION_SETTINGS_EVENT));
}

export function setSquariOnLock(on: boolean): void {
  writeFlag(STORAGE_KEYS.squariOnLock, on);
  window.dispatchEvent(new CustomEvent(COMPANION_SETTINGS_EVENT));
}

export function setCompanionLookAt(on: boolean): void {
  writeFlag(STORAGE_KEYS.squariLookAt, on);
  window.dispatchEvent(new CustomEvent(COMPANION_SETTINGS_EVENT));
}

export function setCompanionCelebrationJump(on: boolean): void {
  writeFlag(STORAGE_KEYS.squariJump, on);
  window.dispatchEvent(new CustomEvent(COMPANION_SETTINGS_EVENT));
}

export function setCompanionSize(size: CompanionSize): void {
  writeStorage(STORAGE_KEYS.squariSize, size);
  window.dispatchEvent(new CustomEvent(COMPANION_SETTINGS_EVENT));
}

export function setCompanionSkin(skin: CompanionSkinId): void {
  if (!(COMPANION_SKINS as readonly string[]).includes(skin)) return;
  writeStorage(STORAGE_KEYS.squariSkin, skin);
  window.dispatchEvent(new CustomEvent(COMPANION_SETTINGS_EVENT));
}

/** Remember last chat thread for click → focus. */
export function rememberLastChatThread(threadId: string): void {
  if (!threadId) return;
  writeStorage(STORAGE_KEYS.lastChatThread, threadId);
}

export function readLastChatThread(): string {
  return readStorage(STORAGE_KEYS.lastChatThread) || 'chief';
}

export function emitCompanionTyping(on: boolean): void {
  window.dispatchEvent(new CustomEvent(COMPANION_TYPING_EVENT, { detail: { on } }));
}

/** @deprecated Use isSquariEnabled — kept for old imports. */
export function isMascotEnabled(): boolean {
  return isSquariEnabled();
}

/** @deprecated Use setSquariEnabled */
export function setMascotEnabled(on: boolean): void {
  setSquariEnabled(on);
}
