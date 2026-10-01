import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@asi-api';
import { useAgentsMeta } from '../../contexts/AgentsContext';
import { useDesk } from '../../contexts/DeskContext';
import { useModelScan } from '../../hooks/useModelScan';
import { useSelectedModelPool } from '../../hooks/useSelectedModelPool';
import { modelLabel } from '../../utils/modelScanBridge';
import {
  buildAutoAssignments,
  buildPoolAssignmentOptions,
} from '../../utils/assignmentModelOptions';
import type { ModelId } from '../../types/models';
import type { DeskMode } from '../../types/settings';
import { ModelAssignmentBulkPanel } from './ModelAssignmentBulkPanel';

const selectCls = 'mt-1 h-9 w-full max-w-xs rounded-lg bg-bg px-2 text-[13px] text-ink ring-1 ring-line';

const ROUTE_OPTIONS = [
  { value: 'local', label: 'Local first' },
  { value: 'cloud', label: 'Cloud first' },
] as const;

const MODE_SWITCH: { id: DeskMode; label: string }[] = [
  { id: 'super', label: 'Super Agent' },
  { id: 'multi', label: 'Multi Agents' },
  { id: 'pro', label: 'Pro Agents' },
];

/** Agent assignments — full-width; registry defaults with app-state overrides. */
export function AgentModelAssignmentsPanel({
  initialModelIds,
  onGoBrowse,
}: {
  /** Prefill Quick assign model chips (from Browse multi-select). */
  initialModelIds?: string[];
  onGoBrowse?: () => void;
} = {}) {
  const { agents, loading, error, refresh } = useAgentsMeta();
  const { agentModels, setAgentModel, mode, setMode, isTeamMode } = useDesk();
  const { scanned, scanMeta, runScan, loading: scanLoading } = useModelScan();
  const { ids: poolIds } = useSelectedModelPool();
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [routing, setRouting] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .agentRouting()
      .then(({ routing: map }) => setRouting(map ?? {}))
      .catch(() => setRouting({}));
  }, []);

  useEffect(() => {
    if (!initialModelIds?.length) return;
    document.getElementById('quick-assign')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [initialModelIds]);

  const modelOptions = useMemo(
    () => buildPoolAssignmentOptions(scanned, poolIds),
    [scanned, poolIds]
  );

  const ordered = useMemo(() => {
    const chief = agents.find((a) => a.isChief || a.id === 'chief');
    const rest = agents.filter((a) => a !== chief);
    return chief ? [chief, ...rest] : agents;
  }, [agents]);

  const patchModels = async (
    agentId: string,
    patch: {
      primaryModelId?: string | null;
      secondaryModelId?: string | null;
      routePref?: string | null;
    }
  ) => {
    setSaving(agentId);
    setSaveError(null);
    try {
      const res = await api.patchAgentModels(agentId, patch);
      if (patch.primaryModelId) {
        setAgentModel(agentId, patch.primaryModelId as ModelId);
      }
      if ('routePref' in patch) {
        setRouting((prev) => {
          const next = { ...prev };
          const token = res.routePref;
          if (!token) delete next[agentId];
          else next[agentId] = token;
          return next;
        });
      }
      await refresh();
    } catch {
      setSaveError('Could not save model assignment — is the ASI server running?');
    } finally {
      setSaving(null);
    }
  };

  const bulkApply = async (
    agentIds: string[],
    modelId: string,
    slot: 'primary' | 'secondary'
  ) => {
    setBulkSaving(true);
    setSaveError(null);
    try {
      for (const agentId of agentIds) {
        const patch =
          slot === 'primary' ? { primaryModelId: modelId } : { secondaryModelId: modelId };
        await api.patchAgentModels(agentId, patch);
        if (slot === 'primary') {
          setAgentModel(agentId, modelId as ModelId);
        }
      }
      await refresh();
    } catch {
      setSaveError('Bulk assign failed — is the ASI server running?');
    } finally {
      setBulkSaving(false);
    }
  };

  const autoAssign = async () => {
    setBulkSaving(true);
    setSaveError(null);
    try {
      const scannedById = new Map(scanned.map((m) => [m.id, m]));
      const cards = poolIds.map((id) => {
        const found = scannedById.get(id);
        if (found) return found;
        const looksApi =
          id.startsWith('openrouter:') || id.includes(':free') || id.includes('/');
        return {
          id,
          name: modelLabel(id),
          source: 'pool',
          meta: '',
          tags: looksApi ? ['api'] : ['local'],
          paid: false,
          kind: looksApi ? ('api' as const) : ('scanned' as const),
        };
      });
      const plan = buildAutoAssignments(
        ordered.map((a) => a.id),
        cards
      );
      if (Object.keys(plan).length === 0) {
        setSaveError('Auto assign needs at least one model in your Browse pool.');
        return;
      }
      for (const [agentId, slot] of Object.entries(plan)) {
        await api.patchAgentModels(agentId, {
          primaryModelId: slot.primary,
          secondaryModelId: slot.secondary ?? null,
        });
        setAgentModel(agentId, slot.primary as ModelId);
      }
      await refresh();
    } catch {
      setSaveError('Auto assign failed — is the ASI server running?');
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          role="radiogroup"
          aria-label="Desk mode"
          className="inline-flex flex-wrap rounded-lg bg-surface p-1 ring-1 ring-line"
        >
          {MODE_SWITCH.map((opt) => {
            const active = mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(opt.id)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
                  active ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {!isTeamMode && (
          <span className="text-[12px] text-warn">Super mode — specialist rows apply on handoff / Multi.</span>
        )}
        {scanLoading && scanned.length === 0 && (
          <span className="text-[12px] text-muted">Loading models…</span>
        )}
        {!scanLoading && scanned.length === 0 && (
          <button type="button" className="text-[12px] text-muted underline" onClick={() => void runScan()}>
            Scan models
          </button>
        )}
        {poolIds.length > 0 && (
          <span className="text-[12px] text-muted">Pool: {poolIds.length} model(s)</span>
        )}
      </div>

      <ModelAssignmentBulkPanel
        agents={ordered}
        scanned={scanned}
        scanMeta={scanMeta}
        saving={bulkSaving || saving !== null}
        poolIds={poolIds}
        initialModelIds={initialModelIds}
        onApplyPrimary={(ids, modelId) => bulkApply(ids, modelId, 'primary')}
        onApplySecondary={(ids, modelId) => bulkApply(ids, modelId, 'secondary')}
        onAutoAssign={autoAssign}
        onGoBrowse={onGoBrowse}
      />

      {loading && agents.length === 0 && <p className="text-[13px] text-muted">Loading agents…</p>}
      {!loading && agents.length === 0 && (
        <p className="text-[13px] text-muted">
          No agents from GET /api/agents.{error ? ` ${error}` : ''}{' '}
          <button type="button" className="underline" onClick={() => void refresh()}>
            Retry
          </button>
        </p>
      )}
      {!loading && agents.length > 0 && error && (
        <p className="mb-3 text-[12px] text-warn">
          {error} — showing cached roster.{' '}
          <button type="button" className="underline" onClick={() => void refresh()}>
            Retry
          </button>
        </p>
      )}

      {saveError && <p className="mb-3 text-[13px] text-warn">{saveError}</p>}

      {ordered.length > 0 && poolIds.length === 0 && (
        <div className="mb-4 rounded-card bg-surface px-4 py-5 text-center ring-1 ring-line">
          <p className="text-[14px] font-medium text-ink">Save a model pool on Browse first</p>
          <p className="mt-1 text-[12px] text-muted">
            On Browse → On device, multi-select with <strong className="font-medium text-ink">Pool</strong>{' '}
            checkboxes, then <strong className="font-medium text-ink">Save selection</strong>. Set Desk Default
            alone does not fill this list.
          </p>
          {onGoBrowse && (
            <button
              type="button"
              onClick={onGoBrowse}
              className="mt-3 rounded-lg bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-2"
            >
              Browse Models
            </button>
          )}
        </div>
      )}

      {ordered.length > 0 && (
        <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {ordered.map((agent) => {
            const primary = (agentModels[agent.id] ?? agent.primary) as ModelId;
            const secondaryValue = agent.secondary || '';
            const routeValue = routing[agent.id] ?? 'local';
            const routeSelectValue =
              routeValue === 'local' || routeValue === 'cloud' ? routeValue : 'custom';
            const primaryInPool = modelOptions.some((m) => m.id === primary);
            const secondaryInPool = !secondaryValue || modelOptions.some((m) => m.id === secondaryValue);
            return (
              <li key={agent.id} className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">
                    {agent.name}
                    {agent.isChief && (
                      <span className="ml-2 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-ink">
                        Chief · Super routing
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-muted">{agent.roleTag || agent.role}</p>
                </div>
                <div className="flex min-w-[200px] flex-1 flex-wrap gap-4 sm:max-w-xl">
                  <label className="min-w-[200px] flex-1 sm:max-w-xs">
                    <span className="text-[12px] font-medium text-muted">Primary</span>
                    <select
                      className={selectCls}
                      value={primary}
                      disabled={saving === agent.id || poolIds.length === 0}
                      onChange={(e) => {
                        void patchModels(agent.id, { primaryModelId: e.target.value });
                      }}
                    >
                      {!primaryInPool && (
                        <option value={primary}>
                          {modelLabel(primary)} ({primary}) — current
                        </option>
                      )}
                      {modelOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} ({m.id})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-[200px] flex-1 sm:max-w-xs">
                    <span className="text-[12px] font-medium text-muted">Secondary (failover)</span>
                    <select
                      className={selectCls}
                      value={secondaryValue}
                      disabled={saving === agent.id || poolIds.length === 0}
                      onChange={(e) => {
                        const raw = e.target.value;
                        void patchModels(agent.id, { secondaryModelId: raw ? raw : null });
                      }}
                    >
                      <option value="">None</option>
                      {secondaryValue && !secondaryInPool && (
                        <option value={secondaryValue}>
                          {modelLabel(secondaryValue)} ({secondaryValue}) — current
                        </option>
                      )}
                      {modelOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} ({m.id})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-[200px] flex-1 sm:max-w-xs">
                    <span className="text-[12px] font-medium text-muted">Generate route</span>
                    <select
                      className={selectCls}
                      value={routeSelectValue}
                      disabled={saving === agent.id}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'custom') return;
                        void patchModels(agent.id, { routePref: v });
                      }}
                    >
                      {ROUTE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                      {routeSelectValue === 'custom' && (
                        <option value="custom">Pinned: {routeValue}</option>
                      )}
                    </select>
                    {routeSelectValue === 'custom' && (
                      <p className="mt-1 text-[11px] text-muted">
                        Provider pin — edit on{' '}
                        <Link to={`/agents/${agent.id}`} className="underline">
                          agent detail
                        </Link>
                        .
                      </p>
                    )}
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
