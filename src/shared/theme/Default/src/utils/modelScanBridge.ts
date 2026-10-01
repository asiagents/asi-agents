import type { ModelCard } from '@asi-api';
import { modelCatalog, type CatalogModel } from '../data/modelCatalog';

export function isApiListedModel(card: ModelCard): boolean {
  return card.kind === 'api';
}

export function isScannedModel(card: ModelCard): boolean {
  if (card.kind === 'api' || card.kind === 'scanned') return true;
  if (card.kind === 'catalog') return false;
  return (
    card.tags.includes('custom') ||
    card.source === 'drop-in' ||
    card.tags.includes('ollama') ||
    card.tags.includes('llamacpp')
  );
}

export function isCatalogReference(card: ModelCard): boolean {
  if (card.kind === 'catalog') return true;
  if (card.kind === 'scanned' || card.kind === 'api') return false;
  return card.tags.includes('showcase') || card.source === 'in-house';
}

/** Map API card or catalog row → detail view model (no fake “installed” status). */
export function catalogModelFromCard(card: ModelCard): CatalogModel {
  const match = modelCatalog.find((m) => m.id === card.id || m.name === card.name);
  if (match) return match;
  const apiListed = isApiListedModel(card);
  const ams =
    card.source === 'ams' ||
    card.tags.includes('ams') ||
    card.id.startsWith('ams-') ||
    card.id === 'agent-chat-50-100m' ||
    card.id === 'ultra-gate-1m';
  const amsHfRepo =
    card.id === 'ams-micro-70m'
      ? 'vvarghese/ams-micro-70m'
      : card.id === 'ams-hybrid-120m'
        ? 'vvarghese/ams-hybrid-120m'
        : ams
          ? 'vvarghese'
          : undefined;
  return {
    id: card.id,
    name: card.name,
    provider: ams ? 'AMS' : card.source,
    providerId: card.provider,
    lane: apiListed ? 'pro' : 'local',
    baseStatus: isScannedModel(card) ? 'online' : 'offline',
    params: card.params?.trim() || '—',
    paramsM: 0,
    latencyMs: 0,
    encrypted: apiListed,
    source: apiListed ? 'api' : isScannedModel(card) ? 'scanned' : 'downloadable',
    note: card.meta,
    ...(amsHfRepo ? { hfRepo: amsHfRepo } : {}),
  };
}

/** UI catalog reference rows — not presented as on-disk scans. */
export function catalogReferenceEntries(): CatalogModel[] {
  return modelCatalog.filter((m) => m.source === 'downloadable');
}

/** Hide HF recipe when scan already lists the same Ollama tag or GGUF name. */
export function isCatalogSatisfiedByScan(entry: CatalogModel, scanned: ModelCard[]): boolean {
  const hay = scanned.map((s) => `${s.id} ${s.name}`.toLowerCase()).join(' ');
  if (entry.ollamaPull && hay.includes(entry.ollamaPull.toLowerCase())) return true;
  if (entry.ollamaPull) {
    const base = entry.ollamaPull.split(':')[0]?.toLowerCase();
    if (base && hay.includes(base)) return true;
  }
  if (entry.hfRepo) {
    const slug = entry.hfRepo.split('/').pop()?.toLowerCase();
    if (slug && hay.includes(slug)) return true;
  }
  if (hay.includes(entry.name.toLowerCase())) return true;
  return false;
}

export function modelLabel(id: string): string {
  const fromCatalog = modelCatalog.find((m) => m.id === id || m.coreId === id);
  if (fromCatalog) return fromCatalog.name;
  return id;
}
