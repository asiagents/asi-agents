import React, { useState } from 'react';
import { CloudIcon, Volume2Icon } from 'lucide-react';
import { Toggle } from '../../components/Toggle';
import { StatusPill, inputClass } from '../../components/settings/SettingsUI';
import { usePrefs } from '../../contexts/PrefsContext';
import type { IntegrationId } from '../../types/settings';
import { apiToolSkillMap } from '../../data/settings';

interface ApiCardProps {
  id: IntegrationId;
  name: string;
  description: string;
  icon: typeof Volume2Icon;
  children?: React.ReactNode;
  connectLabel: string;
}

function ApiCard({ id, name, description, icon: Icon, children, connectLabel }: ApiCardProps) {
  const { integrations, setIntegration } = usePrefs();
  const state = integrations[id];
  return (
    <section className="flex flex-col rounded-card bg-surface ring-1 ring-line" aria-labelledby={`api-${id}`}>
      <div className="flex items-start gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-ink">
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`api-${id}`} className="text-sm font-semibold text-ink">{name}</h2>
            <StatusPill tone="warn">Stub</StatusPill>
            {state.connected ?
            <StatusPill tone="muted">Saved locally (not live)</StatusPill> :
            <StatusPill tone="muted">Not configured</StatusPill>}
          </div>
          <p className="mt-0.5 text-[12px] text-muted">{description}</p>
        </div>
        <Toggle label={`${name} enabled`} checked={state.enabled} onChange={(v) => setIntegration(id, { enabled: v, connected: v ? state.connected : false })} />
      </div>
      {state.enabled &&
      <div className="flex flex-1 flex-col border-t border-line p-4">
          {children}
          <div className="mt-auto flex items-center gap-2 pt-4">
            <button
            type="button"
            onClick={() => setIntegration(id, { connected: !state.connected })}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
            state.connected ? 'text-ink ring-1 ring-line hover:bg-overlay/[0.05]' : 'bg-accent-strong text-white hover:bg-accent-2'}`
            }>
            
              {state.connected ? 'Clear stub state' : connectLabel}
            </button>
            <span className="text-[11px] text-faint">Stub UI — no network calls.</span>
          </div>
        </div>
      }
    </section>);

}

function skillIdsFor(id: IntegrationId): string {
  const row = apiToolSkillMap.find((r) => r.integrationId === id);
  return row?.skillIds.join(', ') ?? '—';
}

/**
 * Non-mail API stubs only. Live mail / Drive / Calendar live under Connections sections.
 */
export function SettingsApis() {
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-[12px] text-muted">
        Mail, Calendar, and Drive use Configure → Connect under Email / Calendar / Cloud storage (not stub plugins).
        POP3 is coming later — use IMAP. These cards are voice / cloud stubs only.
      </p>
    <div className="grid gap-4 lg:grid-cols-2">
      <ApiCard id="elevenlabs" name="ElevenLabs" icon={Volume2Icon} connectLabel="Save stub (voice)" description="Stub — voice API not wired. When live, choose voices under Models & voice.">
        <input aria-label="Voice ID" placeholder="Voice ID, e.g. Rachel" className={inputClass} />
        <p className="mt-2 text-[12px] text-muted">Uses the active ElevenLabs key from API keys.</p>
        <p className="mt-1 font-mono text-[11px] text-faint">Skills: {skillIdsFor('elevenlabs')}</p>
      </ApiCard>

      <ApiCard id="cloud" name="Cloud LLM" icon={CloudIcon} connectLabel="Save stub (endpoint)" description="Stub — Pro lane endpoint not wired. Every call would wait for your approval.">
        <div className="grid gap-2">
          <input aria-label="Endpoint URL" placeholder="https://api.example.com/v1" className={inputClass} />
          <input aria-label="Model name" placeholder="Model name" className={inputClass} />
        </div>
        <p className="mt-2 font-mono text-[11px] text-faint">Skills: {skillIdsFor('cloud')}</p>
      </ApiCard>
    </div>
    </div>);

}
