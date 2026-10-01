import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSunIcon, CpuIcon, MemoryStickIcon, MonitorIcon, RefreshCwIcon } from 'lucide-react';
import { useSettings } from '../../../contexts/SettingsContext';
import { useInternetSpeed } from '../../../hooks/useInternetSpeed';
import { useWeather, weatherLabel } from '../../../hooks/useWeather';
import { useCalendar } from '../../../hooks/useCalendar';
import { shortGpu } from '../../../utils/hardware';
import {
  DEFAULT_CLOCK_PREFS,
  WORLD_CLOCK_SUGGESTIONS,
} from '../../../utils/storage';
import type { ClockStyle, WidgetSize } from '../../../types/settings';

const ZONE_OPTIONS = [
  ...WORLD_CLOCK_SUGGESTIONS.map((c) => c.zone),
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'Australia/Sydney',
  'UTC',
].filter((z, i, arr) => arr.indexOf(z) === i);

const DEFAULT_WORLD = DEFAULT_CLOCK_PREFS.worldZones as readonly string[];

const ZONE_LABELS: Record<string, string> = Object.fromEntries(
  WORLD_CLOCK_SUGGESTIONS.map((c) => [c.zone, c.label])
);

function zoneCity(zone: string): string {
  if (ZONE_LABELS[zone]) return ZONE_LABELS[zone];
  const part = zone.split('/').pop() ?? zone;
  return part.replace(/_/g, ' ');
}

function formatZoneTime(now: Date, zone: string): string {
  try {
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: zone });
  } catch {
    return '—';
  }
}

function zoneParts(now: Date, zone: string): { h: number; m: number; s: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const num = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return { h: num('hour') % 12, m: num('minute'), s: num('second') };
  } catch {
    return { h: 0, m: 0, s: 0 };
  }
}

function AnalogFace({
  now,
  zone,
  mechanical = false,
  size = 72,
}: {
  now: Date;
  zone: string;
  mechanical?: boolean;
  size?: number;
}) {
  const { h, m, s } = zoneParts(now, zone);
  const hourDeg = h * 30 + m * 0.5;
  const minDeg = m * 6 + s * 0.1;
  const secDeg = s * 6;
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0 text-ink">
      <circle
        cx={r}
        cy={r}
        r={r - 1.5}
        className={mechanical ? 'fill-overlay/10' : 'fill-bg'}
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeWidth={mechanical ? 2.5 : 1.5}
      />
      {mechanical
        ? [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            const x1 = r + Math.cos(rad) * (r - 8);
            const y1 = r + Math.sin(rad) * (r - 8);
            const x2 = r + Math.cos(rad) * (r - 3);
            const y2 = r + Math.sin(rad) * (r - 3);
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={1.5} />;
          })
        : null}
      <line
        x1={r}
        y1={r}
        x2={r + Math.sin((hourDeg * Math.PI) / 180) * (r * 0.45)}
        y2={r - Math.cos((hourDeg * Math.PI) / 180) * (r * 0.45)}
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <line
        x1={r}
        y1={r}
        x2={r + Math.sin((minDeg * Math.PI) / 180) * (r * 0.68)}
        y2={r - Math.cos((minDeg * Math.PI) / 180) * (r * 0.68)}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      {!mechanical ? (
        <line
          x1={r}
          y1={r}
          x2={r + Math.sin((secDeg * Math.PI) / 180) * (r * 0.72)}
          y2={r - Math.cos((secDeg * Math.PI) / 180) * (r * 0.72)}
          className="stroke-accent"
          strokeWidth={1}
          strokeLinecap="round"
        />
      ) : null}
      <circle cx={r} cy={r} r={2.5} fill="currentColor" />
    </svg>
  );
}

