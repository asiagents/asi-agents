import type { VoiceDictionaryEntry } from '@asi-api';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Apply heard_as aliases → canonical (longest first). Same rules as server intent normalize. */
export function applyHeardAs(text: string, entries: VoiceDictionaryEntry[]): string {
  if (!text || !entries.length) return text;
  const sorted = [...entries].sort((a, b) => b.heardAs.length - a.heardAs.length);
  let out = text;
  for (const e of sorted) {
    const alias = e.heardAs.trim();
    if (!alias) continue;
    const parts = alias.split(/\s+/).map(escapeRe);
    const pattern = parts.join('\\s+');
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'giu');
    out = out.replace(re, e.canonical);
  }
  return out;
}
