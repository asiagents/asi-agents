import { proCategories } from '../data/proSets';
import type { Agent } from '../types/agents';
import type { ProAgent } from '../types/pro';
import { CHIEF_ID, isChiefId } from './withChief';

export function proSetLabel(categoryId: string) {
  return categoryId === 'custom' ? 'Custom' : proCategories.find((c) => c.id === categoryId)?.name ?? categoryId;
}

export function findProAgent(id: string): ProAgent | undefined {
  for (const c of proCategories) {
    const hit = c.agents.find((a) => a.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export function isProThreadId(threadId: string): boolean {
  return threadId.startsWith('pro-');
}

export function proThreadAgentId(proId: string): string {
  if (isChiefId(proId)) return CHIEF_ID;
  return `pro-${proId}`;
}

export function proIdFromThread(threadId: string): string {
  return threadId.startsWith('pro-') ? threadId.slice(4) : threadId;
}

/** Minimal core Agent shape for chat chrome when the specialist is from a Pro set. */
export function proAgentAsCore(pro: ProAgent, model = pro.model): Agent {
  return {
    id: proThreadAgentId(pro.id),
    name: pro.name,
    roleTag: pro.role,
    role: `${proSetLabel(pro.categoryId)} specialist`,
    initials: pro.name.slice(0, 2).toUpperCase(),
    cube: '',
    status: 'active',
    primary: model,
    secondary: 'micro',
    currentTask: pro.role,
    lastActive: 'Just now',
    skills: pro.skills.map((s) => ({ name: s, enabled: true, gate: 'ask' as const })),
    learnings: [],
    folders: [],
    cloudUsed: 0,
    cloudCap: 5,
    logEntries: 0,
    isChief: false
  };
}
