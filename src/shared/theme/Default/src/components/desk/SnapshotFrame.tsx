import React from 'react';
import { framesFor } from '../../data/snapshots';
import type { Snapshot } from '../../contexts/SnapshotContext';

/** A captured frame of an agent's virtual desktop. Always dark, like a screen. */
export function SnapshotFrame({ agentId, snap, compact = false }: {agentId: string;snap: Snapshot;compact?: boolean;}) {
  const frames = framesFor(agentId);
  const frame = frames[snap.frame] ?? frames[0];
  if (!frame) return null;
  const offline = frame.app === 'Offline';
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-[#0b0d13] ring-1 ring-white/10">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-2.5 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#f87171]" aria-hidden="true" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24]" aria-hidden="true" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" aria-hidden="true" />
        <span className="ml-1.5 truncate text-[10px] font-medium text-[#9aa3b5]">{frame.app}</span>
        <span className="ml-auto font-mono text-[10px] text-[#6b7385]">{snap.time}</span>
      </div>
      <div className={`flex-1 space-y-1 p-2.5 font-mono ${compact ? 'text-[10px]' : 'text-[11px]'} ${offline ? 'text-[#f87171]' : 'text-[#c9cfdb]'}`}>
        {frame.lines.map((l) =>
        <div key={l} className="truncate">{l}</div>
        )}
      </div>
    </div>);

}