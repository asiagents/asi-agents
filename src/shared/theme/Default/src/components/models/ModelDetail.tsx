import { useAgents, useAgentsMeta } from '../../contexts/AgentsContext';
import React, { useState } from 'react';
import { ArrowLeftIcon, StarIcon, UserPlusIcon } from 'lucide-react';
import { NeuralMap } from './NeuralMap';
import { StatusBadge } from './StatusBadge';
import { useDesk } from '../../contexts/DeskContext';
import { usePrefs } from '../../contexts/PrefsContext';
import { usePro } from '../../contexts/ProContext';
import { useRecommendedModels } from '../../hooks/useRecommendedModels';
import { useModelUsers } from '../../hooks/useModelUsers';
import type { ModelId } from '../../types/models';
import { effectiveStatus, offlineReason } from '../../utils/modelStatus';
import type { CatalogModel } from '../../data/modelCatalog';

export function ModelDetail({ model, onBack }: {model: CatalogModel;onBack: () => void;}) {
  const agents = useAgents();
  const { loading: agentsLoading, error: agentsError, refresh: refreshAgents } = useAgentsMeta();
  const { localOn, onlineOn, setAgentModel, mode } = useDesk();
  const { providers } = usePrefs();
  const { activeAgents, setAgentModel: setProAgentModel } = usePro();
  const { add, remove, has } = useRecommendedModels();
  const [assignId, setAssignId] = useState('');
  const users = useModelUsers()(model);
  const coreId = model.coreId;
  const status = effectiveStatus(model, localOn, onlineOn, providers);
  const reason = offlineReason(model, localOn, onlineOn, providers);

  const facts: [string, React.ReactNode][] = [
  ['Provider', model.provider],
  ['Status', <StatusBadge key="s" status={status} />],
  ['Params', model.params],
  ['Latency', status === 'dead' ? '—' : `~${model.latencyMs} ms (est.)`],
  ['Encrypted', model.encrypted ? 'Yes' : model.lane === 'local' ? 'Not needed · local' : 'No'],
  ['Source', model.source === 'scanned' ? 'Scanned on this device' : model.source === 'downloadable' ? 'Downloadable' : 'Connected API']];


  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-overlay/[0.05] hover:text-ink">
        <ArrowLeftIcon size={14} aria-hidden="true" /> All models
      </button>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{model.name}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{model.note}</p>
        </div>
        {reason && status !== 'online' && <span className="rounded-full bg-overlay/[0.06] px-2.5 py-1 text-[12px] font-medium text-muted">{reason}</span>}
      </div>

      <NeuralMap model={model} users={users} online={status === 'online'} />

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <dl className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {facts.map(([k, v]) =>
          <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right text-ink">{v}</dd>
            </div>
          )}
        </dl>
        <section className="rounded-card bg-surface p-4 ring-1 ring-line" aria-labelledby="model-actions">
          <h3 id="model-actions" className="text-[13px] font-semibold text-ink">Actions</h3>
          {coreId &&
          <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="block min-w-[200px] flex-1">
                <span className="text-[12px] font-medium text-muted">Assign to</span>
                <select value={assignId} onChange={(e) => setAssignId(e.target.value)} className="mt-1 h-9 w-full rounded-lg bg-bg px-2 text-[13px] text-ink ring-1 ring-line">
                  <option value="">Choose agent…</option>
                  {agents.map((a) => <option key={a.id} value={`core:${a.id}`}>{a.name} ({a.roleTag || a.role || 'Agent'})</option>)}
                  {mode === 'pro' && activeAgents.map((a) => <option key={a.id} value={`pro:${a.id}`}>{a.name} ({a.role})</option>)}
                </select>
                            {!agentsLoading && agents.length === 0 && (
                <p className="mt-1 text-[12px] text-muted">
                  No registry agents yet.{agentsError ? ` ${agentsError}` : ''}{' '}
                  <button type="button" className="underline" onClick={() => void refreshAgents()}>Retry</button>
                </p>
              )}
              {agentsLoading && agents.length === 0 && (
                <p className="mt-1 text-[12px] text-muted">Loading agents…</p>
              )}
              </label>
              <button
              type="button"
              disabled={!assignId || !coreId}
              onClick={() => {
                if (!coreId || !assignId) return;
                const [kind, id] = assignId.split(':');
                if (kind === 'core') setAgentModel(id, coreId as ModelId);
                else setProAgentModel(id, coreId as ModelId);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent-strong px-3 text-[13px] font-medium text-white disabled:opacity-40">
              
                <UserPlusIcon size={14} aria-hidden="true" /> Assign
              </button>
            </div>
          }
          {model.source === 'downloadable' && (
            <div className="mt-3 rounded-lg bg-bg p-3 text-[12px] text-muted ring-1 ring-line">
              <p className="font-medium text-ink">Not on this device</p>
              <p className="mt-1">
                {model.provider === 'AMS' ? (
                  <>
                    Obtain a real <strong className="font-medium text-ink">.gguf</strong> (not shipped in-repo),
                    name it so the filename matches the recipe (e.g.{' '}
                    <code className="text-[11px]">ams-micro-70m-q4_k_m.gguf</code>), place under{' '}
                    <code className="text-[11px]">models/ams</code>, then Scan. Verify with{' '}
                    <code className="text-[11px]">node scripts/verify-ams-gguf.mjs</code>. See{' '}
                    <code className="text-[11px]">models/ams/README.md</code> for size/hardware and install steps.
                  </>
                ) : (
                  <>
                    Add a <strong className="font-medium text-ink">.gguf</strong> under{' '}
                    <code className="text-[11px]">models/custom</code> or build{' '}
                    <code className="text-[11px]">models/router</code>, then scan on the Browse tab.
                  </>
                )}
              </p>
            </div>
          )}
          <button
          type="button"
          onClick={() => has(model.id) ? remove(model.id) : add(model.id)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
          
            <StarIcon size={14} className={has(model.id) ? 'text-warn' : 'text-faint'} aria-hidden="true" />
            {has(model.id) ? 'Remove from recommended' : 'Add to recommended'}
          </button>
        </section>

        <section aria-labelledby="used-by" className="rounded-card bg-surface p-4 ring-1 ring-line md:col-span-2">
          <h3 id="used-by" className="text-[13px] font-semibold text-ink">Used by</h3>
          {users.length === 0 ?
          <p className="mt-2 text-[13px] text-muted">No agent is on this model. Assign one from its chat panel or Settings → Pro agents.</p> :

          <ul className="mt-2 flex flex-wrap gap-1.5">
              {users.map((u) =>
            <li key={u.id} className="rounded-full bg-overlay/[0.05] px-2.5 py-1 text-[12px] text-ink">
                  {u.name} <span className="text-muted">({u.role})</span>
                </li>
            )}
            </ul>
          }
        </section>
      </div>
    </div>);

}