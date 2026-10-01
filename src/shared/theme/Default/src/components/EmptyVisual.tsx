import React from 'react';
import { ImageOffIcon } from 'lucide-react';

/** Structured empty state when no real screenshot asset is shipped. */
export function EmptyVisual({
  label = 'No capture yet',
  className = '',
  aspect = '4/3'
}: {
  label?: string;
  className?: string;
  aspect?: string;
}) {
  return (
    <div
      className={`grid place-items-center rounded-card bg-overlay/[0.04] ring-1 ring-line ${className}`}
      style={{ aspectRatio: aspect }}>
      <div className="px-4 text-center">
        <ImageOffIcon size={22} className="mx-auto text-faint" aria-hidden="true" />
        <p className="mt-2 text-[12px] font-medium text-muted">{label}</p>
      </div>
    </div>);

}
