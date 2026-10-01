import { useCallback, useEffect, useState } from 'react';
import { api, type AgentTask, type TaskCategory, type TaskPriority, type TodoAssignMode } from '@asi-api';
import { isTaskComplete, normalizeTaskStatus, toggleTaskStatus } from '../utils/taskStatus';
import { useNotifications } from '../contexts/NotificationContext';
import { useDesk } from '../contexts/DeskContext';
import { BOSS_ID, DEFAULT_ASSIGN_MODE, isTodoTask, taskToTodo, type Todo } from './types';

export type AddTodoInput = {
  text: string;
  assignMode?: TodoAssignMode;
  agentId?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  due?: string;
};

function honestApiError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const msg = (raw || fallback).trim();
  if (/failed to fetch|networkerror|could not reach|load failed|econnrefused/i.test(msg)) {
    return 'API unreachable — is ASI running on :3445?';
  }
  if (/cors/i.test(msg)) {
    return 'CORS blocked the Tasks API — use the same-origin UI on :3445.';
  }
  if (msg === 'title required' || msg === 'invalid status' || msg === 'invalid priority' || msg === 'invalid category') {
    return `Could not add to-do: ${msg}`;
  }
  if (msg.startsWith('Could not')) return msg;
  return `${fallback}: ${msg}`;
}

/**
 * Home / Todos page — loads `origin: todo` (+ legacy non-research) from Tasks API.
 */
