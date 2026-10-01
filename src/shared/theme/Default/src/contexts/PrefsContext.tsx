import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type ProviderKeyStatus } from '@asi-api';
import { apiKeySeed, integrationSeed, providerSeed } from '../data/settings';
import { defaultNav, sanitizeNavItems } from '../data/nav';
import { accentVars, hexToRgb, rgbVar } from '../utils/color';
import { createId } from '../utils/time';
import { readJson, writeJson, STORAGE_KEYS } from '../utils/storage';
import type { CustomNavLink, CustomNavSurface, NavSlotId } from '../types/nav';
import { isCustomNavId } from '../types/nav';
import type {
  ApiKey,
  EmailProfile,
  IntegrationId,
  IntegrationState,
  Provider,
  RouterChoice,
  SurfaceOverride,
  Theme,
  VoiceEngine } from
'../types/settings';

function loadCustomNavLinks(): CustomNavLink[] {
  const raw = readJson<unknown>(STORAGE_KEYS.customNavLinks, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): CustomNavLink | null => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === 'string' && isCustomNavId(o.id) ? o.id : null;
      const label = typeof o.label === 'string' ? o.label.trim() : '';
      const to = typeof o.to === 'string' ? o.to.trim() : '';
      if (!id || !label || !to) return null;
      const surfacesRaw = Array.isArray(o.surfaces) ? o.surfaces : ['bottom'];
      const surfaces = surfacesRaw.filter(
        (s): s is CustomNavSurface => s === 'bottom' || s === 'left'
      );
      return { id, label, to, surfaces: surfaces.length ? surfaces : ['bottom'] };
    })
    .filter((x): x is CustomNavLink => Boolean(x));
}

function loadNavItems(customLinks: CustomNavLink[]): NavSlotId[] {
  const raw = readJson<unknown>(STORAGE_KEYS.navItems, null);
  if (!Array.isArray(raw)) return sanitizeNavItems(defaultNav, customLinks);
  return sanitizeNavItems(
    raw.filter((id): id is string => typeof id === 'string'),
    customLinks
  );
}

interface PrefsValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: string;
  setAccent: (hex: string) => void;
  surfaces: Partial<Record<Theme, SurfaceOverride>>;
  setSurface: (theme: Theme, value: SurfaceOverride | null) => void;
  appName: string;
  setAppName: (name: string) => void;
  navItems: NavSlotId[];
  setNavItems: (items: NavSlotId[]) => void;
  customNavLinks: CustomNavLink[];
  addCustomNavLink: (input: { label: string; to: string; surfaces: CustomNavSurface[] }) => void;
  updateCustomNavLink: (id: string, patch: Partial<Pick<CustomNavLink, 'label' | 'to' | 'surfaces'>>) => void;
  removeCustomNavLink: (id: string) => void;
  router: RouterChoice;
  setRouter: (r: RouterChoice) => void;
  voice: VoiceEngine;
  setVoice: (v: VoiceEngine) => void;
  apiKeys: ApiKey[];
  addApiKey: (provider: string, label: string, key: string) => void;
  removeApiKey: (id: string) => void;
  setActiveKey: (id: string) => void;
  providers: Provider[];
  toggleProvider: (id: string) => void;
  providerKeyStatus: Record<string, ProviderKeyStatus>;
  refreshProviderKeys: () => Promise<void>;
  saveProviderKey: (providerId: string, apiKey: string) => Promise<void>;
  clearProviderKey: (providerId: string) => Promise<void>;
  testProviderKey: (
    providerId: string,
    opts?: { apiKey?: string; model?: string }
  ) => Promise<{ working: boolean; reply?: string; error?: string; model: string }>;
  integrations: Record<IntegrationId, IntegrationState>;
  setIntegration: (id: IntegrationId, patch: Partial<IntegrationState>) => void;
  emailProfiles: EmailProfile[];
  gmailOAuthReady: boolean;
  refreshEmailConnection: () => Promise<void>;
  addEmailProfile: (p: Omit<EmailProfile, 'id'> & {
    password?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    useOAuth?: boolean;
  }) => Promise<void>;
  removeEmailProfile: (id: string) => Promise<void>;
}

