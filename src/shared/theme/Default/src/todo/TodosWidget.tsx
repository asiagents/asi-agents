import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon } from 'lucide-react';
import { useAgents } from '../contexts/AgentsContext';
import { useTodos } from './useTodos';
import { resolveLocalAssignee, suggestCategory } from './assign';
import {
  ASSIGN_MODES,
  BOSS_ID,
  CHIEF_ID,
  DEFAULT_ASSIGN_MODE,
  PRIORITIES,
  TODO_CATEGORIES,
  assigneeLabel,
  categoryLabel,
  type TodoAssignMode,
  type TaskCategory,
  type TaskPriority,
  type Todo,
} from './types';
import type { WidgetSize } from '../types/settings';

const selectCls =
  'rounded-md bg-bg px-1.5 py-1 text-[11px] text-ink outline-none ring-1 ring-line focus:ring-accent/60';

const actionBtn =
  'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.06] disabled:opacity-40';

const MAX_SHOWN = 5;

export function TodosWidget({ size }: { size: WidgetSize }) {
  const agents = useAgents();
  const {
    todos,
    addTodo,
    toggleTodo,
    reassignTodo,
    updateTodo,
    busyId,
    error,
  } = useTodos();
  const [text, setText] = useState('');
  const [assignMode, setAssignMode] = useState<TodoAssignMode>(DEFAULT_ASSIGN_MODE);
  const [agentId, setAgentId] = useState(CHIEF_ID);
  const [category, setCategoryLocal] = useState<TaskCategory | ''>('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [due, setDue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [assignOpenId, setAssignOpenId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const open = todos.filter((t) => !t.done);
    const done = todos.filter((t) => t.done);
    return [...open, ...done].slice(0, MAX_SHOWN);
  }, [todos]);

  const agentOptions = useMemo(
    () => agents.filter((a) => a.id !== BOSS_ID),
    [agents]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const cat = category || suggestCategory(text);
    await addTodo({
      text: text.trim(),
      assignMode,
      agentId: assignMode === 'agent' ? agentId : undefined,
      category: cat,
      priority,
      due: due.trim() || undefined,
    });
    setText('');
    setDue('');
  };

  const startEdit = (t: Todo) => {
    setEditingId(t.id);
    setEditText(t.text);
    setAssignOpenId(null);
  };

  const saveEdit = async (id: string) => {
    const next = editText.trim();
    if (!next) return;
    await updateTodo(id, { title: next });
    setEditingId(null);
    setEditText('');
  };

  const runAuto = async (t: Todo) => {
    const cat = suggestCategory(t.text, t.category ?? 'general');
    const nextAgent = resolveLocalAssignee({
      mode: 'auto',
      text: t.text,
      category: cat,
      agents,
    });
    await updateTodo(t.id, {
      category: cat,
      agentId: nextAgent,
    });
    setAssignOpenId(null);
  };

  return (
    <>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {shown.map((t) => (
          <li key={t.id} className="rounded-lg bg-bg/60 px-2 py-1.5 ring-1 ring-line/70">
            <div className="flex items-start gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={t.done}
                disabled={busyId === t.id}
                onChange={() => void toggleTodo(t.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
                aria-label={t.done ? `Reopen ${t.text}` : `Complete ${t.text}`}
              />
              <div className="min-w-0 flex-1">
                {editingId === t.id ? (
                  <form
                    className="flex gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveEdit(t.id);
                    }}
                  >
                    <input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                      className="min-w-0 flex-1 rounded-md bg-surface px-1.5 py-0.5 text-[13px] text-ink outline-none ring-1 ring-accent/50"
                      aria-label="Edit to-do"
                    />
                    <button type="submit" className={`${actionBtn} text-accent-ink`} disabled={!editText.trim()}>
                      Save
                    </button>
                    <button
                      type="button"
                      className={`${actionBtn} text-muted`}
                      onClick={() => {
                        setEditingId(null);
                        setEditText('');
                      }}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <span className={`block truncate ${t.done ? 'text-faint line-through' : 'text-ink'}`}>
                    {t.text}
                  </span>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted">
                  <span>{assigneeLabel(t.agentId, agents)}</span>
                  <span className="text-faint">·</span>
                  <span>{categoryLabel(t.category)}</span>
                  {t.priority && t.priority !== 'normal' ? (
                    <>
                      <span className="text-faint">·</span>
                      <span className={t.priority === 'high' ? 'text-warn' : ''}>{t.priority}</span>
                    </>
                  ) : null}
                  {t.due ? (
                    <>
                      <span className="text-faint">·</span>
                      <span className="tabular-nums">{t.due}</span>
                    </>
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    className={`${actionBtn} text-ink`}
                    disabled={busyId === t.id || t.done}
                    onClick={() => startEdit(t)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`${actionBtn} ${assignOpenId === t.id ? 'bg-accent/10 text-accent-ink ring-accent/40' : 'text-ink'}`}
                    disabled={busyId === t.id || t.done}
                    onClick={() => setAssignOpenId((id) => (id === t.id ? null : t.id))}
                    aria-expanded={assignOpenId === t.id}
                  >
                    Assign
                  </button>
                  <button
                    type="button"
                    className={`${actionBtn} text-accent-ink`}
                    disabled={busyId === t.id || t.done}
                    onClick={() => void runAuto(t)}
                    title="Auto-assign by role / skills + classify category"
                  >
                    Auto
                  </button>
                </div>
                {assignOpenId === t.id ? (
                  <label className="mt-1.5 block">
                    <span className="sr-only">Assign to</span>
                    <select
                      value={t.agentId}
                      disabled={busyId === t.id}
                      onChange={(e) => {
                        void reassignTodo(t.id, e.target.value);
                        setAssignOpenId(null);
                      }}
                      className={`${selectCls} w-full`}
                      aria-label={`Assign ${t.text}`}
                    >
                      <option value={BOSS_ID}>Boss (Personal)</option>
                      <option value={CHIEF_ID}>Chief</option>
                      {agentOptions
                        .filter((a) => a.id !== CHIEF_ID)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>
          </li>
        ))}
        {todos.length === 0 && (
          <li className="text-[13px] text-muted">All clear — add a to-do below.</li>
        )}
      </ul>

      {error ? <p className="mt-1 text-[11px] text-danger">{error}</p> : null}

      <form className="mt-2 space-y-1.5" onSubmit={(e) => void onSubmit(e)}>
        <div className="flex gap-1.5">
          <label htmlFor="todo-quick" className="sr-only">
            Add a to-do
          </label>
          <input
            id="todo-quick"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a to-do"
            className="min-w-0 flex-1 rounded-lg bg-bg px-2.5 py-1 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60"
          />
          <button
            type="submit"
            aria-label="Add"
            disabled={!text.trim()}
            className="grid h-7 w-7 place-items-center rounded-lg bg-accent-strong text-white disabled:opacity-40"
          >
            <PlusIcon size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          <label className="sr-only" htmlFor="todo-assign">
            Assign
          </label>
          <select
            id="todo-assign"
            value={assignMode}
            onChange={(e) => setAssignMode(e.target.value as TodoAssignMode)}
            className={selectCls}
            title="Assign mode"
          >
            {ASSIGN_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {assignMode === 'agent' ? (
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className={selectCls}
              aria-label="Choose agent"
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
            onChange={(e) => setCategoryLocal(e.target.value as TaskCategory | '')}
            className={selectCls}
            aria-label="Category"
          >
            <option value="">Auto category</option>
            {TODO_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {size === 'L' ? (
            <>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={selectCls}
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
                className={selectCls}
                aria-label="Due date"
              />
            </>
          ) : null}
        </div>
        <Link to="/todos" className="inline-block text-[11px] font-medium text-accent-ink hover:underline">
          Open to-dos →
        </Link>
      </form>
    </>
  );
}
