import type { CompanionStateId } from './assets';

export type CompanionTask = {
  id: string;
  text: string;
  status: string;
  done: boolean;
};

export type CompanionSignals = {
  tasks: CompanionTask[];
  openApprovals: number;
  typing: boolean;
  pointerNear: boolean;
  celebrating: boolean;
  lookDown: boolean;
  /** Lock screen: prefer idle/humming; urgent_ask when needs user; skip click/typing chrome. */
  onLock?: boolean;
};

/**
 * Priority: urgent → typing → jump → working → click invite → look_down → humming → idle
 * Lock: urgent_ask when blocked/approvals; otherwise idle/humming only.
 */
export function resolveSquariState(s: CompanionSignals): CompanionStateId {
  if (s.openApprovals > 0 || s.tasks.some((t) => t.status === 'blocked')) return 'urgent_ask';
  if (s.onLock) {
    if (s.tasks.some((t) => t.done) && s.tasks.every((t) => t.done || t.status === 'cancelled')) {
      return 'humming';
    }
    return 'idle';
  }
  if (s.typing) return 'typing';
  if (s.celebrating) return 'jump';
  const working = s.tasks.some(
    (t) => !t.done && (t.status === 'ongoing' || t.status === 'pending' || t.status === 'in_progress')
  );
  if (working) return 'working';
  if (s.pointerNear) return 'click_chat';
  if (s.lookDown) return 'look_down';
  if (s.tasks.some((t) => t.done) && s.tasks.every((t) => t.done || t.status === 'cancelled')) {
    return 'humming';
  }
  return 'idle';
}

export const LOOK_AT_DAMPEN = new Set<CompanionStateId>(['urgent_ask', 'typing', 'jump']);
