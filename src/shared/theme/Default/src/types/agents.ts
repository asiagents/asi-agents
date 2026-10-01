import type { ModelId } from './models';

export type AgentStatus = 'active' | 'idle' | 'waiting' | 'offline';
export type SkillGate = 'free' | 'ask' | 'blocked';

export interface Skill {
  name: string;
  enabled: boolean;
  gate: SkillGate;
}

export interface AgentFolder {
  name: string;
  access: 'read' | 'read-write';
  items: number;
}

export interface Agent {
  id: string;
  name: string;
  roleTag: string;
  role: string;
  initials: string;
  cube: string;
  gif?: string;
  status: AgentStatus;
  primary: ModelId;
  secondary: ModelId;
  currentTask: string;
  lastActive: string;
  skills: Skill[];
  learnings: string[];
  folders: AgentFolder[];
  cloudUsed: number;
  cloudCap: number;
  logEntries: number;
  isChief?: boolean;
  /** Org chart manager. null/undefined = flat peer (default on hire). */
  reportsTo?: string | null;
}

export interface OrgNode {
  id: string;
  parentId: string | null;
}