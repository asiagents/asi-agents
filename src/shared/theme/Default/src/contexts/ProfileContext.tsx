import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  api,
  type ProfileHomeMode,
  type ProfilePrefsSlice,
  type UserPrefs,
  type UserProfileId,
} from '@asi-api';
import { useDesk } from './DeskContext';

const defaultSlice = (homeMode: ProfileHomeMode = 'multi'): ProfilePrefsSlice => ({
  favoriteAgentIds: [],
  homeMode,
  displayContext: '',
});

const defaultPrefs = (): UserPrefs => ({
  activeProfile: 'work',
  profiles: {
    work: defaultSlice('multi'),
    personal: defaultSlice('super'),
  },
  englishOnlyReplies: true,
});

interface ProfileValue {
  prefs: UserPrefs;
  activeProfile: UserProfileId;
  slice: ProfilePrefsSlice;
  ready: boolean;
  englishOnlyReplies: boolean;
  setActiveProfile: (id: UserProfileId) => Promise<void>;
  updateActiveSlice: (patch: Partial<ProfilePrefsSlice>) => Promise<void>;
  setEnglishOnlyReplies: (on: boolean) => Promise<void>;
  toggleFavorite: (agentId: string) => Promise<void>;
}

const ProfileContext = createContext<ProfileValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { setMode } = useDesk();
  const [prefs, setPrefs] = useState<UserPrefs>(defaultPrefs);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .prefs()
      .then((res) => {
        if (cancelled || !res?.prefs) return;
        setPrefs(res.prefs);
        setMode(res.prefs.profiles[res.prefs.activeProfile]?.homeMode ?? 'multi');
      })
      .catch(() => {
        /* offline — local defaults until :3445 is up */
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setMode]);

  const setActiveProfile = useCallback(
    async (id: UserProfileId) => {
      const res = await api.putPrefs({ activeProfile: id });
      setPrefs(res.prefs);
      const mode = res.prefs.profiles[id]?.homeMode ?? 'multi';
      setMode(mode);
    },
    [setMode]
  );

  const updateActiveSlice = useCallback(async (patch: Partial<ProfilePrefsSlice>) => {
    const res = await api.putPrefs(patch);
    setPrefs(res.prefs);
    if (patch.homeMode) setMode(patch.homeMode);
  }, [setMode]);

  const setEnglishOnlyReplies = useCallback(async (on: boolean) => {
    const res = await api.putPrefs({ englishOnlyReplies: on });
    setPrefs(res.prefs);
  }, []);

  const toggleFavorite = useCallback(
    async (agentId: string) => {
      const id = agentId.trim();
      if (!id) return;
      const active = prefs.activeProfile;
      const cur = prefs.profiles[active]?.favoriteAgentIds ?? [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      const res = await api.putPrefs({ favoriteAgentIds: next });
      setPrefs(res.prefs);
    },
    [prefs]
  );

  const activeProfile = prefs.activeProfile;
  const slice = prefs.profiles[activeProfile] ?? defaultSlice();
  const englishOnlyReplies = prefs.englishOnlyReplies !== false;

  const value = useMemo(
    () => ({
      prefs,
      activeProfile,
      slice,
      ready,
      englishOnlyReplies,
      setActiveProfile,
      updateActiveSlice,
      setEnglishOnlyReplies,
      toggleFavorite,
    }),
    [
      prefs,
      activeProfile,
      slice,
      ready,
      englishOnlyReplies,
      setActiveProfile,
      updateActiveSlice,
      setEnglishOnlyReplies,
      toggleFavorite,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
