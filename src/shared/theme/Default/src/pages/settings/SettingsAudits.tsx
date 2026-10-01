import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CheckIcon,
  ClipboardListIcon,
  DownloadIcon,
  GraduationCapIcon,
  ListTodoIcon,
  BookOpenIcon,
  RefreshCwIcon,
} from 'lucide-react';
import {
  api,
  type AuditAssumption,
  type AuditFailEvent,
  type AuditFinding,
  type AuditReport,
  type AuditSeverity,
  type ProviderSpendEvent,
} from '@asi-api';
import { SettingsSection, StatusPill } from '../../components/settings/SettingsUI';

const REVIEWED_KEY = 'asi.audits.reviewedIds';

type FilterId = 'all' | 'fail-closed' | 'desk' | 'permissions' | 'findings' | 'routing' | 'spend';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fail-closed', label: 'Chat fail-closed' },
  { id: 'desk', label: 'Desk' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'findings', label: 'Findings' },
  { id: 'routing', label: 'Routing' },
  { id: 'spend', label: 'Spend' },
];

function severityTone(s: AuditSeverity): 'success' | 'warn' | 'muted' {
  if (s === 'risk') return 'warn';
  if (s === 'warn') return 'warn';
  return 'muted';
}

function severityLabel(s: AuditSeverity): string {
  if (s === 'risk') return 'Risk';
  if (s === 'warn') return 'Warn';
  return 'Info';
}

