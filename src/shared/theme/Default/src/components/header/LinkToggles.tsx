import React, { useState } from 'react';
import { CpuIcon, WifiIcon, WifiOffIcon } from 'lucide-react';
import { useDesk } from '../../contexts/DeskContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useInternetSpeed } from '../../hooks/useInternetSpeed';
import { WifiSpeedOverlay } from './WifiSpeedOverlay';

const base =
  'relative inline-flex h-8 items-center gap-1.5 rounded-full pl-1.5 pr-2.5 text-xs font-medium ring-1 ring-inset transition-colors duration-150';

/**
 * Two independent switches. Local = on-device models. Online = anything off-device.
 * The Online glow also reflects the latest net check (Settings → Net check).
 * Status LEDs use slow breathing CSS (see index.css `.status-led`).
 */
export function LinkToggles() {
  const { localOn, setLocalOn, onlineOn, setOnlineOn } = useDesk();
  const { net } = useSettings();
  const { downloadMbps, checkedAt, loading, error, ensureFresh } = useInternetSpeed();
  const [speedHover, setSpeedHover] = useState(false);
  const netDown = net.status === 'down';
  const onlineTone = !onlineOn
    ? 'text-muted ring-line'
    : netDown
      ? 'bg-danger/10 text-danger ring-danger/25'
      : net.status === 'checking'
        ? 'bg-warn/10 text-warn ring-warn/25'
        : 'bg-success/10 text-success ring-success/25';

  const localLed = localOn ? 'status-led status-led--local status-led--on' : 'status-led status-led--off';
  const onlineLed = !onlineOn
    ? 'status-led status-led--off'
    : netDown
      ? 'status-led status-led--danger status-led--on'
      : net.status === 'checking'
        ? 'status-led status-led--warn status-led--on'
        : 'status-led status-led--online status-led--on';

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Model connectivity">
      <button
        type="button"
        role="switch"
        aria-checked={localOn}
        onClick={() => setLocalOn(!localOn)}
        title={localOn ? 'Local models on — click to turn off' : 'Local models off — click to turn on'}
        className={`${base} ${localOn ? 'bg-accent/10 text-accent-ink ring-accent/25' : 'text-muted ring-line'}`}
      >
        <span className="relative grid h-5 w-5 place-items-center">
          <CpuIcon size={14} aria-hidden="true" />
          {!localOn && <span className="absolute h-[1.5px] w-5 rotate-45 rounded bg-current" aria-hidden="true" />}
        </span>
        <span className={localLed} aria-hidden="true" />
        <span className="hidden lg:inline">Local</span>
        <span className="sr-only">{localOn ? 'on' : 'off'}</span>
      </button>
      <div
        className="relative"
        onMouseEnter={() => {
          setSpeedHover(true);
          ensureFresh();
        }}
        onMouseLeave={() => setSpeedHover(false)}
        onFocus={() => {
          setSpeedHover(true);
          ensureFresh();
        }}
        onBlur={() => setSpeedHover(false)}
      >
        <button
          type="button"
          role="switch"
          aria-checked={onlineOn}
          onClick={() => setOnlineOn(!onlineOn)}
          title={
            onlineOn
              ? `Online models on${net.lastChecked ? ` · net checked ${net.lastChecked}` : ''} — click to turn off`
              : 'Online models off — nothing leaves this device'
          }
          className={`${base} ${onlineTone}`}
        >
          <span className="relative grid h-5 w-5 place-items-center">
            {onlineOn && !netDown ? (
              <WifiIcon size={14} className="relative" aria-hidden="true" />
            ) : (
              <WifiOffIcon size={14} className="relative" aria-hidden="true" />
            )}
          </span>
          <span className={onlineLed} aria-hidden="true" />
          <span className="hidden lg:inline">Online</span>
          <span className="sr-only">{onlineOn ? 'on' : 'off'}</span>
        </button>
        <WifiSpeedOverlay
          open={speedHover}
          downloadMbps={downloadMbps}
          checkedAt={checkedAt}
          loading={loading}
          error={error}
          linkSpeedMbps={net.linkSpeedMbps}
        />
      </div>
    </div>
  );
}
