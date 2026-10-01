import React from 'react';
import { OctagonPauseIcon, PlayIcon } from 'lucide-react';
import { useDesk } from '../../contexts/DeskContext';

/** Kill-switch. Opens the global confirm; the dialog lives in AppShell so the keyboard shortcut can reach it too. */
export function PanicButton({ size = 'sm' }: {size?: 'sm' | 'lg';}) {
  const { pausedAt, requestPanic, resumeAll } = useDesk();

  if (pausedAt) {
    return (
      <button
        type="button"
        onClick={resumeAll}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
        
        <PlayIcon size={13} aria-hidden="true" /> Resume all
      </button>);

  }

  return (
    <button
      type="button"
      onClick={requestPanic}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#dc2626] font-semibold text-white transition-colors duration-150 hover:bg-[#b91c1c] ${
      size === 'lg' ? 'px-5 py-3 text-sm' : 'px-3 py-1.5 text-[12px]'}`
      }>
      
      <OctagonPauseIcon size={size === 'lg' ? 18 : 14} aria-hidden="true" /> Panic
    </button>);

}