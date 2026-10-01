/**
 * Client-side category / auto-assign hints (mirrors server todoAssign; UI preview).
 * Server remains authoritative on create.
 */
import type { Agent } from '../types/agents';
import {
  BOSS_ID,
  CHIEF_ID,
  type TaskCategory,
  type TodoAssignMode,
} from './types';

const CATEGORY_HINTS: { category: TaskCategory; words: string[] }[] = [
  { category: 'finance', words: ['budget', 'invoice', 'payroll', 'expense', 'spend', 'tax', 'finance', 'money', 'payment'] },
  { category: 'research', words: ['research', 'brief', 'literature', 'cite', 'survey', 'investigate', 'look up', 'find out'] },
  { category: 'ops', words: ['deploy', 'ops', 'server', 'uptime', 'incident', 'restart', 'infra', 'monitor', 'backup'] },
  { category: 'work', words: ['meeting', 'deadline', 'client', 'project', 'ship', 'launch', 'standup', 'sprint'] },
  { category: 'personal', words: ['personal', 'family', 'errand', 'grocery', 'doctor', 'gym', 'home'] },
];

const CATEGORY_AGENT_HINTS: Record<TaskCategory, string[]> = {
  finance: ['finance', 'budget', 'spend', 'money', 'invoice'],
  research: ['research', 'cite', 'literature', 'find', 'analyst'],
  ops: ['ops', 'devops', 'infra', 'server', 'shell'],
  work: ['project', 'manager', 'plan', 'coord'],
  personal: [],
  general: [],
};

export function suggestCategory(text: string, fallback: TaskCategory = 'general'): TaskCategory {
  const hay = text.toLowerCase();
  let best: TaskCategory = fallback;
  let bestScore = 0;
  for (const row of CATEGORY_HINTS) {
    let score = 0;
    for (const w of row.words) {
      if (hay.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = row.category;
    }
  }
  return best;
}

function corpus(a: Agent): string {
  return [
    a.id,
    a.name,
    a.role,
    a.roleTag,
    ...a.skills.map((s) => s.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function scoreAgentForTodo(agent: Agent, text: string, category?: TaskCategory): number {
  if (agent.isChief || agent.id === CHIEF_ID || agent.id === BOSS_ID) return 0;
  const bag = corpus(agent);
  if (!bag.trim()) return 0;
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/)
    .filter((t) => t.length >= 2);
  let score = 0;
  for (const t of tokens) {
    if (bag.includes(t)) score += 1;
  }
  for (const h of category ? CATEGORY_AGENT_HINTS[category] : []) {
    if (bag.includes(h)) score += 2;
  }
  return score;
}

export function resolveLocalAssignee(opts: {
  mode: TodoAssignMode;
  text: string;
  category?: TaskCategory;
  agentId?: string;
  agents: Agent[];
}): string {
  if (opts.mode === 'personal') return BOSS_ID;
  if (opts.mode === 'chief') return CHIEF_ID;
  if (opts.mode === 'agent') {
    const id = (opts.agentId ?? '').trim();
    return id && id !== BOSS_ID ? id : CHIEF_ID;
  }
  let bestId = CHIEF_ID;
  let bestScore = 0;
  for (const a of opts.agents) {
    const s = scoreAgentForTodo(a, opts.text, opts.category);
    if (s > bestScore) {
      bestScore = s;
      bestId = a.id;
    }
  }
  return bestScore >= 2 ? bestId : CHIEF_ID;
}
