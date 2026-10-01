import React, { useId, useMemo } from 'react';
import type { WidgetSize } from '../../../types/settings';

type Node = { id: string; x: number; y: number; r: number };
type Link = { a: string; b: string };

/** Lightweight transparent neural graph — teal/slate, not a purple AI blob. */
const NODES: Node[] = [
  { id: 'c', x: 50, y: 48, r: 7 },
  { id: 'n1', x: 28, y: 28, r: 4.5 },
  { id: 'n2', x: 72, y: 26, r: 4.2 },
  { id: 'n3', x: 22, y: 58, r: 3.8 },
  { id: 'n4', x: 78, y: 54, r: 4.0 },
  { id: 'n5', x: 40, y: 78, r: 3.6 },
  { id: 'n6', x: 62, y: 76, r: 3.5 },
  { id: 'n7', x: 50, y: 18, r: 3.2 },
  { id: 'n8', x: 14, y: 42, r: 3.0 },
  { id: 'n9', x: 86, y: 40, r: 3.1 },
];

const LINKS: Link[] = [
  { a: 'c', b: 'n1' },
  { a: 'c', b: 'n2' },
  { a: 'c', b: 'n3' },
  { a: 'c', b: 'n4' },
  { a: 'c', b: 'n5' },
  { a: 'c', b: 'n6' },
  { a: 'c', b: 'n7' },
  { a: 'n1', b: 'n7' },
  { a: 'n1', b: 'n8' },
  { a: 'n2', b: 'n7' },
  { a: 'n2', b: 'n9' },
  { a: 'n3', b: 'n5' },
  { a: 'n3', b: 'n8' },
  { a: 'n4', b: 'n6' },
  { a: 'n4', b: 'n9' },
  { a: 'n5', b: 'n6' },
];

/**
 * Neural brain — SVG node/link animation with transparent background for Home and Lock.
 */
export function NeuralBrainWidget({ size }: { size: WidgetSize }) {
  const uid = useId().replace(/:/g, '');
  const byId = useMemo(() => Object.fromEntries(NODES.map((n) => [n.id, n])), []);
  const tall = size === 'L';

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent ${tall ? 'min-h-[140px]' : 'min-h-[96px]'}`}
      aria-label="Neural brain visualization"
    >
      <svg
        viewBox="0 0 100 100"
        className="asi-neural-brain h-full w-full flex-1 bg-transparent"
        role="img"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id={`nb-glow-${uid}`} cx="50%" cy="48%" r="42%">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.18" />
            <stop offset="55%" stopColor="rgb(var(--accent))" stopOpacity="0.05" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </radialGradient>
          <filter id={`nb-soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="100" height="100" fill="transparent" />
        <circle cx="50" cy="48" r="38" fill={`url(#nb-glow-${uid})`} />

        {LINKS.map((l, i) => {
          const a = byId[l.a];
          const b = byId[l.b];
          if (!a || !b) return null;
          return (
            <line
              key={`${l.a}-${l.b}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="asi-neural-link"
              stroke="rgb(var(--ink))"
              strokeOpacity={0.22}
              strokeWidth={0.55}
              style={{ animationDelay: `${(i % 8) * 0.18}s` }}
            />
          );
        })}

        {NODES.map((n, i) => (
          <g key={n.id} className="asi-neural-node" style={{ animationDelay: `${i * 0.12}s` }}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r + 1.8}
              fill="rgb(var(--accent))"
              fillOpacity={0.12}
              filter={`url(#nb-soft-${uid})`}
            />
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={n.id === 'c' ? 'rgb(var(--accent))' : 'rgb(var(--ink))'}
              fillOpacity={n.id === 'c' ? 0.85 : 0.55}
            />
          </g>
        ))}
      </svg>
      <p className="pointer-events-none absolute bottom-0 left-0 right-0 truncate text-center text-[10px] font-medium tracking-wide text-muted/80">
        Neural · local viz
      </p>
    </div>
  );
}
