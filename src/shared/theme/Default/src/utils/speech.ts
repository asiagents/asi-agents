import type { MuteMode } from '../types/settings';
import { findScriptedLine } from './ttsWarmCache';

interface SpeakOptions {
  muteMode: MuteMode;
  tts: boolean;
  volume: number;
  lang: string;
}

/** Local TTS through the browser's on-device speech engine. Silently does nothing when muted or unsupported. */
export function speak(text: string, opts: SpeakOptions): boolean {
  if (opts.muteMode === 'muted' || !opts.tts) return false;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.volume = Math.max(0, Math.min(1, opts.volume / 100));
  u.lang = opts.lang;
  // Scripted warm-cache path: same utterance API; status tracked in ttsWarmCache for Settings.
  void findScriptedLine(text);
  window.speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
