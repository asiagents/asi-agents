import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@asi-api';
import {
  ArrowLeftRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from 'lucide-react';
import { PageScroll } from '../components/PageScroll';
import { AgentAvatar, statusDot, statusLabel } from '../components/AgentAvatar';
import { ModelChip } from '../components/ModelChip';
import { Toggle } from '../components/Toggle';
import { getAgent } from '../utils/lookup';
import { formatAgentDisplayName, formatAgentRoleChip } from '../utils/agentDisplay';
import { useDesk } from '../contexts/DeskContext';
import { exportControlLog } from '../utils/exportLog';
import { AgentDeskCard } from '../components/desk/AgentDeskCard';
import { DeskLiveView } from '../components/desk/DeskLiveView';
import { AgentRoutePrefControl } from '../components/models/AgentRoutePrefControl';
import { AgentAmsSkillsPanel } from '../components/agents/AgentAmsSkillsPanel';
import { readSidebarOpenPref, STORAGE_KEYS, writeFlag } from '../utils/storage';
import type { SkillGate } from '../types/agents';

const gateLabel: Record<SkillGate, {text: string;cls: string;}> = {
  free: { text: 'Free to use', cls: 'text-muted' },
  ask: { text: 'Asks first', cls: 'text-warn' },
  blocked: { text: 'Blocked', cls: 'text-danger' }
};

function AgentApiKeyPanel({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [configured, setConfigured] = useState(false);
  const [last4, setLast4] = useState<string | undefined>();
  const [scopes, setScopes] = useState<string[]>(['chat', 'tasks:read']);
  const [scopeChat, setScopeChat] = useState(true);
  const [scopeTasks, setScopeTasks] = useState(true);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .agentApiKey(agentId)
      .then((r) => {
        if (cancelled) return;
        setConfigured(Boolean(r.configured));
        setLast4(r.last4);
        if (r.scopes?.length) {
          setScopes(r.scopes);
          setScopeChat(r.scopes.includes('chat'));
          setScopeTasks(r.scopes.includes('tasks:read'));
        }
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    setFreshToken(null);
    try {
      const nextScopes = [
        ...(scopeChat ? (['chat'] as const) : []),
        ...(scopeTasks ? (['tasks:read'] as const) : []),
      ];
      if (!nextScopes.length) {
        setErr('Pick at least one scope');
        setBusy(false);
        return;
      }
      const r = await api.createAgentApiKey(agentId, { scopes: [...nextScopes] });
      setConfigured(true);
      setLast4(r.last4);
      setScopes(r.scopes ?? nextScopes);
      setFreshToken(r.token);
    } catch {
      setErr('Could not generate API key');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.revokeAgentApiKey(agentId);
      setConfigured(false);
      setLast4(undefined);
      setFreshToken(null);
    } catch {
      setErr('Could not revoke key');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-card bg-surface p-5 ring-1 ring-line">
      <h2 className="text-[15px] font-semibold text-ink">API key</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        Bearer token for external callers. Scopes: <code className="text-[11px]">chat</code> (POST chat),{' '}
        <code className="text-[11px]">tasks:read</code> (GET tasks). Loopback UI stays open without the header.
      </p>
      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-muted">
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={scopeChat} onChange={(e) => setScopeChat(e.target.checked)} />
          chat
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={scopeTasks} onChange={(e) => setScopeTasks(e.target.checked)} />
          tasks:read
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {configured ? (
          <span className="text-[12px] text-muted">
            Configured · ends in …{last4}
            {scopes.length ? ` · ${scopes.join(', ')}` : ''}
          </span>
        ) : (
          <span className="text-[12px] text-faint">No key — chat open without auth</span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="rounded-lg bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
        >
          {configured ? 'Rotate key' : `Generate for ${agentName}`}
        </button>
        {configured ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void revoke()}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-danger ring-1 ring-danger/30 disabled:opacity-40"
          >
            Revoke
          </button>
        ) : null}
      </div>
      {freshToken ? (
        <p className="mt-3 break-all rounded-lg bg-bg p-2.5 font-mono text-[11px] text-ink ring-1 ring-line">
          {freshToken}
          <span className="mt-1 block text-faint">Copy now — not shown again.</span>
        </p>
      ) : null}
      {err ? <p className="mt-2 text-[12px] text-danger">{err}</p> : null}
    </section>
  );
}

export function AgentDetail() {
  const { id = '' } = useParams();
  const agent = getAgent(id);
  const [skills, setSkills] = useState(agent?.skills ?? []);
  const [removeStep, setRemoveStep] = useState<'idle' | 'confirm' | 'removed'>('idle');
  const [routePref, setRoutePref] = useState('local');
  const [routeSource, setRouteSource] = useState<'override' | 'registry' | 'default'>('default');
  const { controlLog, log, setReportsTo, tree } = useDesk();
  const [reportsDraft, setReportsDraft] = useState(agent?.reportsTo?.trim() || '');
  const [detailsOpen, setDetailsOpen] = useState(() =>
    readSidebarOpenPref(STORAGE_KEYS.agentPanelOpen, false)
  );

  useEffect(() => {
    setSkills(agent?.skills ?? []);
  }, [agent?.id, agent?.skills]);

  const setDetails = (open: boolean) => {
    setDetailsOpen(open);
    writeFlag(STORAGE_KEYS.agentPanelOpen, open);
  };

  useEffect(() => {
    setReportsDraft(agent?.reportsTo?.trim() || '');
  }, [agent?.id, agent?.reportsTo]);

  useEffect(() => {
    if (!agent?.id || agent.isChief) return;
    let cancelled = false;
    api
      .agentThread(agent.id)
      .then((t) => {
        if (cancelled) return;
        setRoutePref(t.routePref ?? 'local');
        setRouteSource(t.routeSource ?? 'default');
      })
      .catch(() => {
        /* offline — show local default */
      });
    return () => {
      cancelled = true;
    };
  }, [agent?.id, agent?.isChief]);

  if (!agent) {
    return (
      <PageScroll width="max-w-xl">
        <p className="text-sm text-muted">That agent doesn't exist.</p>
        <Link to="/board" className="mt-3 inline-block text-sm text-accent-ink hover:underline">Back to board</Link>
      </PageScroll>);

  }

  const history = controlLog.filter((e) => e.agentId === agent.id);
  const spendPct = Math.min(100, agent.cloudUsed / agent.cloudCap * 100);

  return (
    <PageScroll width="max-w-[1100px]">
      <Link to="/board" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted transition-colors duration-150 hover:text-ink">
        <ChevronLeftIcon size={15} aria-hidden="true" /> Council board
      </Link>

      <header className="rounded-card bg-surface p-5 ring-1 ring-line">
        <div className="flex flex-wrap items-start gap-4">
          <AgentAvatar agent={agent} size="lg" showStatus />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {formatAgentDisplayName(agent)}
              {formatAgentRoleChip(agent) ? (
                <span className="text-base font-medium text-muted"> [{formatAgentRoleChip(agent)}]</span>
              ) : null}
            </h1>
            <p className="text-sm text-muted">{agent.role}</p>
          <Link
            to={`/chat/${agent.id}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 hover:bg-accent-2">
            <MessageCircleIcon size={14} aria-hidden="true" /> Open chat
          </Link>
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot[agent.status]}`} />
              {statusLabel[agent.status]} · {agent.currentTask}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-bg p-3 ring-1 ring-line">
          <div>
            <div className="mb-1 text-[11px] font-medium text-faint">Primary</div>
            <ModelChip id={agent.primary} showRole />
          </div>
          <ArrowLeftRightIcon size={16} className="text-faint" aria-label="escalates to" />
          <div>
            <div className="mb-1 text-[11px] font-medium text-faint">Secondary</div>
            <ModelChip id={agent.secondary} showRole />
          </div>
          <p className="basis-full text-[12px] text-muted md:ml-auto md:basis-auto md:max-w-xs">
            Switching to the secondary always shows up as a handoff in chat first.
          </p>
        </div>
        {!agent.isChief && (
          <div className="mt-4 rounded-xl bg-bg p-3 ring-1 ring-line">
            <label className="block text-[11px] font-medium text-faint">
              Reports to (org chart)
              <select
                className="mt-1 w-full max-w-sm rounded-lg bg-surface px-2.5 py-1.5 text-[12px] text-ink ring-1 ring-line"
                value={reportsDraft}
                onChange={(e) => {
                  const v = e.target.value;
                  setReportsDraft(v);
                  setReportsTo(agent.id, v.trim() || null);
                }}
              >
                <option value="">Flat · no manager</option>
                {tree
                  .filter((n) => n.id !== agent.id)
                  .map((n) => {
                    const label = getAgent(n.id)?.name || n.id;
                    return (
                      <option key={n.id} value={n.id}>
                        {label}
                      </option>
                    );
                  })}
              </select>
            </label>
            <p className="mt-1 text-[11px] text-muted">Persisted to agents.registry.json via PATCH /api/agents/:id.</p>
          </div>
        )}
        {!agent.isChief && (
          <div className="mt-4 rounded-xl bg-bg p-3 ring-1 ring-line">
            <AgentRoutePrefControl
              compact
              agentId={agent.id}
              agentName={agent.name}
              initialRoutePref={routePref}
              routeSource={routeSource}
            />
          </div>
        )}
      </header>

      <div className={`mt-4 grid gap-4 ${detailsOpen ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : 'lg:grid-cols-[minmax(0,1fr)_auto]'}`}>
        <div className="space-y-4">
          {!detailsOpen ? (
            <button
              type="button"
              onClick={() => setDetails(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted ring-1 ring-line transition-colors hover:bg-overlay/[0.04] hover:text-ink lg:hidden"
            >
              <ChevronLeftIcon size={14} aria-hidden="true" /> Show agent details
            </button>
          ) : null}
          <section className="rounded-card bg-surface p-5 ring-1 ring-line">
            <h2 className="text-[15px] font-semibold text-ink">Skills</h2>
            {skills.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted">No registry skills yet — use AMS catalog below.</p>
            ) : null}
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Skill chips">
              {skills.map((s) =>
              <li key={s.name} className={`rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset ${s.enabled ? 'bg-accent/10 text-accent-ink ring-accent/25' : 'bg-overlay/[0.04] text-muted ring-line'}`}>
                  {s.name}
                </li>
              )}
            </ul>
            <ul className="mt-3 divide-y divide-line">
              {skills.map((s, idx) =>
              <li key={s.name} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-ink">{s.name}</div>
                    <div className={`text-[12px] ${gateLabel[s.gate].cls}`}>{gateLabel[s.gate].text}</div>
                  </div>
                  <Toggle
                  label={`${s.name} enabled`}
                  checked={s.enabled}
                  locked={s.gate === 'blocked'}
                  onChange={(v) => setSkills((prev) => prev.map((p, i) => i === idx ? { ...p, enabled: v } : p))} />
                
                </li>
              )}
            </ul>
          </section>

          <section className="rounded-card bg-surface p-5 ring-1 ring-line">
            <AgentAmsSkillsPanel agentId={agent.id} />
          </section>

          {!agent.isChief ? <AgentApiKeyPanel agentId={agent.id} agentName={agent.name} /> : null}

          <section className="rounded-card bg-surface p-5 ring-1 ring-line">
            <h2 className="text-[15px] font-semibold text-ink">Recent activity</h2>
            {history.length === 0 ?
            <p className="mt-2 text-sm text-muted">No logged activity yet today.</p> :

            <ul className="mt-3 space-y-2.5">
                {history.map((e) =>
              <li key={e.id} className="flex gap-3 text-sm">
                    <span className="w-16 shrink-0 text-[12px] tabular-nums text-faint">{e.time}</span>
                    <span className="text-muted">{e.text}</span>
                  </li>
              )}
              </ul>
            }
          </section>
        </div>

        {!detailsOpen ? (
          <aside
            className="hidden w-11 shrink-0 flex-col items-center border-l border-line bg-surface py-3 lg:flex"
            aria-label={`${agent.name} details (collapsed)`}
          >
            <button
              type="button"
              onClick={() => setDetails(true)}
              title="Show details"
              aria-label="Expand agent details"
              className="grid h-8 w-8 place-items-center rounded-full text-muted ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] hover:text-ink"
            >
              <ChevronLeftIcon size={16} aria-hidden="true" />
            </button>
          </aside>
        ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setDetails(false)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted ring-1 ring-line hover:text-ink"
              aria-label="Hide agent details"
            >
              Hide details <ChevronRightIcon size={12} aria-hidden="true" />
            </button>
          </div>
          {agent.id === 'coder' &&
          <section className="rounded-card bg-surface p-5 ring-1 ring-line" aria-label="Coder virtual desktop">
            <h2 className="text-[15px] font-semibold text-ink">Virtual desktop</h2>
            <p className="mt-1 text-[12px] text-muted">Live view of the sandbox Coder uses (local desk service).</p>
            <div className="mt-3"><DeskLiveView compact /></div>
          </section>
          }
          <AgentDeskCard agent={agent} />
          <section className="rounded-card bg-surface p-5 ring-1 ring-line">
            <h2 className="text-[15px] font-semibold text-ink">Spend</h2>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-sm text-muted">On-device runs</span>
              <span className="text-sm font-medium text-success">No cost</span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-sm text-muted">Cloud this month</span>
              <span className="text-sm font-medium text-ink">
                ${agent.cloudUsed.toFixed(2)} <span className="text-faint">of ${agent.cloudCap.toFixed(2)}</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-overlay/[0.06]" role="progressbar" aria-valuenow={Math.round(spendPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Cloud spend">
              <div className="h-full rounded-full bg-accent" style={{ width: `${spendPct}%` }} />
            </div>
            <Link to="/permissions" className="mt-4 inline-block text-[12px] font-medium text-accent-ink hover:underline">
              Edit spend gates
            </Link>
          </section>

          <section className="rounded-card bg-surface p-5 ring-1 ring-line">
            <h2 className="text-[15px] font-semibold text-ink">Remove agent</h2>
            <p className="mt-1 flex gap-1.5 text-[12px] leading-relaxed text-muted">
              <ShieldCheckIcon size={14} className="mt-px shrink-0 text-success" aria-hidden="true" />
              The control log survives. {agent.logEntries} entries stay in your audit history.
            </p>
            {agent.isChief ?
            <p className="mt-3 text-[12px] text-faint">Chief can't be removed — it runs your desk.</p> :
            removeStep === 'idle' ?
            <button type="button" onClick={() => setRemoveStep('confirm')} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-danger ring-1 ring-danger/30 transition-colors duration-150 hover:bg-danger/10">
                <Trash2Icon size={14} aria-hidden="true" /> Remove {agent.name}
              </button> :
            removeStep === 'confirm' ?
            <div className="mt-3 flex flex-wrap gap-2">
                <button
                type="button"
                onClick={() => {
                  void (async () => {
                    try {
                      await api.deleteAgent(agent.id);
                      setRemoveStep('removed');
                      log({ actor: `${agent.name} (removed)`, text: `Agent soft-deleted — recoverable in Settings → Logs & Recycle bin · ${agent.logEntries} control-log entries kept`, tone: 'neutral' });
                    } catch {
                      log({ actor: 'You', text: `Could not remove ${agent.name} (API unavailable)`, tone: 'danger' });
                      setRemoveStep('idle');
                    }
                  })();
                }}
                className="rounded-lg bg-danger/15 px-3 py-1.5 text-[13px] font-medium text-danger transition-colors duration-150 hover:bg-danger/25">
                  Yes, remove
                </button>
                <button type="button" onClick={() => setRemoveStep('idle')} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
                  Cancel
                </button>
              </div> :

            <p className="mt-3 text-[13px] text-ink">
                {agent.name} moved to Logs &amp; Recycle bin. {agent.logEntries} log entries kept.{' '}
                <button type="button" onClick={() => exportControlLog(controlLog)} className="font-medium text-accent-ink hover:underline">Export log</button>
                {' · '}
                <Link to="/settings/logs" className="font-medium text-accent-ink hover:underline">Open recycle bin</Link>
              </p>
            }
          </section>
        </div>
        )}
      </div>
    </PageScroll>);

}