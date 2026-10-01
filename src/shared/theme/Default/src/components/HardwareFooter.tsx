import React from 'react';
import { Link } from 'react-router-dom';
import { CpuIcon, MemoryStickIcon, MonitorIcon as GpuIcon, ShieldAlertIcon } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAppMemory } from '../hooks/useAppMemory';
import { usePendingPermissions } from '../hooks/usePendingPermissions';
import { shortGpu } from '../utils/hardware';

/** Optional footer strip (right side). RAM/VRAM from GET /api/hardware; CPU/GPU from the browser when exposed. */
export function HardwareFooter() {
  const { s, hw } = useSettings();
  const appMb = useAppMemory(s.footerStrip && s.hwTracking);
  const { pendingCount, offline } = usePendingPermissions();
  if (!s.footerStrip) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 hidden flex-col items-end gap-2 lg:flex">
    <Link
      to="/settings/hardware"
      aria-label="Hardware summary"
      className="inline-flex items-center gap-4 rounded-full bg-surface/90 px-4 py-3 text-[12px] text-muted shadow-[0_12px_40px_rgba(0,0,0,0.12)] ring-1 ring-line backdrop-blur-xl transition-colors duration-150 hover:text-ink">
      
      <span className="inline-flex items-center gap-1.5"><CpuIcon size={14} aria-hidden="true" /> CPU {hw.cores ? `${hw.cores} threads` : '—'}</span>
      <span className="inline-flex max-w-[200px] items-center gap-1.5 truncate">
        <GpuIcon size={14} aria-hidden="true" />{' '}
        {hw.vramGb != null ? `VRAM ${hw.vramGb} GB` : shortGpu(hw.gpu)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MemoryStickIcon size={14} aria-hidden="true" /> RAM {hw.memoryGb != null ? `${hw.memoryGb} GB` : '—'}
        {appMb !== null && <span className="text-faint">· app {appMb} MB</span>}
      </span>
    </Link>
    <a
      href="/permissions"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full bg-surface/90 px-3 py-2 text-[12px] text-muted shadow-[0_8px_28px_rgba(0,0,0,0.1)] ring-1 ring-line backdrop-blur-xl transition-colors duration-150 hover:text-ink"
      aria-label={
        offline
          ? 'Permissions — API offline'
          : pendingCount != null && pendingCount > 0
            ? `${pendingCount} pending permissions`
            : 'Permissions — no pending asks'
      }
    >
      <ShieldAlertIcon size={14} aria-hidden="true" />
      <span className="font-medium text-ink">Permissions</span>
      {offline ? (
        <span className="text-[11px] text-muted">offline</span>
      ) : pendingCount != null && pendingCount > 0 ? (
        <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">{pendingCount}</span>
      ) : null}
    </a>
    </div>);


}