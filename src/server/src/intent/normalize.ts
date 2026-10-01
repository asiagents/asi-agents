import { applyHeardAs, DEFAULT_VOICE_DICTIONARY } from "../voiceDictionary.js";
import { getVoiceDictionary } from "../store.js";

const FILLERS = new Set(["please", "pls", "kindly", "can", "you", "could", "would", "the", "a", "an"]);

export const MAX_INTENT_INPUT = 500;

function loadHeardAsEntries() {
  try {
    return getVoiceDictionary();
  } catch {
    return DEFAULT_VOICE_DICTIONARY;
  }
}

export function normalizeIntentText(raw: string): string {
  let s = raw.normalize("NFKC").toLowerCase().trim();
  s = applyHeardAs(s, loadHeardAsEntries());
  s = s.replace(/what's/g, "whats").replace(/what is/g, "whats");
  s = s.replace(/['']/g, "");
  s = s.replace(/[^\p{L}\p{N}\s/-]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  const tokens = s.split(" ").filter((t) => t && !FILLERS.has(t));
  return tokens.join(" ");
}
