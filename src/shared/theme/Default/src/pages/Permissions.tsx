import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlertIcon, TerminalIcon, PuzzleIcon, WalletIcon, WrenchIcon } from 'lucide-react';
import { PageHeader, PageScroll } from '../components/PageScroll';
import { api } from '@asi-api';
import { permissionRules } from '../data/desk';
import type { PermissionCategory, Policy } from '../types/settings';

type Outcome = 'denied' | 'once' | 'always';
type ApiPerm = { id: string; title: string; description: string; status: string; kind?: string };

const categories: { id: PermissionCategory; label: string; icon: typeof WalletIcon }[] = [
  { id: 'spend', label: 'Spend', icon: WalletIcon },
  { id: 'shell', label: 'Shell', icon: TerminalIcon },
  { id: 'skill', label: 'Skills', icon: PuzzleIcon },
  { id: 'ops', label: 'Ops', icon: WrenchIcon },
];

const outcomeText: Record<Outcome, string> = {
  denied: 'Denied',
  once: 'Approved once',
  always: 'Always allowed',
};

const policies: { id: Policy; label: string }[] = [
  { id: 'ask', label: 'Ask' },
  { id: 'always', label: 'Always' },
  { id: 'never', label: 'Never' },
];

function kindToCat(kind?: string): PermissionCategory {
  if (kind === 'shell' || kind === 'spend' || kind === 'skill' || kind === 'ops') return kind;
  return 'skill';
}

function Frame({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  if (embedded) return <div className="max-w-[960px]">{children}</div>;
  return (
    <PageScroll width="max-w-[960px]">
      <PageHeader title="Permissions" description="Gates for money, shell, skills, and chat ops (diagnose / restart ASI). Decide once, or set a standing rule." />
      {children}
    </PageScroll>
  );
}

/** Also rendered inside Settings → Permissions (embedded, no page chrome). */
export function Permissions({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<ApiPerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rules, setRules] = useState(permissionRules);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesBusyId, setRulesBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.permissions();
      setItems(r.items ?? []);
      setError(null);
    } catch {
      setError('Could not reach /api/permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStanding = useCallback(async () => {
    try {
      const r = await api.standingPermissions();
      setRules(r.rules ?? permissionRules);
      setRulesError(null);
    } catch {
      setRulesError('Could not load standing rules');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshStanding();
  }, [refresh, refreshStanding]);

  const act = async (id: string, action: 'approve' | 'deny' | 'always') => {
    setBusyId(id);
    try {
      await api.permAction(id, action);
      await refresh();
    } catch {
      setError('Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const setRulePolicy = async (ruleId: string, policy: Policy) => {
    const prev = rules;
    const next = prev.map((x) => (x.id === ruleId ? { ...x, policy } : x));
    setRules(next);
    setRulesBusyId(ruleId);
    setRulesError(null);
    try {
      const r = await api.putStandingPermissions(next.map(({ id, policy: p }) => ({ id, policy: p })));
      setRules(r.rules ?? next);
    } catch {
      setRules(prev);
      setRulesError('Could not save standing rule');
    } finally {
      setRulesBusyId(null);
    }
  };

  const pending = items.filter((r) => r.status === 'pending').length;

  return (
    <Frame embedded={embedded}>
      <div className="mb-6 flex gap-3 rounded-card bg-bg p-4 ring-1 ring-line">
        <ShieldAlertIcon size={18} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">Fail closed is on.</span> Pending asks come from the live permissions API on :3445.
        </p>
      </div>

      <section aria-labelledby="req-title">
        <h2 id="req-title" className="mb-3 flex items-baseline gap-2 text-[15px] font-semibold text-ink">
          Requests <span className="text-sm font-normal text-muted">{loading ? '…' : `${pending} pending`}</span>
        </h2>
        {error && <p className="mb-2 text-[13px] text-danger">{error}</p>}
        <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {items.length === 0 && !loading && (
            <li className="p-4 text-sm text-muted">No permission requests.</li>
          )}
          {items.map((r) => {
            const cat = categories.find((c) => c.id === kindToCat(r.kind)) ?? categories[2];
            const done = r.status !== 'pending';
            const outcome: Outcome | null =
              r.status === 'denied' ? 'denied' : r.status === 'always' ? 'always' : r.status === 'approved' ? 'once' : null;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-overlay/[0.05] text-muted">
                  <cat.icon size={16} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    {cat.label} · {r.status}
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-ink">{r.title}</div>
                  <div className="text-[12px] text-muted">{r.description}</div>
                </div>
                {done && outcome ? (
                  <span className={`text-[13px] font-medium ${outcome === 'denied' ? 'text-danger' : 'text-success'}`}>
                    {outcomeText[outcome]}
                  </span>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" disabled={busyId === r.id} onClick={() => void act(r.id, 'deny')} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-danger transition-colors duration-150 hover:bg-danger/10 disabled:opacity-40">
                      Deny
                    </button>
                    <button type="button" disabled={busyId === r.id} onClick={() => void act(r.id, 'approve')} className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-40">
                      Approve
                    </button>
                    <button type="button" disabled={busyId === r.id} onClick={() => void act(r.id, 'always')} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40">
                      Always
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="rules-title">
        <h2 id="rules-title" className="mb-1 text-[15px] font-semibold text-ink">Standing rules</h2>
        <p className="mb-4 text-sm text-muted">
          Saved on the server. Anything not listed defaults to Ask (fail closed).
        </p>
        {rulesError && <p className="mb-2 text-[13px] text-danger">{rulesError}</p>}
        <div className="space-y-6">
          {categories.map((c) => (
            <div key={c.id}>
              <h3 className="mb-2 flex items-center gap-2 text-[13px] font-medium text-muted">
                <c.icon size={14} aria-hidden="true" /> {c.label}
              </h3>
              <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
                {rules
                  .filter((r) => r.category === c.id)
                  .map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-ink">{r.label}</div>
                        <div className="text-[12px] text-muted">{r.detail}</div>
                      </div>
                      <div role="radiogroup" aria-label={`${r.label} policy`} className="inline-flex rounded-lg bg-bg p-0.5 ring-1 ring-line">
                        {policies.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            role="radio"
                            aria-checked={r.policy === p.id}
                            disabled={rulesLoading || rulesBusyId === r.id}
                            onClick={() => void setRulePolicy(r.id, p.id)}
                            className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors duration-150 ${
                              r.policy === p.id
                                ? p.id === 'never'
                                  ? 'bg-danger/15 text-danger'
                                  : p.id === 'always'
                                    ? 'bg-success/15 text-success'
                                    : 'bg-raised text-ink'
                                : 'text-muted hover:text-ink'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </Frame>
  );
}
