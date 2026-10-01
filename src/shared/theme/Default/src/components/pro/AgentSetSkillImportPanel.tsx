import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@asi-api';
import { ArrowRightIcon, LayersIcon } from 'lucide-react';
import { categoryName, usePro } from '../../contexts/ProContext';
import { useAgentsMeta } from '../../contexts/AgentsContext';
import { useDesk } from '../../contexts/DeskContext';
import { proCategories } from '../../data/proSets';
import type { RegistryAgentRow } from '../../data/mapRegistryAgent';
import { findProAgent } from '../../utils/proLookup';
import { isChiefId } from '../../utils/withChief';
import {
  agentDisplayName,
  agentModelHints,
  listAgentSkillIds,
} from '../../utils/agentSkillSources';
import { suggestModelsForSkillImport, isAssignableModelId } from '../../utils/skillModelSuggest';
import type { ModelId } from '../../types/models';
import { modelLabel } from '../../utils/modelScanBridge';

type SourceScope = 'pro-set' | 'board' | 'registry';

const selectCls =
  'mt-1 h-9 w-full rounded-lg bg-surface px-2 text-[13px] text-ink ring-1 ring-line';

function registryRowsFromAgents(
  agents: { id: string; name: string; role: string; roleTag?: string; primary: ModelId; secondary: ModelId; skills: { name: string }[]; isChief?: boolean }[],
): RegistryAgentRow[] {
  return agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    roleTag: a.roleTag,
    status: 'idle',
    modelId: a.primary,
    secondaryModelId: a.secondary,
    skills: a.skills.map((s) => s.name),
    isChief: a.isChief,
  }));
}

