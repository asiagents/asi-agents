import React from 'react';
import type { ChannelDraft } from '@asi-api';

const channelLabel: Record<ChannelDraft['channel'], string> = {
  gmail: 'Gmail',
  github: 'GitHub',
  telegram: 'Telegram',
};

type Props = {
  draft: ChannelDraft;
  onSend?: () => void;
  sending?: boolean;
  compact?: boolean;
};

export function ChannelDraftCard({ draft, onSend, sending, compact }: Props) {
  return (
    <li className="text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="font-medium text-ink">{draft.title}</div>
        <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted ring-1 ring-line">
          {channelLabel[draft.channel]}
        </span>
      </div>
      <div className="text-[12px] text-muted">
        To {draft.to || '—'} · {draft.meta}
      </div>
      {!compact && draft.body && <p className="mt-1 line-clamp-2 text-[12px] text-muted">{draft.body}</p>}
      {onSend && !draft.sent && (
        <button
          type="button"
          disabled={sending}
          className="mt-1 rounded-md bg-accent-strong px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-50"
          onClick={onSend}
        >
          Send by you
        </button>
      )}
    </li>
  );
}
