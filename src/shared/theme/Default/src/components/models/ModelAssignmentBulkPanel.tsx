import React, { useEffect, useMemo, useState } from 'react';
import { CheckIcon, SearchIcon } from 'lucide-react';
import type { ModelCard } from '@asi-api';
import type { Agent } from '../../types/agents';
import { ModelBrowseFilterBar } from './ModelBrowseFilterBar';
import type { BrowseFilterId } from '../../utils/modelBrowseFilters';
import {
  ASSIGNMENT_ROLE_FILTERS,
  buildPoolAssignmentOptions,
  filterAssignmentOptions,
  type AssignmentRoleFilter,
} from '../../utils/assignmentModelOptions';
import { scanStatusLines } from '../../utils/modelScanStatus';
import type { ModelsScanMeta } from '@asi-api';

type Props = {
  agents: Agent[];
  scanned: ModelCard[];
  scanMeta: ModelsScanMeta | null;
  saving: boolean;
  /** Persisted Browse Models multi-select pool. */
  poolIds: string[];
  /** Prefill highlight from Browse → Assign to agents handoff. */
  initialModelIds?: string[];
  onApplyPrimary: (agentIds: string[], modelId: string) => Promise<void>;
  onApplySecondary: (agentIds: string[], modelId: string) => Promise<void>;
  onAutoAssign: () => Promise<void>;
  onGoBrowse?: () => void;
};

/** Multi-select agents + pool model chips → bulk primary/secondary assign. */
export function ModelAssignmentBulkPanel({
  agents,
  scanned,
  scanMeta,
  saving,
  poolIds,
  initialModelIds,
  onApplyPrimary,
  onApplySecondary,
  onAutoAssign,
  onGoBrowse,
}: Props) {
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [modelIds, setModelIds] = useState<string[]>(() => initialModelIds ?? []);
  const [activeModelId, setActiveModelId] = useState<string | null>(
    () => initialModelIds?.[initialModelIds.length - 1] ?? null
  );
  const [browse, setBrowse] = useState<BrowseFilterId[]>([]);
  const [roles, setRoles] = useState<AssignmentRoleFilter[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!initialModelIds?.length) return;
    setModelIds(initialModelIds);
    setActiveModelId(initialModelIds[initialModelIds.length - 1] ?? null);
  }, [initialModelIds]);

  // Drop chip selections that left the pool
  useEffect(() => {
    const allow = new Set(poolIds);
    setModelIds((prev) => {
      const next = prev.filter((id) => allow.has(id));
      return next.length === prev.length ? prev : next;
    });
    setActiveModelId((prev) => (prev && allow.has(prev) ? prev : null));
  }, [poolIds]);

  const options = useMemo(
    () => buildPoolAssignmentOptions(scanned, poolIds),
    [scanned, poolIds]
  );
  const scannedById = useMemo(() => new Map(scanned.map((m) => [m.id, m])), [scanned]);
  const browseSet = useMemo(() => new Set(browse), [browse]);
  const roleSet = useMemo(() => new Set(roles), [roles]);

  const filtered = useMemo(
    () => filterAssignmentOptions(options, scannedById, browseSet, roleSet, q),
    [options, scannedById, browseSet, roleSet, q]
  );

  const assignModelId = activeModelId ?? modelIds[modelIds.length - 1] ?? null;

  const toggleAgent = (id: string) => {
    setAgentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleModel = (id: string) => {
    setModelIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next;
    });
    setActiveModelId(id);
  };

  const toggleBrowse = (id: BrowseFilterId) => {
    setBrowse((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const toggleRole = (id: AssignmentRoleFilter) => {
    setRoles((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  const assignableAgents = agents.filter((a) => !a.isChief);

  const probeLines = scanStatusLines(scanMeta).filter((l) => l.label === 'Ollama');

  if (poolIds.length === 0) {
    return (
      <div id="quick-assign" className="mb-6 scroll-mt-6 rounded-card bg-bg/80 p-4 ring-1 ring-line">
        <p className="text-[13px] font-medium text-ink">Quick assign</p>
        <p className="mt-2 text-[13px] text-muted">
          Multi-select with <strong className="font-medium text-ink">Pool</strong> checkboxes on Browse → On
          device, then <strong className="font-medium text-ink">Save selection</strong>.
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
    );
  }

  return (
    <div id="quick-assign" className="mb-6 scroll-mt-6 rounded-card bg-bg/80 p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-ink">Quick assign</p>
          <p className="mt-1 text-[12px] text-muted">
            Models from your Browse pool ({poolIds.length}). Select specialists + a model, or auto-assign.
          </p>
        </div>
        <button
          type="button"
          disabled={saving || agents.length === 0}
          onClick={() => void onAutoAssign()}
          className="rounded-lg bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
        >
          Auto assign
        </button>
      </div>

      {probeLines.length > 0 && (
        <p className="mt-2 text-[12px] text-warn">
          {probeLines.map((l) => l.detail).join(' ')}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Agents for bulk assign">
        {assignableAgents.map((a) => {
          const on = agentIds.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleAgent(a.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset ${
                on ? 'bg-accent/15 text-accent-ink ring-accent/40' : 'bg-surface text-ink ring-line'
              }`}
            >
              {on && <CheckIcon size={11} aria-hidden="true" />}
              {a.name}
            </button>
          );
        })}
        {assignableAgents.length === 0 && (
          <span className="text-[12px] text-muted">No specialists to bulk-assign.</span>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <div className="relative max-w-md">
          <SearchIcon
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pool models…"
            className="w-full rounded-lg bg-surface py-2 pl-9 pr-3 text-[13px] text-ink ring-1 ring-line placeholder:text-faint"
          />
        </div>

        <ModelBrowseFilterBar active={browse} onToggle={toggleBrowse} />

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Role filters">
          {ASSIGNMENT_ROLE_FILTERS.map((f) => {
            const active = roles.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleRole(f.id)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                  active ? 'bg-accent/15 text-accent-ink' : 'bg-overlay/[0.06] text-muted hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {filtered.map((m) => {
            const on = modelIds.includes(m.id);
            const active = assignModelId === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleModel(m.id)}
                  className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset ${
                    active
                      ? 'bg-accent-strong/20 text-accent-ink ring-accent/50'
                      : on
                        ? 'bg-accent/10 text-accent-ink ring-accent/30'
                        : 'bg-surface text-ink ring-line'
                  }`}
                >
                  {on && <CheckIcon size={11} aria-hidden="true" />}
                  <span className="truncate">{m.label}</span>
                  <span className="text-[10px] text-faint">({m.id})</span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="text-[12px] text-muted">No pool models match filters — clear filters or add more on Browse.</li>
          )}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving || agentIds.length === 0 || !assignModelId}
          onClick={() => void onApplyPrimary(agentIds, assignModelId!)}
          className="rounded-lg bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
        >
          Set primary on {agentIds.length || '…'} agent(s)
        </button>
        <button
          type="button"
          disabled={saving || agentIds.length === 0 || !assignModelId}
          onClick={() => void onApplySecondary(agentIds, assignModelId!)}
          className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-accent-ink ring-1 ring-line disabled:opacity-50"
        >
          Set secondary (failover)
        </button>
        {assignModelId && (
          <span className="text-[11px] text-muted">
            Applying: <code className="text-ink">{assignModelId}</code>
          </span>
        )}
      </div>
    </div>
  );
}
