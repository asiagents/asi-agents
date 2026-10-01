import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@asi-api';
import { ProAvatar } from './ProAvatar';
import { SkillCatalog } from './SkillCatalog';
import { categoryName, usePro } from '../../contexts/ProContext';
import { models } from '../../data/models';
import type { ModelId } from '../../types/models';
import { findProAgent } from '../../utils/proLookup';
import { isChiefId } from '../../utils/withChief';

const pickable = models.filter((m) => m.tier !== 'status');

/** Edit the active set: each agent's skills (from the shared pool) and its model. */
export function ProAgentEditor() {
  const { activeAgents, activeSetId, setAgentSkills, setAgentModel, skillLabel, skillsCatalogMeta } = usePro();
  const [picked, setPicked] = useState<string | null>(null);
  const [amsSaveNote, setAmsSaveNote] = useState<string | null>(null);
  const current = activeAgents.find((a) => a.id === picked) ?? activeAgents[0];

  const deskAgentId = current ? findProAgent(current.id)?.deskAgentId : undefined;

  useEffect(() => {
    if (!deskAgentId || isChiefId(deskAgentId) || !current) return;
    void api
      .agentAms(deskAgentId)
      .then((snap) => {
        if (snap.enabledSkillIds.length > 0) {
          setAgentSkills(current.id, snap.enabledSkillIds);
        }
      })
      .catch(() => undefined);
  }, [deskAgentId, current?.id, setAgentSkills]);

  const onSkillsChange = useCallback(
    (ids: string[]) => {
      if (!current) return;
      setAgentSkills(current.id, ids);
      setAmsSaveNote(null);
      const deskId = findProAgent(current.id)?.deskAgentId;
      if (deskId && !isChiefId(deskId)) {
        void api
          .putAgentAms(deskId, ids)
          .then(() => setAmsSaveNote(`Saved ${ids.length} catalog picks to app-state for desk agent ${deskId}.`))
          .catch(() => setAmsSaveNote('Could not persist catalog picks — is the API on :3445?'));
      } else {
        setAmsSaveNote('Catalog picks stay in this browser until you link a desk registry agent.');
      }
    },
    [current, setAgentSkills],
  );

  if (activeAgents.length === 0) {
    return <p className="text-[13px] text-muted">This set has no agents yet. Add some under “Build your own”.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <ul className="space-y-1" aria-label={`${categoryName(activeSetId)} agents`}>
        {activeAgents.map((a) => {
          const on = current?.id === a.id;
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-current={on ? 'true' : undefined}
                onClick={() => setPicked(a.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 ${on ? 'bg-accent/10' : 'hover:bg-overlay/[0.04]'}`}>
                
                <ProAvatar agent={a} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{a.name} <span className="font-normal text-muted">({a.role})</span></span>
                  <span className="block truncate text-[11px] text-faint">{a.skills.map(skillLabel).join(', ') || 'No skills'}</span>
                </span>
              </button>
            </li>);

        })}
      </ul>
      {current &&
      <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="mr-auto text-[15px] font-semibold text-ink">
              {current.name} <span className="font-normal text-muted">({current.role}) · {categoryName(current.categoryId)}</span>
            </h3>
            <label className="flex items-center gap-2 text-[12px] text-muted">
              Model
              <select value={current.model} onChange={(e) => setAgentModel(current.id, e.target.value as ModelId)} className="h-8 rounded-lg bg-surface px-2 text-[13px] text-ink ring-1 ring-line">
                {pickable.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
          <SkillCatalog selected={current.skills} onChange={onSkillsChange} label={`${current.name} skills`} />
          {amsSaveNote && <p className="text-[12px] text-muted">{amsSaveNote}</p>}
          <p className="text-[11px] text-faint">
            AMS catalog: {skillsCatalogMeta.total} skills ({skillsCatalogMeta.source === 'api' ? 'live API' : 'offline fallback'}).{' '}
            <Link to="/settings/skills" className="font-medium text-accent-ink hover:underline">
              See all / edit
            </Link>
            . Orchestration not shipped — picks enable the runtime layer only.
          </p>
        </div>
      }
    </div>);

}