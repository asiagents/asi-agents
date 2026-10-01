import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConicalIcon } from 'lucide-react';
import { api } from '@asi-api';
import {
  DEFAULT_MAX_VIRTUAL_AGENTS,
  DEFAULT_RESEARCH_BRIEF,
  RESEARCH_DEPTH_OPTIONS,
  RESEARCH_FORMAT_OPTIONS,
  RESEARCH_SELECTION_OPTIONS,
  RESEARCH_TYPE_OPTIONS,
  isMultiAgentResearchType,
  type ResearchBriefValues,
  type ResearchDepth,
  type ResearchFormat,
  type ResearchSelection,
  type ResearchType,
} from '../../utils/researchBrief';

interface ResearchBriefSheetProps {
  open: boolean;
  question: string;
  agentLabel?: string;
  submitting?: boolean;
  /** Other briefs waiting behind this one. */
  queuedCount?: number;
  queuedQuestions?: string[];
  onConfirm: (brief: ResearchBriefValues) => void;
  onSkip: () => void;
  onCancel: () => void;
  onQueueAnother?: (question: string) => void;
}

type PoolPreview = {
  agents: { slotId: string; label: string; tier: string; angle: string }[];
  poolSize: number;
  usableCount: number;
  maxAgents: number;
  concurrency: number;
  usedPaid: boolean;
  ollamaReachable: boolean;
  openRouterConfigured: boolean;
  emptyReason?: string;
  defaultMaxVirtualAgents?: number;
};

