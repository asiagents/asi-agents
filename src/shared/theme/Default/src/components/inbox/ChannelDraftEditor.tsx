import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ChannelDraft } from '@asi-api';

type Props = {
  draft: ChannelDraft;
  onPatch: (id: string, patch: Partial<Pick<ChannelDraft, 'body' | 'title' | 'to' | 'meta'>>) => Promise<ChannelDraft>;
  onSend: (id: string) => Promise<{ message: string }>;
};

export function ChannelDraftEditor({ draft, onPatch, onSend }: Props) {
  const [body, setBody] = useState(draft.body);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBody(draft.body);
    setDirty(false);
  }, [draft.id, draft.body]);

  const save = async () => {
    setBusy(true);
    try {
      await onPatch(draft.id, { body });
      setDirty(false);
      toast.success('Draft saved');
    } catch {
      toast.error('Could not save draft');
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      if (dirty) await onPatch(draft.id, { body });
      const r = await onSend(draft.id);
      toast.success(r.message);
    } catch {
      toast.error('Send failed');
    } finally {
      setBusy(false);
    }
  };

  if (draft.sent) {
    return (
      <div className="rounded-card bg-surface p-5 ring-1 ring-line">
        <p className="text-sm text-muted">Sent — nothing else to do here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-card bg-surface p-5 ring-1 ring-line">
      <h2 className="text-lg font-semibold text-ink">{draft.title}</h2>
      <p className="mt-1 text-[13px] text-muted">{draft.meta}</p>
      <p className="mt-2 text-[13px] text-muted">
        To · <span className="font-medium text-ink">{draft.to || '—'}</span>
      </p>
      <label htmlFor={`draft-body-${draft.id}`} className="mt-4 block text-[12px] font-medium text-faint">
        Message
      </label>
      <textarea
        id={`draft-body-${draft.id}`}
        rows={8}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setDirty(e.target.value !== draft.body);
        }}
        className="mt-1 w-full resize-y rounded-lg bg-bg p-3 text-sm text-ink outline-none ring-1 ring-line focus:ring-accent/60"
      />
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => void save()}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line disabled:opacity-40"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={busy || !body.trim()}
          onClick={() => void send()}
          className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
        >
          Send by you
        </button>
      </div>
    </div>
  );
}
