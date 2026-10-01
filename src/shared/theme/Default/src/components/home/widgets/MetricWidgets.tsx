import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { BarDiagram } from './BarDiagram';
import { useHomeMetrics, type FailInspectItem, type SuccessInspectItem } from '../../../hooks/useHomeMetrics';
import type { WidgetSize } from '../../../types/settings';

function WidgetLoading() {
  return <p className="text-[13px] text-ink/80">Loading…</p>;
}

function formatWhen(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function OutcomesInspectDialog({
  open,
  kind,
  fails,
  successes,
  onClose,
}: {
  open: boolean;
  kind: 'fail' | 'success' | null;
  fails: FailInspectItem[];
  successes: SuccessInspectItem[];
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const title = kind === 'fail' ? 'Fail inspect' : kind === 'success' ? 'Success inspect' : '';
  const emptyFail = 'No fail-closed chat replies yet — nothing to inspect.';
  const emptyOk = 'No completed tasks yet — nothing to inspect.';

  return (
    <AnimatePresence>
      {open && kind && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="outcomes-inspect-title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[min(80vh,560px)] w-full max-w-lg flex-col rounded-card bg-surface shadow-xl ring-1 ring-line"
          >
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <h2 id="outcomes-inspect-title" className="mr-auto text-[15px] font-semibold text-ink">
                {title}
              </h2>
              <Link
                to={kind === 'fail' ? '/settings/audits#patterns' : '/tasks'}
                className="text-[12px] font-medium text-accent-ink hover:underline"
                onClick={onClose}
              >
                {kind === 'fail' ? 'Audits · patterns →' : 'Tasks →'}
              </Link>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted ring-1 ring-line hover:text-ink"
              >
                <XIcon size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {kind === 'fail' ? (
                fails.length === 0 ? (
                  <p className="text-sm text-muted">{emptyFail}</p>
                ) : (
                  <ul className="space-y-3">
                    {fails.map((f) => (
                      <li key={f.id} className="rounded-lg bg-bg px-3 py-2.5 ring-1 ring-line">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-[13px] font-semibold text-danger">{f.agentLabel}</span>
                          {f.at ? (
                            <span className="text-[11px] tabular-nums text-muted">{formatWhen(f.at)}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[13px] leading-snug text-ink">{f.reason}</p>
                        {f.text !== f.reason ? (
                          <p className="mt-1 line-clamp-3 text-[12px] text-muted">{f.text}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )
              ) : successes.length === 0 ? (
                <p className="text-sm text-muted">{emptyOk}</p>
              ) : (
                <ul className="space-y-2">
                  {successes.map((s) => (
                    <li key={s.id} className="rounded-lg bg-bg px-3 py-2.5 ring-1 ring-line">
                      <p className="text-[13px] font-medium text-ink">{s.title}</p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {s.agentLabel ? `${s.agentLabel}` : 'Task'}
                        {s.at ? ` · due ${formatWhen(s.at)}` : ' · completed'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
              {kind === 'fail'
                ? 'Fail = fail-closed chat / generate blocks from live threads (honest empty if none).'
                : 'Success = completed tasks from /api/tasks.'}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Recent generates / chat runs by day (or by agent on L). */
export function RunActivityWidget({ size }: { size: WidgetSize }) {
  const { loading, runsByDay, runsByAgent, error } = useHomeMetrics();

  if (loading) return <WidgetLoading />;

  const byAgent = size === 'L' && runsByAgent.length > 0;
  const dayRows = size === 'L' ? runsByDay : runsByDay.slice(-5);
  const data = byAgent
    ? runsByAgent.slice(0, 8).map((r) => ({
        key: r.agentId,
        label: r.label,
        value: r.count,
        colorClass: 'bg-accent',
      }))
    : dayRows.map((d) => ({
        key: d.day,
        label: d.label,
        value: d.count,
        colorClass: 'bg-accent',
      }));

  const total = byAgent
    ? data.reduce((s, d) => s + d.value, 0)
    : runsByDay.reduce((s, d) => s + d.count, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <p className="shrink-0 text-[12px] font-medium leading-snug text-ink">
        {error ? (
          <span className="text-warn">{error}</span>
        ) : total === 0 ? (
          <span className="text-ink/80">No chat runs in the last 7 days</span>
        ) : byAgent ? (
          <>
            <span className="font-semibold tabular-nums">{total}</span>
            <span className="text-ink/85"> runs by agent</span>
          </>
        ) : (
          <>
            <span className="font-semibold tabular-nums">{total}</span>
            <span className="text-ink/85"> runs · last 7 days</span>
          </>
        )}
      </p>
      <BarDiagram
        data={data}
        emptyLabel="No generate / chat activity yet — empty until agents reply."
        compact={size === 'S' || size === 'M'}
        maxBars={size === 'L' ? 8 : 5}
      />
    </div>
  );
}

/** Tasks by status: pending / ongoing / completed (blocked rolls into ongoing). */
export function TasksStatusWidget({ size }: { size: WidgetSize }) {
  const navigate = useNavigate();
  const { loading, taskCounts, error } = useHomeMetrics();

  if (loading) return <WidgetLoading />;

  const data = [
    { key: 'pending', label: 'Pending', value: taskCounts.pending, colorClass: 'bg-accent' },
    { key: 'ongoing', label: 'Ongoing', value: taskCounts.ongoing, colorClass: 'bg-warn' },
    { key: 'completed', label: 'Done', value: taskCounts.completed, colorClass: 'bg-success' },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <p className="shrink-0 text-[12px] font-medium leading-snug text-ink">
        {error ? (
          <span className="text-warn">{error}</span>
        ) : taskCounts.total === 0 ? (
          <span className="text-ink/80">No tasks yet</span>
        ) : (
          <>
            <span className="font-semibold tabular-nums">{taskCounts.total}</span>
            <span className="text-ink/85"> tasks</span>
            {taskCounts.blocked > 0 ? (
              <>
                {' · '}
                <span className="text-warn">{taskCounts.blocked} blocked</span>
              </>
            ) : null}
          </>
        )}
      </p>
      <BarDiagram
        data={data}
        emptyLabel="No tasks from /api/tasks yet."
        compact={size === 'S' || size === 'M'}
        onBarClick={(key) => navigate(`/tasks?status=${encodeURIComponent(key)}`)}
      />
      {size !== 'S' && (
        <Link to="/tasks" className="mt-auto shrink-0 text-[11px] font-medium text-accent-ink hover:underline">
          Open Tasks →
        </Link>
      )}
    </div>
  );
}

/** Success + blocked + fail (chat fail-closed counts). Click Success / Fail to inspect. */
export function TaskOutcomesWidget({ size }: { size: WidgetSize }) {
  const { loading, outcomes, taskCounts, failItems, successItems, error } = useHomeMetrics();
  const [inspect, setInspect] = useState<'fail' | 'success' | null>(null);

  if (loading) return <WidgetLoading />;

  const data = [
    { key: 'success', label: 'Success', value: outcomes.success, colorClass: 'bg-success' },
    { key: 'blocked', label: 'Blocked', value: outcomes.blocked, colorClass: 'bg-warn' },
    { key: 'fail', label: 'Fail', value: outcomes.fail, colorClass: 'bg-danger' },
  ];
  const total = outcomes.success + outcomes.blocked + outcomes.fail;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <p className="shrink-0 text-[12px] font-medium leading-snug text-ink">
        {error ? (
          <span className="text-warn">{error}</span>
        ) : total === 0 ? (
          <span className="text-ink/80">No outcomes yet</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setInspect('success')}
              className="font-semibold tabular-nums text-success underline-offset-2 hover:underline"
              title="Inspect completed tasks"
            >
              {outcomes.success}
            </button>
            <span className="text-ink/85"> ok</span>
            {outcomes.blocked > 0 ? (
              <>
                {' · '}
                <span className="tabular-nums text-warn">{outcomes.blocked}</span>
                <span className="text-ink/85"> blocked</span>
              </>
            ) : null}
            {outcomes.fail > 0 ? (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => setInspect('fail')}
                  className="tabular-nums font-semibold text-danger underline-offset-2 hover:underline"
                  title="Inspect fail-closed reasons"
                >
                  {outcomes.fail}
                </button>
                <span className="text-ink/85"> fail</span>
              </>
            ) : (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => setInspect('fail')}
                  className="tabular-nums text-muted underline-offset-2 hover:underline"
                  title="Inspect fail-closed reasons"
                >
                  0 fail
                </button>
              </>
            )}
          </>
        )}
      </p>
      <BarDiagram
        data={data}
        emptyLabel={
          taskCounts.total === 0
            ? 'No completed tasks or fail-closed chat replies yet.'
            : 'No success / blocked / fail signals yet.'
        }
        compact={size === 'S' || size === 'M'}
        onBarClick={(key) => {
          if (key === 'fail' || key === 'success') setInspect(key);
        }}
      />
      {size !== 'S' && (
        <p className="mt-auto shrink-0 text-[11px] leading-snug text-ink/70">
          Tap Success or Fail to inspect · Success = completed tasks · Fail = fail-closed chat.
        </p>
      )}
      <OutcomesInspectDialog
        open={inspect != null}
        kind={inspect}
        fails={failItems}
        successes={successItems}
        onClose={() => setInspect(null)}
      />
    </div>
  );
}