/** Import a specific skill from another set/agent onto a Pro or registry target. */
export function AgentSetSkillImportPanel() {
  const { activeSetId, activeAgents, setAgentSkills, setAgentModel } = usePro();
  const { agents, refresh } = useAgentsMeta();
  const { boardIds } = useDesk();

  const registry = useMemo(() => registryRowsFromAgents(agents), [agents]);

  const [scope, setScope] = useState<SourceScope>('pro-set');
  const [proSets, setProSets] = useState<{ id: string; name: string; agentIds: string[] }[]>([]);
  const [sourceSetId, setSourceSetId] = useState(activeSetId);
  const [sourceAgentId, setSourceAgentId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [targetKind, setTargetKind] = useState<'pro' | 'registry'>('pro');
  const [targetProId, setTargetProId] = useState('');
  const [targetRegistryId, setTargetRegistryId] = useState('');
  const [applyModels, setApplyModels] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .proSets()
      .then((r) => setProSets(r.sets))
      .catch(() => setProSets([]));
  }, []);

  const sourceMemberIds = useMemo(() => {
    if (scope === 'board') return boardIds;
    if (scope === 'registry') return registry.map((a) => a.id);
    const hit = proSets.find((s) => s.id === sourceSetId);
    if (hit) return hit.agentIds;
    const local = proCategories.find((c) => c.id === sourceSetId);
    return local ? local.agents.map((a) => a.id) : [];
  }, [scope, boardIds, registry, proSets, sourceSetId]);

  const sourceSkills = useMemo(
    () => (sourceAgentId ? listAgentSkillIds(sourceAgentId, registry) : []),
    [sourceAgentId, registry],
  );

  const modelSuggestion = useMemo(() => {
    if (!skillId || !sourceAgentId) return null;
    const hints = agentModelHints(sourceAgentId, registry);
    return suggestModelsForSkillImport({
      skillId,
      sourcePrimary: hints.primary,
      sourceSecondary: hints.secondary,
    });
  }, [skillId, sourceAgentId, registry]);

  const proTargets = useMemo(
    () => activeAgents.filter((a) => !isChiefId(a.id)),
    [activeAgents],
  );

  const registryTargets = useMemo(
    () => registry.filter((a) => !isChiefId(a.id)),
    [registry],
  );

  useEffect(() => {
    if (!sourceMemberIds.includes(sourceAgentId)) {
      const first = sourceMemberIds.find((id) => !isChiefId(id)) ?? sourceMemberIds[0] ?? '';
      setSourceAgentId(first);
      setSkillId('');
    }
  }, [sourceMemberIds, sourceAgentId]);

  useEffect(() => {
    if (!sourceSkills.includes(skillId)) {
      setSkillId(sourceSkills[0] ?? '');
    }
  }, [sourceSkills, skillId]);

  useEffect(() => {
    if (!proTargets.some((a) => a.id === targetProId)) {
      setTargetProId(proTargets[0]?.id ?? '');
    }
  }, [proTargets, targetProId]);

  useEffect(() => {
    if (!registryTargets.some((a) => a.id === targetRegistryId)) {
      setTargetRegistryId(registryTargets[0]?.id ?? '');
    }
  }, [registryTargets, targetRegistryId]);

  const onApply = useCallback(async () => {
    setError(null);
    setMessage(null);
    if (!sourceAgentId || !skillId) {
      setError('Pick a source agent and a skill from its registry list.');
      return;
    }
    if (!sourceSkills.includes(skillId)) {
      setError('That skill is not on the source agent — nothing invented.');
      return;
    }

    setBusy(true);
    try {
      if (targetKind === 'pro') {
        const target = proTargets.find((a) => a.id === targetProId);
        if (!target) {
          setError('Pick a target agent in your active Pro set.');
          return;
        }
        const merged = Array.from(new Set([...target.skills, skillId]));
        setAgentSkills(target.id, merged);
        if (applyModels && modelSuggestion?.primaryModelId && isAssignableModelId(modelSuggestion.primaryModelId)) {
          setAgentModel(target.id, modelSuggestion.primaryModelId as ModelId);
        }
        const deskId = findProAgent(target.id)?.deskAgentId;
        if (deskId && !isChiefId(deskId)) {
          await api.patchAgentSkills(deskId, skillId, 'attach');
          if (applyModels && modelSuggestion) {
            const patch: { primaryModelId?: string; secondaryModelId?: string } = {};
            if (modelSuggestion.primaryModelId) patch.primaryModelId = modelSuggestion.primaryModelId;
            if (modelSuggestion.secondaryModelId) patch.secondaryModelId = modelSuggestion.secondaryModelId;
            if (patch.primaryModelId || patch.secondaryModelId) {
              await api.patchAgentModels(deskId, patch);
            }
          }
        }
        setMessage(`Attached “${skillId}” to ${target.name} in ${categoryName(activeSetId)}.`);
      } else {
        const targetId = targetRegistryId;
        if (!targetId || isChiefId(targetId)) {
          setError('Pick a registry agent (not Chief).');
          return;
        }
        await api.patchAgentSkills(targetId, skillId, 'attach');
        if (applyModels && modelSuggestion) {
          const patch: { primaryModelId?: string | null; secondaryModelId?: string | null } = {};
          if (modelSuggestion.primaryModelId) patch.primaryModelId = modelSuggestion.primaryModelId;
          if (modelSuggestion.secondaryModelId) patch.secondaryModelId = modelSuggestion.secondaryModelId;
          if (patch.primaryModelId || patch.secondaryModelId) {
            await api.patchAgentModels(targetId, patch);
          }
        }
        await refresh();
        setMessage(`Attached “${skillId}” to registry agent ${targetId} (saved in app-state).`);
      }
    } catch {
      setError('Could not save — is the API on :3445?');
    } finally {
      setBusy(false);
    }
  }, [
    sourceAgentId,
    skillId,
    sourceSkills,
    targetKind,
    targetProId,
    targetRegistryId,
    proTargets,
    applyModels,
    modelSuggestion,
    setAgentSkills,
    setAgentModel,
    activeSetId,
    refresh,
  ]);

  return (
    <div className="space-y-4 rounded-card bg-surface p-4 ring-1 ring-line">
      <div className="flex items-start gap-2">
        <LayersIcon size={16} className="mt-0.5 text-muted" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-semibold text-ink">Import skill from another set</p>
          <p className="mt-0.5 text-[12px] text-muted">
            Choose a real skill from another agent&apos;s <code className="text-[11px]">skills[]</code> (Pro catalog or{' '}
            <code className="text-[11px]">GET /api/agents</code>). Registry file is never rewritten — imports persist in
            app-state when the target is a desk agent.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="space-y-3">
          <legend className="text-[12px] font-medium text-muted">Source</legend>
          <label className="block">
            <span className="text-[12px] text-muted">From</span>
            <select
              className={selectCls}
              value={scope}
              onChange={(e) => setScope(e.target.value as SourceScope)}
            >
              <option value="pro-set">Pro set (server registry)</option>
              <option value="board">Board / council</option>
              <option value="registry">Full agent registry</option>
            </select>
          </label>
          {scope === 'pro-set' && (
            <label className="block">
              <span className="text-[12px] text-muted">Set</span>
              <select
                className={selectCls}
                value={sourceSetId}
                onChange={(e) => setSourceSetId(e.target.value)}
              >
                {proSets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.agentIds.length} agents
                  </option>
                ))}
                {!proSets.length &&
                  proCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (local catalog)
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-[12px] text-muted">Agent</span>
            <select
              className={selectCls}
              value={sourceAgentId}
              onChange={(e) => {
                setSourceAgentId(e.target.value);
                setSkillId('');
              }}
            >
              {sourceMemberIds.map((id) => (
                <option key={id} value={id} disabled={isChiefId(id)}>
                  {agentDisplayName(id, registry)}
                  {isChiefId(id) ? ' — Chief (no exportable skills)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] text-muted">Skill</span>
            <select
              className={selectCls}
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              disabled={sourceSkills.length === 0}
            >
              {sourceSkills.length === 0 ? (
                <option value="">No skills on this agent</option>
              ) : (
                sourceSkills.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))
              )}
            </select>
          </label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-[12px] font-medium text-muted">Target</legend>
          <label className="block">
            <span className="text-[12px] text-muted">Apply to</span>
            <select
              className={selectCls}
              value={targetKind}
              onChange={(e) => setTargetKind(e.target.value as 'pro' | 'registry')}
            >
              <option value="pro">Active Pro set ({categoryName(activeSetId)})</option>
              <option value="registry">Registry / desk agent</option>
            </select>
          </label>
          {targetKind === 'pro' ? (
            <label className="block">
              <span className="text-[12px] text-muted">Pro agent</span>
              <select
                className={selectCls}
                value={targetProId}
                onChange={(e) => setTargetProId(e.target.value)}
              >
                {proTargets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="text-[12px] text-muted">Registry agent</span>
              <select
                className={selectCls}
                value={targetRegistryId}
                onChange={(e) => setTargetRegistryId(e.target.value)}
              >
                {registryTargets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.roleTag || a.role})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-[12px] text-ink">
            <input
              type="checkbox"
              checked={applyModels}
              onChange={(e) => setApplyModels(e.target.checked)}
              className="rounded border-line"
            />
            Suggest models from source agent (desk core ids only)
          </label>
          {modelSuggestion && applyModels && (
            <div className="rounded-lg bg-bg px-3 py-2 text-[12px] text-muted ring-1 ring-line">
              <p>{modelSuggestion.rationale}</p>
              {modelSuggestion.primaryModelId && (
                <p className="mt-1 text-ink">
                  Primary: {modelLabel(modelSuggestion.primaryModelId)} ({modelSuggestion.primaryModelId})
                  {modelSuggestion.secondaryModelId && (
                    <>
                      {' '}
                      · Secondary: {modelLabel(modelSuggestion.secondaryModelId)} ({modelSuggestion.secondaryModelId})
                    </>
                  )}
                </p>
              )}
              {modelSuggestion.catalogHint && (
                <p className="mt-1 text-faint">
                  Catalog filter hint: {modelSuggestion.catalogHint} — browse under Settings → Models.
                </p>
              )}
            </div>
          )}
        </fieldset>
      </div>

      {error && <p className="text-[12px] text-warn">{error}</p>}
      {message && <p className="text-[12px] text-success">{message}</p>}

      <button
        type="button"
        disabled={busy || !skillId || sourceSkills.length === 0}
        onClick={() => void onApply()}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-fg transition-opacity disabled:opacity-50"
      >
        <ArrowRightIcon size={14} aria-hidden="true" />
        {busy ? 'Applying…' : 'Attach skill'}
      </button>
    </div>
  );
}
