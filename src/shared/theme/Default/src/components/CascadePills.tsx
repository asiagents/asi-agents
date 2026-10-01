import React from 'react';
import { ChevronRightIcon } from 'lucide-react';

/**
 * Decorative shipping note — live failover order is Settings → Models → Cascade.
 * Kept for any older surfaces that still import this component.
 */
export function CascadePills({ compact = false }: { compact?: boolean }) {
  return (
    <ol aria-label="Model failover note" className="flex flex-wrap items-center gap-1">
      <li className="flex items-center gap-1">
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent/10 font-medium text-accent-ink ring-1 ring-inset ring-accent/25 ${
            compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[12px]'
          }`}
        >
          Primary
          {!compact && <span className="font-normal opacity-80">· agent</span>}
        </span>
        <ChevronRightIcon size={12} className="text-faint" aria-hidden="true" />
      </li>
      <li className="flex items-center gap-1">
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-info/10 font-medium text-info ring-1 ring-inset ring-info/25 ${
            compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[12px]'
          }`}
        >
          Cascade order
          {!compact && <span className="font-normal opacity-80">· when enabled</span>}
        </span>
        <ChevronRightIcon size={12} className="text-faint" aria-hidden="true" />
      </li>
      <li>
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warn/10 font-medium text-warn ring-1 ring-inset ring-warn/25 ${
            compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[12px]'
          }`}
        >
          Secondary
          {!compact && <span className="font-normal opacity-80">· agent</span>}
        </span>
      </li>
    </ol>
  );
}
