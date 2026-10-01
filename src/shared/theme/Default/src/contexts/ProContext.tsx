import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@asi-api';
import { chiefProAgent } from '../data/chiefPro';
import { fallbackSkillCatalog } from '../data/proSkills';
import { proCategories } from '../data/proSets';
import { createId } from '../utils/time';
import { readStorage, STORAGE_KEYS, writeStorage } from '../utils/storage';
import { isChiefId } from '../utils/withChief';
import type { ModelId } from '../types/models';
import type { ProAgent, ProSkill } from '../types/pro';



export const CUSTOM_SET = 'custom';



function withChiefPro(agents: ProAgent[]): ProAgent[] {

  const rest = agents.filter((a) => !isChiefId(a.id));

  return [{ ...chiefProAgent, categoryId: rest[0]?.categoryId ?? chiefProAgent.categoryId }, ...rest];

}



interface ProValue {

  activeSetId: string;

  setActiveSet: (id: string) => void;

  /** Agents in the active set with any edits applied. */

  activeAgents: ProAgent[];

  agentsFor: (setId: string) => ProAgent[];

  setAgentSkills: (agentId: string, skills: string[]) => void;

  setAgentModel: (agentId: string, model: ModelId) => void;

  customAgents: ProAgent[];

  addCustomAgent: (a: Omit<ProAgent, 'id' | 'categoryId'>) => void;

  addCatalogAgent: (source: ProAgent) => void;

  removeCustomAgent: (id: string) => void;
  /** Rehydrate a soft-deleted custom agent with its original id. */
  restoreCustomAgent: (a: ProAgent) => void;

  skillsCatalog: ProSkill[];

  skillsCatalogMeta: { total: number; label: string; source: 'api' | 'fallback' };

  skillLabel: (id: string) => string;

}



const ProContext = createContext<ProValue | null>(null);



export function ProProvider({ children }: {children: React.ReactNode;}) {

  const [activeSetId, setActiveSetState] = useState(() => readStorage(STORAGE_KEYS.activeProSetId) ?? 'software');

  const setActiveSet = useCallback((id: string) => {

    setActiveSetState(id);

    writeStorage(STORAGE_KEYS.activeProSetId, id);

  }, []);

  const [skillEdits, setSkillEdits] = useState<Record<string, string[]>>({});

  const [modelEdits, setModelEdits] = useState<Record<string, ModelId>>({});

  const [customAgents, setCustomAgents] = useState<ProAgent[]>([]);

  const [skillsCatalog, setSkillsCatalog] = useState<ProSkill[]>(fallbackSkillCatalog);
  const [skillsCatalogMeta, setSkillsCatalogMeta] = useState({
    total: fallbackSkillCatalog.length,
    label: 'Offline fallback',
    source: 'fallback' as const,
  });

  useEffect(() => {
    void api
      .skillsCatalog({ limit: 500 })
      .then((r) => {
        const skills = r.skills.map((s) => ({ id: s.id, name: s.name, group: s.group }));
        if (skills.length > 0) {
          setSkillsCatalog(skills);
          setSkillsCatalogMeta({ total: r.total, label: r.label, source: 'api' });
        }
      })
      .catch(() => {
        setSkillsCatalog(fallbackSkillCatalog);
        setSkillsCatalogMeta({
          total: fallbackSkillCatalog.length,
          label: 'Offline fallback',
          source: 'fallback',
        });
      });
  }, []);

  const skillLabel = useCallback(
    (id: string) => skillsCatalog.find((s) => s.id === id)?.name ?? id,
    [skillsCatalog],
  );

  const apply = useCallback(

    (a: ProAgent): ProAgent => ({ ...a, skills: skillEdits[a.id] ?? a.skills, model: modelEdits[a.id] ?? a.model }),

    [skillEdits, modelEdits]

  );



  const agentsFor = useCallback(

    (setId: string) => {

      const base =

        setId === CUSTOM_SET ? customAgents : proCategories.find((c) => c.id === setId)?.agents ?? [];

      const mapped = base.map(apply);

      return withChiefPro(mapped.map((a) => ({ ...a, categoryId: setId === CUSTOM_SET ? CUSTOM_SET : a.categoryId })));

    },

    [customAgents, apply]

  );



  const setAgentSkills = useCallback((id: string, skills: string[]) => {

    if (isChiefId(id)) return;

    setSkillEdits((p) => ({ ...p, [id]: skills }));

    setCustomAgents((p) => p.map((a) => a.id === id ? { ...a, skills } : a));

  }, []);

  const setAgentModel = useCallback((id: string, model: ModelId) => {

    if (!isChiefId(id)) setModelEdits((p) => ({ ...p, [id]: model }));

  }, []);

  const addCustomAgent = useCallback((a: Omit<ProAgent, 'id' | 'categoryId'>) => {

    setCustomAgents((p) => [...p, { ...a, id: `c-${createId()}`, categoryId: CUSTOM_SET }]);

  }, []);

  const addCatalogAgent = useCallback((source: ProAgent) => {

    if (isChiefId(source.id)) return;

    setCustomAgents((p) => {

      if (p.some((a) => a.id === source.id || a.name === source.name && a.role === source.role)) return p;

      return [...p, { ...source, id: `c-${createId()}`, categoryId: CUSTOM_SET }];

    });

  }, []);

  const removeCustomAgent = useCallback((id: string) => {
    if (isChiefId(id)) return;
    setCustomAgents((p) => {
      const hit = p.find((a) => a.id === id);
      if (hit) {
        void api
          .softDeleteCustomPro({
            id: hit.id,
            name: hit.name,
            role: hit.role,
            status: 'idle',
            modelId: hit.model ?? null,
            skills: hit.skills ?? [],
            // Stash Pro UI fields for restore (ignored by registry restore path).
            roleTag: hit.look,
            initials: hit.height,
            currentTask: hit.deskAgentId ?? undefined,
          })
          .catch(() => undefined);
      }
      return p.filter((a) => a.id !== id);
    });
  }, []);

  const restoreCustomAgent = useCallback((a: ProAgent) => {
    if (!a?.id || isChiefId(a.id)) return;
    setCustomAgents((p) => {
      if (p.some((x) => x.id === a.id)) return p;
      return [...p, { ...a, categoryId: CUSTOM_SET }];
    });
  }, []);



  useEffect(() => {

    writeStorage(STORAGE_KEYS.activeProSetId, activeSetId);

  }, [activeSetId]);



  const value = useMemo(

    () => ({

      activeSetId,

      setActiveSet,

      activeAgents: agentsFor(activeSetId),

      agentsFor,

      setAgentSkills,

      setAgentModel,

      customAgents,

      addCustomAgent,

      addCatalogAgent,

      removeCustomAgent,

      restoreCustomAgent,

      skillsCatalog,

      skillsCatalogMeta,

      skillLabel,

    }),

    [activeSetId, agentsFor, setAgentSkills, setAgentModel, customAgents, addCustomAgent, addCatalogAgent, removeCustomAgent, restoreCustomAgent, setActiveSet, skillsCatalog, skillsCatalogMeta, skillLabel]

  );

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;

}



export function usePro(): ProValue {

  const ctx = useContext(ProContext);

  if (!ctx) throw new Error('usePro must be used inside ProProvider');

  return ctx;

}



export function categoryName(id: string) {

  return id === CUSTOM_SET ? 'Custom' : proCategories.find((c) => c.id === id)?.name ?? id;

}

