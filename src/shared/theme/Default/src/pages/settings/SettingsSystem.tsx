import React, { useEffect } from 'react';
import { CpuIcon, MemoryStickIcon, MonitorIcon, RefreshCwIcon } from 'lucide-react';
import { SettingsRow, SettingsSection, StatusPill, inputClass } from '../../components/settings/SettingsUI';
import { Toggle } from '../../components/Toggle';
import { useSettings } from '../../contexts/SettingsContext';
import { useInternetSpeed } from '../../hooks/useInternetSpeed';
import { useAppMemory } from '../../hooks/useAppMemory';
import type { NetInterval } from '../../types/settings';

/** Hardware — capacity + usage from GET /api/hardware; GPU name from the browser when exposed. */
export function SettingsHardware() {
  const { s, set, hw, scanHw } = useSettings();
  const appMb = useAppMemory(s.hwTracking);
  const lowRam = hw.memoryGb !== null && hw.memoryGb <= 4;

  const rows = [
  {
    icon: CpuIcon,
    label: 'CPU',
    value:
      hw.cpuPercent != null
        ? `${hw.cpuPercent}% busy${hw.cores ? ` · ${hw.cores} logical threads` : ''}`
        : hw.cores
          ? `${hw.cores} logical threads · usage unavailable`
          : 'Not exposed',
  },
  {
    icon: MemoryStickIcon,
    label: 'RAM',
    value:
      hw.memoryGb != null && hw.ramUsedGb != null
        ? `${hw.ramUsedGb} / ${hw.memoryGb} GB used${hw.ramUsedPct != null ? ` (${hw.ramUsedPct}%)` : ''}`
        : hw.memoryGb != null
          ? `${hw.memoryGb} GB total · usage unavailable`
          : 'Unavailable from server',
  },
  {
    icon: MonitorIcon,
    label: 'VRAM',
    value:
      hw.vramGb != null && hw.vramUsedGb != null
        ? `${hw.vramUsedGb} / ${hw.vramGb} GB used${hw.vramUsedPct != null ? ` (${hw.vramUsedPct}%)` : ''}${hw.gpuPercent != null ? ` · GPU ${hw.gpuPercent}%` : ''}`
        : hw.vramGb != null
          ? `${hw.vramGb} GB · usage unavailable`
          : 'Not reported',
  },
  { icon: MonitorIcon, label: 'GPU', value: hw.gpu ?? 'Not exposed in browser' },
  { icon: MemoryStickIcon, label: 'App memory', value: appMb !== null ? `${appMb} MB in use` : s.hwTracking ? 'Not exposed by this browser' : 'Tracking off' }];


  return (
    <>
      <SettingsSection title="This device" description={`Last refresh ${hw.scannedAt}. Usage from the product server (OS + optional nvidia-smi); GPU name from the browser when available.`}>
        <ul className="max-w-2xl divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {rows.map((r) =>
          <li key={r.label} className="flex items-center gap-3 px-4 py-3 text-sm">
              <r.icon size={16} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="w-28 shrink-0 text-muted">{r.label}</span>
              <span className="min-w-0 break-words text-ink tabular-nums">{r.value}</span>
            </li>
          )}
        </ul>
        <button type="button" onClick={scanHw} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2">
          <RefreshCwIcon size={14} aria-hidden="true" /> Scan now
        </button>
      </SettingsSection>

      <SettingsSection title="Tracking" description="Nothing here leaves the device.">
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="RAM / GPU tracking" detail="Refresh app memory every 5 seconds.">
            <Toggle label="Tracking" checked={s.hwTracking} onChange={(v) => set('hwTracking', v)} />
          </SettingsRow>
          <SettingsRow title="Footer hardware strip" detail="CPU / GPU / RAM on the right; the menu moves left.">
            <Toggle label="Footer strip" checked={s.footerStrip} onChange={(v) => set('footerStrip', v)} />
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection title="Low-end tips" description={lowRam ? 'This device looks memory-limited.' : 'Useful on older laptops.'}>
        <ul className="max-w-2xl list-disc space-y-1.5 pl-5 text-[13px] text-ink">
          <li>Stay on ASI AMS Micro 70M as the default router; Hybrid 120M uses more memory.</li>
          <li>Turn on Low-end mode in Performance — it stops agent motion and turns TTS off.</li>
          <li>Keep fewer desktop snapshots per agent on the Lock screen page.</li>
          <li>Close the Office floor when you don't need it.</li>
        </ul>
      </SettingsSection>
    </>);

}

