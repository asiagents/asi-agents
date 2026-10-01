import type { TaskCategory, TaskPriority } from '@asi-api';

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  agentId?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  due?: string;
};

/** Personal todos — no product demo rows. Persisted via `/api/tasks` (`origin: todo`). */
export const todoSeed: TodoItem[] = [];

export const todosSetupHint = {
  title: 'No to-dos yet',
  lead: 'Your list starts empty. Add items here — assign to Chief (default), auto-match a specialist, pick an agent, or keep Personal (Boss).',
  steps: [
    'Capture work with a category (Work / Personal / Ops / Research / Finance / General).',
    'Assign to Chief by default, auto-match by role/skills, choose an agent, or keep it Personal.',
    'Open items sync with Tasks (`origin: todo` on :3445).',
  ],
  links: [
    { to: '/chat/chief', label: 'Plan with Chief' },
    { to: '/tasks', label: 'Agent task queue' },
  ],
} as const;
