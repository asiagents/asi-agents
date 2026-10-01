import { getAgent } from '../utils/lookup';

export interface DeskFrame {
  app: string;
  lines: string[];
}

/** No pre-assigned desks — assign from Desk or agent profile when agents exist. */
export const defaultDeskAgents: string[] = [];

export const snapshotFrames: Record<string, DeskFrame[]> = {};

const offlineFrame: DeskFrame = { app: 'Offline', lines: ['Model offline', 'Watch surface read-only', 'All actions blocked'] };

/** Frames for any agent. Agents without hand-written frames get ones built from their current task and skills. */
export function framesFor(agentId: string): DeskFrame[] {
  const agent = getAgent(agentId);
  if (agent?.status === 'offline') return [offlineFrame];
  if (snapshotFrames[agentId]) return snapshotFrames[agentId];
  if (!agent) return [offlineFrame];
  const skills = agent.skills.filter((s) => s.enabled).map((s) => s.name);
  return [
  { app: 'Workspace', lines: [`${agent.name} — ${agent.currentTask}`, 'Sandbox — read-only by default', 'Nothing sends without Approve'] },
  { app: 'Notes', lines: [`Skills: ${skills.slice(0, 2).join(', ') || 'none on'}`, 'Draft saved locally', 'Waiting for next step'] },
  { app: 'Terminal', lines: ['$ desk status', `agent: ${agent.id}`, 'fail closed — ok'] }];

}

/** Kept for API compat; SnapshotContext starts with empty lists (no fake seed times). */
export const snapshotSeed = (agentId: string) =>
[] as { id: string; time: string; frame: number }[];