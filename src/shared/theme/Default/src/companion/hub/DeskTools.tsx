/**
 * Desk companion hub tools — countdown, world clocks, Wi‑Fi vault, sticky, focus.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  TimerIcon,
  Trash2Icon,
  WifiIcon,
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { WORLD_CLOCK_SUGGESTIONS } from '../../utils/storage';
import {
  readCountdownPrefs,
  writeCountdownPrefs,
  readFocusPrefs,
  writeFocusPrefs,
  readStickyNote,
  writeStickyNote,
  type CountdownPrefs,
} from '../deskPrefs';
import {
  clearWifiVault,
  readWifiVaultPublic,
  saveWifiVault,
  unlockWifiPassword,
  type WifiVaultPublic,
} from '../wifiVault';

function formatRemain(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function zoneLabel(zone: string): string {
  const hit = WORLD_CLOCK_SUGGESTIONS.find((c) => c.zone === zone);
  if (hit) return hit.label;
  const part = zone.split('/').pop() ?? zone;
  return part.replace(/_/g, ' ');
}

function formatZoneTime(now: Date, zone: string): string {
  try {
    return now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: zone,
    });
  } catch {
    return '—';
  }
}

function formatZoneDate(now: Date, zone: string): string {
  try {
    return now.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: zone,
    });
  } catch {
    return '';
  }
}

/* ── Countdown ─────────────────────────────────────────────────────────── */

export function CountdownTool() {
  const { notify } = useNotifications();
  const [prefs, setPrefs] = useState<CountdownPrefs>(() => readCountdownPrefs());
  const [running, setRunning] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remainMs, setRemainMs] = useState(0);
  const [doneFlash, setDoneFlash] = useState(false);
  const firedRef = useRef(false);

  const persist = useCallback((next: CountdownPrefs) => {
    setPrefs(next);
    writeCountdownPrefs(next);
  }, []);

  useEffect(() => {
    if (!running || endsAt == null) return;
    const tick = () => {
      const left = endsAt - Date.now();
      setRemainMs(left);
      if (left <= 0) {
        setRunning(false);
        setEndsAt(null);
        setRemainMs(0);
        setDoneFlash(true);
        if (!firedRef.current && prefs.notify) {
          firedRef.current = true;
          const title = prefs.label.trim() || 'Countdown done';
          notify({
            kind: 'agentDone',
            title,
            detail: 'Desk companion countdown finished.',
          });
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, { body: 'Desk companion countdown finished.' });
            } catch {
              /* ignore */
            }
          }
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, endsAt, prefs.notify, prefs.label, notify]);

  const start = () => {
    const ms = Math.max(1, prefs.minutes) * 60_000;
    firedRef.current = false;
    setDoneFlash(false);
    setEndsAt(Date.now() + ms);
    setRemainMs(ms);
    setRunning(true);
  };

  const pause = () => {
    if (endsAt == null) return;
    setRemainMs(Math.max(0, endsAt - Date.now()));
    setEndsAt(null);
    setRunning(false);
  };

  const resume = () => {
    if (remainMs <= 0) return;
    firedRef.current = false;
    setEndsAt(Date.now() + remainMs);
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setEndsAt(null);
    setRemainMs(0);
    setDoneFlash(false);
    firedRef.current = false;
  };

  const requestOsNotify = async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    try {
      await Notification.requestPermission();
    } catch {
      /* ignore */
    }
  };

  const displayMs = running && endsAt != null ? Math.max(0, endsAt - Date.now()) : remainMs;
  const active = running || remainMs > 0;

  return (
    <section className="rounded-2xl bg-raised/50 p-3 ring-1 ring-line sm:p-4" aria-label="Countdown">
      <h3 className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink">
        <TimerIcon size={15} aria-hidden="true" />
        Countdown
      </h3>

      <div
        className={`mb-4 rounded-2xl px-4 py-6 text-center ring-1 ${
          doneFlash ? 'bg-accent/15 ring-accent/35' : 'bg-surface/80 ring-line'
        }`}
      >
        <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-ink sm:text-5xl">
          {active || doneFlash ? formatRemain(doneFlash ? 0 : displayMs) : formatRemain(prefs.minutes * 60_000)}
        </p>
        {prefs.label.trim() ? (
          <p className="mt-2 text-[13px] text-muted">{prefs.label.trim()}</p>
        ) : null}
        {doneFlash ? <p className="mt-1 text-[12px] font-medium text-accent-ink">Done</p> : null}
      </div>

      {!running ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-faint">Minutes</span>
            <input
              type="number"
              min={1}
              max={180}
              value={prefs.minutes}
              disabled={active}
              onChange={(e) =>
                persist({ ...prefs, minutes: Math.max(1, Math.min(180, Number(e.target.value) || 1)) })
              }
              className="w-full rounded-xl bg-surface px-3 py-2 text-[13px] text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
            />
          </label>
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-faint">Label</span>
            <input
              type="text"
              maxLength={80}
              value={prefs.label}
              disabled={active}
              placeholder="Tea break, meeting…"
              onChange={(e) => persist({ ...prefs, label: e.target.value })}
              className="w-full rounded-xl bg-surface px-3 py-2 text-[13px] text-ink ring-1 ring-line placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
            />
          </label>
        </div>
      ) : null}

      <label className="mb-3 flex items-center gap-2 text-[12px] text-ink">
        <input
          type="checkbox"
          checked={prefs.notify}
          onChange={(e) => {
            const on = e.target.checked;
            persist({ ...prefs, notify: on });
            if (on) void requestOsNotify();
          }}
          className="h-4 w-4 accent-[rgb(var(--accent))]"
        />
        <BellIcon size={13} aria-hidden="true" className="text-faint" />
        Notify when done
      </label>

      <div className="flex flex-wrap gap-2">
        {!running && remainMs <= 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-strong px-3 py-2 text-[12px] font-semibold text-white"
            onClick={start}
          >
            <PlayIcon size={14} aria-hidden="true" />
            Start
          </button>
        ) : null}
        {running ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-raised px-3 py-2 text-[12px] font-semibold text-ink ring-1 ring-line hover:bg-overlay/10"
            onClick={pause}
          >
            <PauseIcon size={14} aria-hidden="true" />
            Pause
          </button>
        ) : null}
        {!running && remainMs > 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-strong px-3 py-2 text-[12px] font-semibold text-white"
            onClick={resume}
          >
            <PlayIcon size={14} aria-hidden="true" />
            Resume
          </button>
        ) : null}
        {(running || remainMs > 0 || doneFlash) && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-[12px] font-semibold text-ink ring-1 ring-line hover:bg-overlay/10"
            onClick={reset}
          >
            <RotateCcwIcon size={14} aria-hidden="true" />
            Reset
          </button>
        )}
      </div>
    </section>
  );
}

