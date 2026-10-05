import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { defaultWidgets } from '../data/widgets';
import { api } from '@asi-api';
import { applyServerHardware, readConnection, readHardware } from '../utils/hardware';
import { nowTime } from '../utils/time';
import { normalizeWidgets } from '../utils/widgets';
import type { AppSettings, HardwareInfo, NetState, WidgetInstance } from '../types/settings';
import {
  DEFAULT_AVATAR_EMOJI,
  DEFAULT_CLOCK_PREFS,
  readFlag,
  readJson,
  readStorage,
  STORAGE_KEYS,
  writeFlag,
  writeJson,
  writeStorage,
  type ClockPrefs,
} from '../utils/storage';

function loadHomeWidgets(): WidgetInstance[] {
  const raw = readJson<unknown>(STORAGE_KEYS.homeWidgets, null);
  const normalized = normalizeWidgets(raw);
  return normalized.length > 0 ? normalized : defaultWidgets.map((w) => ({ ...w }));
}

function loadLockWidgets(): WidgetInstance[] {
  const raw = readJson<unknown>(STORAGE_KEYS.lockWidgets, null);
  return normalizeWidgets(raw);
}

function loadLockLayout(): AppSettings['lockLayout'] {
  const raw = readStorage(STORAGE_KEYS.lockLayout);
  return raw === 'roomy' ? 'roomy' : 'normal';
}

function loadClockPrefs(): ClockPrefs {
  const raw = readJson<Partial<ClockPrefs> | null>(STORAGE_KEYS.clockPrefs, null);
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CLOCK_PREFS };
  const style =
    raw.style === 'analog' || raw.style === 'mechanical' || raw.style === 'digital'
      ? raw.style
      : DEFAULT_CLOCK_PREFS.style;
  const worldZones = Array.isArray(raw.worldZones)
    ? raw.worldZones.map((z) => String(z).trim()).filter(Boolean).slice(0, 2)
    : DEFAULT_CLOCK_PREFS.worldZones;
  return {
    style,
    worldZones: worldZones.length ? worldZones : [...DEFAULT_CLOCK_PREFS.worldZones],
    localCity: typeof raw.localCity === 'string' ? raw.localCity : '',
  };
}

function loadDisplayName(): string | null {
  const raw = readStorage(STORAGE_KEYS.displayName)?.trim();
  return raw ? raw : null;
}

function loadLocked(): boolean {
  return readFlag(STORAGE_KEYS.locked);
}

