import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLinkIcon, KeyRoundIcon, Trash2Icon } from 'lucide-react';
import { StatusPill } from '../../components/settings/SettingsUI';
import { AddKeyForm } from '../../components/settings/AddKeyForm';
import { usePrefs } from '../../contexts/PrefsContext';
import { cloudInferenceProviderIds, keyProviders } from '../../data/settings';

export function SettingsKeys() {
  const { apiKeys, removeApiKey, setActiveKey, providerKeyStatus, clearProviderKey, testProviderKey } =
    usePrefs();
  const [searchParams] = useSearchParams();
  const focusProvider = searchParams.get('provider');
  const validFocus =
    focusProvider && keyProviders.some((p) => p.id === focusProvider) ? focusProvider : null;
  const [testBusyId, setTestBusyId] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<Record<string, { working: boolean; detail: string }>>({});

  useEffect(() => {
    if (!validFocus) return;
    const el = document.getElementById(`kp-${validFocus}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [validFocus]);

  const runTest = async (providerId: string) => {
    setTestBusyId(providerId);
    try {
      const r = await testProviderKey(providerId);
      setTestMsg((prev) => ({
        ...prev,
        [providerId]: {
          working: r.working,
          detail: r.working
            ? `Working · ${r.model}${r.reply ? ` · “${r.reply}”` : ''}`
            : `Failed · ${r.error ?? 'no reply'}`,
        },
      }));
    } catch {
      setTestMsg((prev) => ({
        ...prev,
        [providerId]: { working: false, detail: 'Failed · could not reach :3445' },
      }));
    } finally {
      setTestBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-[12px] text-muted">
        Cloud inference keys are stored on the API server (masked on read). Use Test connection for a ~10-token
        generate (“Reply with OK”). ElevenLabs and Gmail slots stay local until those integrations ship.
      </p>
      {keyProviders.map((p) => {
        const serverBacked = cloudInferenceProviderIds.has(p.id);
        const keys = apiKeys.filter((k) => k.provider === p.id);
        const status = providerKeyStatus[p.id];
        const configured = serverBacked && status?.configured === true;
        const localActive = !serverBacked ? keys.find((k) => k.active) ?? keys[0] : undefined;
        const test = testMsg[p.id];
        return (
          <section key={p.id} aria-labelledby={`kp-${p.id}`} className="rounded-card bg-surface ring-1 ring-line">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <KeyRoundIcon size={15} className="text-muted" aria-hidden="true" />
              <h2 id={`kp-${p.id}`} className="text-sm font-semibold text-ink">{p.name}</h2>
              {p.stub && <StatusPill tone="warn">Stub</StatusPill>}
              {p.supportsFreeTier && !p.stub && <StatusPill tone="success">Free tier</StatusPill>}
              {serverBacked ? (
                configured ? (
                  <StatusPill tone="success">Secret saved · ••••{status?.last4}</StatusPill>
                ) : (
                  <StatusPill tone="muted">No key</StatusPill>
                )
              ) : localActive ? (
                <StatusPill tone="success">Secret saved · ••••{localActive.last4}</StatusPill>
              ) : (
                <StatusPill tone="muted">No key</StatusPill>
              )}
              {p.signupUrl && (
                <a
                  href={p.signupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-accent-ink hover:underline"
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
            </div>
            {serverBacked && configured && (
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0 flex-1 text-[12px] text-muted">
                  Secret saved · ends in{' '}
                  <span className="font-mono text-ink">••••{status?.last4}</span>
                  {test && (
                    <span className={`ml-2 ${test.working ? 'text-success' : 'text-danger'}`}>{test.detail}</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={testBusyId === p.id}
                  onClick={() => void runTest(p.id)}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40"
                >
                  {testBusyId === p.id ? 'Testing…' : 'Test connection'}
                </button>
                <button
                  type="button"
                  onClick={() => void clearProviderKey(p.id)}
                  aria-label={`Remove ${p.name} key`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2Icon size={15} aria-hidden="true" />
                </button>
              </div>
            )}
            {!serverBacked && keys.length > 0 && (
              <ul className="divide-y divide-line">
                {keys.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <input
                      type="radio"
                      name={`active-${p.id}`}
                      checked={k.active}
                      onChange={() => setActiveKey(k.id)}
                      aria-label={`Use ${k.label} as active key`}
                      className="h-4 w-4 accent-[rgb(var(--accent))]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-ink">{k.label}</div>
                      <div className="text-[12px] text-muted">
                        Secret saved · <span className="font-mono">••••{k.last4}</span> · added {k.added}
                      </div>
                    </div>
                    {k.active && <StatusPill tone="success">Active</StatusPill>}
                    <button
                      type="button"
                      onClick={() => removeApiKey(k.id)}
                      aria-label={`Remove ${k.label}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2Icon size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line px-4 py-2.5">
              <AddKeyForm providerId={p.id} startOpen={validFocus === p.id} signupUrl={p.signupUrl} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