/* ── World clock ───────────────────────────────────────────────────────── */

export function WorldClockTool() {
  const { s } = useSettings();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const localZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  const zones = useMemo(() => {
    const preferred = [
      localZone,
      s.homeZone,
      ...(s.worldClockZones ?? []),
      ...WORLD_CLOCK_SUGGESTIONS.map((c) => c.zone),
    ].filter(Boolean);
    const seen = new Set<string>();
    const out: { zone: string; label: string; tag?: string }[] = [];
    for (const z of preferred) {
      if (seen.has(z)) continue;
      seen.add(z);
      let tag: string | undefined;
      if (z === localZone) tag = 'Local';
      else if (z === s.homeZone) tag = 'Home';
      else if ((s.worldClockZones ?? []).includes(z)) tag = 'Pinned';
      out.push({ zone: z, label: zoneLabel(z), tag });
    }
    return out.slice(0, 6);
  }, [localZone, s.homeZone, s.worldClockZones]);

  return (
    <section className="rounded-2xl bg-raised/50 p-3 ring-1 ring-line sm:p-4" aria-label="World clock">
      <h3 className="mb-1 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink">
        <ClockIcon size={15} aria-hidden="true" />
        World clock
      </h3>
      <p className="mb-3 text-[12px] text-muted">
        Uses your Home Time pins plus Silicon Valley, London, Singapore, Dubai, and Amsterdam.
      </p>
      <ul className="space-y-2">
        {zones.map((c) => (
          <li
            key={c.zone}
            className="flex items-baseline gap-3 rounded-xl bg-surface/70 px-3 py-2.5 ring-1 ring-line"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">
                {c.label}
                {c.tag ? (
                  <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-faint">{c.tag}</span>
                ) : null}
              </p>
              <p className="truncate text-[11px] text-muted">{formatZoneDate(now, c.zone)}</p>
            </div>
            <span className="shrink-0 font-mono text-[16px] font-semibold tabular-nums text-ink">
              {formatZoneTime(now, c.zone)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Wi‑Fi vault ───────────────────────────────────────────────────────── */

export function WifiTool() {
  const [pub, setPub] = useState<WifiVaultPublic>(() => readWifiVaultPublic());
  const [ssid, setSsid] = useState(() => readWifiVaultPublic().ssid);
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = () => {
    const next = readWifiVaultPublic();
    setPub(next);
    setSsid(next.ssid);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setRevealed(null);
    setShow(false);
    try {
      const next = await saveWifiVault(ssid, password);
      setPub(next);
      setPassword('');
      setMsg(next.configured ? 'Saved locally (encrypted).' : 'Cleared.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const onReveal = async () => {
    setMsg(null);
    const plain = await unlockWifiPassword();
    if (plain == null) {
      setMsg('Vault locked or corrupt — clear and re-enter.');
      setRevealed(null);
      setShow(false);
      return;
    }
    setRevealed(plain);
    setShow(true);
  };

  const onCopy = async () => {
    let plain = revealed;
    if (plain == null) {
      plain = await unlockWifiPassword();
      if (plain == null) {
        setMsg('Nothing to copy — enter a password first.');
        return;
      }
      setRevealed(plain);
    }
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setMsg('Clipboard blocked by the browser.');
    }
  };

  const onClear = () => {
    clearWifiVault();
    setPassword('');
    setRevealed(null);
    setShow(false);
    setMsg('Cleared.');
    refresh();
  };

  return (
    <section className="rounded-2xl bg-raised/50 p-3 ring-1 ring-line sm:p-4" aria-label="Wi-Fi password">
      <h3 className="mb-1 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink">
        <WifiIcon size={15} aria-hidden="true" />
        Home Wi‑Fi
      </h3>
      <p className="mb-3 text-[12px] leading-snug text-muted">
        Local vault only — you type the network name and password. Never reads system Wi‑Fi or invents credentials.
      </p>

      <form className="space-y-2" onSubmit={(e) => void onSave(e)}>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-faint">Network name</span>
          <input
            type="text"
            autoComplete="off"
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            placeholder="Home Wi‑Fi"
            className="w-full rounded-xl bg-surface px-3 py-2 text-[13px] text-ink ring-1 ring-line placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-faint">Password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={pub.configured ? `••••${pub.last4} — paste to replace` : 'Enter password'}
            className="w-full rounded-xl bg-surface px-3 py-2 text-[13px] text-ink ring-1 ring-line placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={busy || !ssid.trim() || !password}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-strong px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
          >
            Save
          </button>
          {pub.configured ? (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-[12px] font-semibold text-ink ring-1 ring-line hover:bg-overlay/10"
                onClick={() => {
                  if (show) {
                    setShow(false);
                    return;
                  }
                  void onReveal();
                }}
              >
                {show ? <EyeOffIcon size={14} aria-hidden="true" /> : <EyeIcon size={14} aria-hidden="true" />}
                {show ? 'Hide' : 'Show'}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-[12px] font-semibold text-ink ring-1 ring-line hover:bg-overlay/10"
                onClick={() => void onCopy()}
              >
                {copied ? <CheckIcon size={14} aria-hidden="true" /> : <CopyIcon size={14} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-[12px] font-semibold text-danger ring-1 ring-line hover:bg-overlay/10"
                onClick={onClear}
              >
                <Trash2Icon size={14} aria-hidden="true" />
                Clear
              </button>
            </>
          ) : null}
        </div>
      </form>

      {pub.configured ? (
        <div className="mt-3 rounded-xl bg-surface/70 px-3 py-2.5 ring-1 ring-line">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Stored</p>
          <p className="mt-0.5 text-[13px] font-medium text-ink">{pub.ssid}</p>
          <p className="mt-1 font-mono text-[13px] text-muted">
            {show && revealed != null ? revealed : `••••${pub.last4}`}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-muted">No password saved yet.</p>
      )}
      {msg ? <p className="mt-2 text-[12px] text-muted">{msg}</p> : null}
    </section>
  );
}

/* ── Sticky note ───────────────────────────────────────────────────────── */

export function StickyNoteTool() {
  const [text, setText] = useState(() => readStickyNote());
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const onChange = (value: string) => {
    setText(value);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => writeStickyNote(value), 280);
  };

  return (
    <section className="rounded-2xl bg-raised/50 p-3 ring-1 ring-line sm:p-4" aria-label="Sticky note">
      <h3 className="mb-2 text-[14px] font-semibold text-ink">Quick note</h3>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder="Scratch pad — stays on this device…"
        className="w-full resize-y rounded-xl bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-ink ring-1 ring-line placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <p className="mt-1.5 text-[11px] text-faint">Autosaved locally</p>
    </section>
  );
}

/* ── Focus timer ───────────────────────────────────────────────────────── */

export function FocusTimerTool() {
  const { notify } = useNotifications();
  const [minutes, setMinutes] = useState(() => readFocusPrefs().minutes);
  const [running, setRunning] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remainMs, setRemainMs] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!running || endsAt == null) return;
    const tick = () => {
      const left = endsAt - Date.now();
      setRemainMs(left);
      if (left <= 0) {
        setRunning(false);
        setEndsAt(null);
        setRemainMs(0);
        if (!firedRef.current) {
          firedRef.current = true;
          notify({
            kind: 'agentDone',
            title: 'Focus session done',
            detail: 'Take a short break.',
          });
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, endsAt, notify]);

  const start = () => {
    writeFocusPrefs({ minutes });
    const ms = minutes * 60_000;
    firedRef.current = false;
    setEndsAt(Date.now() + ms);
    setRemainMs(ms);
    setRunning(true);
  };

  const pause = () => {
    if (endsAt == null) return;
    setRemainMs(Math.max(0, endsAt - Date.now()));
    setEndsAt(null);
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setEndsAt(null);
    setRemainMs(0);
    firedRef.current = false;
  };

  const displayMs = running && endsAt != null ? Math.max(0, endsAt - Date.now()) : remainMs;
  const active = running || remainMs > 0;

  return (
    <section className="rounded-2xl bg-raised/50 p-3 ring-1 ring-line sm:p-4" aria-label="Focus timer">
      <h3 className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink">
        <TimerIcon size={15} aria-hidden="true" />
        Focus timer
      </h3>
      <div className="mb-4 rounded-2xl bg-surface/80 px-4 py-6 text-center ring-1 ring-line">
        <p className="font-mono text-4xl font-semibold tabular-nums text-ink sm:text-5xl">
          {active ? formatRemain(displayMs) : formatRemain(minutes * 60_000)}
        </p>
        <p className="mt-2 text-[12px] text-muted">{running ? 'Focusing…' : 'Quiet work block'}</p>
      </div>
      {!active ? (
        <label className="mb-3 block max-w-[10rem]">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-faint">Minutes</span>
          <input
            type="number"
            min={1}
            max={120}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Math.min(120, Number(e.target.value) || 25)))}
            className="w-full rounded-xl bg-surface px-3 py-2 text-[13px] text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!running && remainMs <= 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-strong px-3 py-2 text-[12px] font-semibold text-white"
            onClick={start}
          >
            <PlayIcon size={14} aria-hidden="true" />
            Start focus
          </button>
        ) : null}
        {running ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-raised px-3 py-2 text-[12px] font-semibold text-ink ring-1 ring-line"
            onClick={pause}
          >
            <PauseIcon size={14} aria-hidden="true" />
            Pause
          </button>
        ) : null}
        {!running && remainMs > 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-strong px-3 py-2 text-[12px] font-semibold text-white"
            onClick={() => {
              setEndsAt(Date.now() + remainMs);
              setRunning(true);
            }}
          >
            <PlayIcon size={14} aria-hidden="true" />
            Resume
          </button>
        ) : null}
        {active ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-[12px] font-semibold text-ink ring-1 ring-line"
            onClick={reset}
          >
            <RotateCcwIcon size={14} aria-hidden="true" />
            Reset
          </button>
        ) : null}
      </div>
    </section>
  );
}