export function TimeWidget({ size }: { size: WidgetSize }) {
  const { s, set, net } = useSettings();
  const weather = useWeather(s.weatherLocation, s.tempUnit);
  const [now, setNow] = useState(new Date());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const tick = s.clockStyle === 'digital' ? 15_000 : 1_000;
    const id = window.setInterval(() => setNow(new Date()), tick);
    return () => window.clearInterval(id);
  }, [s.clockStyle]);

  const localCity =
    s.localCity.trim() ||
    (weather.status === 'ready' && weather.place ? weather.place : '') ||
    net.city ||
    '';

  const localZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  const homeTime = formatZoneTime(now, s.homeZone);
  const localTime = formatZoneTime(now, localZone);
  const worldZones = (s.worldClockZones ?? []).filter(Boolean).slice(0, 2);
  const style = s.clockStyle;
  const showFaces = style !== 'digital' && (size !== 'S' || expanded);

  const clocks: { key: string; label: string; sub: string; zone: string; tone?: string }[] = [
    {
      key: 'local',
      label: 'Local',
      sub: localCity || zoneCity(localZone),
      zone: localZone,
      tone: s.presence === 'home' ? 'text-accent-ink' : undefined,
    },
    {
      key: 'home',
      label: 'Home',
      sub: zoneCity(s.homeZone),
      zone: s.homeZone,
    },
    {
      key: 'away',
      label: 'Away',
      sub: s.presence === 'away' ? 'Active' : 'Standby',
      zone: localZone,
      tone: s.presence === 'away' ? 'text-warn' : 'text-muted',
    },
    ...worldZones.map((z, i) => ({
      key: `w${i}`,
      label: zoneCity(z),
      sub: z,
      zone: z,
    })),
  ];

  // Away uses device local when traveling; Home always shows homeZone — same box.
  const rows =
    size === 'S' && !expanded
      ? [
          clocks.find((c) => c.key === 'local')!,
          clocks.find((c) => c.key === 'home')!,
          ...worldZones.map((z, i) => ({
            key: `w${i}`,
            label: zoneCity(z),
            sub: 'World',
            zone: z,
          })),
        ]
      : [
          clocks.find((c) => c.key === 'local')!,
          clocks.find((c) => c.key === 'home')!,
          ...(s.presence === 'away'
            ? [
                {
                  key: 'away',
                  label: 'Away',
                  sub: localCity || 'On the road',
                  zone: localZone,
                  tone: 'text-warn',
                },
              ]
            : []),
          ...worldZones.map((z, i) => ({
            key: `w${i}`,
            label: zoneCity(z),
            sub: 'World',
            zone: z,
          })),
        ];

  const setStyle = (next: ClockStyle) => set('clockStyle', next);
  const setWorld = (index: number, zone: string) => {
    const next = [...(s.worldClockZones ?? [])];
    while (next.length < 2) next.push(DEFAULT_WORLD[next.length]!);
    next[index] = zone;
    set('worldClockZones', next.slice(0, 2));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {showFaces ? (
        <div className={`flex flex-wrap items-end gap-3 ${size === 'L' ? 'justify-start' : ''}`}>
          {rows.slice(0, size === 'L' ? 4 : 3).map((c) => (
            <div key={c.key} className="flex flex-col items-center gap-1">
              <AnalogFace now={now} zone={c.zone} mechanical={style === 'mechanical'} size={size === 'L' ? 88 : 64} />
              <span className={`text-[11px] font-semibold ${c.tone ?? 'text-ink'}`}>{c.label}</span>
              <span className="max-w-[5.5rem] truncate text-[10px] text-muted" title={c.sub}>
                {c.sub}
              </span>
              <span className="text-[12px] font-semibold tabular-nums text-ink">{formatZoneTime(now, c.zone)}</span>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((c) => (
            <li key={c.key} className="flex items-baseline gap-2">
              <span className={`w-12 shrink-0 text-[11px] font-semibold uppercase tracking-wide ${c.tone ?? 'text-muted'}`}>
                {c.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink/80" title={c.sub}>
                {c.sub}
              </span>
              <span className="text-[15px] font-semibold tabular-nums text-ink">
                {c.key === 'local' ? localTime : c.key === 'home' ? homeTime : formatZoneTime(now, c.zone)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted">
        {now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
        {localCity ? ` · ${localCity}` : ''}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <div
          role="radiogroup"
          aria-label="Presence"
          className="inline-flex rounded-full bg-bg p-0.5 text-[11px] ring-1 ring-line"
        >
          {(['home', 'away'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={s.presence === p}
              onClick={() => set('presence', p)}
              className={`rounded-full px-2 py-0.5 font-medium capitalize transition-colors duration-150 ${
                s.presence === p ? 'bg-surface text-ink ring-1 ring-line' : 'text-muted'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div
          role="radiogroup"
          aria-label="Clock style"
          className="inline-flex rounded-full bg-bg p-0.5 text-[11px] ring-1 ring-line"
        >
          {(
            [
              { id: 'digital', label: 'Dig' },
              { id: 'analog', label: 'Ana' },
              { id: 'mechanical', label: 'Mech' },
            ] as { id: ClockStyle; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={style === opt.id}
              onClick={() => setStyle(opt.id)}
              className={`rounded-full px-2 py-0.5 font-medium transition-colors duration-150 ${
                style === opt.id ? 'bg-surface text-ink ring-1 ring-line' : 'text-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {size === 'S' && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-medium text-accent-ink hover:underline"
          >
            {expanded ? 'Less' : 'Expand'}
          </button>
        )}
      </div>

      {(size !== 'S' || expanded) && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <label key={i} className="block text-[11px] text-muted">
              World {i + 1}
              <select
                value={worldZones[i] ?? DEFAULT_WORLD[i]}
                onChange={(e) => setWorld(i, e.target.value)}
                className="mt-0.5 w-full rounded-md bg-bg px-1.5 py-1 text-[12px] text-ink ring-1 ring-line"
              >
                {ZONE_OPTIONS.map((z) => (
                  <option key={z} value={z}>
                    {zoneCity(z)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="block text-[11px] text-muted sm:col-span-2">
            Local city (optional)
            <input
              key={s.localCity}
              defaultValue={s.localCity}
              onBlur={(e) => set('localCity', e.target.value.trim())}
              placeholder={localCity || 'Auto from location'}
              className="mt-0.5 w-full rounded-md bg-bg px-1.5 py-1 text-[12px] text-ink ring-1 ring-line placeholder:text-faint"
            />
          </label>
          <Link to="/settings/general#location" className="text-[11px] text-accent-ink hover:underline sm:col-span-2">
            Location & Home zone in Settings →
          </Link>
        </div>
      )}
    </div>
  );
}

export function WeatherWidget({ size }: { size: WidgetSize }) {
  const { s, set } = useSettings();
  const w = useWeather(s.weatherLocation, s.tempUnit);
  return (
    <>
      {w.status === 'loading' && <div className="h-10 w-24 animate-pulse rounded-lg bg-overlay/[0.06]" aria-label="Loading weather" />}
      {(w.status === 'idle' || w.status === 'denied') && (
        <p className="text-[13px] text-muted">
          {w.status === 'denied'
            ? 'Location denied — weather stays empty (no fake city). Allow location or set one in Settings.'
            : 'Weather empty until location works — allow browser location or set a place in Settings.'}
        </p>
      )}
      {w.status === 'error' && (
        <p className="text-[13px] text-muted">
          {s.weatherLocation.trim()
            ? `Weather unavailable for “${s.weatherLocation}”. Check the location in Settings.`
            : 'Weather unavailable — try again or set a location in Settings.'}
        </p>
      )}
      {w.status === 'ready' &&
      <div className="flex items-center gap-3">
          <CloudSunIcon size={size === 'S' ? 22 : 30} className="text-accent-ink" aria-hidden="true" />
          <div>
            <p className="text-3xl font-semibold tabular-nums text-ink">{w.temp}°{s.tempUnit}</p>
            <p className="text-[12px] text-muted">
              {weatherLabel(w.code)}
              {` · ${
                s.weatherLocation.trim().toLowerCase() === 'silicon valley'
                  ? 'Silicon Valley'
                  : w.place || s.weatherLocation.trim() || '—'
              }`}
            </p>
          </div>
        </div>
      }
      <div className="mt-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => set('tempUnit', s.tempUnit === 'C' ? 'F' : 'C')}
          className="rounded-full px-2.5 py-0.5 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]"
          aria-label={`Switch to °${s.tempUnit === 'C' ? 'F' : 'C'}`}>
          
          °{s.tempUnit === 'C' ? 'F' : 'C'}
        </button>
        {size !== 'S' && <Link to="/settings/general#location" className="text-[12px] text-muted hover:text-ink">Change location</Link>}
      </div>
    </>);

}

export function NetWidget() {
  const { net, testNet } = useSettings();
  const { downloadMbps, loading: speedLoading, error: speedError, ensureFresh } = useInternetSpeed();
  useEffect(() => {
    ensureFresh();
  }, [ensureFresh]);
  // Prefer fast.com download sample; else OS NIC negotiated link rate; else honest dash.
  const mbps =
    downloadMbps != null ? downloadMbps :
    net.linkSpeedMbps != null ? net.linkSpeedMbps :
    null;
  const fromDownload = downloadMbps != null;
  const fromLink = !fromDownload && net.linkSpeedMbps != null;
  const unknownReason =
    speedError ||
    (net.notes?.find((n) => /link|speed|adapter|PowerShell/i.test(n)) ?? null) ||
    'No download sample and no OS link rate';
  const speedLabel =
    speedLoading && mbps == null ? 'Mbps …' :
    mbps != null ? `${mbps} Mbps` :
    'Mbps —';
  const speedTitle =
    fromDownload ? 'Internet download (fast.com sample)' :
    fromLink ? 'Adapter link speed — OS negotiated rate (not a throughput test)' :
    unknownReason;
  const tone = net.status === 'down' ? 'bg-danger' : net.status === 'checking' ? 'bg-warn' : 'bg-success';
  const provider = (net.isp || '').trim() || null;
  const onTest = () => {
    testNet();
    ensureFresh();
  };
  return (
    <>
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${tone}`} aria-hidden="true" />
        <span className="text-lg font-semibold text-ink">{net.status === 'down' ? 'Offline' : net.status === 'checking' ? 'Checking' : 'Online'}</span>
      </div>
      <p className="text-base font-semibold tabular-nums text-ink" title={speedTitle}>
        {fromLink && mbps != null ? `${mbps} Mbps link` : speedLabel}
      </p>
      <p className="truncate text-[12px] text-muted" title={provider ?? undefined}>
        {provider || (net.lastChecked ? `Checked ${net.lastChecked}` : 'Provider —')}
      </p>
      <button type="button" onClick={onTest} className="mt-auto inline-flex w-fit items-center gap-1 text-[12px] font-medium text-accent-ink hover:underline">
        <RefreshCwIcon size={12} aria-hidden="true" /> Test now
      </button>
    </>);

}



export function HardwareWidget({ size }: {size: WidgetSize;}) {
  const { hw, scanHw } = useSettings();

  useEffect(() => {
    scanHw();
    const id = window.setInterval(scanHw, 4000);
    return () => window.clearInterval(id);
  }, [scanHw]);

  const rows: {
    icon: typeof CpuIcon;
    label: string;
    value: string;
    pct: number | null;
  }[] = [
    {
      icon: CpuIcon,
      label: 'CPU',
      value:
        hw.cpuPercent != null
          ? `${hw.cpuPercent}%${hw.cores ? ` · ${hw.cores} threads` : ''}`
          : hw.cores
            ? `${hw.cores} threads · usage n/a`
            : 'Not exposed',
      pct: hw.cpuPercent,
    },
    {
      icon: MemoryStickIcon,
      label: 'RAM',
      value:
        hw.memoryGb != null && hw.ramUsedGb != null
          ? `${hw.ramUsedGb} / ${hw.memoryGb} GB${hw.ramUsedPct != null ? ` · ${hw.ramUsedPct}%` : ''}`
          : hw.memoryGb != null
            ? `${hw.memoryGb} GB · usage n/a`
            : '—',
      pct: hw.ramUsedPct,
    },
    {
      icon: MonitorIcon,
      label: 'VRAM',
      value:
        hw.vramGb != null && hw.vramUsedGb != null
          ? `${hw.vramUsedGb} / ${hw.vramGb} GB${hw.vramUsedPct != null ? ` · ${hw.vramUsedPct}%` : ''}`
          : hw.vramGb != null
            ? `${hw.vramGb} GB · usage n/a`
            : shortGpu(hw.gpu),
      pct: hw.vramUsedPct,
    },
  ];

  return (
    <>
      <ul className="space-y-2">
        {(size === 'S' ? rows.slice(0, 2) : rows).map((r) =>
        <li key={r.label} className="min-w-0">
            <div className="flex items-center gap-2 text-[13px]">
              <r.icon size={14} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="w-9 shrink-0 text-muted">{r.label}</span>
              <span className="min-w-0 truncate text-ink tabular-nums" title={r.value}>{r.value}</span>
            </div>
            <div
              className="mt-1 ml-[1.375rem] h-1 overflow-hidden rounded-full bg-overlay/[0.08]"
              role="progressbar"
              aria-label={`${r.label} usage`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={r.pct ?? undefined}
              aria-valuetext={r.pct != null ? `${r.pct}%` : 'unavailable'}
            >
              {r.pct != null ?
              <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} /> :
              <div className="h-full w-0" />}
            </div>
          </li>
        )}
      </ul>
      <button type="button" onClick={scanHw} className="mt-auto inline-flex w-fit items-center gap-1 text-[12px] font-medium text-accent-ink hover:underline">
        <RefreshCwIcon size={12} aria-hidden="true" /> Scan · {hw.scannedAt}
      </button>
    </>);

}

export function CalendarWidget({ size }: {size: WidgetSize;}) {
  const { events, loading } = useCalendar();
  const shown = size === 'L' ? events : events.slice(0, 3);
  if (loading) {
    return <p className="text-[12px] text-muted">Loading schedule…</p>;
  }
  if (shown.length === 0) {
    return <p className="text-[12px] text-muted">No events — calendar connector off or empty.</p>;
  }
  return (
    <ol className="space-y-2">
      {shown.map((e) =>
      <li key={e.id} className="flex gap-3 text-[13px]">
          <span className="w-11 shrink-0 tabular-nums text-muted">{e.time}</span>
          <span className={`h-auto w-0.5 shrink-0 rounded-full ${e.pending ? 'bg-warn' : 'bg-accent'}`} aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-ink">{e.title}</span>
            <span className="block truncate text-[11px] text-muted">{e.pending ? 'Held · needs your OK' : e.place}</span>
          </span>
        </li>
      )}
    </ol>);

}