interface SettingsValue {
  s: AppSettings;
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  net: NetState;
  testNet: () => void;
  hw: HardwareInfo;
  scanHw: () => void;
  logout: () => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

const intervalMs: Record<string, number> = { '30s': 30_000, '5m': 300_000, '1h': 3_600_000, '1d': 86_400_000 };

export function SettingsProvider({ firstLaunch, children }: {firstLaunch: boolean;children: React.ReactNode;}) {
  const initialClocks = loadClockPrefs();
  const [s, setS] = useState<AppSettings>({
    displayName: loadDisplayName(),
    onboarded: !firstLaunch,
    locked: loadLocked(),
    lockPassword: null,
    widgets: loadHomeWidgets(),
    lockWidgets: loadLockWidgets(),
    liveVisuals: true,
    lowEnd: false,
    footerStrip: false,
    serviceStrip: false,
    showTeamBanner: false,
    officeSign: false,
    officeToolbar: false,
    officeBottomNav: false,
    homeHeroImage: readFlag(STORAGE_KEYS.homeHeroVisible),
    hwTracking: true,
    muteMode: 'unmuted',
    micMuted: true,
    tts: true,
    stt: true,
    volume: 80,
    speakHandoffs: false,
    defaultVoice: 'local-aria',
    agentVoices: {},
    voiceProviders: { local: true, piper: false, elevenlabs: false, azure: false, google: false },
    netInterval: '5m',
    netCustomMin: 15,
    lockItems: { counts: true, vcs: true, time: true, weather: true, panic: true },
    lockLayout: loadLockLayout(),
    snapshotMin: 5,
    snapshotKeep: 6,
    notify: { approval: true, redAlert: true, agentDone: true, router: true, mail: true, quiet: false, os: false },
    language: 'en',
    sttLocale: 'en-IN',
    weatherLocation: 'Silicon Valley',
    tempUnit: 'C',
    presence: 'home',
    homeZone: 'Asia/Kolkata',
    avatarEmoji: readStorage(STORAGE_KEYS.avatarEmoji)?.trim() || DEFAULT_AVATAR_EMOJI,
    clockStyle: initialClocks.style,
    worldClockZones: initialClocks.worldZones,
    localCity: initialClocks.localCity,
    redAlertStyle: 'page',
    officeLight: 'auto',
    greenery: false,
    mapViz: true,
    mapShowBypass: true,
    showMessageTiming: readFlag(STORAGE_KEYS.showMessageTiming),
  });
  const [net, setNet] = useState<NetState>({
    status: 'ok',
    lastChecked: null,
    connType: 'unknown',
    productName: null,
    linkSpeedMbps: null,
    localIp: null,
    publicIp: null,
    isp: null,
    gateway: null,
    dns: [],
    city: null,
    region: null,
    country: null,
    notes: [],
  });
  const [hw, setHw] = useState<HardwareInfo>(() => readHardware());

  const set = useCallback(<K extends keyof AppSettings,>(key: K, value: AppSettings[K]) => {
    if (key === 'homeHeroImage') {
      writeFlag(STORAGE_KEYS.homeHeroVisible, Boolean(value));
    }
    if (key === 'showMessageTiming') {
      writeFlag(STORAGE_KEYS.showMessageTiming, Boolean(value));
    }
    if (key === 'avatarEmoji') {
      const emoji = String(value ?? '').trim() || DEFAULT_AVATAR_EMOJI;
      writeStorage(STORAGE_KEYS.avatarEmoji, emoji);
      value = emoji as AppSettings[K];
    }
    if (key === 'lockLayout') {
      writeStorage(STORAGE_KEYS.lockLayout, value === 'roomy' ? 'roomy' : 'normal');
    }
    if (key === 'displayName') {
      const name = String(value ?? '').trim();
      if (name) writeStorage(STORAGE_KEYS.displayName, name);
      else {
        try {
          localStorage.removeItem(`asi.default.${STORAGE_KEYS.displayName}`);
        } catch {
          /* ignore */
        }
      }
      value = (name || null) as AppSettings[K];
    }
    if (key === 'locked') {
      writeFlag(STORAGE_KEYS.locked, Boolean(value));
    }
    if (key === 'widgets') {
      const normalized = normalizeWidgets(value);
      writeJson(STORAGE_KEYS.homeWidgets, normalized);
      value = normalized as AppSettings[K];
    }
    if (key === 'lockWidgets') {
      const normalized = normalizeWidgets(value);
      writeJson(STORAGE_KEYS.lockWidgets, normalized);
      value = normalized as AppSettings[K];
    }
    setS((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'lowEnd' && value === true) {
        next.liveVisuals = false;
        next.tts = false;
        next.mapViz = false;
      }
      if (key === 'clockStyle' || key === 'worldClockZones' || key === 'localCity') {
        const prefs: ClockPrefs = {
          style: key === 'clockStyle' ? (value as AppSettings['clockStyle']) : next.clockStyle,
          worldZones:
            key === 'worldClockZones'
              ? (value as AppSettings['worldClockZones']).slice(0, 2)
              : next.worldClockZones.slice(0, 2),
          localCity: key === 'localCity' ? String(value ?? '') : next.localCity,
        };
        writeJson(STORAGE_KEYS.clockPrefs, prefs);
        next.clockStyle = prefs.style;
        next.worldClockZones = prefs.worldZones;
        next.localCity = prefs.localCity;
      }
      return next;
    });
  }, []);

  const testNet = useCallback(() => {
    setNet((n) => ({ ...n, status: 'checking' }));
    const browser = readConnection();
    api
      .network()
      .then((n) => {
        setNet({
          status: n.online || browser.status === 'ok' ? 'ok' : 'down',
          lastChecked: nowTime(),
          connType: n.connType || browser.connType || 'unknown',
          productName: n.productName,
          linkSpeedMbps: n.linkSpeedMbps,
          localIp: n.localIp,
          publicIp: n.publicIp,
          isp: n.isp ?? n.org,
          gateway: n.gateway,
          dns: n.dns ?? [],
          city: n.city,
          region: n.region,
          country: n.country,
          notes: n.notes ?? [],
        });
      })
      .catch(() => {
        setNet({ ...browser, lastChecked: nowTime() });
      });
  }, []);

  const scanHw = useCallback(() => {
    const browser = readHardware();
    api
      .hardware()
      .then((h) => setHw(applyServerHardware(browser, h)))
      .catch(() => setHw(browser));
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(`asi.default.${STORAGE_KEYS.displayName}`);
    } catch {
      /* ignore */
    }
    writeFlag(STORAGE_KEYS.locked, false);
    setS((prev) => ({ ...prev, displayName: null, locked: false }));
  }, []);

  useEffect(() => {
    scanHw();
  }, [scanHw]);

  useEffect(() => {
    testNet();
    const onChange = () => testNet();
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => {
      window.removeEventListener('online', onChange);
      window.removeEventListener('offline', onChange);
    };
  }, [testNet]);

  useEffect(() => {
    if (s.netInterval === 'off') return;
    const ms = s.netInterval === 'custom' ? Math.max(1, s.netCustomMin) * 60_000 : intervalMs[s.netInterval];
    const id = window.setInterval(testNet, ms);
    return () => window.clearInterval(id);
  }, [s.netInterval, s.netCustomMin, testNet]);

  const value = useMemo(() => ({ s, set, net, testNet, hw, scanHw, logout }), [s, set, net, testNet, hw, scanHw, logout]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}