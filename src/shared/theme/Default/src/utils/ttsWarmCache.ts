/**
 * Warm-cache for scripted local TTS lines ("Got it", "Done", clarify, welcome variants).
 * Browser speechSynthesis cannot dump audio blobs reliably; we prime voices at volume 0
 * and keep an in-memory ready set so Settings can show cache status.
 */
import { readJson, writeJson, STORAGE_KEYS } from './storage';

export type TtsCacheLineStatus = 'cold' | 'warming' | 'ready' | 'error';

export interface TtsCacheLine {
  id: string;
  text: string;
  group: 'ack' | 'clarify' | 'welcome' | 'other';
  status: TtsCacheLineStatus;
  warmedAt: string | null;
}

/** Fixed scripted lines for the local TTS path. */
export const SCRIPTED_TTS_LINES: Omit<TtsCacheLine, 'status' | 'warmedAt'>[] = [
  { id: 'ack-got-it', text: 'Got it', group: 'ack' },
  { id: 'ack-done', text: 'Done', group: 'ack' },
  { id: 'ack-cancelled', text: 'Cancelled.', group: 'ack' },
  { id: 'clarify-repeat', text: 'Could you say that again?', group: 'clarify' },
  { id: 'clarify-which', text: 'Which one did you mean?', group: 'clarify' },
  { id: 'clarify-more', text: 'I need a bit more detail.', group: 'clarify' },
  { id: 'welcome-desk', text: "You're through to the desk. Local commands work here — say help anytime.", group: 'welcome' },
  { id: 'welcome-quiet', text: 'Desk is quiet and listening. What do you need first?', group: 'welcome' },
  { id: 'welcome-local', text: 'On-device assistant online. Greetings stay local; heavier asks escalate.', group: 'welcome' },
  { id: 'welcome-skip', text: 'Hi. Skip the introductions — say help, or just start.', group: 'welcome' },
  { id: 'welcome-standing', text: 'Standing by. Navigation, roster, and system facts are a hello away.', group: 'welcome' },
];

type PersistShape = Record<string, { warmedAt: string }>;

function loadPersist(): PersistShape {
  return readJson<PersistShape>(STORAGE_KEYS.ttsWarmCache, {});
}

function savePersist(map: PersistShape) {
  writeJson(STORAGE_KEYS.ttsWarmCache, map);
}

/** In-memory ready set for this session (also mirrored to localStorage timestamps). */
const readyIds = new Set<string>();

function hydrateFromPersist() {
  const p = loadPersist();
  for (const id of Object.keys(p)) readyIds.add(id);
}

hydrateFromPersist();

export function listTtsCacheLines(): TtsCacheLine[] {
  const persist = loadPersist();
  return SCRIPTED_TTS_LINES.map((line) => {
    const warmedAt = persist[line.id]?.warmedAt ?? null;
    const ready = readyIds.has(line.id) || !!warmedAt;
    return {
      ...line,
      status: ready ? 'ready' : 'cold',
      warmedAt,
    };
  });
}

export function ttsCacheStatus(): { ready: number; total: number; lines: TtsCacheLine[] } {
  const lines = listTtsCacheLines();
  const ready = lines.filter((l) => l.status === 'ready').length;
  return { ready, total: lines.length, lines };
}

function speakSilent(text: string, lang: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      reject(new Error('speechSynthesis unavailable'));
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.volume = 0;
    u.lang = lang;
    u.onend = () => resolve();
    u.onerror = () => reject(new Error('utterance failed'));
    window.speechSynthesis.speak(u);
  });
}

/** Prime all scripted lines (volume 0). Returns updated status. */
export async function warmTtsCache(lang = 'en-US'): Promise<ReturnType<typeof ttsCacheStatus>> {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    // Ensure voices are loaded before priming.
    window.speechSynthesis.getVoices();
  }
  const persist = loadPersist();
  for (const line of SCRIPTED_TTS_LINES) {
    try {
      await speakSilent(line.text, lang);
      readyIds.add(line.id);
      persist[line.id] = { warmedAt: new Date().toISOString() };
    } catch {
      /* leave cold */
    }
  }
  savePersist(persist);
  return ttsCacheStatus();
}

export function clearTtsCache(): ReturnType<typeof ttsCacheStatus> {
  readyIds.clear();
  savePersist({});
  return ttsCacheStatus();
}

/** Exact-match lookup for scripted speak path. */
export function findScriptedLine(text: string): TtsCacheLine | null {
  const t = text.trim();
  const lines = listTtsCacheLines();
  return lines.find((l) => l.text === t) ?? null;
}
