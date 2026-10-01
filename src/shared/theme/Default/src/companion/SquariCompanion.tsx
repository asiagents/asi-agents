/**
 * Squari Companion — corner overlay for ASI Agents.
 * Prod: off until Settings → Modules → Show Squari.
 * Test bed / localhost: on by default when storage unset (see isCompanionTestBed).
 * Default: character only (BR). Press → fullscreen companion hub (todos, music stub, actions).
 * Lock: larger 9:16 scale; click unlocks into chat when no lock password.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ListTodoIcon,
  MessageSquareIcon,
  Music2Icon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  Settings2Icon,
  XIcon,
} from 'lucide-react';
import { api, type AgentTask } from '@asi-api';
import { useDesk } from '../contexts/DeskContext';
import { useSettings } from '../contexts/SettingsContext';
import { isTodoTask, taskToTodo } from '../todo/types';
import { DEFAULT_DISPLAY_NAME } from '../types/settings';
import { isTaskComplete, normalizeTaskStatus, toggleTaskStatus } from '../utils/taskStatus';
import {
  COMPANION_HITBOX,
  COMPANION_SKIN_LABELS,
  companionSpriteSource,
  type CompanionSkinId,
  type CompanionStateId,
  type CompanionSpriteKind,
} from './assets';
import {
  COMPANION_SETTINGS_EVENT,
  COMPANION_TOGGLE_EVENT,
  COMPANION_TYPING_EVENT,
  readCompanionSettings,
  readLastChatThread,
  rememberLastChatThread,
  type CompanionSettings,
} from './settings';
import {
  resolveSquariState,
  type CompanionTask,
} from './stateMachine';

const JUMP_MS = 1200;
const TASK_POLL_MS = 12_000;

function mapTask(t: AgentTask): CompanionTask {
  const todo = taskToTodo({ ...t, status: normalizeTaskStatus(t.status) });
  return {
    id: todo.id,
    text: todo.text,
    status: String(todo.status),
    done: isTaskComplete(todo.status),
  };
}

function useIsCompactViewport(): boolean {
  const [compact, setCompact] = useState(() => {
    try {
      return window.matchMedia('(max-width: 640px)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setCompact(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return compact;
}

function useCompanionSettings(): CompanionSettings {
  const [settings, setSettings] = useState(readCompanionSettings);
  useEffect(() => {
    const refresh = () => setSettings(readCompanionSettings());
    const onToggle = (e: Event) => {
      const on = Boolean((e as CustomEvent<{ on: boolean }>).detail?.on);
      setSettings((s) => ({ ...s, showSquari: on }));
    };
    window.addEventListener(COMPANION_TOGGLE_EVENT, onToggle);
    window.addEventListener(COMPANION_SETTINGS_EVENT, refresh);
    return () => {
      window.removeEventListener(COMPANION_TOGGLE_EVENT, onToggle);
      window.removeEventListener(COMPANION_SETTINGS_EVENT, refresh);
    };
  }, []);
  return settings;
}

type SpriteView = {
  skin: CompanionSkinId;
  state: CompanionStateId;
  url: string;
  kind: CompanionSpriteKind;
  fallbacks: string[];
};

function buildSpriteView(skin: CompanionSkinId, state: CompanionStateId): SpriteView {
  const src = companionSpriteSource(skin, state);
  return { skin, state, url: src.url, kind: src.kind, fallbacks: [...src.fallbacks] };
}

function statusGlyph(status: string): string {
  if (status === 'blocked') return '!';
  if (status === 'ongoing') return '›';
  return '·';
}

/** Bottom-right companion — mounts only when Show Squari is on (and on-lock flag while locked). */
export function SquariCompanion() {
  const { openApprovals } = useDesk();
  const { s, set } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useCompanionSettings();
  const mobile = useIsCompactViewport();
  const [tasks, setTasks] = useState<CompanionTask[]>([]);
  const [hubOpen, setHubOpen] = useState(false);
  const [todoDraft, setTodoDraft] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  const [typing, setTyping] = useState(false);
  const [pointerNear, setPointerNear] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lookYaw, setLookYaw] = useState(0);
  const [lookShift, setLookShift] = useState({ x: 0, y: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const hubCloseRef = useRef<HTMLButtonElement>(null);
  const prevDoneRef = useRef<number | null>(null);
  const jumpTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  const locked = s.locked || !s.displayName;
  // Modules master off → never show / never load assets. Lock uses extra lock-specific toggle.
  const enabled = settings.showSquari && (!locked || settings.showSquariOnLock);
  const sizeKey = locked ? 'lock' : mobile || settings.size === 'sm' ? 'sm' : 'md';
  const box = COMPANION_HITBOX[sizeKey];
  const skin = settings.skin;
  const skinLabel = COMPANION_SKIN_LABELS[skin];

  // Remember last chat route for click → focus
  useEffect(() => {
    const m = location.pathname.match(/^\/chat\/([^/]+)/);
    if (m?.[1]) rememberLastChatThread(m[1]);
  }, [location.pathname]);

  useEffect(() => {
    const onTyping = (e: Event) => {
      setTyping(Boolean((e as CustomEvent<{ on: boolean }>).detail?.on));
    };
    window.addEventListener(COMPANION_TYPING_EVENT, onTyping);
    return () => window.removeEventListener(COMPANION_TYPING_EVENT, onTyping);
  }, []);

  const loadTasks = useCallback(() => {
    void api
      .tasks()
      .then((r) => {
        const list = (r.tasks ?? []).filter(isTodoTask).map(mapTask);
        setTasks(list);
      })
      .catch(() => {
        setTasks([]);
      });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      void api
        .tasks()
        .then((r) => {
          if (cancelled) return;
          const list = (r.tasks ?? []).filter(isTodoTask).map(mapTask);
          setTasks(list);
        })
        .catch(() => {
          if (!cancelled) setTasks([]);
        });
    };
    load();
    const id = window.setInterval(load, TASK_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  // Celebration jump when a task newly completes (desktop only — lock stays idle/humming/urgent)
  useEffect(() => {
    if (!enabled || !settings.celebrationJump || locked) {
      prevDoneRef.current = tasks.filter((t) => t.done).length;
      return;
    }
    const doneCount = tasks.filter((t) => t.done).length;
    if (prevDoneRef.current !== null && doneCount > prevDoneRef.current) {
      setCelebrating(true);
      if (jumpTimerRef.current) window.clearTimeout(jumpTimerRef.current);
      jumpTimerRef.current = window.setTimeout(() => {
        setCelebrating(false);
        jumpTimerRef.current = null;
      }, JUMP_MS);
    }
    prevDoneRef.current = doneCount;
    return () => {
      if (jumpTimerRef.current) window.clearTimeout(jumpTimerRef.current);
    };
  }, [tasks, enabled, settings.celebrationJump, locked]);

  const state: CompanionStateId = useMemo(
    () =>
      resolveSquariState({
        tasks,
        openApprovals,
        typing,
        pointerNear,
        celebrating,
        lookDown: false,
        onLock: locked,
      }),
    [tasks, openApprovals, typing, pointerNear, celebrating, locked]
  );

  const [sprite, setSprite] = useState<SpriteView>(() => buildSpriteView(skin, state));

  useEffect(() => {
    if (!enabled) return;
    setSprite(buildSpriteView(skin, state));
  }, [enabled, skin, state]);

  const dampenLook = locked || hubOpen || state !== 'idle' || !settings.lookAt;

  // Pointer look-at when idle (rAF throttle; no coord logging)
  useEffect(() => {
    if (!enabled || !settings.lookAt || locked || hubOpen) {
      setLookYaw(0);
      setLookShift({ x: 0, y: 0 });
      setPointerNear(false);
      return;
    }
    const onMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const el = rootRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height * 0.28;
        const { x, y } = pointerRef.current;
        const dx = x - cx;
        const dy = y - cy;
        const near =
          x >= rect.left - 24 &&
          x <= rect.right + 24 &&
          y >= rect.top - 24 &&
          y <= rect.bottom + 24;
        setPointerNear(near);
        if (state !== 'idle' || dampenLook) {
          setLookYaw(0);
          setLookShift({ x: 0, y: 0 });
          return;
        }
        const yaw = Math.max(-8, Math.min(8, (dx / Math.max(window.innerWidth, 1)) * 28));
        const sx = Math.max(-10, Math.min(10, (dx / Math.max(rect.width, 1)) * 8));
        const sy = Math.max(-8, Math.min(8, (dy / Math.max(rect.height, 1)) * 6));
        setLookYaw(yaw);
        setLookShift({ x: sx, y: sy });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, settings.lookAt, state, dampenLook, locked, hubOpen]);

  const closeHub = useCallback(() => {
    setHubOpen(false);
    setAddError(null);
  }, []);

  const openHub = useCallback(() => {
    if (locked) return;
    setHubOpen(true);
    loadTasks();
  }, [locked, loadTasks]);

  useEffect(() => {
    if (!hubOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeHub();
      }
    };
    window.addEventListener('keydown', onKey);
    // Focus close control for a11y when hub opens
    window.requestAnimationFrame(() => hubCloseRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [hubOpen, closeHub]);

  const openChat = useCallback(() => {
    const thread = readLastChatThread();
    if (locked) {
      // Password lock: do not bypass — user must unlock via Lock screen.
      if (s.lockPassword) return;
      if (!s.displayName) set('displayName', DEFAULT_DISPLAY_NAME);
      set('locked', false);
      navigate(`/chat/${thread}`);
      return;
    }
    closeHub();
    navigate(`/chat/${thread}`);
  }, [navigate, locked, s.lockPassword, s.displayName, set, closeHub]);

  const openTodosPage = useCallback(
    (todoId?: string) => {
      closeHub();
      navigate(todoId ? `/todos?todo=${encodeURIComponent(todoId)}` : '/todos');
    },
    [navigate, closeHub]
  );

  const openModules = useCallback(() => {
    closeHub();
    navigate('/settings/modules');
  }, [navigate, closeHub]);

  const openVoice = useCallback(() => {
    closeHub();
    navigate('/settings/voice');
  }, [navigate, closeHub]);

  const toggleComplete = useCallback(
    async (task: CompanionTask) => {
      if (busyId) return;
      setBusyId(task.id);
      try {
        const next = toggleTaskStatus(task.status);
        const { task: updated } = await api.patchTask(task.id, { status: next });
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? mapTask(updated) : t))
        );
      } catch {
        loadTasks();
      } finally {
        setBusyId(null);
      }
    },
    [busyId, loadTasks]
  );

  const assignTodo = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const title = todoDraft.trim();
      if (!title || addingTodo) return;
      setAddingTodo(true);
      setAddError(null);
      try {
        const { task } = await api.createTask({
          title,
          origin: 'todo',
          status: 'pending',
          priority: 'normal',
          suggestCategory: true,
          startWork: true,
        });
        setTasks((prev) => {
          const mapped = mapTask(task);
          return [mapped, ...prev.filter((t) => t.id !== mapped.id)];
        });
        setTodoDraft('');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not add to-do';
        setAddError(/fetch|network|econnrefused/i.test(msg) ? 'API unreachable — is ASI on :3445?' : msg);
      } finally {
        setAddingTodo(false);
      }
    },
    [todoDraft, addingTodo]
  );

  const onSpriteError = useCallback(() => {
    setSprite((prev) => {
      if (prev.fallbacks.length === 0) return prev;
      const [next, ...rest] = prev.fallbacks;
      const kind: CompanionSpriteKind = next.endsWith('.png') ? 'png' : 'gif';
      return { ...prev, url: next, kind, fallbacks: rest };
    });
  }, []);

  const ongoing = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const useBob = sprite.kind === 'png';
  const showStatePip = !locked && !hubOpen && (state === 'working' || state === 'urgent_ask');

  if (!enabled) return null;

  const safeRight = 'max(16px, env(safe-area-inset-right, 0px))';
  const safeBottom = locked
    ? 'max(24px, env(safe-area-inset-bottom, 0px))'
    : mobile
      ? 'max(5.5rem, calc(72px + env(safe-area-inset-bottom, 0px)))'
      : 'max(5rem, calc(64px + env(safe-area-inset-bottom, 0px)))';

  const statusLine =
    state === 'urgent_ask'
      ? 'Needs your attention'
      : state === 'working'
        ? 'Working through the list'
        : state === 'typing'
          ? 'Composing a reply'
          : state === 'jump'
            ? 'Nice — task done'
            : 'Ready when you are';

  const spriteImg = (
    <img
      key={`${sprite.skin}-${sprite.state}-${sprite.url}`}
      src={sprite.url}
      alt=""
      draggable={false}
      className="asi-squari-sprite h-full w-full object-contain object-bottom select-none"
      style={{
        background: 'transparent',
        transform: dampenLook
          ? undefined
          : `perspective(600px) rotateY(${lookYaw}deg) translate(${lookShift.x}%, ${lookShift.y * 0.4}%)`,
        transformOrigin: '50% 30%',
        transition: 'transform 80ms linear',
      }}
      onError={onSpriteError}
    />
  );

  return (
    <>
      {/* Corner character only — no floating todo glass until hub opens */}
      {!hubOpen ? (
        <div
          ref={rootRef}
          className="asi-squari pointer-events-none fixed z-[60] flex flex-col items-end"
          style={{
            right: safeRight,
            bottom: safeBottom,
            width: box.w,
          }}
          data-squari-state={state}
          data-companion={skin}
          data-on-lock={locked ? '1' : '0'}
        >
          <button
            type="button"
            className={`asi-squari-hit pointer-events-auto relative overflow-hidden bg-transparent p-0 transition-transform duration-200 hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))] ${
              state === 'jump' ? 'asi-squari--jump' : ''
            } ${useBob ? 'asi-squari--bob' : ''}`}
            style={{
              width: box.w,
              height: box.h,
              borderRadius: 20,
            }}
            aria-label={
              locked
                ? `Unlock with ${skinLabel}`
                : `Open ${skinLabel} companion hub`
            }
            title={locked ? (s.lockPassword ? skinLabel : 'Unlock') : `Open ${skinLabel} hub`}
            onClick={() => {
              if (locked) openChat();
              else openHub();
            }}
          >
            {spriteImg}
            {showStatePip ? (
              <span
                className={`asi-squari-pip absolute right-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${
                  state === 'urgent_ask' ? 'asi-squari-pip--urgent bg-danger' : 'asi-squari-pip--work bg-accent'
                }`}
                title={statusLine}
                aria-hidden="true"
              />
            ) : null}
          </button>
          {showStatePip ? (
            <span className="pointer-events-none mt-1 max-w-full truncate text-right text-[10px] font-medium text-faint">
              {statusLine}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Full-screen companion hub */}
      {hubOpen && !locked ? (
        <div
          className="asi-squari-hub pointer-events-auto fixed inset-0 z-[70] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={`${skinLabel} companion hub`}
          data-squari-state={state}
          data-companion={skin}
        >
          <div
            className="asi-squari-hub-backdrop absolute inset-0 bg-ink/55 backdrop-blur-md"
            onClick={closeHub}
            aria-hidden="true"
          />

          <div
            className="asi-squari-hub-panel relative z-[1] m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-surface/95 shadow-2xl ring-1 ring-line sm:m-4 md:m-6"
            style={{
              paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
            }}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 px-3 pb-2 pt-1 sm:px-5 sm:pt-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-faint">Companion hub</p>
                <h2 className="truncate text-xl font-semibold text-ink sm:text-2xl">{skinLabel}</h2>
                <p className="mt-0.5 text-[13px] text-muted">{statusLine}</p>
              </div>
              <button
                ref={hubCloseRef}
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-ink ring-1 ring-line transition-colors hover:bg-overlay/10"
                onClick={closeHub}
                aria-label="Close companion hub"
                title="Close"
              >
                <XIcon size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-3 pb-3 sm:px-5 sm:pb-4 lg:grid-cols-[minmax(140px,220px)_minmax(0,1fr)] lg:overflow-hidden">
              {/* Character column */}
              <div className="flex flex-col items-center justify-end gap-3 lg:min-h-0">
                <div
                  className={`relative mx-auto ${state === 'jump' ? 'asi-squari--jump' : ''} ${useBob ? 'asi-squari--bob' : ''}`}
                  style={{ width: Math.min(box.w * 1.15, 220), height: Math.min(box.h * 1.15, 440) }}
                >
                  {spriteImg}
                </div>
                <div className="flex w-full max-w-[240px] flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent/12 px-3 py-2 text-[12px] font-semibold text-accent-ink ring-1 ring-accent/25 hover:bg-accent/20"
                    onClick={openChat}
                  >
                    <MessageSquareIcon size={14} aria-hidden="true" />
                    Open chat
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-raised px-3 py-2 text-[12px] font-semibold text-ink ring-1 ring-line hover:bg-overlay/10"
                    onClick={openModules}
                  >
                    <Settings2Icon size={14} aria-hidden="true" />
                    Skins
                  </button>
                </div>
              </div>

              {/* Actions column */}
              <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
                {/* Assign to-dos */}
                <section className="rounded-2xl bg-raised/50 p-3 ring-1 ring-line sm:p-4" aria-label="Assign to-dos">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                      <ListTodoIcon size={15} aria-hidden="true" />
                      To-dos
                    </h3>
                    <button
                      type="button"
                      className="text-[12px] font-medium text-accent-ink hover:underline"
                      onClick={() => openTodosPage()}
                    >
                      Full list
                    </button>
                  </div>
                  <form className="mb-3 flex gap-2" onSubmit={assignTodo}>
                    <label htmlFor="squari-hub-todo" className="sr-only">
                      Assign a to-do
                    </label>
                    <input
                      id="squari-hub-todo"
                      value={todoDraft}
                      onChange={(e) => setTodoDraft(e.target.value)}
                      placeholder="Assign a to-do…"
                      className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 text-[13px] text-ink ring-1 ring-line placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <button
                      type="submit"
                      disabled={!todoDraft.trim() || addingTodo}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-accent-strong px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
                    >
                      <PlusIcon size={15} aria-hidden="true" />
                      Add
                    </button>
                  </form>
                  {addError ? <p className="mb-2 text-[12px] text-danger">{addError}</p> : null}

                  {ongoing.length === 0 && done.length === 0 ? (
                    <p className="rounded-xl bg-surface/70 px-3 py-4 text-[13px] text-muted ring-1 ring-line">
                      No to-dos yet — add one above.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {ongoing.length > 0 ? (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                            Ongoing · {ongoing.length}
                          </p>
                          <ul className="max-h-48 space-y-1 overflow-y-auto sm:max-h-56">
                            {ongoing.map((t) => (
                              <li key={t.id} className="asi-squari-todo-row flex items-start gap-2 rounded-xl px-2 py-2">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  disabled={busyId === t.id}
                                  aria-label={`Mark complete: ${t.text}`}
                                  className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
                                  onChange={() => void toggleComplete(t)}
                                />
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 text-left"
                                  onClick={() => openTodosPage(t.id)}
                                >
                                  <span className="flex items-start gap-1.5">
                                    <span className="mt-0.5 shrink-0 text-[13px] font-semibold text-faint" aria-hidden="true">
                                      {statusGlyph(t.status)}
                                    </span>
                                    <span className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">
                                      {t.text}
                                    </span>
                                  </span>
                                  <span className="mt-1 block pl-4 text-[10px] uppercase tracking-wide text-faint">
                                    {t.status === 'blocked'
                                      ? 'Blocked'
                                      : t.status === 'ongoing'
                                        ? 'In progress'
                                        : 'Open'}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {done.length > 0 ? (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                            Completed · {done.length}
                          </p>
                          <ul className="max-h-36 space-y-1 overflow-y-auto">
                            {done.slice(0, 8).map((t) => (
                              <li key={t.id} className="asi-squari-todo-row flex items-start gap-2 rounded-xl px-2 py-1.5 opacity-80">
                                <input
                                  type="checkbox"
                                  checked
                                  disabled={busyId === t.id}
                                  aria-label={`Reopen: ${t.text}`}
                                  className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
                                  onChange={() => void toggleComplete(t)}
                                />
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 text-left"
                                  onClick={() => openTodosPage(t.id)}
                                >
                                  <span className="line-clamp-2 text-[12px] leading-snug text-muted line-through">
                                    {t.text}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>

                {/* Music stub + light actions */}
                <section className="rounded-2xl bg-raised/50 p-3 ring-1 ring-line sm:p-4" aria-label="Music">
                  <h3 className="mb-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                    <Music2Icon size={15} aria-hidden="true" />
                    Music
                  </h3>
                  <p className="mb-3 text-[12px] leading-snug text-muted">
                    UI stub — no companion playlist wired yet. Toggle is local only; voice/TTS lives in Settings.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold ring-1 ${
                        musicOn
                          ? 'bg-accent/15 text-accent-ink ring-accent/30'
                          : 'bg-surface text-ink ring-line hover:bg-overlay/10'
                      }`}
                      onClick={() => setMusicOn((v) => !v)}
                      aria-pressed={musicOn}
                    >
                      {musicOn ? (
                        <>
                          <PauseIcon size={14} aria-hidden="true" /> Pause stub
                        </>
                      ) : (
                        <>
                          <PlayIcon size={14} aria-hidden="true" /> Play stub
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-[12px] font-semibold text-ink ring-1 ring-line hover:bg-overlay/10"
                      onClick={openVoice}
                    >
                      Voice settings
                    </button>
                    {musicOn ? (
                      <span className="text-[11px] font-medium text-faint">Playing · local stub (no audio)</span>
                    ) : null}
                  </div>
                </section>

                <div className="flex flex-wrap gap-2 pb-1">
                  <button
                    type="button"
                    className="rounded-xl bg-surface px-3 py-2 text-[12px] font-semibold text-ink ring-1 ring-line hover:bg-overlay/10"
                    onClick={closeHub}
                  >
                    Collapse to corner
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** @deprecated Alias — Corner mascot replaced by Squari Companion. */
export function TaskMascot() {
  return <SquariCompanion />;
}
