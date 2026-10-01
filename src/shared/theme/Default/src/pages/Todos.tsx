import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ListTodoIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { PageHeader, PageScroll } from '../components/PageScroll';
import { useAgents } from '../contexts/AgentsContext';
import { PlanningSetupEmpty } from './PlanningSetupEmpty';
import { todosSetupHint } from '../data/todos';
import { useTodos } from '../todo/useTodos';
import { suggestCategory } from '../todo/assign';
import {
  ASSIGN_MODES,
  BOSS_ID,
  CHIEF_ID,
  DEFAULT_ASSIGN_MODE,
  PRIORITIES,
  TODO_CATEGORIES,
  assigneeLabel,
  categoryLabel,
  type TaskCategory,
  type TaskPriority,
  type TodoAssignMode,
} from '../todo/types';

const field =
  'rounded-lg bg-surface px-3 py-2 text-sm text-ink outline-none ring-1 ring-line focus:ring-accent/60';
const select =
  'rounded-lg bg-surface px-2.5 py-2 text-[13px] text-ink outline-none ring-1 ring-line focus:ring-accent/60';

export function Todos() {
  const agents = useAgents();
  const [searchParams] = useSearchParams();
  const focusTodoId = searchParams.get('todo');
  const { todos, addTodo, toggleTodo, removeTodo, reassignTodo, busyId, error, loading } = useTodos();
  const [text, setText] = useState('');
  const [assignMode, setAssignMode] = useState<TodoAssignMode>(DEFAULT_ASSIGN_MODE);
  const [agentId, setAgentId] = useState(CHIEF_ID);
  const [category, setCategory] = useState<TaskCategory | ''>('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [due, setDue] = useState('');

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);
  const empty = !loading && todos.length === 0;
  const agentOptions = useMemo(() => agents.filter((a) => a.id !== BOSS_ID), [agents]);

  useEffect(() => {
    if (!focusTodoId || loading) return;
    const el = document.getElementById(`todo-${focusTodoId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-accent/50');
    const t = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-accent/50');
    }, 2200);
    return () => window.clearTimeout(t);
  }, [focusTodoId, loading, todos]);

  return (
    <PageScroll width="max-w-2xl">
      <PageHeader
        title="To-dos"
        description={
          empty
            ? 'Personal + agent list · synced with Tasks'
            : `${open.length} open · ${done.length} done`
        }
      />

      <form
        className="mb-6 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          void addTodo({
            text: text.trim(),
            assignMode,
            agentId: assignMode === 'agent' ? agentId : undefined,
            category: category || suggestCategory(text),
            priority,
            due: due.trim() || undefined,
          });
          setText('');
          setDue('');
        }}
      >
        <div className="flex gap-2">
          <label htmlFor="new-todo" className="sr-only">
            New to-do
          </label>
          <input
            id="new-todo"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a to-do"
            className={`flex-1 ${field}`}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            <PlusIcon size={15} aria-hidden="true" /> Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={assignMode}
            onChange={(e) => setAssignMode(e.target.value as TodoAssignMode)}
            className={select}
            aria-label="Assign mode"
          >
            {ASSIGN_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.hint}
              </option>
            ))}
          </select>
          {assignMode === 'agent' ? (
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className={select}
              aria-label="Agent"
            >
              {agentOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory | '')}
            className={select}
            aria-label="Category"
          >
            <option value="">Auto category</option>
            {TODO_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className={select}
            aria-label="Priority"
          >
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={select}
            aria-label="Due date"
          />
        </div>
      </form>

      {error ? <p className="mb-3 text-[13px] text-danger">{error}</p> : null}

      {empty ? (
        <PlanningSetupEmpty hint={todosSetupHint} icon={ListTodoIcon} />
      ) : (
        <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {[...open, ...done].map((t) => (
            <li
              id={`todo-${t.id}`}
              key={t.id}
              className={`flex items-start gap-3 px-4 py-3 transition-shadow duration-300 ${
                focusTodoId === t.id ? 'bg-accent/5' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={t.done}
                disabled={busyId === t.id}
                onChange={() => void toggleTodo(t.id)}
                aria-label={t.text}
                className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]"
              />
              <div className="min-w-0 flex-1">
                <span className={`block text-sm ${t.done ? 'text-faint line-through' : 'text-ink'}`}>
                  {t.text}
                </span>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <select
                    value={t.agentId}
                    disabled={busyId === t.id}
                    onChange={(e) => void reassignTodo(t.id, e.target.value)}
                    className="rounded-md bg-bg px-1.5 py-0.5 text-[11px] ring-1 ring-line"
                    aria-label={`Reassign ${t.text}`}
                  >
                    <option value={BOSS_ID}>Boss</option>
                    <option value={CHIEF_ID}>Chief</option>
                    {agentOptions
                      .filter((a) => a.id !== CHIEF_ID)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                  <span>{categoryLabel(t.category)}</span>
                  {t.priority && t.priority !== 'normal' ? <span>{t.priority}</span> : null}
                  {t.due ? <span className="tabular-nums">{t.due}</span> : null}
                  <span className="text-faint">{assigneeLabel(t.agentId, agents)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void removeTodo(t.id)}
                aria-label={`Delete ${t.text}`}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
              >
                <Trash2Icon size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[12px] text-muted">
        Also on{' '}
        <Link to="/tasks" className="font-medium text-accent-ink hover:underline">
          Tasks
        </Link>{' '}
        · Home widget uses the same API.
      </p>
    </PageScroll>
  );
}