function loadReviewed(): Set<string> {
  try {
    const raw = localStorage.getItem(REVIEWED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveReviewed(ids: Set<string>): void {
  try {
    localStorage.setItem(REVIEWED_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    /* ignore quota */
  }
}

function dayShort(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function LearnActions({
  title,
  body,
  agentIds,
  itemId,
  reviewed,
  onReviewed,
  busyId,
  setBusyId,
}: {
  title: string;
  body: string;
  agentIds?: string[];
  itemId: string;
  reviewed: Set<string>;
  onReviewed: (id: string) => void;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
}) {
  const isReviewed = reviewed.has(itemId);
  const busy = busyId === itemId;

  async function toLesson(source: 'manual' | 'training') {
    setBusyId(itemId);
    try {
      await api.createLesson({
        title: title.slice(0, 200),
        body: body.slice(0, 24_000),
        source,
        agentIds: agentIds ?? [],
      });
      toast.success(source === 'training' ? 'Saved to Company Training (Lessons)' : 'Saved to Lessons');
      onReviewed(itemId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save lesson');
    } finally {
      setBusyId(null);
    }
  }

  async function toChiefTodo() {
    setBusyId(itemId);
    try {
      await api.createTask({
        title: `Review audit: ${title.slice(0, 120)}`,
        agentId: 'chief',
        status: 'pending',
        note: body.slice(0, 2000),
        origin: 'todo',
        startWork: false,
      });
      toast.success('Task created for Chief');
      onReviewed(itemId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create task');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => void toLesson('manual')}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-accent-ink ring-1 ring-line hover:bg-overlay/[0.04] disabled:opacity-50"
      >
        <BookOpenIcon size={12} aria-hidden="true" />
        → Lessons
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void toLesson('training')}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-accent-ink ring-1 ring-line hover:bg-overlay/[0.04] disabled:opacity-50"
      >
        <GraduationCapIcon size={12} aria-hidden="true" />
        → Training note
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void toChiefTodo()}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-accent-ink ring-1 ring-line hover:bg-overlay/[0.04] disabled:opacity-50"
      >
        <ListTodoIcon size={12} aria-hidden="true" />
        Chief todo
      </button>
      <button
        type="button"
        disabled={busy || isReviewed}
        onClick={() => onReviewed(itemId)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted ring-1 ring-line hover:bg-overlay/[0.04] disabled:opacity-50"
      >
        <CheckIcon size={12} aria-hidden="true" />
        {isReviewed ? 'Reviewed' : 'Mark reviewed'}
      </button>
    </div>
  );
}

function FindingRow({
  f,
  reviewed,
  onReviewed,
  busyId,
  setBusyId,
}: {
  f: AuditFinding;
  reviewed: Set<string>;
  onReviewed: (id: string) => void;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
}) {
  const dim = reviewed.has(f.id);
  return (
    <li className={`border-t border-line px-4 py-3.5 first:border-t-0 ${dim ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start gap-2">
        <StatusPill tone={severityTone(f.severity)}>{severityLabel(f.severity)}</StatusPill>
        <span className="rounded-full bg-overlay/[0.06] px-2 py-0.5 text-[11px] font-medium text-muted">{f.area}</span>
        <div className="min-w-0 flex-1 text-sm font-medium text-ink">{f.title}</div>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{f.detail}</p>
      {f.evidence ? (
        <p className="mt-1 font-mono text-[11px] text-faint">{f.evidence}</p>
      ) : null}
      {(f.severity === 'risk' || f.severity === 'warn') && (
        <LearnActions
          title={f.title}
          body={`${f.detail}${f.evidence ? `\n\nEvidence: ${f.evidence}` : ''}\n\n(From local audit · ${f.area} · ${f.id})`}
          itemId={f.id}
          reviewed={reviewed}
          onReviewed={onReviewed}
          busyId={busyId}
          setBusyId={setBusyId}
        />
      )}
    </li>
  );
}

function AssumptionRow({ a }: { a: AuditAssumption }) {
  return (
    <li className="border-t border-line px-4 py-3.5 first:border-t-0">
      <div className="text-sm font-medium text-ink">{a.assumption}</div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
        <span className="font-medium text-warn">Risk:</span> {a.risk}
      </p>
      {a.basedOn.length > 0 ? (
        <p className="mt-1 font-mono text-[11px] text-faint">Based on: {a.basedOn.join(', ')}</p>
      ) : null}
    </li>
  );
}

function FailEventRow({
  e,
  reviewed,
  onReviewed,
  busyId,
  setBusyId,
}: {
  e: AuditFailEvent;
  reviewed: Set<string>;
  onReviewed: (id: string) => void;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
}) {
  const dim = reviewed.has(e.id);
  return (
    <li className={`border-t border-line px-4 py-3 first:border-t-0 ${dim ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-baseline gap-2 text-[12px]">
        <span className="font-semibold text-danger">{e.agentLabel}</span>
        <span className="text-faint tabular-nums">{new Date(e.at).toLocaleString()}</span>
      </div>
      <p className="mt-1 text-[13px] text-ink">{e.reason}</p>
      {e.text !== e.reason ? (
        <p className="mt-1 line-clamp-2 text-[12px] text-muted">{e.text}</p>
      ) : null}
      <LearnActions
        title={`Fail-closed · ${e.agentLabel}`}
        body={`${e.reason}\n\n${e.text}\n\n(Chat fail-closed · ${e.agentId} · ${e.at})`}
        agentIds={e.agentId !== 'chief' ? [e.agentId] : []}
        itemId={e.id}
        reviewed={reviewed}
        onReviewed={onReviewed}
        busyId={busyId}
        setBusyId={setBusyId}
      />
    </li>
  );
}

function MiniBars({
  rows,
  empty,
}: {
  rows: { key: string; label: string; count: number }[];
  empty: string;
}) {
  if (rows.length === 0 || rows.every((r) => r.count === 0)) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2 text-[12px]">
          <span className="w-28 shrink-0 truncate text-muted" title={r.label}>
            {r.label}
          </span>
          <div className="h-1.5 min-w-0 flex-1 rounded-full bg-overlay/[0.08]">
            <div
              className="h-1.5 rounded-full bg-accent"
              style={{ width: `${Math.max(6, (r.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right tabular-nums text-ink">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function SettingsAudits() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [spend, setSpend] = useState<ProviderSpendEvent[]>([]);
  const [spendNote, setSpendNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterId>('all');
  const [reviewed, setReviewed] = useState<Set<string>>(() => loadReviewed());
  const [busyId, setBusyId] = useState<string | null>(null);

  const markReviewed = useCallback((id: string) => {
    setReviewed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReviewed(next);
      return next;
    });
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [next, spendRes] = await Promise.all([api.runAudit(), api.auditSpend(40)]);
      setReport(next);
      setSpend(spendRes.events ?? []);
      setSpendNote(spendRes.note ?? null);
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? e.message : 'Audit failed — is the API on :3445?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash === 'patterns' || hash === 'fail-closed') setFilter('fail-closed');
    else if (hash === 'desk') setFilter('desk');
    else if (hash === 'permissions') setFilter('permissions');
  }, []);

  const findings = useMemo(() => {
    const all = report?.findings ?? [];
    if (filter === 'desk') return all.filter((f) => f.area === 'desk');
    if (filter === 'permissions') return all.filter((f) => f.area === 'permissions');
    if (filter === 'findings') return all.filter((f) => f.area !== 'desk' && f.area !== 'permissions');
    if (filter === 'fail-closed' || filter === 'routing' || filter === 'spend') return [];
    return all;
  }, [report, filter]);

  const showPatterns = filter === 'all' || filter === 'fail-closed';
  const showRouting = filter === 'all' || filter === 'routing';
  const showSpend = filter === 'all' || filter === 'spend';
  const showFindings = filter === 'all' || filter === 'findings' || filter === 'desk' || filter === 'permissions';
  const showAssumptions = filter === 'all' || filter === 'findings';

  function exportJson() {
    if (!report) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      filter,
      summary: report.summary,
      patterns: report.patterns,
      findings: findings,
      assumptions: showAssumptions ? report.assumptions : undefined,
      routingDecisions: showRouting ? report.routingDecisions : undefined,
      spend: showSpend ? spend : undefined,
      failEvents: showPatterns ? report.patterns?.events : undefined,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asi-audit-${filter}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported local audit JSON');
  }

  const patterns = report?.patterns;

  return (
    <>
      <SettingsSection
        title="Improve & learn"
        description="Audits are a local mirror: notice deficits and fail-closed events, turn the useful ones into Lessons / Training notes or a Chief task, then fix under Models, Connections, Permissions, or Desk."
      >
        <p className="text-[13px] leading-relaxed text-muted">
          Loop: <span className="text-ink">Run audit</span> → spot patterns →{' '}
          <span className="text-ink">Learn from this</span> (Lessons, Training, Chief todo, or mark reviewed) →
          fix the cause → re-run. No cloud analytics — counts come from your threads and app-state.
        </p>
        <p className="mt-2 text-[12px] text-muted">
          Home <span className="text-ink">Fail inspect</span> opens here. Lessons live under{' '}
          <Link to="/settings/lessons" className="text-accent-ink underline-offset-2 hover:underline">
            Lessons
          </Link>
          ; company briefing under{' '}
          <Link to="/settings/company" className="text-accent-ink underline-offset-2 hover:underline">
            Company / Training
          </Link>
          .
        </p>
      </SettingsSection>

      <SettingsSection
        title="Local audit"
        description="Reads app-state.json, agents registry, model pool / GGUF on disk, Desk probe, permissions, and provider key presence. No database — findings are deficits you can act on."
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-60"
          >
            <RefreshCwIcon size={15} aria-hidden="true" className={loading ? 'animate-spin' : undefined} />
            {loading ? 'Running…' : 'Run audit'}
          </button>
          <button
            type="button"
            onClick={exportJson}
            disabled={!report}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.04] disabled:opacity-50"
          >
            <DownloadIcon size={15} aria-hidden="true" />
            Export JSON
          </button>
          {report ? (
            <p className="text-[12px] text-muted">
              {report.summary.findings} findings · {report.summary.risks} risks · {report.summary.assumptions}{' '}
              assumptions
              {report.summary.failClosed != null ? ` · ${report.summary.failClosed} fail-closed` : ''} ·{' '}
              {new Date(report.ranAt).toLocaleString()}
            </p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Audit filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                filter === f.id
                  ? 'bg-accent-strong text-white'
                  : 'bg-overlay/[0.06] text-muted hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {report ? (
          <p className="mt-3 font-mono text-[11px] text-faint">
            Scope: {report.scope} · {report.stateFile}
          </p>
        ) : null}
        <p className="mt-4 text-[12px] text-muted">
          Fix keys under{' '}
          <Link to="/settings/connections" className="text-accent-ink underline-offset-2 hover:underline">
            Providers and APIs
          </Link>
          , models under{' '}
          <Link to="/settings/models" className="text-accent-ink underline-offset-2 hover:underline">
            Models
          </Link>
          , research tasks on{' '}
          <Link to="/tasks" className="text-accent-ink underline-offset-2 hover:underline">
            Tasks
          </Link>
          .
        </p>
      </SettingsSection>

      {showPatterns ? (
        <SettingsSection
          id="patterns"
          title="Patterns"
          description="Top fail-closed reasons, frequent agents, and 7-day trend from local chat threads. Honest empty when sparse — no invented trends."
        >
          {!patterns || patterns.failClosedCount === 0 ? (
            <p className="text-sm text-muted">
              No fail-closed chat replies yet — nothing to pattern. Send a turn that needs a backend when offline to
              see counts here.
            </p>
          ) : (
            <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-[12px] font-semibold text-ink">Top fail-closed reasons</h3>
                <MiniBars
                  rows={patterns.topFailReasons}
                  empty="No repeated reasons yet."
                />
              </div>
              <div>
                <h3 className="mb-2 text-[12px] font-semibold text-ink">Frequent agents</h3>
                <MiniBars
                  rows={patterns.frequentAgents}
                  empty="No agent fail-closed counts yet."
                />
              </div>
              <div className="sm:col-span-2">
                <h3 className="mb-2 text-[12px] font-semibold text-ink">Fail-closed · last 7 days</h3>
                <MiniBars
                  rows={patterns.failByDay.map((d) => ({
                    key: d.day,
                    label: dayShort(d.day),
                    count: d.count,
                  }))}
                  empty="No day buckets filled."
                />
                {patterns.sparse ? (
                  <p className="mt-2 text-[11px] text-faint">{patterns.note}</p>
                ) : (
                  <p className="mt-2 text-[11px] text-faint">{patterns.note}</p>
                )}
              </div>
            </div>
          )}

          {patterns && patterns.events.length > 0 ? (
            <ul className="mt-4 max-w-2xl overflow-hidden rounded-card bg-surface ring-1 ring-line">
              {patterns.events.map((e) => (
                <FailEventRow
                  key={e.id}
                  e={e}
                  reviewed={reviewed}
                  onReviewed={markReviewed}
                  busyId={busyId}
                  setBusyId={setBusyId}
                />
              ))}
            </ul>
          ) : null}
        </SettingsSection>
      ) : null}

      {showSpend ? (
        <SettingsSection
          title="Provider spend / call log"
          description="Appended from routeGenerate when token usage is available. Estimates are not billing."
        >
          {spendNote ? <p className="mb-2 text-[11px] text-faint">{spendNote}</p> : null}
          {spend.length === 0 ? (
            <p className="text-sm text-muted">No generate usage events yet — chat once with a live backend.</p>
          ) : (
            <ul className="max-w-2xl overflow-hidden rounded-card bg-surface ring-1 ring-line">
              {spend.map((e) => (
                <li key={e.id} className="border-t border-line px-4 py-2.5 first:border-t-0 text-[12px]">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-ink">{e.via}</span>
                    {e.providerId ? <span className="text-muted">{e.providerId}</span> : null}
                    {e.model ? <code className="text-[10px] text-faint">{e.model}</code> : null}
                    {e.agentId ? <span className="text-muted">· {e.agentId}</span> : null}
                    <span className="ml-auto text-faint tabular-nums">{new Date(e.at).toLocaleString()}</span>
                  </div>
                  <div className="mt-0.5 text-muted tabular-nums">
                    {e.promptTokens != null || e.completionTokens != null
                      ? `${e.promptTokens ?? '—'} in / ${e.completionTokens ?? '—'} out`
                      : 'no token counts'}
                    {e.latencyMs != null ? ` · ${e.latencyMs} ms` : ''}
                    {e.estimatedCostUsd != null ? ` · ~$${e.estimatedCostUsd}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>
      ) : null}

      {showRouting ? (
        <SettingsSection
          title="Fan-out routing"
          description="Hey Jev–inspired speculative classifier slots per chat turn (category, target, action, compound, confidence). Also expandable under each message."
        >
          {!report?.routingDecisions?.length ? (
            <p className="text-sm text-muted">No routing decisions yet — send a chat turn.</p>
          ) : (
            <ul className="max-w-2xl overflow-hidden rounded-card bg-surface ring-1 ring-line">
              {report.routingDecisions.map((e) => (
                <li key={e.id} className="border-t border-line px-4 py-2.5 first:border-t-0 text-[12px]">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-ink">{e.gated ?? e.category ?? 'route'}</span>
                    {e.category ? <span className="text-muted">{e.category}</span> : null}
                    {e.target ? <span className="text-muted">· {e.target}</span> : null}
                    {e.action ? <code className="text-[10px] text-faint">{e.action}</code> : null}
                    <span className="ml-auto text-faint tabular-nums">
                      {Math.round(e.confidence * 100)}% · {new Date(e.at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-0.5 text-muted">
                    <span className="font-mono text-[11px] text-faint">{e.threadKey}</span>
                    {e.textPreview ? ` · “${e.textPreview}”` : ''}
                    {e.compound ? ' · compound' : ''}
                    {e.via ? ` · via ${e.via}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>
      ) : null}

      {showAssumptions ? (
        <SettingsSection
          title="Assumptions & risks"
          description="Deficits (no keys, empty pool, model-only research, Desk offline) restated as what the app is assuming about your setup."
        >
          {!report && !error ? (
            <p className="text-sm text-muted">Waiting for first run…</p>
          ) : report && report.assumptions.length === 0 ? (
            <div className="max-w-2xl rounded-card bg-surface px-4 py-3.5 text-sm text-muted ring-1 ring-line">
              No high-signal deficit assumptions — keys, pool, or research stubs did not flag.
            </div>
          ) : report ? (
            <ul className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
              {report.assumptions.map((a) => (
                <AssumptionRow key={a.id} a={a} />
              ))}
            </ul>
          ) : null}
        </SettingsSection>
      ) : null}

      {showFindings ? (
        <SettingsSection
          title={filter === 'desk' ? 'Desk findings' : filter === 'permissions' ? 'Permissions findings' : 'Findings'}
          description="All checks from local files, registry paths, Desk probe, and permission gates."
        >
          {report ? (
            findings.length === 0 ? (
              <p className="text-sm text-muted">No findings in this filter.</p>
            ) : (
              <ul className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
                {findings.map((f) => (
                  <FindingRow
                    key={f.id}
                    f={f}
                    reviewed={reviewed}
                    onReviewed={markReviewed}
                    busyId={busyId}
                    setBusyId={setBusyId}
                  />
                ))}
              </ul>
            )
          ) : !error ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <ClipboardListIcon size={16} aria-hidden="true" />
              No findings yet.
            </div>
          ) : null}
        </SettingsSection>
      ) : null}
    </>
  );
}
