import React from 'react';

export type BarDatum = {
  key: string;
  label: string;
  value: number;
  /** Tailwind color class for the bar fill, e.g. bg-accent */
  colorClass?: string;
};

/** Simple CSS bar diagram — no chart library. */
export function BarDiagram({
  data,
  emptyLabel = 'No data yet',
  maxBars = 8,
  compact = false,
  onBarClick,
}: {
  data: BarDatum[];
  emptyLabel?: string;
  maxBars?: number;
  compact?: boolean;
  onBarClick?: (key: string) => void;
}) {
  const rows = data.slice(0, maxBars);
  const max = Math.max(0, ...rows.map((d) => d.value));
  const any = rows.some((d) => d.value > 0);

  if (!rows.length || !any) {
    return <p className="text-[13px] leading-snug text-ink/80">{emptyLabel}</p>;
  }

  return (
    <ul
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${compact ? 'gap-1' : 'gap-1.5'}`}
    >
      {rows.map((d) => {
        const pct = max > 0 ? Math.max(d.value > 0 ? 4 : 0, Math.round((d.value / max) * 100)) : 0;
        const clickable = Boolean(onBarClick);
        const RowTag = clickable ? 'button' : 'div';
        return (
          <li key={d.key} className="shrink-0">
            <RowTag
              type={clickable ? 'button' : undefined}
              onClick={clickable ? () => onBarClick?.(d.key) : undefined}
              className={`flex w-full items-center gap-2 text-left ${
                compact ? 'text-[12px]' : 'text-[13px]'
              } ${
                clickable
                  ? 'rounded-md px-0.5 py-0.5 transition-colors duration-150 hover:bg-overlay/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent/50'
                  : ''
              }`}
              title={clickable ? `Inspect ${d.label}` : undefined}
            >
              <span
                className={`shrink-0 truncate font-medium text-ink ${compact ? 'w-12' : 'w-16'}`}
                title={d.label}
              >
                {d.label}
              </span>
              <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-overlay/[0.1] ring-1 ring-inset ring-line/60">
                <div
                  className={`absolute inset-y-0 left-0 rounded-sm transition-[width] duration-300 ${d.colorClass ?? 'bg-accent'}`}
                  style={{ width: `${pct}%` }}
                  role="img"
                  aria-label={`${d.label}: ${d.value}`}
                />
              </div>
              <span className="w-7 shrink-0 text-right text-[12px] font-semibold tabular-nums text-ink">
                {d.value}
              </span>
            </RowTag>
          </li>
        );
      })}
    </ul>
  );
}
