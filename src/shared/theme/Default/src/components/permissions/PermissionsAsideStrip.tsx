import React from 'react';
import { ShieldAlertIcon } from 'lucide-react';
import { usePendingPermissions } from '../../hooks/usePendingPermissions';

/** Compact permissions chrome for chat / council side panels. */
export function PermissionsAsideStrip() {
  const { pendingCount, offline } = usePendingPermissions();

  return (
    <div className="mx-4 mb-3 rounded-lg bg-bg px-3 py-2.5 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlertIcon size={14} className="shrink-0 text-accent-ink" aria-hidden="true" />
        <span className="text-[12px] font-medium text-ink">Permissions</span>
        {offline ? (
          <span className="text-[11px] text-muted">API offline</span>
        ) : pendingCount != null && pendingCount > 0 ? (
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">
            {pendingCount} pending
          </span>
        ) : (
          <span className="text-[11px] text-muted">No pending asks</span>
        )}
        <a
          href="/permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[11px] font-medium text-accent-ink hover:underline"
        >
          Open ↗
        </a>
      </div>
    </div>
  );
}
