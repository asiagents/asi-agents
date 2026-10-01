import { loadIntentCatalog } from "./loadCatalog.js";
import { normalizeIntentText } from "./normalize.js";
import type { IntentCatalogRow, IntentMatchResult } from "./types.js";

/** Whole-token keyword hit — avoids "time" matching inside "times". */
function keywordHits(norm: string, keyword: string): boolean {
  const k = keyword.trim();
  if (!k) return false;
  if (k.includes(" ")) return norm.includes(k);
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(norm);
}

function scoreIntent(norm: string, row: IntentCatalogRow): { score: number; slots: Record<string, string> } {
  if (row.negatives?.some((n) => norm.includes(normalizeIntentText(n)))) {
    return { score: 0, slots: {} };
  }

  let score = 0;
  const slots: Record<string, string> = {};

  if (row.regex) {
    try {
      const re = new RegExp(row.regex, "i");
      const m = re.exec(norm) ?? re.exec(norm.replace(/\s+/g, " "));
      if (m) {
        score += 0.45;
        if (m[1]) {
          const g1 = m[1].trim();
          slots.name = g1;
          if (/^\d+$/.test(g1)) slots.count = g1;
          else slots.role = g1;
        }
        if (m[2]) {
          const g2 = m[2].trim();
          slots.extra = g2;
          if (/^\d+$/.test(g2)) slots.count = g2;
          else if (!slots.role || /^\d+$/.test(slots.name ?? "")) slots.role = g2;
        }
        if (m[3]) {
          const g3 = m[3].trim();
          if (/^\d+$/.test(g3)) {
            // e.g. count to N — only group 3 is set
            if (!slots.count) slots.count = g3;
            else slots.extra = slots.extra || g3;
          } else if (!slots.extra) {
            slots.extra = g3;
          }
        }
      }
    } catch {
      /* ignore bad regex */
    }
  }

  const required = row.keywords ?? [];
  if (required.length > 0) {
    const any = required.some((k) => keywordHits(norm, normalizeIntentText(k)));
    if (any) score += 0.35;
  }

  const optional = row.optionalKeywords ?? [];
  if (optional.some((k) => keywordHits(norm, normalizeIntentText(k)))) {
    score += 0.25;
  }

  const phrases = row.phrases ?? [];
  let bestPhrase = 0;
  for (const p of phrases) {
    const pn = normalizeIntentText(p);
    if (!pn) continue;
    if (norm === pn) bestPhrase = Math.max(bestPhrase, 0.85);
    else if (
      norm.includes(` ${pn} `) ||
      norm.startsWith(`${pn} `) ||
      norm.endsWith(` ${pn}`)
    ) {
      bestPhrase = Math.max(bestPhrase, 0.55);
    }
  }
  score += bestPhrase;

  const min = row.minScore ?? 0;
  if (score < min) return { score: 0, slots };
  return { score: Math.min(score, 1), slots };
}

export type RankedIntent = {
  intentId: string;
  handler: string;
  score: number;
  slots: Record<string, string>;
  needsConfirm: boolean;
};

/** Soft ranking for fan-out — does not apply high/margin gates. */
export function rankIntentMatches(rawText: string): RankedIntent[] {
  const trimmed = rawText.trim();
  if (!trimmed || trimmed.length > 500) return [];
  const norm = normalizeIntentText(trimmed);
  if (!norm) return [];

  const { intents } = loadIntentCatalog();
  const ranked: RankedIntent[] = [];
  for (const row of intents) {
    const { score, slots } = scoreIntent(norm, row);
    if (score > 0) {
      ranked.push({
        intentId: row.id,
        handler: row.handler,
        score,
        slots,
        needsConfirm: row.confirm === true,
      });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

export function matchIntent(rawText: string): IntentMatchResult | "escalate" | "overlong" {
  const trimmed = rawText.trim();
  if (!trimmed) return "escalate";
  if (trimmed.length > 500) return "overlong";

  const norm = normalizeIntentText(trimmed);
  if (!norm) return "escalate";

  const { thresholds } = loadIntentCatalog();
  const ranked = rankIntentMatches(rawText);
  const top = ranked[0];
  if (!top || top.score < thresholds.low) return "escalate";

  const second = ranked[1];
  const margin = second ? top.score - second.score : top.score;
  if (top.score < thresholds.high || margin < thresholds.margin) return "escalate";

  return {
    intentId: top.intentId,
    handler: top.handler,
    confidence: top.score,
    slots: top.slots,
    needsConfirm: top.needsConfirm,
  };
}
