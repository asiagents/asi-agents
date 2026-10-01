import React, { useState } from 'react';
import { GavelIcon, SparklesIcon } from 'lucide-react';

/** User-moderator decide UI: top 3 + verdict; optional Chief draft. */
export function ConcludePanel({
  busy,
  draftBusy,
  error,
  onCancel,
  onAskDraft,
  onSubmit,
}: {
  busy: boolean;
  draftBusy: boolean;
  error?: string | null;
  onCancel: () => void;
  onAskDraft: () => Promise<string | null>;
  onSubmit: (payload: { shortlist: string[]; verdict: string }) => void;
}) {
  const [pick1, setPick1] = useState('');
  const [pick2, setPick2] = useState('');
  const [pick3, setPick3] = useState('');
  const [verdict, setVerdict] = useState('');

  const applyDraft = async () => {
    const draft = await onAskDraft();
    if (draft) setVerdict(draft);
  };

  return (
    <div className="border-t border-line bg-surface px-4 py-3 md:px-5" role="region" aria-label="Your Final decision">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-center gap-2">
          <GavelIcon size={14} className="text-accent-ink" aria-hidden="true" />
          <p className="text-[13px] font-semibold text-ink">You are moderating — post a Final</p>
        </div>
        <p className="mb-3 text-[12px] text-muted">
          Pick up to three options from the debate, write your verdict, then post Final. Synthesis is best-effort —
          edit freely.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            [pick1, setPick1, 'Top pick 1'],
            [pick2, setPick2, 'Top pick 2'],
            [pick3, setPick3, 'Top pick 3'],
          ].map(([value, setValue, label], i) => (
            <label key={i} className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">{label as string}</span>
              <input
                value={value as string}
                onChange={(e) => (setValue as (v: string) => void)(e.target.value)}
                disabled={busy}
                className="w-full rounded-md bg-bg px-2.5 py-1.5 text-[13px] text-ink ring-1 ring-line placeholder:text-faint focus:outline-none focus:ring-accent/40"
                placeholder={`Option ${i + 1}`}
              />
            </label>
          ))}
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-medium text-muted">Verdict</span>
          <textarea
            value={verdict}
            onChange={(e) => setVerdict(e.target.value)}
            disabled={busy}
            rows={4}
            placeholder="Your Final answer…"
            className="w-full resize-y rounded-md bg-bg px-2.5 py-2 text-[13px] leading-relaxed text-ink ring-1 ring-line placeholder:text-faint focus:outline-none focus:ring-accent/40"
          />
        </label>
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || draftBusy || !verdict.trim()}
            onClick={() =>
              onSubmit({
                shortlist: [pick1, pick2, pick3],
                verdict: verdict.trim(),
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-strong px-3.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
          >
            <GavelIcon size={13} aria-hidden="true" />
            {busy ? 'Posting…' : 'Post Final'}
          </button>
          <button
            type="button"
            disabled={busy || draftBusy}
            onClick={() => void applyDraft()}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.04] disabled:opacity-40"
          >
            <SparklesIcon size={13} aria-hidden="true" />
            {draftBusy ? 'Drafting…' : 'Ask Chief to draft'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-full px-3 py-1.5 text-[12px] font-medium text-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
