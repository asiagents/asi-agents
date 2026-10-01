/**
 * User-editable heard_as map: misheard / alias → canonical (agent names, skills, apps).
 * Applied in intent normalize and available to the client for STT correction.
 */
import type { VoiceDictionaryEntry, VoiceDictionaryKind } from "./types.js";

const KINDS = new Set<VoiceDictionaryKind>(["agent", "skill", "app", "other"]);

/** Seed aliases for common STT / nickname slips. Users can edit freely. */
export const DEFAULT_VOICE_DICTIONARY: VoiceDictionaryEntry[] = [
  { heardAs: "cheese", canonical: "chief", kind: "agent" },
  { heardAs: "sheaf", canonical: "chief", kind: "agent" },
  { heardAs: "jeff", canonical: "chief", kind: "agent" },
  { heardAs: "fin ants", canonical: "finance", kind: "agent" },
  { heardAs: "fine ants", canonical: "finance", kind: "agent" },
  { heardAs: "design agent", canonical: "design", kind: "agent" },
  { heardAs: "research agent", canonical: "research", kind: "agent" },
  { heardAs: "virtual desk", canonical: "desk", kind: "app" },
  { heardAs: "v desk", canonical: "desk", kind: "app" },
  { heardAs: "in box", canonical: "inbox", kind: "app" },
];

function normalizeKind(raw: unknown): VoiceDictionaryKind {
  if (typeof raw === "string" && KINDS.has(raw as VoiceDictionaryKind)) {
    return raw as VoiceDictionaryKind;
  }
  return "other";
}

function normalizeEntry(raw: unknown): VoiceDictionaryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<VoiceDictionaryEntry>;
  const heardAs = typeof o.heardAs === "string" ? o.heardAs.trim().slice(0, 80) : "";
  const canonical = typeof o.canonical === "string" ? o.canonical.trim().slice(0, 80) : "";
  if (!heardAs || !canonical) return null;
  return {
    heardAs,
    canonical,
    kind: normalizeKind(o.kind),
  };
}

export function normalizeVoiceDictionary(raw: unknown): VoiceDictionaryEntry[] {
  if (!Array.isArray(raw)) return DEFAULT_VOICE_DICTIONARY.map((e) => ({ ...e }));
  const out: VoiceDictionaryEntry[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const e = normalizeEntry(row);
    if (!e) continue;
    const key = e.heardAs.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** Escape for RegExp literal match of a phrase. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace heard_as aliases with canonical forms (case-insensitive, longest alias first).
 * Alias must match as a contiguous phrase (flexible whitespace).
 */
export function applyHeardAs(text: string, entries: VoiceDictionaryEntry[]): string {
  if (!text || !entries.length) return text;
  const sorted = [...entries].sort((a, b) => b.heardAs.length - a.heardAs.length);
  let out = text;
  for (const e of sorted) {
    const alias = e.heardAs.trim();
    if (!alias) continue;
    const parts = alias.split(/\s+/).map(escapeRe);
    const pattern = parts.join("\\s+");
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "giu");
    out = out.replace(re, e.canonical);
  }
  return out;
}
