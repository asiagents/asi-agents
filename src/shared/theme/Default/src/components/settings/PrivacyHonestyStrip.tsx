import React from 'react';
import { Link } from 'react-router-dom';
import { usePrefs } from '../../contexts/PrefsContext';
import { useDesk } from '../../contexts/DeskContext';
import { StatusPill } from './SettingsUI';

/**
 * Explicit strip: what leaves this machine for speech + models.
 * Honest about browser dictation (often cloud) vs on-device TTS vs LLM providers.
 */
export function PrivacyHonestyStrip() {
  const { integrations, providers, providerKeyStatus } = usePrefs();
  const { onlineOn } = useDesk();

  const cloudKeys = Object.entries(providerKeyStatus).filter(([, s]) => s?.configured).map(([id]) => id);
  const enabledCloudProviders = providers.filter((p) => p.enabled && p.lane !== 'local' && !p.locked);
  const elevenOn = integrations.elevenlabs.enabled;

  return (
    <div
      role="note"
      className="max-w-2xl rounded-card bg-surface px-4 py-3.5 ring-1 ring-line"
      aria-label="What leaves this machine"
    >
      <p className="text-[13px] font-semibold text-ink">What leaves this machine</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        Straight facts for voice and chat — not a marketing promise. Defaults stay on-device when you keep Online models off and skip cloud voice APIs.
      </p>
      <ul className="mt-3 space-y-2.5 text-[12px] leading-snug text-ink">
        <li className="flex gap-2">
          <StatusPill tone="warn">Mic / STT</StatusPill>
          <span className="min-w-0 text-muted">
            Composer mic uses the <span className="text-ink">browser Speech Recognition API</span>. On Chrome that usually means audio goes to Google; Safari may use Apple. This is not an offline Whisper path unless you install and wire a local STT model.
          </span>
        </li>
        <li className="flex gap-2">
          <StatusPill tone="success">Local TTS</StatusPill>
          <span className="min-w-0 text-muted">
            System / browser <span className="text-ink">speechSynthesis</span> stays on this device. Scripted warm-cache lines are primed here only.
          </span>
        </li>
        <li className="flex gap-2">
          <StatusPill tone={elevenOn ? 'warn' : 'muted'}>Cloud TTS</StatusPill>
          <span className="min-w-0 text-muted">
            {elevenOn ?
            <>ElevenLabs is enabled — spoken text can leave via that API (see <Link to="/settings/connections#apis" className="font-medium text-accent-ink hover:underline">APIs</Link>).</> :

            <>ElevenLabs / other cloud voices are off unless you enable them under Voice providers or Connections.</>}
          </span>
        </li>
        <li className="flex gap-2">
          <StatusPill tone={onlineOn || cloudKeys.length > 0 ? 'warn' : 'success'}>LLM chat</StatusPill>
          <span className="min-w-0 text-muted">
            {onlineOn ?
            <>Online models are on — prompts can go to cloud providers you enabled ({enabledCloudProviders.map((p) => p.name).slice(0, 4).join(', ') || 'configured APIs'}{enabledCloudProviders.length > 4 ? '…' : ''}).</> :
            cloudKeys.length > 0 ?
            <>Online models are off in the header, but {cloudKeys.length} provider key{cloudKeys.length === 1 ? ' is' : 's are'} saved. Nothing is sent until a cloud route runs.</> :

            <>Local / in-app intents stay on-device. No cloud provider keys are configured.</>}
            {' '}
            <Link to="/settings/connections" className="font-medium text-accent-ink hover:underline">Providers</Link>
            {' · '}
            <Link to="/settings/safety" className="font-medium text-accent-ink hover:underline">Safety</Link>
          </span>
        </li>
      </ul>
    </div>
  );
}
