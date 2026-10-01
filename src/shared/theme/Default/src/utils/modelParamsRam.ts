import type { ModelCard } from '@asi-api';
import { modelCatalog, type CatalogModel } from '../data/modelCatalog';

/** Curated AMS recipe hardware (mirrors models/ams/catalog.json — planning hints, not measured). */
const AMS_HARDWARE: Record<string, { params: string; ram: string }> = {
  'ams-micro-70m': { params: '70M', ram: '~0.5–1 GB (Q4 catalog)' },
  'ams-hybrid-120m': { params: '120M', ram: '~1–2 GB (Q4 catalog)' },
  'agent-chat-50-100m': { params: '~50–100M', ram: '~0.5–1.5 GB (Q4 catalog)' },
  'ultra-gate-1m': { params: '~1M', ram: 'Negligible (<100 MB)' },
};

export type ModelParamsRam = {
  /** Display params, e.g. `7B` / `70M`, or `N/A`. */
  params: string;
  /** Expected PC RAM impact, or `N/A` / `N/A (cloud)`. */
  ramImpact: string;
  paramsKnown: boolean;
  ramKnown: boolean;
};

/** Pull a compact size token from ids like `qwen2.5-coder:1.5b` or `gemma2:4b`. */
export function inferModelSizeLabel(id: string, name: string, params?: string): string | null {
  if (params && params.trim() && params !== '—') {
    const cleaned = params.trim().replace(/\s*\+.*$/, '');
    if (/embed|stt|tts|asr/i.test(cleaned) && !/\d/.test(cleaned)) return null;
    return params.trim();
  }
  const hay = `${id} ${name}`;
  const m = hay.match(/(\d+(?:\.\d+)?)\s*([bBmM])\b/);
  if (!m) return null;
  return `${m[1]}${m[2].toUpperCase()}`;
}

/**
 * Parse a params label into millions of parameters.
 * Ranges like `~50–100M` use the midpoint. Returns null when unknown / non-numeric.
 */