export function useTodos() {
  const { notify } = useNotifications();
  const { requestApproval } = useDesk();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.tasks();
      const list = (r.tasks ?? [])
        .filter(isTodoTask)
        .map((t) => taskToTodo({ ...t, status: normalizeTaskStatus(t.status) }));
      setTodos(list);
      setError(null);
    } catch (err) {
      setError(honestApiError(err, 'Could not load to-dos'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pingBossForAssign = useCallback(
    (todo: Todo, kickoff?: { chatSeeded?: boolean } | null) => {
      if (!todo.agentId || todo.agentId === BOSS_ID) return;
      const chatHint = kickoff?.chatSeeded === false
        ? 'Chat seed skipped — open chat to kick off.'
        : 'Chat seeded (queued, waiting for model).';
      notify({
        kind: 'approval',
        title: `Assigned to ${todo.agentId}`,
        detail: `${todo.text} — ${chatHint}`,
        to: `/chat/${todo.agentId === 'chief' ? 'chief' : todo.agentId}`,
      });
      if (todo.priority === 'high') {
        requestApproval({
          threadId: todo.agentId === 'chief' ? 'chief' : todo.agentId,
          agentId: todo.agentId,
          kind: 'permission',
          title: `High-priority to-do: ${todo.text}`,
          detail: 'Agent was assigned a high-priority Home to-do. Confirm they should start, or keep it queued.',
        });
      }
    },
    [notify, requestApproval]
  );

  const addTodo = useCallback(async (input: AddTodoInput | string) => {
    const opts: AddTodoInput = typeof input === 'string' ? { text: input } : input;
    const title = opts.text.trim();
    if (!title) return null;
    try {
      const { task, kickoff } = await api.createTask({
        title,
        origin: 'todo',
        assignMode: opts.assignMode ?? DEFAULT_ASSIGN_MODE,
        agentId: opts.agentId,
        category: opts.category,
        priority: opts.priority ?? 'normal',
        due: opts.due,
        suggestCategory: !opts.category,
        status: 'pending',
        startWork: true,
      });
      const todo = taskToTodo({ ...task, status: normalizeTaskStatus(task.status) });
      setTodos((p) => [todo, ...p.filter((t) => t.id !== todo.id)]);
      setError(null);
      pingBossForAssign(todo, kickoff);
      return todo;
    } catch (err) {
      setError(honestApiError(err, 'Could not add to-do'));
      return null;
    }
  }, [pingBossForAssign]);

  const toggleTodo = useCallback(async (id: string) => {
    const cur = todos.find((t) => t.id === id);
    if (!cur) return;
    setBusyId(id);
    try {
      const next = toggleTaskStatus(cur.status);
      const { task } = await api.patchTask(id, { status: next });
      const todo = taskToTodo({ ...task, status: normalizeTaskStatus(task.status) });
      setTodos((p) => p.map((t) => (t.id === id ? todo : t)));
      if (todo.agentId && todo.agentId !== BOSS_ID) {
        if (isTaskComplete(todo.status)) {
          notify({
            kind: 'agentDone',
            title: `${todo.agentId} finished a to-do`,
            detail: todo.text,
            to: '/todos',
          });
        }
      }
      setError(null);
    } catch (err) {
      setError(honestApiError(err, 'Could not update to-do'));
    } finally {
      setBusyId(null);
    }
  }, [todos, notify]);

  const removeTodo = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await api.deleteTask(id);
      setTodos((p) => p.filter((t) => t.id !== id));
      setError(null);
    } catch (err) {
      setError(honestApiError(err, 'Could not delete to-do'));
    } finally {
      setBusyId(null);
    }
  }, []);

  const reassignTodo = useCallback(async (id: string, agentId: string) => {
    setBusyId(id);
    try {
      const { task, kickoff } = await api.patchTask(id, { agentId, startWork: true });
      const todo = taskToTodo({ ...task, status: normalizeTaskStatus(task.status) });
      setTodos((p) => p.map((t) => (t.id === id ? todo : t)));
      pingBossForAssign(todo, kickoff);
      setError(null);
    } catch (err) {
      setError(honestApiError(err, 'Could not reassign'));
    } finally {
      setBusyId(null);
    }
  }, [pingBossForAssign]);

  const updateTodo = useCallback(async (id: string, patch: { title?: string; agentId?: string; category?: TaskCategory }) => {
    const body: { title?: string; agentId?: string; category?: TaskCategory; startWork?: boolean } = {};
    if (patch.title != null) body.title = patch.title.trim();
    if (patch.agentId != null) {
      body.agentId = patch.agentId;
      body.startWork = true;
    }
    if (patch.category != null) body.category = patch.category;
    if (!body.title && body.agentId == null && body.category == null) return;
    setBusyId(id);
    try {
      const { task, kickoff } = await api.patchTask(id, body);
      const todo = taskToTodo({ ...task, status: normalizeTaskStatus(task.status) });
      setTodos((p) => p.map((t) => (t.id === id ? todo : t)));
      if (patch.agentId) pingBossForAssign(todo, kickoff);
      setError(null);
    } catch (err) {
      setError(honestApiError(err, 'Could not update to-do'));
    } finally {
      setBusyId(null);
    }
  }, [pingBossForAssign]);

  const setCategory = useCallback(async (id: string, category: TaskCategory) => {
    try {
      const { task } = await api.patchTask(id, { category });
      setTodos((p) =>
        p.map((t) => (t.id === id ? taskToTodo({ ...task, status: normalizeTaskStatus(task.status) }) : t))
      );
      setError(null);
    } catch (err) {
      setError(honestApiError(err, 'Could not update category'));
    }
  }, []);

  const openTodos = todos.filter((t) => !isTaskComplete(t.status));
  const doneTodos = todos.filter((t) => isTaskComplete(t.status));

  return {
    todos,
    openTodos,
    doneTodos,
    loading,
    error,
    busyId,
    refresh,
    addTodo,
    toggleTodo,
    removeTodo,
    reassignTodo,
    updateTodo,
    setCategory,
  };
}

/** Sync a raw AgentTask into local todo list shape (research brief helper). */
export function upsertTodoFromTask(task: AgentTask, prev: Todo[]): Todo[] {
  const todo = taskToTodo({ ...task, status: normalizeTaskStatus(task.status) });
  const without = prev.filter((t) => t.id !== todo.id);
  return [todo, ...without];
}
