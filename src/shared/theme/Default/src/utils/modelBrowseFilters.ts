import type { ModelCard } from '@asi-api';
import type { CapabilityCatalogModel } from '@asi-api';

export type HostingFilter = 'local' | 'api';
export type BrowseFilterId = 'free' | HostingFilter;

export const HOSTING_FILTERS: { id: HostingFilter; label: string }[] = [
  { id: 'local', label: 'Local' },
  { id: 'api', label: 'API' },
];

export const PRICING_FILTERS: { id: 'free'; label: string }[] = [{ id: 'free', label: 'Free only' }];

export function isLocalScanCard(card: ModelCard): boolean {
  return card.kind !== 'api';
}

export function isApiScanCard(card: ModelCard): boolean {
  return card.kind === 'api';
}

/** Scan list: free when the card is not marked paid (all on-device scans). */
export function isFreeScanCard(card: ModelCard): boolean {
  return !card.paid;
}

export function passesScanBrowseFilters(
  card: ModelCard,
  active: Set<BrowseFilterId>
): boolean {
  if (active.size === 0) return true;
  const needFree = active.has('free');
  const needLocal = active.has('local');
  const needApi = active.has('api');
  const hostingWanted = needLocal || needApi;

  if (hostingWanted) {
    const local = isLocalScanCard(card);
    const api = isApiScanCard(card);
    const hostingOk = (needLocal && local) || (needApi && api);
    if (!hostingOk) return false;
  }
  if (needFree && !isFreeScanCard(card)) return false;
  return true;
}

const LOCAL_CATALOG_PROVIDERS = new Set([
  'ollama',
  'gguf',
  'local',
  'docling',
  'marker',
  'unstructured',
  'stack',
  'audio',
]);

export function isLocalCatalogRow(m: CapabilityCatalogModel): boolean {
  const p = m.provider.toLowerCase();
  if (LOCAL_CATALOG_PROVIDERS.has(p)) return true;
  const id = m.id.toLowerCase();
  return (
    id.startsWith('ollama/') ||
    id.startsWith('local/') ||
    id.startsWith('gguf/') ||
    id.startsWith('stack/') ||
    id.startsWith('audio/')
  );
}

export function isApiCatalogRow(m: CapabilityCatalogModel): boolean {
  return !isLocalCatalogRow(m);
}

/** Catalog: explicit free hint, or local recipe (not API-priced). Unknown API rows fail closed. */
export function isFreeCatalogRow(m: CapabilityCatalogModel): boolean {
  if (m.pricingHint === 'free') return true;
  if (m.pricingHint === 'paid') return false;
  return isLocalCatalogRow(m);
}
