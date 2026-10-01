import { useAgents } from '../../contexts/AgentsContext';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { api, type VoiceDictionaryEntry, type VoiceDictionaryKind } from '@asi-api';
import { SettingsRow, SettingsSection, StatusPill, inputClass } from '../../components/settings/SettingsUI';
import { PrivacyHonestyStrip } from '../../components/settings/PrivacyHonestyStrip';
import { Toggle } from '../../components/Toggle';
import { AgentAvatar } from '../../components/AgentAvatar';
import { useSettings } from '../../contexts/SettingsContext';
import { usePrefs } from '../../contexts/PrefsContext';
import { voiceProviders, voices } from '../../data/voices';
import { speak } from '../../utils/speech';
import { clearTtsCache, ttsCacheStatus, warmTtsCache, type TtsCacheLine } from '../../utils/ttsWarmCache';
import type { MuteMode } from '../../types/settings';

const muteOptions: { id: MuteMode; label: string; detail: string }[] = [
  { id: 'unmuted', label: 'Unmuted', detail: 'Agents and app sounds' },
  { id: 'agents', label: 'Agents only', detail: 'Only agent speech' },
  { id: 'muted', label: 'Mute all', detail: 'Silence everything' },
];

const KIND_OPTIONS: VoiceDictionaryKind[] = ['agent', 'skill', 'app', 'other'];

