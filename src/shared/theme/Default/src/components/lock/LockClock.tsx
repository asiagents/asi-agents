import React, { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import type { ClockStyle } from '../../types/settings';

function zoneParts(now: Date): { h: number; m: number; s: number } {
  return {
    h: now.getHours() % 12,
    m: now.getMinutes(),
    s: now.getSeconds(),
  };
}

function AnalogLockFace({
  now,
  mechanical,
  size,
}: {
  now: Date;
  mechanical: boolean;
  size: number;
}) {
  const { h, m, s } = zoneParts(now);
  const hourDeg = h * 30 + m * 0.5;
  const minDeg = m * 6 + s * 0.1;
  const secDeg = s * 6;
  const r = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="text-ink drop-shadow-[0_12px_40px_rgba(97,84,187,0.22)]"
    >
      <defs>
        <radialGradient id="lock-face-glow" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="rgb(var(--surface))" stopOpacity="0.05" />
        </radialGradient>
      </defs>
      <circle
        cx={r}
        cy={r}
        r={r - 2}
        fill="url(#lock-face-glow)"
        stroke="currentColor"
        strokeOpacity={mechanical ? 0.55 : 0.28}
        strokeWidth={mechanical ? 3 : 1.5}
      />
      {(mechanical ? [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] : [0, 90, 180, 270]).map((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const inner = mechanical ? r - 14 : r - 10;
        const outer = r - 4;
        return (
          <line
            key={deg}
            x1={r + Math.cos(rad) * inner}
            y1={r + Math.sin(rad) * inner}
            x2={r + Math.cos(rad) * outer}
            y2={r + Math.sin(rad) * outer}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={mechanical || deg % 90 === 0 ? 2 : 1}
          />
        );
      })}
      <line
        x1={r}
        y1={r}
        x2={r + Math.sin((hourDeg * Math.PI) / 180) * (r * 0.42)}
        y2={r - Math.cos((hourDeg * Math.PI) / 180) * (r * 0.42)}
        stroke="currentColor"
        strokeWidth={mechanical ? 4 : 3}
        strokeLinecap="round"
      />
      <line
        x1={r}
        y1={r}
        x2={r + Math.sin((minDeg * Math.PI) / 180) * (r * 0.66)}
        y2={r - Math.cos((minDeg * Math.PI) / 180) * (r * 0.66)}
        stroke="currentColor"
        strokeWidth={mechanical ? 2.5 : 2}
        strokeLinecap="round"
      />
      {!mechanical ? (
        <line
          x1={r}
          y1={r}
          x2={r + Math.sin((secDeg * Math.PI) / 180) * (r * 0.72)}
          y2={r - Math.cos((secDeg * Math.PI) / 180) * (r * 0.72)}
          className="stroke-accent"
          strokeWidth={1.25}
          strokeLinecap="round"
        />
      ) : null}
      <circle cx={r} cy={r} r={mechanical ? 4 : 3} className="fill-accent" />
    </svg>
  );
}

function DigitalLockFace({
  now,
  roomy,
  compact,
}: {
  now: Date;
  roomy: boolean;
  compact?: boolean;
}) {
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');

  return (
    <p
      className={`lock-clock-digital font-semibold leading-none tracking-tight ${
        compact
          ? 'text-[56px] sm:text-[72px]'
          : roomy
            ? 'text-[96px] md:text-[128px]'
            : 'text-[80px] md:text-[108px]'
      }`}
      style={{
        fontFamily: "'Syne', 'Segoe UI', sans-serif",
        letterSpacing: compact ? '-0.04em' : '-0.055em',
        backgroundImage:
          'linear-gradient(180deg, rgb(var(--ink)) 0%, rgb(var(--ink)) 55%, rgb(var(--accent-ink)) 130%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }}
    >
      <span className="tabular-nums">{h}</span>
      <span
        className="mx-[0.04em] inline-block animate-pulse"
        style={{ color: 'rgb(var(--accent-ink))', WebkitTextFillColor: 'rgb(var(--accent-ink))' }}
        aria-hidden="true"
      >
        :
      </span>
      <span className="tabular-nums">{m}</span>
    </p>
  );
}

/** Large lock-face clock — Dig / Ana / Mech from shared clockStyle prefs. */
export function LockClock({
  roomy = false,
  compact = false,
}: {
  roomy?: boolean;
  compact?: boolean;
}) {
  const { s } = useSettings();
  const style: ClockStyle = s.clockStyle ?? 'digital';
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = style === 'digital' ? 15_000 : 1_000;
    const id = window.setInterval(() => setNow(new Date()), tick);
    return () => window.clearInterval(id);
  }, [style]);

  const dateLine = useMemo(
    () => now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
    [now]
  );

  const faceSize = compact ? (roomy ? 148 : 128) : roomy ? 220 : 180;

  return (
    <div className="lock-clock">
      {style === 'digital' ? (
        <DigitalLockFace now={now} roomy={roomy} compact={compact} />
      ) : (
        <div className={compact ? 'mt-1' : 'mt-2'}>
          <AnalogLockFace now={now} mechanical={style === 'mechanical'} size={faceSize} />
        </div>
      )}
      <p
        className={`mt-3 text-muted ${compact ? 'text-sm' : roomy ? 'text-xl' : 'text-lg'}`}
        style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", letterSpacing: '0.02em' }}
      >
        {dateLine}
      </p>
    </div>
  );
}
