import type { RegistryAgentRow } from '../data/mapRegistryAgent';
import { findProAgent } from './proLookup';
import type { ModelId } from '../types/models';

/** Registry + Pro catalog skills for an agent id (fail-closed: empty when unknown). */
export function listAgentSkillIds(agentId: string, registry: RegistryAgentRow[]): string[] {
  const pro = findProAgent(agentId);
  if (pro) return [...pro.skills];
  const row = registry.find((a) => a.id === agentId);
  if (!row) return [];
  return (row.skills ?? []).map((s) => String(s)).filter(Boolean);
}

export function agentModelHints(
  agentId: string,
  registry: RegistryAgentRow[],
): { primary: string | null; secondary: string | null; proModel: ModelId | null } {
  const pro = findProAgent(agentId);
  if (pro) {
    return { primary: pro.model, secondary: 'micro', proModel: pro.model };
  }
  const row = registry.find((a) => a.id === agentId);
  return {
    primary: row?.modelId ?? null,
    secondary: row?.secondaryModelId ?? null,
    proModel: null,
  };
}

export function agentDisplayName(agentId: string, registry: RegistryAgentRow[]): string {
  const pro = findProAgent(agentId);
  if (pro) return `${pro.name} (${pro.role})`;
  const row = registry.find((a) => a.id === agentId);
  if (row) return `${row.name} (${row.roleTag || row.role})`;
  return agentId;
}
