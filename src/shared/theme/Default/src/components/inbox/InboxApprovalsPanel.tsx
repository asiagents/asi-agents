import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlertIcon } from 'lucide-react';
import { api } from '@asi-api';
import { useChannelDrafts } from '../../hooks/useChannelDrafts';
import { ChannelDraftCard } from './ChannelDraftCard';

type Perm = { id: string; title: string; description: string; status: string };

/** Approvals tab — permissions from API; full page opens in a new tab. */
export function InboxApprovalsPanel() {
  const { drafts, error: draftsErr, refresh: refreshDrafts, send } = useChannelDrafts();
  const [perms, setPerms] = useState<Perm[]>([]);
  const [permsErr, setPermsErr] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const refreshPerms = useCallback(async () => {
    try {
      const p = await api.permissions();
      setPerms(p.items ?? []);
      setPermsErr(null);
    } catch {
      setPermsErr('Permissions offline — is :3445 up?');
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshDrafts(), refreshPerms()]);
  }, [refreshDrafts, refreshPerms]);

  useEffect(() => {
    void refreshPerms();
  }, [refreshPerms]);

  const pendingPerms = perms.filter((p) => p.status === 'pending');
  const openDrafts = drafts.filter((d) => !d.sent);
  const liveErr = draftsErr ?? permsErr;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlertIcon size={14} className="text-accent-ink" aria-hidden="true" />
        <span className="text-[13px] font-medium text-ink">Permissions & channel drafts</span>
        <a href="/permissions" target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-accent-ink hover:underline">
          Open permissions in new tab
        </a>
        <Link to="/channels" className="text-[12px] font-medium text-accent-ink hover:underline">
          Channels
        </Link>
        <button type="button" onClick={() => void refreshAll()} className="ml-auto text-[12px] font-medium text-accent-ink hover:underline">
          Refresh
        </button>
      </div>
      {liveErr && <p className="text-[12px] text-danger">{liveErr}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-card bg-surface p-3 ring-1 ring-line">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-faint">Permissions</h2>
            <a href="/permissions" target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent-ink hover:underline">
              Open
            </a>
          </div>
          {pendingPerms.length === 0 ? (
            <p className="text-[13px] text-muted">No pending asks.</p>
          ) : (
            <ul className="space-y-2">
              {pendingPerms.map((p) => (
                <li key={p.id} className="text-[13px] text-ink">
                  <div className="font-medium">{p.title}</div>
                  <div className="text-[12px] text-muted">{p.description}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-accent-strong px-2 py-0.5 text-[11px] font-medium text-white"
                      onClick={async () => {
                        await api.permAction(p.id, 'approve');
                        await refreshPerms();
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2 py-0.5 text-[11px] font-medium text-danger ring-1 ring-line"
                      onClick={async () => {
                        await api.permAction(p.id, 'deny');
                        await refreshPerms();
                      }}
                    >
                      Deny
                    </button>
                    <a href="/permissions" target="_blank" rel="noopener noreferrer" className="self-center text-[11px] text-accent-ink hover:underline">
                      Details ↗
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-card bg-surface p-3 ring-1 ring-line">
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-faint">Channel drafts</h2>
          {openDrafts.length === 0 ? (
            <p className="text-[13px] text-muted">No unsent drafts.</p>
          ) : (
            <ul className="space-y-2">
              {openDrafts.map((d) => (
                <ChannelDraftCard
                  key={d.id}
                  draft={d}
                  sending={sendingId === d.id}
                  onSend={async () => {
                    setSendingId(d.id);
                    try {
                      await send(d.id);
                    } finally {
                      setSendingId(null);
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
