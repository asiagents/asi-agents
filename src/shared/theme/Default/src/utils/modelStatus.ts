import type { CatalogModel, CatalogStatus } from '../data/modelCatalog';
import type { Provider } from '../types/settings';

/** Status after applying the header Local / Online switches and provider toggles. Dead always stays dead. */
export function effectiveStatus(m: CatalogModel, localOn: boolean, onlineOn: boolean, providers: Provider[]): CatalogStatus {
  if (m.baseStatus === 'dead') return 'dead';
  if (m.lane === 'local') return localOn ? m.baseStatus : 'offline';
  if (!onlineOn) return 'offline';
  if (m.providerId && !providers.find((p) => p.id === m.providerId)?.enabled) return 'offline';
  return m.baseStatus;
}

export function offlineReason(m: CatalogModel, localOn: boolean, onlineOn: boolean, providers: Provider[]): string | null {
  if (m.baseStatus === 'dead') return 'Retired';
  if (m.lane === 'local' && !localOn) return 'Local switched off in header';
  if (m.lane !== 'local' && !onlineOn) return 'Online switched off in header';
  if (m.providerId && !providers.find((p) => p.id === m.providerId)?.enabled) return 'Provider off';
  if (m.source === 'downloadable') return 'Not downloaded';
  return null;
}

export function paramsBucket(m: CatalogModel): 'small' | 'mid' | 'large' {
  if (m.paramsM < 100) return 'small';
  if (m.paramsM < 1000) return 'mid';
  return 'large';
}