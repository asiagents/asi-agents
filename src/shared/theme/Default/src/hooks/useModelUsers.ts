import { useAgents } from '../contexts/AgentsContext';
import { useMemo } from 'react';
import { useDesk } from '../contexts/DeskContext';
import { usePro } from '../contexts/ProContext';
import type { CatalogModel } from '../data/modelCatalog';

export interface ModelUser {
  id: string;
  name: string;
  role: string;
  isChief?: boolean;
}

/** Everyone currently on a model: core agents plus the active Pro set (in Pro mode). */
export function useModelUsers() {
  const agents = useAgents();
  const { agentModels, mode } = useDesk();
  const { activeAgents } = usePro();
  return useMemo(() => {
    return (m: CatalogModel): ModelUser[] => {
      if (!m.coreId) return [];
      const core = agents.
      filter((a) => agentModels[a.id] === m.coreId).
      map((a) => ({ id: a.id, name: a.name, role: a.roleTag, isChief: a.isChief }));
      const pro = mode === 'pro' ? activeAgents.filter((a) => a.model === m.coreId).map((a) => ({ id: a.id, name: a.name, role: a.role })) : [];
      return [...core, ...pro];
    };
  }, [agents, agentModels, mode, activeAgents]);
}