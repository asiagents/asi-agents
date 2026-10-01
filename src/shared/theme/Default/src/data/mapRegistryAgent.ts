import type { Agent, AgentStatus, Skill } from '../types/agents';
import type { ModelId } from '../types/models';
import { themeAssetUrl } from '../utils/themeAssets';

export type RegistryAgentRow = {
  id: string;
  name: string;
  role: string;
  status: string;
  modelId: string | null;
  secondaryModelId?: string | null;
  skills: string[];
  source?: string;
  updatedAt?: string | null;
  avatar?: string | null;
  roleTag?: string | null;
  initials?: string | null;
  isChief?: boolean;
  currentTask?: string | null;
  learnings?: string[];
  /** Org chart manager. null/omit = flat peer. */
  reportsTo?: string | null;
};

const VALID_STATUS: AgentStatus[] = ['active', 'idle', 'waiting', 'offline'];

function statusOf(raw: string): AgentStatus {
  return (VALID_STATUS as string[]).includes(raw) ? (raw as AgentStatus) : 'idle';
}

function avatarUrl(avatar: string | null | undefined, id: string): string {
  if (!avatar) return '';
  if (avatar.startsWith('/') || avatar.startsWith('http')) return avatar;
  return themeAssetUrl(avatar) ?? `/${avatar.replace(/^\//, '')}`;
}

function initialsOf(row: RegistryAgentRow): string {
  if (row.initials) return row.initials;
  const parts = row.name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return row.name.slice(0, 2).toUpperCase() || row.id.slice(0, 2).toUpperCase();
}

/** Map GET /api/agents row → Default theme Agent (local avatar paths only). */
export function mapRegistryAgent(row: RegistryAgentRow): Agent {
  const skills: Skill[] = (row.skills ?? []).map((name) => ({
    name,
    enabled: true,
    gate: 'free' as const,
  }));
  const model = (row.modelId || 'micro') as ModelId;
  const secondary = (row.secondaryModelId ? row.secondaryModelId : '') as ModelId;
  return {
    id: row.id,
    name: row.name,
    roleTag: row.roleTag || 'Agent',
    role: row.role || '',
    initials: initialsOf(row),
    cube: avatarUrl(row.avatar, row.id),
    status: statusOf(row.status),
    primary: model,
    secondary,
    currentTask: row.currentTask || 'Ready',
    lastActive: row.updatedAt || 'now',
    skills,
    learnings: Array.isArray(row.learnings) ? row.learnings.map(String).filter(Boolean) : [],
    folders: [],
    cloudUsed: 0,
    cloudCap: 0,
    logEntries: 0,
    isChief: row.isChief === true || row.id === 'chief',
    reportsTo: row.reportsTo?.trim() || null,
  };
}
