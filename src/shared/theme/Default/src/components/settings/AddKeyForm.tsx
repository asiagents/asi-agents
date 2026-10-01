import React, { useEffect, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { inputClass } from './SettingsUI';
import { usePrefs } from '../../contexts/PrefsContext';
import { cloudInferenceProviderIds } from '../../data/settings';

export function AddKeyForm({
  providerId,
  startOpen = false,
  signupUrl,
}: {
  providerId: string;
  startOpen?: boolean;
  signupUrl?: string;
}) {
  const { addApiKey, saveProviderKey, testProviderKey } = usePrefs();
  const serverBacked = cloudInferenceProviderIds.has(providerId);
  const [open, setOpen] = useState(startOpen);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ working: boolean; detail: string } | null>(null);

  useEffect(() => {
    if (startOpen) setOpen(true);
  }, [startOpen, providerId]);
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const valid = (serverBacked ? key.trim().length >= 8 : label.trim() && key.trim().length >= 8) && !saving;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent/10"
      >
        <PlusIcon size={14} aria-hidden="true" /> Add key
      </button>
    );
  }

  return (
    <form
      className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        setError(null);
        setSaving(true);
        void (async () => {
          try {
            if (serverBacked) {
              await saveProviderKey(providerId, key.trim());
            } else {
              addApiKey(providerId, label.trim(), key.trim());
            }
            setLabel('');
            setKey('');
            setOpen(false);
            setTestResult(null);
          } catch {
            setError('Could not save key — is the API server running on :3445?');
          } finally {
            setSaving(false);
          }
        })();
      }}
    >
      {!serverBacked && (
        <input
          aria-label="Key label"
          placeholder="Label, e.g. Personal"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={inputClass}
        />
      )}
      <input
        aria-label="API key"
        type="password"
        placeholder="Paste key (min 8 characters)"
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          setTestResult(null);
        }}
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-2">
        {serverBacked && (
          <button
            type="button"
            disabled={key.trim().length < 8 || testing || saving}
            onClick={() => {
              setError(null);
              setTesting(true);
              setTestResult(null);
              void (async () => {
                try {
                  const r = await testProviderKey(providerId, { apiKey: key.trim() });
                  setTestResult({
                    working: r.working,
                    detail: r.working
                      ? `Working · ${r.model}${r.reply ? ` · “${r.reply}”` : ''}`
                      : `Failed · ${r.error ?? 'no reply'}`,
                  });
                } catch {
                  setTestResult({ working: false, detail: 'Failed · could not reach :3445' });
                } finally {
                  setTesting(false);
                }
              })();
            }}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40"
          >
            {testing ? 'Testing…' : 'Test'}
          </button>
        )}
        <button
          type="submit"
          disabled={!valid}
          className="rounded-lg bg-accent-strong px-3 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
        >
          Cancel
        </button>
        {signupUrl && (
          <a
            href={signupUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-medium text-accent-ink hover:underline"
          >
            Sign up
          </a>
        )}
      </div>
      {testResult && (
        <p className={`col-span-full text-[12px] ${testResult.working ? 'text-success' : 'text-danger'}`}>
          {testResult.detail}
        </p>
      )}
      {error && <p className="col-span-full text-[12px] text-danger">{error}</p>}
    </form>
  );
}
