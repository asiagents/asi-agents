import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { InboxIcon, MailIcon, ServerIcon, Trash2Icon } from 'lucide-react';
import { usePrefs } from '../../contexts/PrefsContext';
import type { EmailKind } from '../../types/settings';

const kindIcon: Record<EmailKind, typeof MailIcon> = { gmail: MailIcon, imap: InboxIcon, pop3: ServerIcon };

/** Server-backed mail connection (single profile). */
export function EmailProfileList() {
  const { emailProfiles, removeEmailProfile, refreshEmailConnection, gmailOAuthReady } = usePrefs();
  const [busy, setBusy] = useState<string | null>(null);

  if (emailProfiles.length === 0) {
    return (
      <div className="rounded-card bg-surface p-4 ring-1 ring-line">
        <p className="text-sm font-medium text-ink">No email connection on the server</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Inbox stays empty until you connect — nothing is invented. Pick one path:
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13px] text-muted">
          <li>
            Use <span className="font-medium text-ink">Add email profile</span> below with a Gmail app password or IMAP host.
          </li>
          <li>
            Or set <code className="text-ink">ASI_IMAP_HOST</code>, <code className="text-ink">ASI_IMAP_USER</code>,{' '}
            <code className="text-ink">ASI_IMAP_PASS</code> on :3445 and restart the server.
          </li>
          {gmailOAuthReady ? (
            <li>
              Gmail OAuth: <span className="text-success">server keys detected</span> — choose Sign in with Google in
              the form.
            </li>
          ) : null}
        </ol>
        <p className="mt-3 text-[12px] text-faint">
          After connecting, open{' '}
          <Link to="/inbox" className="font-medium text-accent-ink hover:underline">
            Inbox
          </Link>{' '}
          to load live mail.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
      {emailProfiles.map((p) => {
        const Icon = kindIcon[p.kind];
        const pending = p.id.includes('pending');
        return (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-ink">
              <Icon size={15} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-ink">{p.label}</span>
                <span className="shrink-0 rounded-full bg-overlay/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">{p.kind}</span>
                {pending && (
                  <span className="shrink-0 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold text-warn">Sign-in needed</span>
                )}
              </div>
              <div className="truncate text-[12px] text-muted">{p.address}</div>
            </div>
            <button
              type="button"
              disabled={busy === p.id}
              onClick={() => {
                setBusy(p.id);
                void removeEmailProfile(p.id)
                  .then(() => refreshEmailConnection())
                  .finally(() => setBusy(null));
              }}
              aria-label={`Remove ${p.label}`}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger disabled:opacity-40"
            >
              <Trash2Icon size={14} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
