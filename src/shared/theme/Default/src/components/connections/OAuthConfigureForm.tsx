import React, { useCallback, useEffect, useState } from 'react';
import { api, type OAuthClientPublicStatus, type OAuthClientSlot } from '@asi-api';
import { StatusPill, inputClass } from '../settings/SettingsUI';

const SLOT_COPY: Record<
  OAuthClientSlot,
  { title: string; steps: string[]; envHint: string }
> = {
  gmail: {
    title: 'Gmail OAuth app',
    steps: [
      'Google Cloud Console → APIs & Services → Credentials → OAuth client (Web).',
      'Add the redirect URI shown below (exact match).',
      'Enable Gmail API. Scope used for IMAP XOAUTH2: mail.google.com (not Drive).',
      'Paste Client ID + Client secret here, or set ASI_GMAIL_CLIENT_ID / ASI_GMAIL_CLIENT_SECRET.',
    ],
    envHint: 'ASI_GMAIL_CLIENT_ID + ASI_GMAIL_CLIENT_SECRET',
  },
  google_calendar: {
    title: 'Google Calendar OAuth app',
    steps: [
      'Same Google Cloud project can host a separate OAuth client, or reuse one.',
      'Enable Google Calendar API. Scope: calendar.readonly.',
      'Register the redirect URI below.',
      'Paste secrets here or set ASI_GOOGLE_CALENDAR_CLIENT_ID / SECRET.',
    ],
    envHint: 'ASI_GOOGLE_CALENDAR_CLIENT_ID + ASI_GOOGLE_CALENDAR_CLIENT_SECRET',
  },
  google_drive: {
    title: 'Google Drive OAuth app',
    steps: [
      'Opt-in only — Gmail Connect never requests Drive scopes.',
      'Enable Google Drive API. Scope: drive.readonly.',
      'Register the Drive redirect URI below (different path from Gmail).',
      'Paste secrets here, or ASI_GOOGLE_DRIVE_* (falls back to ASI_GMAIL_* client).',
    ],
    envHint: 'ASI_GOOGLE_DRIVE_CLIENT_ID + SECRET (or Gmail client)',
  },
  microsoft: {
    title: 'Microsoft Graph app',
    steps: [
      'Azure Portal → App registrations → New registration (public client / web).',
      'Add redirect URI below. API permissions: Calendars.Read, Mail.Read (delegated) + grant admin consent if required.',
      'Create a client secret under Certificates & secrets.',
      'Paste here or set ASI_MICROSOFT_CLIENT_ID / ASI_MICROSOFT_CLIENT_SECRET.',
    ],
    envHint: 'ASI_MICROSOFT_CLIENT_ID + ASI_MICROSOFT_CLIENT_SECRET',
  },
};

/**
 * Configure / Set up — save OAuth client id/secret (Secret saved + last4).
 * Env overrides in-app values when set.
 */
export function OAuthConfigureForm({
  slot,
  onSaved,
}: {
  slot: OAuthClientSlot;
  onSaved?: (status: OAuthClientPublicStatus) => void;
}) {
  const copy = SLOT_COPY[slot];
  const [status, setStatus] = useState<OAuthClientPublicStatus | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const st = await api.oauthClient(slot);
      setStatus(st);
      setRedirectUri(st.redirectUri);
      if (!st.configured) setOpen(true);
    } catch {
      setStatus(null);
    }
  }, [slot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const st = await api.putOAuthClient(slot, {
        clientId: clientId.trim() || undefined,
        clientSecret: clientSecret.trim() || undefined,
        redirectUri: redirectUri.trim() || undefined,
      });
      setStatus(st);
      setClientSecret('');
      setClientId('');
      onSaved?.(st);
      if (st.configured) setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      const st = await api.putOAuthClient(slot, { clear: true });
      setStatus(st);
      onSaved?.(st);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg bg-bg px-3 py-3 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-ink">{copy.title}</span>
        {status?.configured ? (
          <StatusPill tone="success">
            Secret saved{status.last4 ? ` · ••••${status.last4}` : ''}
            {status.source === 'env' ? ' · env' : ''}
          </StatusPill>
        ) : (
          <StatusPill tone="muted">Not configured</StatusPill>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto rounded-lg px-2.5 py-1 text-[12px] font-medium text-accent-ink ring-1 ring-line hover:bg-overlay/[0.04]"
        >
          {open ? 'Hide setup' : status?.configured ? 'Configure' : 'Set up'}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-[12px] text-muted">
            {copy.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="text-[11px] text-faint">
            Env override: <code className="text-ink">{copy.envHint}</code>. Redirect URI to register:
          </p>
          <code className="block break-all rounded bg-surface px-2 py-1.5 text-[11px] text-ink ring-1 ring-line">
            {status?.redirectUri ?? redirectUri}
          </code>
          {status?.source === 'env' ? (
            <p className="text-[12px] text-muted" role="status">
              Credentials come from server env — clear env vars to use in-app secrets instead.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[12px] font-medium text-muted">Client ID</span>
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={status?.clientIdHint ? `Saved ${status.clientIdHint}` : 'OAuth client id'}
                  className={`mt-1 ${inputClass}`}
                  autoComplete="off"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[12px] font-medium text-muted">Client secret</span>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={status?.last4 ? `••••${status.last4} — paste to replace` : 'Client secret'}
                  className={`mt-1 ${inputClass}`}
                  autoComplete="new-password"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[12px] font-medium text-muted">Redirect URI (optional override)</span>
                <input
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            </div>
          )}
          {err ? <p className="text-[12px] text-danger">{err}</p> : null}
          <div className="flex flex-wrap gap-2">
            {status?.source !== 'env' ? (
              <button
                type="button"
                disabled={busy || (!clientId.trim() && !status?.configured) || (!clientSecret.trim() && !status?.configured)}
                onClick={() => void save()}
                className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-2 disabled:opacity-40"
              >
                {busy ? 'Saving…' : 'Save secret'}
              </button>
            ) : null}
            {status?.configured && status.source === 'state' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void clear()}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.04]"
              >
                Clear saved secret
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
