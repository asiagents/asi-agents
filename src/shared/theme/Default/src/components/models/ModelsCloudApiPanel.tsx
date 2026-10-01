import React from 'react';
import { Link } from 'react-router-dom';
import { CloudIcon, ExternalLinkIcon, KeyRoundIcon } from 'lucide-react';
import { SettingsSection, StatusPill } from '../settings/SettingsUI';
import { AddKeyForm } from '../settings/AddKeyForm';
import { Toggle } from '../Toggle';
import { modelRoutingKeyProviders } from '../../data/settings';
import { usePrefs } from '../../contexts/PrefsContext';

/** Cloud / relay API keys for model routing — keys stored on :3445. */
export function ModelsCloudApiPanel() {
  const { providers, toggleProvider, providerKeyStatus } = usePrefs();

  return (
    <SettingsSection
      title="API Settings"
      stacked
      description="Cloud providers with server-stored keys. Model lists load when a key is configured; Chief chat still uses Ollama/llama.cpp env unless routed later."
    >
      <div className="w-full min-w-0 space-y-3">
        <p className="text-[12px] text-muted">
          Turning a provider off fails closed. Keys are stored in app-state on the server; only the last four characters are shown.
        </p>
        <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {modelRoutingKeyProviders.map((p) => {
            const pref = providers.find((row) => row.id === p.id);
            const status = providerKeyStatus[p.id];
            const configured = status?.configured === true;
            const enabled = pref?.enabled ?? false;
            return (
              <li key={p.id} className="flex flex-wrap items-start gap-4 px-4 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-ink">
                  <CloudIcon size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{p.name}</span>
                    {p.supportsFreeTier && <StatusPill tone="success">Free tier</StatusPill>}
                    {configured ? (
                      <StatusPill tone="success">Secret saved · ••••{status?.last4 ?? '????'}</StatusPill>
                    ) : (
                      <StatusPill tone="muted">No key</StatusPill>
                    )}
                    {enabled ? <StatusPill tone="success">On</StatusPill> : <StatusPill tone="muted">Off</StatusPill>}
                  </div>
                  <p className="mt-1 text-[12px] text-muted">{pref?.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {p.signupUrl && (
                      <a
                        href={p.signupUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-ink hover:underline"
                      >
                        <ExternalLinkIcon size={12} aria-hidden="true" />
                        Sign up
                      </a>
                    )}
                    {p.docsUrl && (
                      <a
                        href={p.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink hover:underline"
                      >
                        Docs
                      </a>
                    )}
                    <AddKeyForm providerId={p.id} signupUrl={p.signupUrl} />
                    <Link
                      to={`/settings/keys?provider=${encodeURIComponent(p.id)}`}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-ink hover:underline"
                    >
                      <KeyRoundIcon size={12} aria-hidden="true" />
                      Open in Settings
                    </Link>
                  </div>
                </div>
                {pref && (
                  <Toggle
                    label={`${p.name} enabled`}
                    checked={enabled}
                    locked={pref.locked}
                    onChange={() => toggleProvider(p.id)}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-faint">
          Hugging Face uses the Inference Providers router (
          <code className="text-ink">huggingface</code> ·{' '}
          <code className="text-ink">https://router.huggingface.co/v1</code>
          ). Token needs Inference Providers permission; list + chat use the same OpenAI-compat paths as other cards.
        </p>
      </div>
    </SettingsSection>
  );
}
