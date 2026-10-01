import React from 'react';
import { ShieldAlertIcon } from 'lucide-react';

export function MessageApprovalStrip() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-warn/25 bg-warn/[0.06] px-3 py-2 text-[12px] text-ink">
      <ShieldAlertIcon size={13} className="text-warn" aria-hidden="true" />
      <span className="text-muted">This reply may need a permission decision.</span>
      <a
        href="/permissions"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto font-medium text-accent-ink hover:underline"
      >
        Review permissions ↗
      </a>
    </div>
  );
}
