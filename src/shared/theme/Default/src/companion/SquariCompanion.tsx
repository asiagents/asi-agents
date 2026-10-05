/**
 * Companion — corner overlay for ASI Agents.
 * Prod: off until Settings → Modules → Show Squari.
 * Test bed / localhost: on by default when storage unset (see isCompanionTestBed).
 * Default: character only (BR). Press → fullscreen desk companion hub.
 * Lock: larger 9:16 scale; click unlocks into chat when no lock password.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { DeskCompanionHub } from './hub/DeskCompanionHub';
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
  const enabled = settings.showSquari && (!locked || settings.showSquariOnLock);
  const sizeKey = locked ? 'lock' : mobile || settings.size === 'sm' ? 'sm' : 'md';
  const box = COMPANION_HITBOX[sizeKey];
  const skin = settings.skin;
  const skinLabel = COMPANION_SKIN_LABELS[skin];

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
    window.requestAnimationFrame(() => hubCloseRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [hubOpen, closeHub]);

  const openChat = useCallback(() => {
    const thread = readLastChatThread();
    if (locked) {
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

  const toggleComplete = useCallback(
    async (task: CompanionTask) => {
      if (busyId) return;
      setBusyId(task.id);
      try {
        const next = toggleTaskStatus(task.status);
        const { task: updated } = await api.patchTask(task.id, { status: next });
        setTasks((prev) => prev.map((t) => (t.id === task.id ? mapTask(updated) : t)));
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
              locked ? `Unlock with ${skinLabel}` : `Open ${skinLabel} desk companion`
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

      {hubOpen && !locked ? (
        <DeskCompanionHub
          skin={skin}
          state={state}
          statusLine={statusLine}
          spriteImg={spriteImg}
          useBob={useBob}
          box={box}
          hubCloseRef={hubCloseRef}
          tasks={tasks}
          todoDraft={todoDraft}
          setTodoDraft={setTodoDraft}
          addingTodo={addingTodo}
          addError={addError}
          busyId={busyId}
          onClose={closeHub}
          onOpenChat={openChat}
          onOpenModules={openModules}
          onOpenTodosPage={openTodosPage}
          onAssignTodo={(e) => void assignTodo(e)}
          onToggleComplete={(t) => void toggleComplete(t)}
        />
      ) : null}
    </>
  );
}

/** @deprecated Alias — Corner mascot replaced by Squari Companion. */
export function TaskMascot() {
  return <SquariCompanion />;
}
