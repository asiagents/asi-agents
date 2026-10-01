import React from 'react';
import { useDesk } from '../contexts/DeskContext';
import { useProfile } from '../contexts/ProfileContext';
import { modeOptions } from '../data/modes';
import { EmptyVisual } from './EmptyVisual';
import type { ProfileHomeMode } from '@asi-api';

/** Large picture tiles for choosing a mode. Used only in Settings → General and first login. */
export function ModeTiles({ onPick }: {onPick?: () => void;}) {
  const { mode } = useDesk();
  const { updateActiveSlice } = useProfile();
  return (
    <div role="radiogroup" aria-label="Mode" className="grid gap-3 md:grid-cols-3">
      {modeOptions.map((o) => {
        const active = mode === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              // Persist profile homeMode + desk mode; council session switches via DeskContext / prefs.
              void updateActiveSlice({ homeMode: o.id as ProfileHomeMode });
              onPick?.();
            }}
            style={{ boxShadow: active ? `0 0 0 2px ${o.accent}` : undefined, backgroundColor: active ? o.tint : undefined }}
            className={`flex flex-col overflow-hidden rounded-card text-left transition-[box-shadow,background-color] duration-150 ${
            active ? '' : 'bg-surface ring-1 ring-line hover:ring-overlay/25'}`
            }>
            
            <span className="relative block">
              {o.image ?
              <img src={o.image} alt="" className="aspect-[4/3] w-full object-cover" /> :

              <EmptyVisual label={`${o.short} mode`} className="w-full rounded-none ring-0" />
              }
              <span className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: o.accent }} aria-hidden="true" />
            </span>
            <span className="flex flex-1 flex-col p-4">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.accent }} aria-hidden="true" />
                <span className="text-[15px] font-semibold text-ink">{o.label}</span>
                {active &&
                <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: o.accent }}>
                    Selected
                  </span>
                }
              </span>
              <span className="mt-1 text-[13px] font-medium" style={{ color: o.accent }}>{o.caption}</span>
              <span className="mt-1.5 block text-[12px] leading-relaxed text-muted">{o.blurb}</span>
            </span>
          </button>);

      })}
    </div>);

}