const PrefsContext = createContext<PrefsValue | null>(null);

export function PrefsProvider({ initialTheme, children }: {initialTheme: Theme;children: React.ReactNode;}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [accent, setAccent] = useState('#7c6cf0');
  const [surfaces, setSurfaces] = useState<Partial<Record<Theme, SurfaceOverride>>>({});
  const [appName, setAppName] = useState('ASI Agents');
  const [customNavLinks, setCustomNavLinks] = useState<CustomNavLink[]>(loadCustomNavLinks);
  const [navItems, setNavItemsRaw] = useState<NavSlotId[]>(() => loadNavItems(loadCustomNavLinks()));

  const commitNavItems = useCallback((items: NavSlotId[], links: CustomNavLink[]) => {
    const next = sanitizeNavItems(items, links);
    setNavItemsRaw(next);
    writeJson(STORAGE_KEYS.navItems, next);
  }, []);

  const setNavItems = useCallback(
    (items: NavSlotId[]) => {
      commitNavItems(items, customNavLinks);
    },
    [commitNavItems, customNavLinks]
  );

  const persistCustomLinks = useCallback(
    (links: CustomNavLink[], items: NavSlotId[]) => {
      setCustomNavLinks(links);
      writeJson(STORAGE_KEYS.customNavLinks, links);
      commitNavItems(items, links);
    },
    [commitNavItems]
  );

  const addCustomNavLink = useCallback(
    (input: { label: string; to: string; surfaces: CustomNavSurface[] }) => {
      const label = input.label.trim();
      const to = input.to.trim();
      if (!label || !to) return;
      const surfaces = input.surfaces.length ? input.surfaces : (['bottom'] as CustomNavSurface[]);
      const id = `custom-${createId()}`;
      const link: CustomNavLink = { id, label, to, surfaces };
      const links = [...customNavLinks, link];
      const withoutDup = navItems.filter((x) => x !== id);
      const insertAt = Math.max(0, withoutDup.length - 1);
      const nextItems = [...withoutDup.slice(0, insertAt), id, ...withoutDup.slice(insertAt)];
      persistCustomLinks(links, nextItems);
    },
    [customNavLinks, navItems, persistCustomLinks]
  );

  const updateCustomNavLink = useCallback(
    (id: string, patch: Partial<Pick<CustomNavLink, 'label' | 'to' | 'surfaces'>>) => {
      const links = customNavLinks.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          label: patch.label !== undefined ? patch.label.trim() || c.label : c.label,
          to: patch.to !== undefined ? patch.to.trim() || c.to : c.to,
          surfaces:
            patch.surfaces !== undefined
              ? patch.surfaces.length
                ? patch.surfaces
                : c.surfaces
              : c.surfaces,
        };
      });
      persistCustomLinks(links, navItems);
    },
    [customNavLinks, navItems, persistCustomLinks]
  );

  const removeCustomNavLink = useCallback(
    (id: string) => {
      persistCustomLinks(
        customNavLinks.filter((c) => c.id !== id),
        navItems.filter((x) => x !== id)
      );
    },
    [customNavLinks, navItems, persistCustomLinks]
  );

  const [router, setRouter] = useState<RouterChoice>('micro');
  const [voice, setVoice] = useState<VoiceEngine>('local');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(apiKeySeed);
  const [providers, setProviders] = useState<Provider[]>(providerSeed);
  const [providerKeyStatus, setProviderKeyStatus] = useState<Record<string, ProviderKeyStatus>>({});
  const [integrations, setIntegrations] = useState(integrationSeed);
  const [emailProfiles, setEmailProfiles] = useState<EmailProfile[]>([]);
  const [gmailOAuthReady, setGmailOAuthReady] = useState(false);

  const refreshProviderKeys = useCallback(async () => {
    try {
      const { keys } = await api.providerKeys();
      setProviderKeyStatus(keys ?? {});
    } catch {
      setProviderKeyStatus({});
    }
  }, []);

  const refreshProviderEnabled = useCallback(async () => {
    try {
      const { enabled } = await api.providerEnabled();
      setProviders((prev) =>
        prev.map((p) => {
          if (p.locked) return { ...p, enabled: true };
          if (enabled && typeof enabled[p.id] === 'boolean') {
            return { ...p, enabled: enabled[p.id] === true };
          }
          return p;
        })
      );
    } catch {
      /* keep seed until server is up */
    }
  }, []);

  const saveProviderKey = useCallback(async (providerId: string, apiKey: string) => {
    const res = await api.putProviderKey(providerId, apiKey);
    setProviderKeyStatus((prev) => ({
      ...prev,
      [providerId]: { configured: res.configured, last4: res.last4 },
    }));
  }, []);

  const clearProviderKey = useCallback(async (providerId: string) => {
    await api.putProviderKey(providerId, '');
    setProviderKeyStatus((prev) => ({
      ...prev,
      [providerId]: { configured: false },
    }));
  }, []);

  const testProviderKey = useCallback(
    async (providerId: string, opts?: { apiKey?: string; model?: string }) => {
      const res = await api.testProviderKey(providerId, opts);
      return {
        working: res.working === true,
        reply: res.reply,
        error: res.error,
        model: res.model,
      };
    },
    []
  );

  useEffect(() => {
    void refreshProviderKeys();
    void refreshProviderEnabled();
  }, [refreshProviderKeys, refreshProviderEnabled]);

  const syncIntegrationsFromProfiles = useCallback((profiles: EmailProfile[]) => {
    setIntegrations((cur) => ({
      ...cur,
      gmail: { ...cur.gmail, connected: profiles.some((p) => p.kind === 'gmail') },
      imap: { ...cur.imap, connected: profiles.some((p) => p.kind === 'imap') },
    }));
  }, []);

  const refreshEmailConnection = useCallback(async () => {
    try {
      const st = await api.inboxEmailStatus();
      setGmailOAuthReady(Boolean(st.gmailOAuthReady));
      const addr = st.address?.trim();
      if (st.configured && addr) {
        const kind = st.mode === 'gmail' ? 'gmail' : 'imap';
        const profiles: EmailProfile[] = [{
          id: 'server-mail',
          kind,
          label: st.label?.trim() || addr,
          address: addr,
        }];
        setEmailProfiles(profiles);
        syncIntegrationsFromProfiles(profiles);
        return;
      }
      if (addr && st.authMethod === 'oauth') {
        const profiles: EmailProfile[] = [{
          id: 'server-mail-pending',
          kind: 'gmail',
          label: st.label?.trim() || addr,
          address: addr,
        }];
        setEmailProfiles(profiles);
        syncIntegrationsFromProfiles(profiles);
        return;
      }
      setEmailProfiles([]);
      syncIntegrationsFromProfiles([]);
    } catch {
      setEmailProfiles([]);
      syncIntegrationsFromProfiles([]);
    }
  }, [syncIntegrationsFromProfiles]);

  useEffect(() => {
    void refreshEmailConnection();
  }, [refreshEmailConnection]);

  const addEmailProfile = useCallback(async (p: Omit<EmailProfile, 'id'> & {
    password?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    useOAuth?: boolean;
  }) => {
    if (p.kind === 'pop3') {
      throw new Error('POP3 is not supported — use IMAP on the server.');
    }
    if (p.kind === 'gmail' && p.useOAuth) {
      window.location.assign(api.inboxEmailOAuthStartUrl({ address: p.address, label: p.label }));
      return;
    }
    const kind = p.kind === 'gmail' ? 'gmail' : 'imap';
    await api.putInboxEmailConnection({
      kind,
      address: p.address,
      label: p.label,
      user: p.address,
      password: p.password,
      host: p.host || (kind === 'gmail' ? 'imap.gmail.com' : undefined),
      port: p.port,
      secure: p.secure,
      authMethod: 'password',
    });
    await refreshEmailConnection();
  }, [refreshEmailConnection]);

  const removeEmailProfile = useCallback(async (_id: string) => {
    await api.putInboxEmailConnection(null);
    await refreshEmailConnection();
  }, [refreshEmailConnection]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    Object.entries(accentVars(accent, theme)).forEach(([k, val]) => root.style.setProperty(k, val));
    const s = surfaces[theme];
    if (s) {
      root.style.setProperty('--bg', rgbVar(hexToRgb(s.bg)));
      root.style.setProperty('--surface', rgbVar(hexToRgb(s.card)));
    } else {
      root.style.removeProperty('--bg');
      root.style.removeProperty('--surface');
    }
  }, [theme, accent, surfaces]);

  const setSurface = useCallback((t: Theme, value: SurfaceOverride | null) => {
    setSurfaces((prev) => {
      const next = { ...prev };
      if (value) next[t] = value;else
      delete next[t];
      return next;
    });
  }, []);


  const addApiKey = useCallback((provider: string, label: string, key: string) => {
    setApiKeys((prev) => [
    ...prev,
    {
      id: createId(),
      provider,
      label,
      last4: key.slice(-4),
      active: !prev.some((k) => k.provider === provider && k.active),
      added: 'Today'
    }]
    );
  }, []);
  const removeApiKey = useCallback((id: string) => setApiKeys((p) => p.filter((k) => k.id !== id)), []);
  const setActiveKey = useCallback((id: string) => {
    setApiKeys((prev) => {
      const target = prev.find((k) => k.id === id);
      if (!target) return prev;
      return prev.map((k) => k.provider === target.provider ? { ...k, active: k.id === id } : k);
    });
  }, []);

  const toggleProvider = useCallback((id: string) => {
    setProviders((prev) => {
      const target = prev.find((p) => p.id === id);
      if (!target || target.locked) return prev;
      const nextEnabled = !target.enabled;
      void api.putProviderEnabled(id, nextEnabled).catch(() => {
        // Revert optimistic update if server rejects / is down.
        setProviders((cur) => cur.map((p) => (p.id === id ? { ...p, enabled: target.enabled } : p)));
      });
      return prev.map((p) => (p.id === id ? { ...p, enabled: nextEnabled } : p));
    });
  }, []);

  const setIntegration = useCallback((id: IntegrationId, patch: Partial<IntegrationState>) => {
    setIntegrations((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    if (id === 'elevenlabs' && patch.enabled === false) setVoice('local');
  }, []);

  const value = useMemo(
    () => ({
      theme, setTheme, accent, setAccent, surfaces, setSurface, appName, setAppName,
      navItems, setNavItems, customNavLinks, addCustomNavLink, updateCustomNavLink, removeCustomNavLink,
      router, setRouter, voice, setVoice,
      apiKeys, addApiKey, removeApiKey, setActiveKey, providers, toggleProvider,
      providerKeyStatus, refreshProviderKeys, saveProviderKey, clearProviderKey, testProviderKey,
      integrations, setIntegration,
      emailProfiles, gmailOAuthReady, refreshEmailConnection, addEmailProfile, removeEmailProfile
    }),
    [theme, accent, surfaces, setSurface, appName, navItems, setNavItems, customNavLinks, addCustomNavLink, updateCustomNavLink, removeCustomNavLink, router, voice, apiKeys, addApiKey, removeApiKey, setActiveKey, providers, toggleProvider, providerKeyStatus, refreshProviderKeys, saveProviderKey, clearProviderKey, testProviderKey, integrations, setIntegration, emailProfiles, gmailOAuthReady, refreshEmailConnection, addEmailProfile, removeEmailProfile]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}