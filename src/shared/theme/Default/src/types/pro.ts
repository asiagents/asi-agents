import type { ModelId } from './models';

export type ProHeight = 'short' | 'mid' | 'tall';
export type LookKind = 'human-pixel' | 'creature' | 'cube';

export interface ProLook {
  src: string;
  kind: LookKind;
  label: string;
}

export interface ProSkill {
  id: string;
  name: string;
  group: string;
}

export interface ProAgent {
  id: string;
  name: string;
  role: string;
  categoryId: string;
  /** Key into proLooks, or a core agent id to reuse its cube. */
  look: string;
  height: ProHeight;
  skills: string[];
  model: ModelId;
  /** Core agent whose virtual desktop this agent works on. Clicking opens that desk. */
  deskAgentId?: string;
}

export interface ProCategory {
  id: string;
  name: string;
  blurb: string;
  agents: ProAgent[];
}