function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-[12px] font-medium text-muted">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              title={o.hint}
              aria-pressed={on}
              onClick={() => onChange(o.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 ring-1 ${
                on
                  ? 'bg-accent/15 text-accent-ink ring-accent/40'
                  : 'bg-surface text-ink ring-line hover:bg-overlay/[0.04]'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Short sheet before Research runs — type, depth, selection, format, participate. */
export function ResearchBriefSheet({
  open,
  question,
  agentLabel = 'Research',
  submitting = false,
  queuedCount = 0,
  queuedQuestions = [],
  onConfirm,
  onSkip,
  onCancel,
  onQueueAnother,
}: ResearchBriefSheetProps) {
  const [brief, setBrief] = useState<ResearchBriefValues>(DEFAULT_RESEARCH_BRIEF);
  const [queueDraft, setQueueDraft] = useState('');
  const [poolPreview, setPoolPreview] = useState<PoolPreview | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);
  /** null = probing; true/false = Desk :3456 */
  const [deskLive, setDeskLive] = useState<boolean | null>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setBrief(DEFAULT_RESEARCH_BRIEF);
    setQueueDraft('');
    setPoolPreview(null);
    setDeskLive(null);
    const t = window.setTimeout(() => firstRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel, submitting, question]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void api
      .browserStatus()
      .then((s) => {
        if (cancelled) return;
        const live = s.ok === true && s.live !== false && s.deskLive !== false;
        setDeskLive(live);
        // Default Live web on when Desk is live; off when offline (user can still toggle).
        setBrief((b) => ({ ...b, liveWeb: live }));
      })
      .catch(() => {
        if (cancelled) return;
        setDeskLive(false);
        setBrief((b) => ({ ...b, liveWeb: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, question]);

  const multiAgent = isMultiAgentResearchType(brief.type);

  useEffect(() => {
    if (!open || !multiAgent) {
      setPoolPreview(null);
      return;
    }
    let cancelled = false;
    setPoolLoading(true);
    void api
      .researchPoolPreview({
        maxVirtualAgents: brief.maxVirtualAgents,
        mode: brief.type === 'predictive' ? 'predictive' : 'deep',
        preferFree: true,
      })
      .then((preview) => {
        if (!cancelled) setPoolPreview(preview);
      })
      .catch(() => {
        if (!cancelled) setPoolPreview(null);
      })
      .finally(() => {
        if (!cancelled) setPoolLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, multiAgent, brief.maxVirtualAgents, brief.type]);

  const addToQueue = () => {
    const q = queueDraft.trim();
    if (!q || !onQueueAnother || submitting) return;
    onQueueAnother(q);
    setQueueDraft('');
  };

  const startLabel = submitting
    ? multiAgent
      ? 'Running multi-agent research…'
      : 'Running research…'
    : brief.type === 'predictive'
      ? 'Start predictive research'
      : brief.type === 'deep'
        ? 'Start deep research'
        : 'Start research';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => !submitting && onCancel()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="research-brief-title"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card bg-surface p-5 shadow-xl ring-1 ring-line"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent-ink">
                <FlaskConicalIcon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="research-brief-title" className="text-[15px] font-semibold text-ink">
                  Research brief
                </h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  Set how {agentLabel} should work this question. Confirming creates tasks on{' '}
                  <span className="font-medium text-ink">Tasks</span>.
                </p>
              </div>
            </div>

            <p className="mt-4 rounded-lg bg-overlay/[0.04] px-3 py-2 text-[13px] leading-relaxed text-ink ring-1 ring-line">
              {question}
            </p>

            {queuedCount > 0 && (
              <div className="mt-3 rounded-lg bg-accent/[0.06] px-3 py-2 ring-1 ring-accent/25">
                <p className="text-[12px] font-medium text-accent-ink">
                  {queuedCount} more research{queuedCount === 1 ? '' : 'es'} queued
                </p>
                <ul className="mt-1 space-y-0.5">
                  {queuedQuestions.slice(0, 4).map((q, i) => (
                    <li key={`${i}-${q.slice(0, 24)}`} className="truncate text-[11px] text-muted">
                      {i + 1}. {q}
                    </li>
                  ))}
                  {queuedQuestions.length > 4 && (
                    <li className="text-[11px] text-faint">+{queuedQuestions.length - 4} more</li>
                  )}
                </ul>
                <p className="mt-1.5 text-[11px] text-muted">
                  Finish or cancel this brief to open the next — each creates its own task group on Tasks.
                </p>
              </div>
            )}

            <div className="mt-4 space-y-3.5">
              <ChoiceGroup
                legend="Type"
                options={RESEARCH_TYPE_OPTIONS}
                value={brief.type}
                onChange={(type: ResearchType) => setBrief((b) => ({ ...b, type }))}
              />
              <ChoiceGroup
                legend="How long / depth"
                options={RESEARCH_DEPTH_OPTIONS}
                value={brief.depth}
                onChange={(depth: ResearchDepth) => setBrief((b) => ({ ...b, depth }))}
              />
              <ChoiceGroup
                legend="How answers are chosen"
                options={RESEARCH_SELECTION_OPTIONS}
                value={brief.selection}
                onChange={(selection: ResearchSelection) => setBrief((b) => ({ ...b, selection }))}
              />
              <ChoiceGroup
                legend="Report format"
                options={RESEARCH_FORMAT_OPTIONS}
                value={brief.format}
                onChange={(format: ResearchFormat) => setBrief((b) => ({ ...b, format }))}
              />

              {multiAgent && (
                <fieldset className="min-w-0 rounded-lg bg-overlay/[0.03] p-3 ring-1 ring-line">
                  <legend className="px-1 text-[12px] font-medium text-muted">
                    Virtual agents (model pool)
                  </legend>
                  <label className="mt-1 flex items-center justify-between gap-3 text-[13px] text-ink">
                    <span>Max concurrent agents</span>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      disabled={submitting}
                      value={brief.maxVirtualAgents}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setBrief((b) => ({
                          ...b,
                          maxVirtualAgents: Number.isFinite(n)
                            ? Math.min(16, Math.max(1, Math.floor(n)))
                            : DEFAULT_MAX_VIRTUAL_AGENTS,
                        }));
                      }}
                      className="w-16 rounded-md bg-bg px-2 py-1 text-right text-[13px] ring-1 ring-line focus:outline-none focus:ring-accent/40 disabled:opacity-40"
                    />
                  </label>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">
                    {poolLoading
                      ? 'Resolving Free OpenRouter + live Ollama from your saved model pool…'
                      : poolPreview
                        ? poolPreview.agents.length > 0
                          ? `Will use ${poolPreview.agents.length} of ${poolPreview.usableCount} usable model(s) ` +
                            `(pool ${poolPreview.poolSize}, concurrency ${poolPreview.concurrency}` +
                            `${poolPreview.usedPaid ? ', includes paid' : ', free/local preferred'}` +
                            `). Ollama ${poolPreview.ollamaReachable ? 'up' : 'down'}; OpenRouter key ${
                              poolPreview.openRouterConfigured ? 'set' : 'missing'
                            }.`
                          : poolPreview.emptyReason ??
                            'No usable virtual agents — add Free OpenRouter / Ollama models to the pool, or start Ollama.'
                        : 'Could not load pool preview — is the API on :3445 online? Start the server and retry.'}
                  </p>
                  {poolPreview && poolPreview.agents.length > 0 && (
                    <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                      {poolPreview.agents.map((a) => (
                        <li key={a.slotId} className="truncate text-[11px] text-faint" title={a.angle}>
                          <span className="font-medium text-muted">{a.label}</span>
                          <span className="text-faint"> · {a.tier}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </fieldset>
              )}

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-line accent-current"
                  checked={brief.liveWeb}
                  onChange={(e) => setBrief((b) => ({ ...b, liveWeb: e.target.checked }))}
                />
                <span>
                  <span className="block text-[13px] font-medium text-ink">Live web (Virtual Desk)</span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    Fetch real pages via Desk on :3456 when live.
                  </span>
                  <span
                    className={`mt-1 inline-block text-[11px] font-medium ${
                      deskLive === true
                        ? 'text-accent-ink'
                        : deskLive === false
                          ? 'text-faint'
                          : 'text-muted'
                    }`}
                  >
                    {deskLive === null
                      ? 'Checking Desk on :3456…'
                      : deskLive
                        ? 'Desk live — Live web default ON'
                        : 'Desk offline — Live web skipped (default OFF)'}
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-line accent-current"
                  checked={brief.participate}
                  onChange={(e) => setBrief((b) => ({ ...b, participate: e.target.checked }))}
                />
                <span>
                  <span className="block text-[13px] font-medium text-ink">I will participate</span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    Add notes, votes, and answers to prompts — agents see your input in the thread.
                  </span>
                </span>
              </label>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-faint">
              {multiAgent
                ? 'Deep / predictive runs fan-out gather across capped virtual agents from your model pool, then draft + report on the Research agent. '
                : 'On start, Research runs gather → draft → report via your configured model. '}
              {brief.liveWeb
                ? deskLive === false
                  ? 'Live web on but Desk offline — will skip with a short note.'
                  : 'Live web on — Desk browser fetches pages when available.'
                : 'Live web off — model knowledge only (one-line note).'}
              {brief.type === 'predictive'
                ? ' Predictive output is scenario rehearsal, not a calibrated forecast.'
                : ''}{' '}
              Needs a working LLM on :3445 (fail-closed if none answers). Report posts to this chat and Tasks.
            </p>

            {onQueueAnother && (
              <div className="mt-4 rounded-lg bg-overlay/[0.03] p-3 ring-1 ring-line">
                <p className="text-[12px] font-medium text-ink">Queue another research</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Starts a separate task group after you finish this brief.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={queueDraft}
                    disabled={submitting}
                    onChange={(e) => setQueueDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addToQueue();
                      }
                    }}
                    placeholder="Next question…"
                    className="min-w-0 flex-1 rounded-md bg-bg px-2.5 py-1.5 text-[13px] text-ink ring-1 ring-line focus:outline-none focus:ring-accent/40 disabled:opacity-40"
                  />
                  <button
                    type="button"
                    disabled={submitting || !queueDraft.trim()}
                    onClick={addToQueue}
                    className="shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-accent-ink ring-1 ring-accent/30 hover:bg-accent/10 disabled:opacity-40"
                  >
                    Queue
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                ref={firstRef}
                type="button"
                disabled={submitting}
                onClick={onCancel}
                className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onSkip}
                className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40"
              >
                Skip brief
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => onConfirm(brief)}
                className="rounded-lg bg-accent-strong px-3.5 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-40"
              >
                {startLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
