import React from 'react';
import type { CatalogStatus } from '../../data/modelCatalog';

const styles: Record<CatalogStatus, {label: string;cls: string;dot: string;}> = {
  online: { label: 'Online', cls: 'text-success', dot: 'bg-success' },
  offline: { label: 'Offline', cls: 'text-muted', dot: 'bg-faint' },
  dead: { label: 'Dead', cls: 'text-danger', dot: 'bg-danger' }
};

export function StatusBadge({ status, title }: {status: CatalogStatus;title?: string | null;}) {
  const s = styles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium ${s.cls}`} title={title ?? undefined}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>);

}