const intervals: {id: NetInterval;label: string;}[] = [
{ id: 'off', label: 'Off' },
{ id: '30s', label: '30 s' },
{ id: '5m', label: '5 min' },
{ id: '1h', label: '1 hour' },
{ id: '1d', label: '1 day' },
{ id: 'custom', label: 'Custom' }];


export function SettingsNetwork() {
  const { s, set, net, testNet } = useSettings();
  const { downloadMbps, loading: speedLoading, checkedAt: speedCheckedAt, error: speedError, ensureFresh } = useInternetSpeed();
  useEffect(() => {
    ensureFresh();
  }, [ensureFresh]);
  // Prefer fast.com throughput; else fail-closed dash (never invent Mbps). Link speed stays separate below.
  const internetMbps = downloadMbps;
  const internetLabel =
    speedLoading && internetMbps == null ? 'Mbps …' :
    internetMbps != null ? `${internetMbps} Mbps` :
    'Mbps —';
  const onTest = () => {
    testNet();
    ensureFresh();
  };
  return (
    <>
      <SettingsSection title="Check every" description="The header glow shows the latest result.">
        <div role="radiogroup" aria-label="Net check interval" className="flex flex-wrap gap-2">
          {intervals.map((i) =>
          <button
            key={i.id}
            type="button"
            role="radio"
            aria-checked={s.netInterval === i.id}
            onClick={() => set('netInterval', i.id)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-medium ring-1 transition-colors duration-150 ${s.netInterval === i.id ? 'bg-accent/15 text-accent-ink ring-accent/40' : 'bg-surface text-muted ring-line hover:text-ink'}`}>
            
              {i.label}
            </button>
          )}
        </div>
        {s.netInterval === 'custom' &&
        <label className="mt-3 flex items-center gap-2 text-[13px] text-muted">
            Every
            <input type="number" min={1} max={1440} value={s.netCustomMin} onChange={(e) => set('netCustomMin', Math.max(1, Number(e.target.value) || 1))} className={`${inputClass} w-24`} />
            minutes
          </label>
        }
      </SettingsSection>
      <SettingsSection title="Status" description="Online from GET /api/network. Internet Mbps from GET /api/network/speed (fast.com sample on the server; client caches at most one test / 3h). Blank or Mbps — means truly unavailable — nothing is invented.">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone={net.status === 'down' ? 'warn' : net.status === 'checking' ? 'muted' : 'success'}>
            {net.status === 'down' ? 'Offline' : net.status === 'checking' ? 'Checking…' : 'Online'}
          </StatusPill>
          <span className="text-[13px] font-semibold tabular-nums text-ink" title={internetMbps != null ? 'Internet download (fast.com)' : 'No throughput sample'}>
            {internetLabel}
          </span>
          <span className="text-[13px] text-muted">
            {net.lastChecked ? `Last checked ${net.lastChecked}` : 'Not checked yet'}
          </span>
          <button type="button" onClick={onTest} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2">
            <RefreshCwIcon size={13} aria-hidden="true" /> Test now
          </button>
        </div>
        <ul className="mt-4 max-w-2xl divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {[
            ['Connection', net.connType && net.connType !== 'unknown' ? net.connType : 'Not reported by OS'],
            ['Adapter / product', net.productName || 'Not reported'],
            ['Internet speed', internetMbps != null ? `${internetMbps} Mbps (fast.com)` : (speedError || 'Mbps —')],
            ['Link speed', net.linkSpeedMbps != null ? `${net.linkSpeedMbps} Mbps` : 'Not reported'],
            ['Local IP', net.localIp || 'Not reported'],
            ['Public IP', net.publicIp || 'Not reported'],
            ['ISP / org', net.isp || 'Not reported'],
            ['Gateway', net.gateway || 'Not reported'],
            ['DNS', net.dns?.length ? net.dns.join(', ') : 'Not reported'],
            ['Location', [net.city, net.region, net.country].filter(Boolean).join(', ') || 'Not reported'],
          ].map(([label, value]) => (
            <li key={label as string} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              <span className="w-36 shrink-0 text-muted">{label}</span>
              <span className="min-w-0 break-words text-ink">{value}</span>
            </li>
          ))}
        </ul>
        {speedCheckedAt && (
          <p className="mt-2 max-w-2xl text-[12px] text-muted">Speed sample at {new Date(speedCheckedAt).toLocaleString()} (fast.com via server).</p>
        )}
        {net.notes?.length > 0 && (
          <p className="mt-2 max-w-2xl text-[12px] text-muted">{net.notes.join(' · ')}</p>
        )}
      </SettingsSection>
    </>);

}
