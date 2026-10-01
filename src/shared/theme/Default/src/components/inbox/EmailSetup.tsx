import React, { useEffect, useState } from 'react';
import { InboxIcon, MailIcon } from 'lucide-react';
import { usePrefs } from '../../contexts/PrefsContext';
import { useNotifications } from '../../contexts/NotificationContext';
import type { EmailKind } from '../../types/settings';

/** Choosable kinds only — POP3 is not on the API; keep it out of the UI. */
const methods: { id: Exclude<EmailKind, 'pop3'>; label: string; detail: string; icon: typeof MailIcon }[] = [
  { id: 'gmail', label: 'Gmail', detail: 'OAuth or app password', icon: MailIcon },
  { id: 'imap', label: 'IMAP', detail: 'Any provider', icon: InboxIcon },
];

const field =
  'w-full rounded-lg bg-bg px-3 py-2 text-sm text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60';

/** Saves one server mail connection via PUT /api/inbox/email/connection (or Gmail OAuth when configured). */
export function EmailSetup({ onDone }: { onDone?: () => void }) {
  const { addEmailProfile, emailProfiles, gmailOAuthReady } = usePrefs();
  const { notify } = useNotifications();
  const [method, setMethod] = useState<Exclude<EmailKind, 'pop3'>>('gmail');
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('993');
  const [password, setPassword] = useState('');
  const [gmailAuth, setGmailAuth] = useState<'oauth' | 'password'>(gmailOAuthReady ? 'oauth' : 'password');
  const [connecting, setConnecting] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    if (!gmailOAuthReady && gmailAuth === 'oauth') setGmailAuth('password');
  }, [gmailOAuthReady, gmailAuth]);

  const addressValid = /.+@.+\..+/.test(address.trim());
  const duplicate = emailProfiles.some((p) => p.address.toLowerCase() === address.trim().toLowerCase());
  const gmailOAuth = method === 'gmail' && gmailAuth === 'oauth' && gmailOAuthReady;
  const gmailPassword = method === 'gmail' && (gmailAuth === 'password' || !gmailOAuthReady);
  const imapValid = method === 'imap' && host.trim().length > 3 && password.trim().length > 0;
  const gmailPassValid = gmailPassword && password.trim().length > 0;
  const valid = addressValid && !duplicate && (gmailOAuth || gmailPassValid || imapValid);

  const connect = async () => {
    if (!valid || connecting) return;
    setConnecting(true);
    setFormErr(null);
    try {
      const name = label.trim() || (method === 'gmail' ? 'Gmail' : method.toUpperCase());
      if (method === 'gmail' && gmailOAuth) {
        await addEmailProfile({
          kind: 'gmail',
          label: name,
          address: address.trim(),
          useOAuth: true,
        });
        return;
      }
      await addEmailProfile({
        kind: method === 'gmail' ? 'gmail' : 'imap',
        label: name,
        address: address.trim(),
        password: password.trim(),
        host: method === 'imap' ? host.trim() : 'imap.gmail.com',
        port: Number(port) || 993,
        secure: true,
      });
      notify({
        kind: 'mail',
        title: `${name} saved on server`,
        detail: 'Inbox will load mail when IMAP credentials are valid.',
        to: '/inbox',
      });
      setLabel('');
      setAddress('');
      setHost('');
      setPassword('');
      onDone?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save email connection';
      setFormErr(msg);
      notify({ kind: 'mail', title: 'Email connection failed', detail: msg });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="rounded-card bg-surface ring-1 ring-line">
      <div role="tablist" aria-label="Email type" className="grid grid-cols-2 border-b border-line">
        {methods.map((m) => (
          <button
            key={m.id}
            role="tab"
            type="button"
            aria-selected={method === m.id}
            onClick={() => setMethod(m.id)}
            className={`flex items-center justify-center gap-2 px-3 py-3 text-[13px] font-medium transition-colors duration-150 ${
              method === m.id ? 'bg-accent/10 text-accent-ink' : 'text-muted hover:text-ink'
            }`}
          >
            <m.icon size={15} aria-hidden="true" /> {m.label}
            <span className="hidden text-[11px] font-normal text-faint sm:inline">· {m.detail}</span>
          </button>
        ))}
      </div>
      <form
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void connect();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Profile name</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={method === 'gmail' ? 'Personal Gmail' : 'College mail'}
              className={`mt-1 ${field}`}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Email address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={method === 'gmail' ? 'maya.r@gmail.com' : 'maya@1234tech.edu'}
              aria-invalid={duplicate}
              className={`mt-1 ${field} ${duplicate ? 'ring-danger' : ''}`}
            />
            {duplicate && <span className="mt-1 block text-[12px] text-danger">That address is already connected.</span>}
          </label>

          {method === 'gmail' && (
            <>
              {gmailOAuthReady ? (
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setGmailAuth('oauth')}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ring-1 ring-line ${
                      gmailAuth === 'oauth' ? 'bg-accent/10 text-accent-ink' : 'text-muted'
                    }`}
                  >
                    Sign in with Google
                  </button>
                  <button
                    type="button"
                    onClick={() => setGmailAuth('password')}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ring-1 ring-line ${
                      gmailAuth === 'password' ? 'bg-accent/10 text-accent-ink' : 'text-muted'
                    }`}
                  >
                    App password (IMAP)
                  </button>
                </div>
              ) : null}
              {gmailOAuthReady && gmailAuth === 'oauth' && (
                <p className="sm:col-span-2 text-[11px] text-faint">
                  Starts <code className="text-ink">/api/inbox/email/oauth/start</code> and returns to Settings → Connections on success.
                </p>
              )}
              {gmailPassword && (
                <label className="block sm:col-span-2">
                  <span className="text-[12px] font-medium text-muted">Gmail app password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="16-character app password"
                    className={`mt-1 ${field}`}
                  />
                </label>
              )}
            </>
          )}

          {method === 'imap' && (
            <>
              <label className="block">
                <span className="text-[12px] font-medium text-muted">Server</span>
                <input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="imap.1234tech.edu"
                  className={`mt-1 ${field}`}
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-muted">Port</span>
                <input value={port} onChange={(e) => setPort(e.target.value)} className={`mt-1 ${field}`} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[12px] font-medium text-muted">App password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Stored on the server in app-state"
                  className={`mt-1 ${field}`}
                />
              </label>
            </>
          )}
        </div>
        <p className="mt-4 text-[12px] text-muted">
          Credentials are stored on :3445 (<code className="text-ink">mailConnection</code> in app-state). Server{' '}
          <code className="text-ink">ASI_IMAP_*</code> env overrides saved settings. Nothing sends without Approvals.
        </p>
        {formErr && <p className="mt-2 text-[12px] text-danger">{formErr}</p>}
        <button
          type="submit"
          disabled={connecting || !valid}
          className="mt-4 rounded-lg bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-40"
        >
          {connecting
            ? 'Connecting…'
            : gmailOAuth
              ? 'Sign in with Google'
              : method === 'gmail'
                ? 'Save Gmail (IMAP)'
                : `Save ${method.toUpperCase()}`}
        </button>
      </form>
    </div>
  );
}
