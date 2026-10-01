import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MailIcon, PlusIcon, RefreshCwIcon, Settings2Icon, XIcon } from 'lucide-react';
import { api, type InboxEmailMessage, type InboxEmailStatus } from '@asi-api';
import { EmailSetup } from '../components/inbox/EmailSetup';
import { EmailView } from '../components/inbox/EmailView';
import { InboxApprovalsPanel } from '../components/inbox/InboxApprovalsPanel';
import { inboxSetupHint } from '../data/inbox';
import { PlanningSetupEmpty } from './PlanningSetupEmpty';

type InboxTab = 'emails' | 'approvals';

const tabBtn = (active: boolean) =>
  `rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
    active ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'
  }`;

export function Inbox() {
  const [tab, setTab] = useState<InboxTab>('emails');
  const [status, setStatus] = useState<InboxEmailStatus | null>(null);
  const [messages, setMessages] = useState<InboxEmailMessage[]>([]);
  const [mailErr, setMailErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [read, setRead] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const refreshMail = useCallback(async () => {
    setLoading(true);
    try {
      const st = await api.inboxEmailStatus();
      setStatus(st);
      if (!st.configured) {
        setMessages([]);
        setMailErr(st.setup ?? null);
        return;
      }
      const payload = await api.inboxEmailMessages();
      setMessages(payload.messages);
      if (payload.error === 'not_implemented') {
        setMailErr(payload.setup ?? payload.message ?? 'Gmail OAuth is not available yet.');
      } else if (payload.error) {
        setMailErr(payload.message ?? 'Could not load mail from the server.');
      } else {
        setMailErr(null);
      }
    } catch {
      setStatus(null);
      // Keep any already-loaded mail; only flag offline.
      setMailErr('Inbox mail API offline — is the server running on :3445?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'emails') void refreshMail();
  }, [tab, refreshMail]);

  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? messages[0],
    [messages, selectedId]
  );

  const header = (
    <div className="shrink-0 border-b border-line bg-surface px-4 py-3 md:px-5">
      <div role="tablist" aria-label="Inbox sections" className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-[15px] font-semibold text-ink">Inbox</h1>
        <button type="button" role="tab" aria-selected={tab === 'emails'} onClick={() => setTab('emails')} className={tabBtn(tab === 'emails')}>
          Emails
        </button>
        <button type="button" role="tab" aria-selected={tab === 'approvals'} onClick={() => setTab('approvals')} className={tabBtn(tab === 'approvals')}>
          Approvals
        </button>
      </div>
    </div>
  );

  if (tab === 'approvals') {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto pb-32">
        {header}
        <div className="min-h-0 flex-1 px-4 py-4 md:px-6">
          <InboxApprovalsPanel />
        </div>
      </div>
    );
  }

  if (loading && !status) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto pb-32">
        {header}
        <p className="px-4 py-8 text-[13px] text-muted md:px-10">Loading mail status…</p>
      </div>
    );
  }

  if (!status?.configured) {
    const hint = mailErr ?
      { ...inboxSetupHint, lead: mailErr } :
      status?.gmailOAuthReady ?
        {
          ...inboxSetupHint,
          lead: 'Gmail OAuth env is ready on :3445 — sign in below, or use an IMAP / app-password connection. No demo mail is shown.',
        } :
        inboxSetupHint;
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto pb-32">
        {header}
        <div className="px-4 pt-8 md:px-10">
          <div className="max-w-3xl space-y-6">
            <PlanningSetupEmpty hint={hint} icon={MailIcon} />
            <div>
              <h3 className="mb-2 text-[13px] font-medium text-ink">Connect here</h3>
              <EmailSetup onDone={() => void refreshMail()} />
            </div>
            <button type="button" onClick={() => void refreshMail()} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-ink hover:underline">
              <RefreshCwIcon size={14} aria-hidden="true" /> Retry status
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div className="grid min-h-0 flex-1 w-full md:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-line bg-surface" aria-label="Messages">
          <div className="flex items-center gap-2 px-4 pb-2 pt-4">
            <span className="text-[12px] text-faint">{status.label ?? status.address ?? 'Connected'}</span>
            <button
              type="button"
              onClick={() => void refreshMail()}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent/10"
            >
              <RefreshCwIcon size={13} aria-hidden="true" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent/10"
            >
              <PlusIcon size={13} aria-hidden="true" /> Add
            </button>
            <Link
              to="/settings/connections#email"
              aria-label="Manage email connection"
              className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-overlay/[0.05] hover:text-ink"
            >
              <Settings2Icon size={14} aria-hidden="true" />
            </Link>
          </div>
          {mailErr && <p className="px-4 pb-2 text-[12px] text-danger">{mailErr}</p>}
          <ul className="min-h-0 flex-1 overflow-y-auto border-t border-line pb-24">
            {messages.length === 0 ? (
              <li className="px-4 py-8 text-[13px] text-muted">
                Connected, but this mailbox has no messages to show (or IMAP could not list them). Nothing is invented — check credentials and server logs if you expected mail.
              </li>
            ) : (
              messages.map((e) => {
                const unread = e.unread && !read.includes(e.id);
                const active = e.id === selected?.id && !adding;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(e.id);
                        setAdding(false);
                        setRead((r) => [...r, e.id]);
                      }}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full border-b border-line px-4 py-3 text-left transition-colors duration-150 ${active ? 'bg-accent/10' : 'hover:bg-overlay/[0.04]'}`}
                    >
                      <div className="flex items-center gap-2">
                        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                        <span className={`truncate text-[14px] ${unread ? 'font-semibold text-ink' : 'text-ink'}`}>{e.from}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-faint">{e.time}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[13px] text-ink">{e.subject}</div>
                      <div className="mt-0.5 truncate text-[12px] text-muted">{e.body.split('\n').filter(Boolean)[0] ?? ''}</div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>
        {adding ? (
          <section aria-label="Add email profile" className="min-h-0 overflow-y-auto px-5 pb-28 pt-5 md:px-8">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">Add another email profile</h2>
              <button type="button" onClick={() => setAdding(false)} aria-label="Close" className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-overlay/[0.05] hover:text-ink">
                <XIcon size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="max-w-3xl">
              <EmailSetup onDone={() => setAdding(false)} />
            </div>
          </section>
        ) : selected ? (
          <EmailView email={selected} />
        ) : (
          <div className="p-8 text-sm text-muted">
            <p>No mail loaded yet.</p>
            <Link to="/settings/connections#email" className="mt-2 inline-block font-medium text-accent-ink hover:underline">
              Configure email in Settings
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