export function parseParamsToMillions(label: string | null | undefined): number | null {
  if (!label) return null;
  const s = label.trim();
  if (!s || s === '—' || s.toUpperCase() === 'N/A') return null;
  if (/^(embed|stt|tts|asr)\b/i.test(s) && !/\d/.test(s)) return null;

  const range = s.match(
    /~?\s*(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*([bBmM])\b/
  );
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    const unit = range[3].toUpperCase();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const mid = (a + b) / 2;
    return unit === 'B' ? mid * 1000 : mid;
  }

  const single = s.match(/~?\s*(\d+(?:\.\d+)?)\s*([bBmM])\b/);
  if (!single) return null;
  const n = Number(single[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return single[2].toUpperCase() === 'B' ? n * 1000 : n;
}

/**
 * Honest Q4-class load estimate for on-device weights (planning only).
 * Uses ~0.55–0.7 bytes/param plus modest runtime overhead; floors tiny SLMs.
 */
export function estimateQ4RamRangeGb(paramsM: number): { low: number; high: number } | null {
  if (!Number.isFinite(paramsM) || paramsM <= 0) return null;
  if (paramsM < 200) return { low: 0.5, high: 1.5 };
  const B = paramsM / 1000;
  const low = Math.round((B * 0.55 + 0.3) * 10) / 10;
  const high = Math.round((B * 0.7 + Math.max(0.5, B * 0.15)) * 10) / 10;
  return { low, high: Math.max(low, high) };
}

function formatRamRange(range: { low: number; high: number }, suffix = 'Q4 est.'): string {
  const fmt = (n: number) => (n >= 10 ? String(Math.round(n)) : String(n));
  if (range.low === range.high) return `~${fmt(range.low)} GB (${suffix})`;
  return `~${fmt(range.low)}–${fmt(range.high)} GB (${suffix})`;
}

function findCatalogMatch(card: ModelCard | CatalogModel): CatalogModel | undefined {
  const isCard = 'meta' in card;
  if (!isCard) return card as CatalogModel;
  const id = card.id.toLowerCase();
  const name = card.name.toLowerCase();
  return modelCatalog.find((m) => {
    if (m.id === card.id || m.name === card.name) return true;
    if (m.ollamaPull) {
      const pull = m.ollamaPull.toLowerCase();
      if (id.includes(pull) || name.includes(pull)) return true;
      const base = pull.split(':')[0];
      if (base && (id.includes(base) || name.includes(base))) return true;
    }
    return false;
  });
}

function findAmsHardware(id: string, name: string, meta?: string): { params: string; ram: string } | null {
  const hay = `${id} ${name} ${meta ?? ''}`.toLowerCase();
  for (const [key, hw] of Object.entries(AMS_HARDWARE)) {
    if (hay.includes(key) || hay.includes(key.replace(/-/g, ''))) return hw;
  }
  // Matched AMS GGUF meta often includes `matches ams-micro-70m`
  const match = hay.match(/matches\s+(ams-[\w-]+|agent-chat-[\w-]+|ultra-gate-[\w-]+)/);
  if (match && AMS_HARDWARE[match[1]]) return AMS_HARDWARE[match[1]];
  return null;
}

/** Prefer an explicit RAM phrase already present in AMS/meta text. */
function parseRamFromText(text: string): string | null {
  if (!text) return null;
  if (/negligible/i.test(text)) {
    const m = text.match(/negligible[^·|]*/i);
    return m ? m[0].trim() : 'Negligible';
  }
  const m = text.match(/~?\s*[\d.,]+(?:\s*[–-]\s*[\d.,]+)?\s*GB\s*RAM[^·|]*/i);
  return m ? m[0].trim() : null;
}

function isCloudCard(card: ModelCard | CatalogModel): boolean {
  if ('meta' in card) {
    return card.kind === 'api' || card.tags?.includes('api') === true;
  }
  return (card as CatalogModel).lane === 'pro' || (card as CatalogModel).source === 'api';
}

/**
 * Params size + expected PC RAM impact for Browse rows.
 * Returns `N/A` when unknown; cloud rows never invent a local RAM figure.
 */
export function modelParamsRam(card: ModelCard | CatalogModel): ModelParamsRam {
  const isCard = 'meta' in card;
  const id = card.id;
  const name = card.name;
  const meta = isCard ? card.meta : (card as CatalogModel).note;
  const cloud = isCloudCard(card);

  const catalog = findCatalogMatch(card);
  const ams = findAmsHardware(id, name, meta);

  let paramsLabel =
    (isCard ? card.params : undefined) ||
    (!isCard ? (card as CatalogModel).params : undefined) ||
    ams?.params ||
    (catalog && catalog.params !== '—' ? catalog.params : null) ||
    inferModelSizeLabel(
      id,
      name,
      isCard ? card.params : (card as CatalogModel).params
    );

  if (paramsLabel === '—') paramsLabel = null;

  // Meta sometimes embeds params before “recipe — not on disk”
  if (!paramsLabel && meta) {
    const fromMeta = meta.match(/\b(~?\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*[bBmM])\b/);
    if (fromMeta) paramsLabel = fromMeta[1].replace(/\s+/g, '');
  }

  const paramsM =
    (!isCard && (card as CatalogModel).paramsM > 0 ? (card as CatalogModel).paramsM : 0) ||
    (catalog && catalog.paramsM > 0 ? catalog.paramsM : 0) ||
    parseParamsToMillions(paramsLabel) ||
    0;

  const paramsKnown = Boolean(paramsLabel) || paramsM > 0;
  let params = 'N/A';
  if (paramsLabel) {
    params = paramsLabel;
  } else if (paramsM > 0) {
    params =
      paramsM >= 1000
        ? `${Number((paramsM / 1000).toFixed(paramsM % 1000 === 0 ? 0 : 1))}B`
        : `${Math.round(paramsM)}M`;
  }
  if (cloud) {
    return {
      params,
      ramImpact: 'N/A (cloud)',
      paramsKnown,
      ramKnown: false,
    };
  }

  const serverRam = isCard ? card.ramHint?.trim() : undefined;
  const fromMetaRam = parseRamFromText(meta ?? '');
  const noteRam = catalog ? parseRamFromText(catalog.note) : null;
  const curatedRam = serverRam || ams?.ram || noteRam || fromMetaRam;

  if (curatedRam) {
    return {
      params,
      ramImpact: curatedRam,
      paramsKnown,
      ramKnown: true,
    };
  }

  if (paramsM > 0) {
    const range = estimateQ4RamRangeGb(paramsM);
    if (range) {
      return {
        params,
        ramImpact: formatRamRange(range),
        paramsKnown,
        ramKnown: true,
      };
    }
  }

  return {
    params,
    ramImpact: '?—estimate N/A',
    paramsKnown,
    ramKnown: false,
  };
}
