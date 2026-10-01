import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ClockIcon, CloudIcon, DatabaseIcon, DownloadIcon, SparklesIcon, UploadIcon } from 'lucide-react';
import {
  api,
  type CompanyOpsItem,
  type CronRoutine,
  type PostgresModuleStatus,
  type SkillTemplate,
} from '@asi-api';
import { SettingsSection, SettingsRow, StatusPill, inputClass } from '../../components/settings/SettingsUI';
import { Toggle } from '../../components/Toggle';
import { AdapterSandboxPanel } from '../../components/settings/AdapterSandboxPanel';
import { SkillStudioGraphPanel } from '../../components/settings/SkillStudioGraphPanel';

export function SettingsCompanyOps() {
  const [ops, setOps] = useState<CompanyOpsItem[]>([]);
  const [routines, setRoutines] = useState<CronRoutine[]>([]);
  const [templates, setTemplates] = useState<SkillTemplate[]>([]);
  const [pg, setPg] = useState<PostgresModuleStatus | null>(null);
  const [connDraft, setConnDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('Daily standup check-in');
  const [agentId, setAgentId] = useState('chief');
  const [everyMinutes, setEveryMinutes] = useState(1440);
  const [cronExpr, setCronExpr] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [pgMsg, setPgMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [opsRes, cronRes, tplRes, pgRes] = await Promise.all([
        api.companyOps(),
        api.cronRoutines(),
        api.skillTemplates(),
        api.postgresPrefs(),
      ]);
      setOps(opsRes.items ?? []);
      setRoutines(cronRes.routines ?? []);
      setTemplates(tplRes.templates ?? []);
      setPg(pgRes);
      setNote(tplRes.note ?? cronRes.note ?? null);
      setError(null);
    } catch {
      setError('Could not load company ops — is the API on :3445?');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePg = async (patch: {
    usePostgres?: boolean;
    dualWrite?: boolean;
    connectionString?: string | null;
  }) => {
    setBusy(true);
    setPgMsg(null);
    try {
      const next = await api.putPostgresPrefs(patch);
      setPg(next);
      if (patch.connectionString) setConnDraft('');
      setPgMsg(next.note);
    } catch {
      setError('Could not save Postgres prefs');
    } finally {
      setBusy(false);
    }
  };

  const exportJson = async () => {
    setPgMsg(null);
    try {
      const snap = await api.exportControlPlane();
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `asi-control-plane-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setPgMsg(`Exported ${snap.tasks.length} tasks, ${snap.lessons.length} lessons, ${snap.cronRoutines.length} cron routines.`);
    } catch {
      setError('Export failed');
    }
  };

  const importJson = async (file: File) => {
    setPgMsg(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const res = await api.importControlPlane(parsed);
      const snap = res.snapshot;
      setPgMsg(
        `Imported ${snap.tasks.length} tasks, ${snap.lessons.length} lessons, ${snap.cronRoutines.length} cron — FileStore updated (no secrets in snapshot).`
      );
      await refresh();
    } catch {
      setError('Import failed — check the JSON is a control-plane export.');
    }
  };

  const addRoutine = async () => {
    setBusy(true);
    try {
      const expr = cronExpr.trim();
      await api.createCronRoutine({
        title: title.trim() || 'Scheduled task',
        agentId: agentId.trim() || 'chief',
        everyMinutes: Math.max(1, everyMinutes || 60),
        ...(expr ? { cronExpr: expr } : {}),
      });
      setCronExpr('');
      await refresh();
    } catch {
      setError('Could not create cron routine — check crontab (5 fields) or every-minutes.');
    } finally {
      setBusy(false);
    }
  };

  const toggleRoutine = async (r: CronRoutine) => {
    try {
      await api.patchCronRoutine(r.id, { enabled: !r.enabled });
      await refresh();
    } catch {
      setError('Could not update routine');
    }
  };

  const removeRoutine = async (id: string) => {
    try {
      await api.deleteCronRoutine(id);
      await refresh();
    } catch {
      setError('Could not delete routine');
    }
  };

  const applyTemplate = async (id: string, count: number) => {
    setApplyMsg(null);
    try {
      const res = await api.applySkillTemplate(id, { count });
      const n = Array.isArray(res.created) ? res.created.length : 0;
      setApplyMsg(`Created ${n} agent${n === 1 ? '' : 's'} from template “${id}”.`);
    } catch {
      setApplyMsg('Apply failed — check API / registry write access.');
    }
  };

  const statusTone = (status: string): 'success' | 'warn' | 'muted' => {
    if (status === 'shipped') return 'success';
    if (status === 'partial') return 'warn';
    return 'warn';
  };

  const statusLabel = (status: string) => {
    if (status === 'shipped') return 'Shipped';
    if (status === 'partial') return 'Partial';
    return 'Not shipped';
  };

  return (
    <>
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {note ? <p className="mb-4 text-[12px] text-muted">{note}</p> : null}

      <SettingsSection
        id="postgres"
        title="Use Postgres (optional)"
        description="Default stays app-state.json (FileStore). Opt in only when you want a SQL control plane — no fake database."
        stacked
      >
        <div className="max-w-2xl overflow-hidden rounded-card bg-surface ring-1 ring-line">
          <SettingsRow
            title="Use Postgres"
            detail={
              pg?.envOverrides.usePostgres
                ? 'Overridden by ASI_USE_POSTGRES env'
                : 'Off = FileStore only; module never required'
            }
          >
            <Toggle
              label="Use Postgres"
              checked={pg?.usePostgres === true}
              locked={pg?.envOverrides.usePostgres === true || busy}
              onChange={(v) => void savePg({ usePostgres: v })}
            />
          </SettingsRow>
          <SettingsRow
            title="Dual-write (stub)"
            detail="Files stay primary; mirror ops log to @asi-agents/postgres-store when on"
          >
            <Toggle
              label="Dual-write"
              checked={pg?.dualWrite === true}
              locked={pg?.envOverrides.dualWrite === true || busy}
              onChange={(v) => void savePg({ dualWrite: v })}
            />
          </SettingsRow>
        </div>

        {pg?.usePostgres ? (
          <div className="mt-3 max-w-2xl space-y-3 rounded-card bg-surface p-4 ring-1 ring-line">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={pg.connected ? 'success' : 'warn'}>
                {pg.connected ? `Secret saved · …${pg.last4 ?? '****'}` : 'Setup required'}
              </StatusPill>
              <span className="text-[11px] text-faint">Active store: {pg.activeStore}</span>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">{pg.note}</p>
            {!pg.connected || pg.setupRequired ? (
              <label className="block text-[11px] font-medium text-muted">
                Connection string (ASI_DATABASE_URL)
                <input
                  className={`${inputClass} mt-1 font-mono text-[12px]`}
                  type="password"
                  autoComplete="off"
                  placeholder="postgres://user:pass@host:5432/asi"
                  value={connDraft}
                  onChange={(e) => setConnDraft(e.target.value)}
                />
              </label>
            ) : (
              <label className="block text-[11px] font-medium text-muted">
                Replace connection string
                <input
                  className={`${inputClass} mt-1 font-mono text-[12px]`}
                  type="password"
                  autoComplete="off"
                  placeholder="Leave blank to keep · paste to replace"
                  value={connDraft}
                  onChange={(e) => setConnDraft(e.target.value)}
                />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !connDraft.trim()}
                onClick={() => void savePg({ connectionString: connDraft.trim() })}
                className="rounded-lg bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
              >
                Save connection
              </button>
              {pg.configured ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void savePg({ connectionString: null })}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-danger ring-1 ring-line disabled:opacity-40"
                >
                  Clear secret
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-3 max-w-2xl text-[12px] text-muted">
            {pg?.note ?? 'FileStore remains the default. Enable the toggle only when you have a real Postgres URL.'}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportJson()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.05]"
          >
            <DownloadIcon size={14} aria-hidden="true" /> Export control-plane JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.05]"
          >
            <UploadIcon size={14} aria-hidden="true" /> Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void importJson(f);
            }}
          />
        </div>
        <p className="mt-2 max-w-2xl text-[11px] text-faint">
          Export includes tasks, lessons, training overlays, cron, and company briefing — not provider keys, mail tokens, or agent API keys.
        </p>
        {pgMsg ? <p className="mt-2 text-[12px] text-muted">{pgMsg}</p> : null}
      </SettingsSection>

      <SettingsSection
        title="Capability map"
        description="Honest status for Paperclip-like company ops. Shipped pieces work on local app-state; the rest are explicit stubs."
        stacked
      >
        <ul className="overflow-hidden rounded-card ring-1 ring-line">
          {ops.map((item) => (
            <li key={item.id} className="border-t border-line px-4 py-3.5 first:border-t-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusPill>
                <span className="text-sm font-medium text-ink">{item.title}</span>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{item.summary}</p>
              <p className="mt-1 text-[11px] text-faint">Roadmap: {item.roadmap}</p>
            </li>
          ))}
          {ops.length === 0 && !error ? (
            <li className="px-4 py-6 text-center text-[12px] text-muted">Loading…</li>
          ) : null}
        </ul>
      </SettingsSection>

      <SettingsSection
        id="cron"
        title="Cron routines"
        description="5-field crontab (e.g. 0 9 * * 1-5) or every-N-minutes fallback. Creates a pending task when due; poller ticks every 30s."
        stacked
      >
        <div className="space-y-3 rounded-card bg-surface p-4 ring-1 ring-line">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-[11px] font-medium text-muted">
              Task title
              <input className={`${inputClass} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block text-[11px] font-medium text-muted">
              Agent id
              <input className={`${inputClass} mt-1`} value={agentId} onChange={(e) => setAgentId(e.target.value)} />
            </label>
            <label className="block text-[11px] font-medium text-muted">
              Crontab (optional)
              <input
                className={`${inputClass} mt-1 font-mono`}
                placeholder="0 9 * * 1-5"
                value={cronExpr}
                onChange={(e) => setCronExpr(e.target.value)}
              />
            </label>
            <label className="block text-[11px] font-medium text-muted">
              Every (minutes) fallback
              <input
                type="number"
                min={1}
                className={`${inputClass} mt-1`}
                value={everyMinutes}
                onChange={(e) => setEveryMinutes(Number(e.target.value))}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addRoutine()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
          >
            <ClockIcon size={14} aria-hidden="true" /> Add routine
          </button>
        </div>
        <ul className="mt-3 overflow-hidden rounded-card ring-1 ring-line">
          {routines.length === 0 ? (
            <li className="px-4 py-5 text-center text-[12px] text-muted">No routines yet.</li>
          ) : (
            routines.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">{r.title}</div>
                  <div className="text-[11px] text-muted">
                    {r.agentId} ·{' '}
                    {r.cronExpr ? (
                      <code className="text-[10px]">{r.cronExpr}</code>
                    ) : (
                      <>every {r.everyMinutes}m</>
                    )}
                    {r.nextRunAt ? ` · next ${new Date(r.nextRunAt).toLocaleString()}` : ''}
                    {!r.enabled ? ' · paused' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleRoutine(r)}
                  className="text-[12px] font-medium text-accent-ink hover:underline"
                >
                  {r.enabled ? 'Pause' : 'Resume'}
                </button>
                <button
                  type="button"
                  onClick={() => void removeRoutine(r.id)}
                  className="text-[12px] text-danger hover:underline"
                >
                  Delete
                </button>
              </li>
            ))
          )}
        </ul>
      </SettingsSection>

      <SettingsSection
        id="skill-templates"
        title="Skill templates"
        description="Preset agent packs from name sets. Lightweight — not Skill Studio."
        stacked
      >
        {applyMsg ? <p className="mb-2 text-[12px] text-muted">{applyMsg}</p> : null}
        <ul className="space-y-3">
          {templates.map((t) => (
            <li key={t.id} className="rounded-card bg-surface p-4 ring-1 ring-line">
              <div className="flex flex-wrap items-start gap-2">
                <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent-ink">
                  <SparklesIcon size={14} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{t.label}</div>
                  <p className="mt-0.5 text-[12px] text-muted">{t.description}</p>
                  <p className="mt-1 text-[11px] text-faint">
                    {t.agentCount} names · default apply {t.defaultCount}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void applyTemplate(t.id, t.defaultCount)}
                  className="rounded-lg bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white"
                >
                  Apply pack
                </button>
              </div>
            </li>
          ))}
        </ul>
      </SettingsSection>

      <AdapterSandboxPanel />

      <SkillStudioGraphPanel />

      <SettingsSection
        title="Still partial / not shipped"
        description="Honest leftovers — adapters and the simple skill graph shipped above."
        stacked
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: DatabaseIcon,
              title: 'Postgres module',
              body: 'Optional @asi-agents/postgres-store. Toggle + export/import above; FileStore default. Full SQL driver later.',
              roadmap: 'See docs/OPTIONAL-POSTGRES-MODULE.md — modular pack, not a forced migration.',
              tone: 'warn' as const,
              badge: 'Partial',
            },
            {
              icon: CloudIcon,
              title: 'Azure / Bedrock BYO',
              body: 'Ten API-key providers work; Azure OpenAI and AWS Bedrock enterprise cards are missing.',
              roadmap: 'Cursor-style modular cards: enable toggle, base URL / region / deployment, secret saved.',
              tone: 'warn' as const,
              badge: 'Partial',
            },
          ].map((card) => (
            <div key={card.title} className="rounded-card bg-bg p-4 ring-1 ring-line">
              <div className="flex items-center gap-2">
                <card.icon size={16} className="text-muted" aria-hidden="true" />
                <span className="text-sm font-medium text-ink">{card.title}</span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">{card.body}</p>
              <StatusPill tone={card.tone}>{card.badge}</StatusPill>
              <p className="mt-2 text-[11px] text-faint">Roadmap: {card.roadmap}</p>
            </div>
          ))}
        </div>
      </SettingsSection>
    </>
  );
}
