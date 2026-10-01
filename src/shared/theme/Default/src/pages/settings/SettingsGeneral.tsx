import React, { useMemo, useState } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { SettingsRow, SettingsSection, inputClass } from '../../components/settings/SettingsUI';
import { Toggle } from '../../components/Toggle';
import { ModeTiles } from '../../components/ModeSwitch';
import { Link } from 'react-router-dom';
import { PencilIcon } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { usePrefs } from '../../contexts/PrefsContext';
import { useDesk } from '../../contexts/DeskContext';
import { categoryName, usePro } from '../../contexts/ProContext';
import { ProfileSettingsSection } from '../../components/settings/ProfileSettingsSection';
import { useProfile } from '../../contexts/ProfileContext';
import type { Language } from '../../types/settings';
import { DEFAULT_DISPLAY_NAME } from '../../types/settings';
import { DEFAULT_AVATAR_EMOJI, DEFAULT_WEATHER_LOCATION, WORLD_CLOCK_SUGGESTIONS } from '../../utils/storage';

const DEFAULT_NAME = 'ASI Agents';
const locales = [
{ id: 'en-IN', label: 'English (India)' },
{ id: 'en-US', label: 'English (US)' },
{ id: 'hi-IN', label: 'Hindi / Hinglish' }];

const zones = ['Asia/Kolkata', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore', 'Asia/Dubai', 'Europe/Amsterdam'];

/** Curated weather + clock places — selecting one sets weatherLocation and homeZone. */
const LOCATION_PICKS: { label: string; zone: string; aliases?: string[] }[] = [
  { label: 'Silicon Valley', zone: 'America/Los_Angeles', aliases: ['bay area', 'san francisco', 'sf', 'palo alto'] },
  ...WORLD_CLOCK_SUGGESTIONS.filter((c) => c.label !== 'Silicon Valley').map((c) => ({
    label: c.label,
    zone: c.zone,
  })),
  { label: 'New York', zone: 'America/New_York', aliases: ['nyc'] },
  { label: 'Tokyo', zone: 'Asia/Tokyo' },
  { label: 'Mumbai', zone: 'Asia/Kolkata', aliases: ['bombay', 'india'] },
  { label: 'Sydney', zone: 'Australia/Sydney' },
];

const AVATAR_EMOJIS = ['🧑‍💼', '😎', '🧢', '🦊', '🐯', '🐼', '🚀', '⚡', '🎯', '🧠', '🌟', '☕'];

export function SettingsGeneral() {
  const { appName, setAppName } = usePrefs();
  const { s, set } = useSettings();
  const { mode } = useDesk();
  const { activeSetId, activeAgents } = usePro();
  const { englishOnlyReplies, setEnglishOnlyReplies } = useProfile();
  const [name, setName] = useState(s.displayName ?? DEFAULT_DISPLAY_NAME);
  const [locationQuery, setLocationQuery] = useState('');
  const emoji = (s.avatarEmoji || DEFAULT_AVATAR_EMOJI).trim() || DEFAULT_AVATAR_EMOJI;

  const filteredLocations = useMemo(() => {
    const q = locationQuery.trim().toLowerCase();
    if (!q) return LOCATION_PICKS;
    return LOCATION_PICKS.filter((p) => {
      const hay = [p.label, p.zone, ...(p.aliases ?? [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [locationQuery]);

  const applyLocation = (label: string, zone: string) => {
    set('weatherLocation', label);
    set('homeZone', zone);
    setLocationQuery('');
  };

  return (
    <>
      <ProfileSettingsSection />

      <SettingsSection title="Mode" description="The only place to switch modes. Home, the bottom menu, and team surfaces follow it. Live agents, meetings, and the Office are Multi / Pro only. Each Work/Personal profile also stores its own home mode above.">
        <ModeTiles />
        <div className="mt-4 max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Group upgrade banner" detail="Yellow strip on Group in Super mode. Off by default.">
            <Toggle label="Group upgrade banner" checked={s.showTeamBanner} onChange={(v) => set('showTeamBanner', v)} />
          </SettingsRow>
        </div>
      </SettingsSection>

      {(mode === 'pro' || activeAgents.length > 0) &&
      <SettingsSection title="Pro agent set" description="Active specialist lineup and skills. Mute and Panic are separate controls in Voice and the header.">
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface px-4 py-3 ring-1 ring-line">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink">{categoryName(activeSetId)}</p>
            <p className="text-[12px] text-muted">{activeAgents.length} agent{activeAgents.length === 1 ? '' : 's'} · edit skills per agent</p>
          </div>
          <Link to="/settings/pro" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
            <PencilIcon size={13} aria-hidden="true" /> Edit set & skills
          </Link>
        </div>
      </SettingsSection>
      }

      <SettingsSection title="App name" description="Shown in the header and on the lock screen.">
        <div className="flex max-w-md gap-2">
          <label htmlFor="app-name" className="sr-only">App name</label>
          <input
            id="app-name"
            value={appName}
            maxLength={32}
            onChange={(e) => setAppName(e.target.value)}
            onBlur={(e) => !e.target.value.trim() && setAppName(DEFAULT_NAME)}
            className={inputClass} />
          
          <button
            type="button"
            onClick={() => setAppName(DEFAULT_NAME)}
            disabled={appName === DEFAULT_NAME}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40">
            
            <RotateCcwIcon size={13} aria-hidden="true" /> Restore default
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="Your name" description="One local display name. Log out from the user menu to change who's signed in.">
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) set('displayName', name.trim());
          }}>
          
          <label htmlFor="display-name-set" className="sr-only">Display name</label>
          <input id="display-name-set" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <button type="submit" disabled={!name.trim() || name.trim() === s.displayName} className="shrink-0 rounded-lg bg-accent-strong px-3 text-[13px] font-medium text-white disabled:opacity-40">Save</button>
        </form>
      </SettingsSection>

      <SettingsSection title="Avatar emoji" description="Replaces the letter circle in the header. Saved on this device.">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-overlay/[0.08] text-[22px] ring-1 ring-line" aria-hidden="true">
            {emoji}
          </span>
          <div role="listbox" aria-label="Avatar emoji" className="flex flex-wrap gap-1.5">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="option"
                aria-selected={emoji === e}
                onClick={() => set('avatarEmoji', e)}
                className={`grid h-9 w-9 place-items-center rounded-lg text-[18px] ring-1 transition-colors duration-150 ${
                  emoji === e ? 'bg-accent/15 ring-accent/40' : 'ring-line hover:bg-overlay/[0.05]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <label className="mt-3 block max-w-xs text-[12px] font-medium text-muted">
          Custom emoji
          <input
            value={emoji}
            maxLength={8}
            onChange={(e) => set('avatarEmoji', e.target.value.trim() || DEFAULT_AVATAR_EMOJI)}
            className={`mt-1 ${inputClass}`}
            aria-label="Custom avatar emoji"
          />
        </label>
      </SettingsSection>

      <SettingsSection title="Language" description="Interface language, mic locale, and model reply language.">
        <div className="flex flex-wrap gap-4">
          <div role="radiogroup" aria-label="Interface language" className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line">
            {([{ id: 'en', label: 'English' }, { id: 'hinglish', label: 'Hinglish' }] as {id: Language;label: string;}[]).map((l) =>
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={s.language === l.id}
              onClick={() => set('language', l.id)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors duration-150 ${s.language === l.id ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'}`}>
              
                {l.label}
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Speech locale
            <select value={s.sttLocale} onChange={(e) => set('sttLocale', e.target.value)} className="rounded-lg bg-surface px-2.5 py-1.5 text-ink ring-1 ring-line">
              {locales.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow
            title="English only"
            detail="Agent / council replies stay in English. Strips Chinese chain-of-thought and thinking tags. On by default.">
            <Toggle
              label="English only"
              checked={englishOnlyReplies}
              onChange={(v) => {
                void setEnglishOnlyReplies(v);
              }}
            />
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection id="location" title="Location & time" description="Pick a city for weather and the Home clock timezone. Detect uses GPS; never invents a city.">
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const { latitude, longitude } = pos.coords;
                  set('weatherLocation', `${latitude.toFixed(4)},${longitude.toFixed(4)}`);
                },
                () => {
                  applyLocation(DEFAULT_WEATHER_LOCATION, 'America/Los_Angeles');
                },
                { enableHighAccuracy: false, timeout: 12000 },
              );
            }}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.05]"
          >
            Detect location
          </button>
          <button
            type="button"
            onClick={() => applyLocation(DEFAULT_WEATHER_LOCATION, 'America/Los_Angeles')}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted hover:text-ink"
          >
            Reset (Silicon Valley)
          </button>
        </div>

        <div className="max-w-2xl rounded-card bg-surface p-3 ring-1 ring-line">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Search cities</span>
            <input
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="Silicon Valley, London, Singapore…"
              className={`mt-1 ${inputClass}`}
              aria-label="Search location"
            />
          </label>
          <p className="mt-2 text-[12px] text-muted">
            Current:{' '}
            <span className="font-medium text-ink">{s.weatherLocation.trim() || DEFAULT_WEATHER_LOCATION}</span>
            {' · '}
            <span className="tabular-nums text-ink">{s.homeZone}</span>
          </p>
          <ul
            role="listbox"
            aria-label="Location picker"
            className="mt-3 max-h-56 space-y-1 overflow-y-auto"
          >
            {filteredLocations.length === 0 ? (
              <li className="px-2 py-2 text-[13px] text-muted">No matches — try another city name.</li>
            ) : (
              filteredLocations.map((p) => {
                const selected = s.weatherLocation.trim().toLowerCase() === p.label.toLowerCase();
                return (
                  <li key={`${p.label}:${p.zone}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => applyLocation(p.label, p.zone)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150 ${
                        selected
                          ? 'bg-accent/15 text-accent-ink ring-1 ring-accent/40'
                          : 'text-ink hover:bg-overlay/[0.05]'
                      }`}
                    >
                      <span className="font-medium">{p.label}</span>
                      <span className="shrink-0 text-[11px] text-muted">{p.zone}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className="text-[12px] font-medium text-muted">Custom weather place</span>
            <input
              key={s.weatherLocation}
              defaultValue={s.weatherLocation}
              onBlur={(e) => set('weatherLocation', e.target.value.trim() || DEFAULT_WEATHER_LOCATION)}
              placeholder={DEFAULT_WEATHER_LOCATION}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Units</span>
            <select value={s.tempUnit} onChange={(e) => set('tempUnit', e.target.value as 'C' | 'F')} className={`mt-1 ${inputClass}`}>
              <option value="C">°C</option>
              <option value="F">°F</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Home time zone</span>
            <select value={s.homeZone} onChange={(e) => set('homeZone', e.target.value)} className={`mt-1 ${inputClass}`}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
        </div>
      </SettingsSection>
    </>);

}
