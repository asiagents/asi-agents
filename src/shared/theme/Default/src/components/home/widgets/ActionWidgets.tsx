import React from 'react';
import { Link } from 'react-router-dom';
import { PanicButton } from '../../chat/PanicButton';
import { DeskLiveView } from '../../desk/DeskLiveView';
import { DeskHealth } from '../../desk/DeskHealth';
import { useDesk } from '../../../contexts/DeskContext';
import type { WidgetSize } from '../../../types/settings';

/** Re-export from todo module so older imports keep working. */
export { TodosWidget } from '../../../todo/TodosWidget';

export function PanicWidget() {
  const { pausedAt } = useDesk();
  return (
    <div className="flex flex-1 flex-col items-start justify-between">
      <p className="text-[12px] text-muted">{pausedAt ? `Paused at ${pausedAt}` : 'Stop every agent'}</p>
      <PanicButton size="lg" />
    </div>
  );
}

/**
 * Home Virtual desktop — live Desk via ASI `/api/desk/*` → daemon :3456.
 * Shows iframe when daemon is up; honest offline (not blank "keeping 0/6") when down.
 */
export function VdWidget({ size }: { size: WidgetSize }) {
  const { deskModule } = useDesk();

  if (!deskModule) {
    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-2">
        <p className="text-[13px] text-muted">The Virtual Computer module is off.</p>
        <Link to="/settings/safety" className="text-[13px] font-medium text-accent-ink hover:underline">
          Enable in Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <DeskLiveView compact={size !== 'L'} />
      {size === 'L' ? (
        <div className="shrink-0">
          <DeskHealth compact />
        </div>
      ) : null}
      <div className="mt-auto flex shrink-0 items-center gap-2 text-[11px] text-muted">
        <span>ASI Agents Desk</span>
        <Link to="/desk" className="ml-auto font-medium text-accent-ink hover:underline">
          Open Desk →
        </Link>
      </div>
    </div>
  );
}