export function SettingsVoice() {
  const agents = useAgents();
  const { s, set } = useSettings();
  const { integrations } = usePrefs();
  const available = voices.filter((v) => s.voiceProviders[v.provider]);

  const providerOn = (id: string) =>
    id === 'elevenlabs' ? integrations.elevenlabs.enabled && s.voiceProviders.elevenlabs : s.voiceProviders[id];

  const [dict, setDict] = useState<VoiceDictionaryEntry[]>([]);
  const [dictLoading, setDictLoading] = useState(true);
  const [dictSaving, setDictSaving] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);
  const [draftHeard, setDraftHeard] = useState('');
  const [draftCanon, setDraftCanon] = useState('');
  const [draftKind, setDraftKind] = useState<VoiceDictionaryKind>('agent');

  const [cacheLines, setCacheLines] = useState<TtsCacheLine[]>(() => ttsCacheStatus().lines);
  const [cacheReady, setCacheReady] = useState(() => ttsCacheStatus().ready);
  const [cacheTotal, setCacheTotal] = useState(() => ttsCacheStatus().total);
  const [warming, setWarming] = useState(false);

  const refreshCache = useCallback(() => {
    const st = ttsCacheStatus();
    setCacheLines(st.lines);
    setCacheReady(st.ready);
    setCacheTotal(st.total);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDictLoading(true);
    api
      .voiceDictionary()
      .then((r) => {
        if (!cancelled) {
          setDict(r.entries ?? []);
          setDictError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setDictError('Could not load dictionary from the server.');
      })
      .finally(() => {
        if (!cancelled) setDictLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistDict = async (next: VoiceDictionaryEntry[]) => {
    setDictSaving(true);
    setDictError(null);
    try {
      const r = await api.putVoiceDictionary(next);
      setDict(r.entries);
    } catch {
      setDictError('Save failed — is the API running?');
    } finally {
      setDictSaving(false);
    }
  };

  const addEntry = () => {
    const heardAs = draftHeard.trim();
    const canonical = draftCanon.trim();
    if (!heardAs || !canonical) return;
    const next = [
      ...dict.filter((e) => e.heardAs.toLowerCase() !== heardAs.toLowerCase()),
      { heardAs, canonical, kind: draftKind },
    ];
    setDraftHeard('');
    setDraftCanon('');
    void persistDict(next);
  };

  const removeEntry = (heardAs: string) => {
    void persistDict(dict.filter((e) => e.heardAs !== heardAs));
  };

  const onWarm = async () => {
    setWarming(true);
    try {
      const st = await warmTtsCache(s.sttLocale);
      setCacheLines(st.lines);
      setCacheReady(st.ready);
      setCacheTotal(st.total);
    } finally {
      setWarming(false);
    }
  };

  const onClearCache = () => {
    const st = clearTtsCache();
    setCacheLines(st.lines);
    setCacheReady(st.ready);
    setCacheTotal(st.total);
  };

  return (
    <>
      <SettingsSection title="Privacy" description="What leaves this machine for mic, speech, and models.">
        <PrivacyHonestyStrip />
      </SettingsSection>

      <SettingsSection title="Master" description="Mute is not Panic: it only silences audio. Agents keep working.">
        <div role="radiogroup" aria-label="Audio" className="grid max-w-2xl gap-2 sm:grid-cols-3">
          {muteOptions.map((o) =>
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={s.muteMode === o.id}
            onClick={() => set('muteMode', o.id)}
            className={`rounded-xl p-3 text-left ring-1 transition-colors duration-150 ${s.muteMode === o.id ? 'bg-accent/10 ring-accent/50' : 'bg-surface ring-line hover:bg-raised'}`}>

              <span className="block text-sm font-semibold text-ink">{o.label}</span>
              <span className="block text-[12px] text-muted">{o.detail}</span>
            </button>
          )}
        </div>
        <div className="mt-4 max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Agent speech (TTS)" detail={s.lowEnd ? 'Low-end mode turned this off by default.' : 'Agents read replies aloud.'}>
            <Toggle label="TTS" checked={s.tts} onChange={(v) => set('tts', v)} />
          </SettingsRow>
          <SettingsRow title="Your mic (STT)" detail="Browser speech recognition from the composer mic — see Privacy above.">
            <Toggle label="STT" checked={s.stt} onChange={(v) => set('stt', v)} />
          </SettingsRow>
          <SettingsRow title="Speak handoffs & approvals" detail="Announce when a request changes model or needs you.">
            <Toggle label="Speak handoffs" checked={s.speakHandoffs} onChange={(v) => set('speakHandoffs', v)} />
          </SettingsRow>
          <SettingsRow title={`Volume · ${s.volume}`} detail="Applies to Local TTS.">
            <input type="range" min={0} max={100} value={s.volume} onChange={(e) => set('volume', Number(e.target.value))} aria-label="Volume" className="w-40 accent-[rgb(var(--accent))]" />
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection
        id="dictionary"
        title="Dictionary"
        description="heard_as map: misheard or alias → canonical agent, skill, or app name. Applied on STT text and intent normalize."
      >
        <div className="max-w-2xl space-y-3">
          {dictError && <p className="text-[12px] text-danger">{dictError}</p>}
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[8rem] flex-1 text-[12px] text-muted">
              Heard as
              <input
                value={draftHeard}
                onChange={(e) => setDraftHeard(e.target.value)}
                placeholder="cheese"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="min-w-[8rem] flex-1 text-[12px] text-muted">
              Canonical
              <input
                value={draftCanon}
                onChange={(e) => setDraftCanon(e.target.value)}
                placeholder="chief"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-[12px] text-muted">
              Kind
              <select
                value={draftKind}
                onChange={(e) => setDraftKind(e.target.value as VoiceDictionaryKind)}
                className="mt-1 block rounded-lg bg-surface px-2.5 py-2 text-sm text-ink ring-1 ring-line"
              >
                {KIND_OPTIONS.map((k) =>
                <option key={k} value={k}>{k}</option>
                )}
              </select>
            </label>
            <button
              type="button"
              onClick={addEntry}
              disabled={!draftHeard.trim() || !draftCanon.trim() || dictSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-40"
            >
              <PlusIcon size={14} aria-hidden="true" /> Add
            </button>
          </div>
          <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
            {dictLoading &&
            <li className="px-4 py-3 text-[12px] text-muted">Loading…</li>
            }
            {!dictLoading && dict.length === 0 &&
            <li className="px-4 py-3 text-[12px] text-muted">No entries yet.</li>
            }
            {dict.map((e) =>
            <li key={e.heardAs} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-ink">
                      <span className="font-medium">{e.heardAs}</span>
                      <span className="text-muted"> → </span>
                      {e.canonical}
                    </span>
                    <StatusPill tone="muted">{e.kind}</StatusPill>
                  </div>
                </div>
                <button
                type="button"
                onClick={() => removeEntry(e.heardAs)}
                aria-label={`Remove ${e.heardAs}`}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
              >
                  <Trash2Icon size={14} aria-hidden="true" />
                </button>
              </li>
            )}
          </ul>
          {dictSaving && <p className="text-[11px] text-faint">Saving…</p>}
        </div>
      </SettingsSection>

      <SettingsSection
        title="TTS warm-cache"
        description="Pre-prime scripted local lines (Got it, Done, clarify, welcome). Status is local to this browser."
      >
        <div className="max-w-2xl space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={cacheReady === cacheTotal && cacheTotal > 0 ? 'success' : cacheReady > 0 ? 'warn' : 'muted'}>
              {cacheReady}/{cacheTotal} ready
            </StatusPill>
            <button
              type="button"
              onClick={() => void onWarm()}
              disabled={warming}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40"
            >
              {warming ? 'Warming…' : 'Warm cache'}
            </button>
            <button
              type="button"
              onClick={onClearCache}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={refreshCache}
              className="text-[12px] font-medium text-accent-ink hover:underline"
            >
              Refresh status
            </button>
          </div>
          <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-card bg-surface ring-1 ring-line">
            {cacheLines.map((line) =>
            <li key={line.id} className="flex items-center gap-3 px-4 py-2">
                <StatusPill tone={line.status === 'ready' ? 'success' : 'muted'}>
                  {line.status === 'ready' ? 'ready' : 'cold'}
                </StatusPill>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink" title={line.text}>
                  {line.text}
                </span>
                <span className="shrink-0 text-[11px] text-faint">{line.group}</span>
              </li>
            )}
          </ul>
        </div>
      </SettingsSection>

      <SettingsSection title="Voice providers" description="Local TTS is always available. Others are stubs.">
        <ul className="max-w-2xl divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {voiceProviders.map((p) =>
          <li key={p.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{p.name}</span>
                  <StatusPill tone={p.kind === 'local' ? 'success' : 'muted'}>{p.kind === 'local' ? 'On-device' : 'Cloud'}</StatusPill>
                </div>
                <p className="text-[12px] text-muted">
                  {p.id === 'elevenlabs' && !integrations.elevenlabs.enabled ?
                <>Enable ElevenLabs in <Link to="/settings/connections#apis" className="font-medium text-accent-ink hover:underline">APIs</Link> first.</> :

                p.detail
                }
                </p>
              </div>
              <Toggle
              label={`${p.name} enabled`}
              checked={!!providerOn(p.id)}
              locked={p.locked || p.id === 'elevenlabs' && !integrations.elevenlabs.enabled}
              onChange={(v) => set('voiceProviders', { ...s.voiceProviders, [p.id]: v })} />

            </li>
          )}
        </ul>
      </SettingsSection>

      <SettingsSection title="Voices" description="Default voice, and an override per agent.">
        <div className="flex max-w-2xl items-center gap-3">
          <label htmlFor="default-voice" className="text-sm text-ink">Default</label>
          <select id="default-voice" value={s.defaultVoice} onChange={(e) => set('defaultVoice', e.target.value)} className="rounded-lg bg-surface px-3 py-2 text-sm text-ink ring-1 ring-line">
            {available.map((v) => <option key={v.id} value={v.id}>{v.name} · {voiceProviders.find((p) => p.id === v.provider)?.name}</option>)}
          </select>
          <button
            type="button"
            onClick={() => speak('Hi, this is your default voice.', { muteMode: s.muteMode, tts: s.tts, volume: s.volume, lang: s.sttLocale })}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">

            Test
          </button>
        </div>
        <ul className="mt-4 grid max-w-3xl gap-2 sm:grid-cols-2">
          {agents.map((a) =>
          <li key={a.id} className="flex items-center gap-3 rounded-xl bg-surface p-2.5 ring-1 ring-line">
              <AgentAvatar agent={a} size="sm" />
              <span className="flex-1 truncate text-[13px] text-ink">{a.name}</span>
              <label className="sr-only" htmlFor={`voice-${a.id}`}>Voice for {a.name}</label>
              <select
              id={`voice-${a.id}`}
              value={s.agentVoices[a.id] ?? ''}
              onChange={(e) => set('agentVoices', { ...s.agentVoices, [a.id]: e.target.value })}
              className="rounded-md bg-bg px-2 py-1 text-[12px] text-ink ring-1 ring-line">

                <option value="">Default</option>
                {available.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </li>
          )}
        </ul>
      </SettingsSection>
    </>
  );
}
