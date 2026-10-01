import React, { useMemo, useState } from 'react';
import { PageHeader, PageScroll } from '../components/PageScroll';
import { ChannelDraftEditor } from '../components/inbox/ChannelDraftEditor';
import { useChannelDrafts } from '../hooks/useChannelDrafts';

export function Channels() {
  const { drafts, loading, error, refresh, patch, send } = useChannelDrafts();
  const open = useMemo(() => drafts.filter((d) => !d.sent), [drafts]);
  const sent = useMemo(() => drafts.filter((d) => d.sent), [drafts]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = open.find((d) => d.id === activeId) ?? open[0] ?? null;

  return (
    <PageScroll width="max-w-[960px]">
      <PageHeader
        title="Channels"
        description="Draft-first outbound. Nothing posts until you send from here or the Inbox strip."
        actions={
          <button type="button" onClick={() => void refresh()} className="text-[13px] font-medium text-accent-ink hover:underline">
            Refresh
          </button>
        }
      />
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-muted">Loading drafts…</p>}
      {!loading && open.length === 0 && sent.length === 0 && (
        <p className="rounded-card bg-surface p-5 text-sm text-muted ring-1 ring-line">
          No channel drafts yet. When agents queue Gmail, GitHub, or Telegram messages, they appear here for your approval.
        </p>
      )}
      {open.length > 0 && (
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <ul className="space-y-1 rounded-card bg-surface p-2 ring-1 ring-line" aria-label="Open drafts">
            {open.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(d.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                    active?.id === d.id ? 'bg-accent/15 text-accent-ink' : 'text-ink hover:bg-overlay/[0.04]'
                  }`}
                >
                  <div className="font-medium">{d.title}</div>
                  <div className="text-[11px] text-muted">{d.channel}</div>
                </button>
              </li>
            ))}
          </ul>
          {active && (
            <ChannelDraftEditor
              draft={active}
              onPatch={async (id, body) => patch(id, body)}
              onSend={async (id) => {
                const r = await send(id);
                return { message: r.message };
              }}
            />
          )}
        </div>
      )}
      {sent.length > 0 && (
        <section className="mt-8" aria-labelledby="sent-drafts">
          <h2 id="sent-drafts" className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-faint">
            Sent
          </h2>
          <ul className="space-y-2 text-[13px] text-muted">
            {sent.map((d) => (
              <li key={d.id} className="rounded-lg bg-surface px-3 py-2 ring-1 ring-line">
                {d.title} · {d.channel}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageScroll>
  );
}
