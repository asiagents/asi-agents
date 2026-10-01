/**
 * Home To-do module — types, assign modes, classification.
 * Persisted via `/api/tasks` with `origin: "todo"` (unifies toward Tasks).
 */
import type { AgentTask, TaskCategory, TaskPriority, TodoAssignMode } from '@asi-api';

export type { TaskCategory, TaskPriority, TodoAssignMode };

/** Sentinel — Personal (Boss); no agent owns the work. */
export const BOSS_ID = 'boss';

/** Default assignee when creating a Home to-do. */
export const DEFAULT_ASSIGN_MODE: TodoAssignMode = 'chief';
export const CHIEF_ID = 'chief';

export const TODO_CATEGORIES: { id: TaskCategory; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'work', label: 'Work' },
  { id: 'personal', label: 'Personal' },
  { id: 'ops', label: 'Ops' },
  { id: 'research', label: 'Research' },
  { id: 'finance', label: 'Finance' },
];

export const ASSIGN_MODES: { id: TodoAssignMode; label: string; hint: string }[] = [
  { id: 'chief', label: 'Chief', hint: 'Assign to Chief (default)' },
  { id: 'auto', label: 'Auto', hint: 'Match role / skills; else Chief' },
  { id: 'agent', label: 'Agent', hint: 'Pick a specialist' },
  { id: 'personal', label: 'Personal', hint: 'Boss only — no agent' },
];

export const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
];

/** Desk / UI shape mapped from AgentTask. */
export type Todo = {
  id: string;
  text: string;
  done: boolean;
  agentId: string;
  status: AgentTask['status'];
  category?: TaskCategory;
  priority?: TaskPriority;
  due?: string;
  origin?: AgentTask['origin'];
};

export function taskToTodo(t: AgentTask): Todo {
  return {
    id: t.id,
    text: t.title,
    done: t.status === 'completed' || (t.status as string) === 'done',
    agentId: t.agentId,
    status: t.status,
    category: t.category,
    priority: t.priority ?? 'normal',
    due: t.due,
    origin: t.origin,
  };
}

/** Home / /todos list: explicit todo origin, or legacy rows without research/board/cron. */
export function isTodoTask(t: AgentTask): boolean {
  if (t.origin === 'todo') return true;
  if (t.researchId) return false;
  if (t.origin === 'research' || t.origin === 'board' || t.origin === 'cron') return false;
  // Pre-origin legacy tasks: show on Home until classified.
  return t.origin == null;
}

export function assigneeLabel(agentId: string, agents: { id: string; name: string }[]): string {
  if (agentId === BOSS_ID) return 'Boss';
  if (agentId === CHIEF_ID) return 'Chief';
  return agents.find((a) => a.id === agentId)?.name ?? agentId;
}

export function categoryLabel(c?: TaskCategory): string {
  return TODO_CATEGORIES.find((x) => x.id === c)?.label ?? 'General';
}
