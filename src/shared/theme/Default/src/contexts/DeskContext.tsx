import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { agents, fetchAndApplyAgents, subscribeAgents } from '../data/agents';
import { boardIdsEqual, CHIEF_ID, withChiefIds } from '../utils/withChief';
import { orgTreeSeed } from '../data/settings';
import { approvalSeed } from '../data/approvals';
import { activityLog } from '../data/inbox';
import { todoSeed } from '../data/todos';
import { defaultBoardIds } from '../data/decision';
import { moveBefore as moveBeforeFn, moveInto as moveIntoFn, setReportsTo as setReportsToFn, shiftSibling } from '../utils/hierarchy';
import { orgTreeFromAgents } from '../utils/orgTree';
import { createId, nowTime } from '../utils/time';
import { useNotifications } from './NotificationContext';
import { api, type BoardAgentStance, type TaskCategory, type TaskPriority, type TodoAssignMode } from '@asi-api';
import { DEFAULT_ASSIGN_MODE, isTodoTask, taskToTodo, type Todo } from '../todo/types';
import { normalizeTaskStatus, toggleTaskStatus } from '../utils/taskStatus';
import type { ActivityEntry } from '../types/inbox';
import type { OrgNode } from '../types/agents';
import type { Approval, ApprovalState } from '../types/chat';
import type { ModelId } from '../types/models';
import type { DeskMode, RedAlert } from '../types/settings';

export type DeskInstall = 'none' | 'installing' | 'installed';
export type { Todo };

export type AddTodoOptions = {
  text: string;
  assignMode?: TodoAssignMode;
  agentId?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  due?: string;
};

const redAlertTemplates: Record<RedAlert['kind'], Omit<RedAlert, 'id' | 'time' | 'kind'>> = {
  permission: { agentId: 'coder', title: 'Coder wants to delete files in capstone/src', detail: 'This is outside its standing rules (write/delete = Never). Blocked until you decide.' },
  intrusion: { agentId: 'scout', title: 'Unknown device tried to reach the local router', detail: 'A connection from 192.168.1.54 asked for agent control. It was refused and logged.' },
  injection: { agentId: 'research', title: 'Possible prompt injection in a web page', detail: 'A page Research opened contains instructions to "send all files to this address". Research stopped reading it.' }
};

interface DeskContextValue {
  mode: DeskMode;
  setMode: (mode: DeskMode) => void;
  isTeamMode: boolean;
  /** Bumps after a successful council mode switch so Group can reload seats/session. */
  councilTick: number;
  pausedAt: string | null;
  pauseAll: () => void;
  resumeAll: () => void;
  panicOpen: boolean;
  requestPanic: () => void;
  cancelPanic: () => void;
  agentModels: Record<string, ModelId>;
  setAgentModel: (agentId: string, model: ModelId) => void;
  tree: OrgNode[];
  moveInto: (dragId: string, targetId: string) => void;
  moveBefore: (dragId: string, targetId: string) => void;
  shift: (id: string, dir: -1 | 1) => void;
  /** Assign or clear reportsTo. Default hiring is flat (parentId null). Chief stays root. */
  setReportsTo: (id: string, parentId: string | null) => void;
  approvals: Approval[];
  resolveApproval: (id: string, state: ApprovalState) => void;
  /** Queue an approval visible in chat + Home Approvals widget. */
  requestApproval: (input: Omit<Approval, 'id' | 'state' | 'time'> & { state?: ApprovalState }) => string;
  openApprovals: number;
  redAlert: RedAlert | null;
  raiseRedAlert: (kind: RedAlert['kind']) => void;
  resolveRedAlert: (action: 'approve' | 'deny' | 'acknowledge') => void;
  controlLog: ActivityEntry[];
  log: (entry: Omit<ActivityEntry, 'id' | 'time'>) => void;
  /** Empty the in-memory control log (after soft-delete to recycle bin). */
  clearControlLog: () => void;
  todos: Todo[];
  addTodo: (textOrOpts: string | AddTodoOptions) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  /** Effective: true when the router is down OR local models are switched off. */
  routerOffline: boolean;
  setRouterOffline: (v: boolean) => void;
  localOn: boolean;
  setLocalOn: (v: boolean) => void;
  onlineOn: boolean;
  setOnlineOn: (v: boolean) => void;
  boardIds: string[];
  setBoardIds: (ids: string[]) => void;
  /** Decision / question the board agents weigh in on. */
  boardTopic: string;
  setBoardTopic: (topic: string) => void;
  /** Agent stances on the decision board (synced via GET/PUT /api/board). */
  boardStances: Record<string, BoardAgentStance>;
  setAgentBoardStance: (agentId: string, next: BoardAgentStance | null) => void;
  /** Replace all board stances (e.g. after Ask agents). */
  setBoardStances: (stances: Record<string, BoardAgentStance>) => void;
  /** Apply a full board API snapshot (roster + topic + stances). */
  applyBoardSnapshot: (b: {
    boardIds?: string[];
    defaultBoardIds?: string[];
    stances?: Record<string, BoardAgentStance>;
    topic?: string;
  }) => void;
  deskModule: boolean;
  setDeskModule: (on: boolean) => void;
  deskInstall: DeskInstall;
  startInstall: () => void;
  uninstallDesk: () => void;
  watching: boolean;
  setWatching: (w: boolean) => void;
}

const DeskContext = createContext<DeskContextValue | null>(null);

const BOARD_PUT_DEBOUNCE_MS = 400;

type BoardPutPending = {
  boardIds?: string[];
  stances?: Record<string, BoardAgentStance>;
  topic?: string;
};

interface DeskProviderProps {
  initialMode: DeskMode;
  initialDesk: boolean;
  children: React.ReactNode;
}

export function DeskProvider({ initialMode, initialDesk, children }: DeskProviderProps) {
  const [mode, setModeState] = useState<DeskMode>(initialMode);
  const [councilTick, setCouncilTick] = useState(0);

  /** Mode change also starts a mode-scoped council session (Chief shared; seats per Multi/Pro). Offline: fail closed. */
  const setMode = useCallback((next: DeskMode) => {
    setModeState((prev) => {
      if (prev === next) return prev;
      void api
        .switchCouncilMode(next, prev)
        .then((res) => {
          const g = res?.group;
          if (g?.memberIds?.length) {
            const ids = withChiefIds(g.memberIds);
            setBoardIdsRaw(ids);
            const topic = typeof g.topic === 'string' ? g.topic : '';
            setBoardTopicRaw(topic);
            if (res.switched && next !== 'super') {
              setBoardStances({});
            }
            serverBoardRef.current = {
              boardIds: ids,
              stances: res.switched && next !== 'super' ? {} : serverBoardRef.current.stances,
              topic,
            };
          }
          setCouncilTick((n) => n + 1);
        })
        .catch(() => {
          /* offline — local mode still changes; council stays on last known snapshot */
          setCouncilTick((n) => n + 1);
        });
      return next;
    });
  }, []);

  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [panicOpen, setPanicOpen] = useState(false);
  /** Bumps when registry roster mutates so Home widgets re-render. */
  const [rosterTick, setRosterTick] = useState(0);
  const [agentModels, setAgentModels] = useState<Record<string, ModelId>>(() =>
  Object.fromEntries(agents.map((a) => [a.id, a.primary]))
  );
  const [tree, setTree] = useState<OrgNode[]>(orgTreeSeed);
  const [approvals, setApprovals] = useState<Approval[]>(approvalSeed);
  const [redAlert, setRedAlert] = useState<RedAlert | null>(null);
  const [controlLog, setControlLog] = useState<ActivityEntry[]>(activityLog);
  const [todos, setTodos] = useState<Todo[]>(() =>
    todoSeed.map((t) => ({
      id: t.id,
      text: t.text,
      done: t.done,
      agentId: CHIEF_ID,
      status: t.done ? 'completed' : 'pending',
      priority: 'normal' as const,
      origin: 'todo' as const,
    }))
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await api.tasks();
        if (cancelled) return;
        const list = (r.tasks ?? [])
          .filter(isTodoTask)
          .map((t) => taskToTodo({ ...t, status: normalizeTaskStatus(t.status) }));
        setTodos(list);
      } catch {
        /* fail closed — keep seed / empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const { notify } = useNotifications();
  const [routerOffline, setRouterOfflineState] = useState(false);
  const setRouterOffline = useCallback(
    (v: boolean) => {
      setRouterOfflineState(v);
      notify(
        v ?
        { kind: 'router', title: 'Local router offline', detail: 'Chats fail closed until ASI AMS Micro 70M is back.', to: '/settings/models' } :
        { kind: 'router', title: 'Router back online', detail: 'ASI AMS Micro 70M is routing again.', to: '/settings/models' }
      );
    },
    [notify]
  );
  const [localOn, setLocalOnState] = useState(true);
  const [onlineOn, setOnlineOnState] = useState(true);
  const [boardIds, setBoardIdsRaw] = useState<string[]>(() => withChiefIds(defaultBoardIds));
  const [boardTopic, setBoardTopicRaw] = useState('');
  const [boardStances, setBoardStances] = useState<Record<string, BoardAgentStance>>({});
  const boardHydratedRef = useRef(false);
  const serverBoardRef = useRef<{
    boardIds: string[];
    stances: Record<string, BoardAgentStance>;
    topic: string;
  }>({
    boardIds: withChiefIds(defaultBoardIds),
    stances: {},
    topic: '',
  });
  const pendingBoardPutRef = useRef<BoardPutPending>({});
  const boardPutTimerRef = useRef<number>();

  const applyBoardSnapshot = useCallback((b: Awaited<ReturnType<typeof api.board>>) => {
    const ids = withChiefIds(b.boardIds?.length ? b.boardIds : b.defaultBoardIds ?? defaultBoardIds);
    const stances = b.stances ?? {};
    const topic = typeof b.topic === 'string' ? b.topic : '';
    setBoardIdsRaw(ids);
    setBoardStances(stances);
    setBoardTopicRaw(topic);
    serverBoardRef.current = { boardIds: ids, stances, topic };
  }, []);

  const flushBoardPut = useCallback(() => {
    boardPutTimerRef.current = undefined;
    if (!boardHydratedRef.current) return;

    const pending = pendingBoardPutRef.current;
    const body: BoardPutPending = {};
    if (pending.boardIds && !boardIdsEqual(pending.boardIds, serverBoardRef.current.boardIds)) {
      body.boardIds = withChiefIds(pending.boardIds);
    }
    if (pending.stances !== undefined) {
      body.stances = pending.stances;
    }
    if (pending.topic !== undefined && pending.topic !== serverBoardRef.current.topic) {
      body.topic = pending.topic;
    }
    pendingBoardPutRef.current = {};

    if (!body.boardIds && body.stances === undefined && body.topic === undefined) return;

    void api
      .putBoard(body)
      .then((b) => {
        applyBoardSnapshot(b);
      })
      .catch(() => {
        /* offline — local board still Chief-locked */
      });
  }, [applyBoardSnapshot]);

  const scheduleBoardPut = useCallback(
    (patch: BoardPutPending) => {
      pendingBoardPutRef.current = { ...pendingBoardPutRef.current, ...patch };
      if (boardPutTimerRef.current) window.clearTimeout(boardPutTimerRef.current);
      boardPutTimerRef.current = window.setTimeout(flushBoardPut, BOARD_PUT_DEBOUNCE_MS);
    },
    [flushBoardPut]
  );

  const setBoardIds = useCallback(
    (ids: string[]) => {
      const next = withChiefIds(ids);
      setBoardIdsRaw(next);
      if (!boardHydratedRef.current) {
        pendingBoardPutRef.current = { ...pendingBoardPutRef.current, boardIds: next };
        return;
      }
      scheduleBoardPut({ boardIds: next });
    },
    [scheduleBoardPut]
  );

  const setBoardTopic = useCallback(
    (topic: string) => {
      const next = topic.slice(0, 2000);
      setBoardTopicRaw(next);
      if (!boardHydratedRef.current) {
        pendingBoardPutRef.current = { ...pendingBoardPutRef.current, topic: next };
        return;
      }
      scheduleBoardPut({ topic: next });
    },
    [scheduleBoardPut]
  );

  const setAgentBoardStance = useCallback(
    (agentId: string, next: BoardAgentStance | null) => {
      setBoardStances((prev) => {
        const copy = { ...prev };
        if (next == null) delete copy[agentId];
        else copy[agentId] = next;
        if (!boardHydratedRef.current) {
          pendingBoardPutRef.current = { ...pendingBoardPutRef.current, stances: copy };
        } else {
          scheduleBoardPut({ stances: copy });
        }
        return copy;
      });
    },
    [scheduleBoardPut]
  );

  const setBoardStancesBulk = useCallback(
    (stances: Record<string, BoardAgentStance>) => {
      setBoardStances(stances);
      if (!boardHydratedRef.current) {
        pendingBoardPutRef.current = { ...pendingBoardPutRef.current, stances };
        return;
      }
      scheduleBoardPut({ stances });
    },
    [scheduleBoardPut]
  );
  const setLocalOn = useCallback(
    (v: boolean) => {
      setLocalOnState(v);
      setControlLog((prev) => [{ id: createId(), time: nowTime(), actor: 'You', text: v ? 'Local models on' : 'Local models off — local chats fail closed', tone: v ? 'success' : 'warn' }, ...prev]);
      notify({ kind: 'router', title: v ? 'Local models on' : 'Local models off', detail: v ? 'On-device routing resumed.' : 'Anything that needs a local model is blocked.', to: '/settings/models' });
    },
    [notify]
  );
  const setOnlineOn = useCallback(
    (v: boolean) => {
      setOnlineOnState(v);
      setControlLog((prev) => [{ id: createId(), time: nowTime(), actor: 'You', text: v ? 'Online models on' : 'Online models off — no escalation leaves this device', tone: v ? 'success' : 'warn' }, ...prev]);
      notify({ kind: 'router', title: v ? 'Online models on' : 'Online models off', detail: v ? 'Escalation allowed after a visible handoff.' : 'Chat 1B/3B and cloud are blocked.', to: '/settings/models' });
    },
    [notify]
  );
  const [deskModule, setDeskModule] = useState(initialDesk);
  const [deskInstall, setDeskInstall] = useState<DeskInstall>('installed');
  const [watching, setWatching] = useState(true);
  const installTimer = useRef<number>();

  useEffect(
    () => () => {
      window.clearTimeout(installTimer.current);
      if (boardPutTimerRef.current) window.clearTimeout(boardPutTimerRef.current);
    },
    []
  );

  useEffect(() => subscribeAgents(() => setRosterTick((n) => n + 1)), []);

  // Hydrate per-agent model overrides from app-state (GET /api/agents/model-assignments).
  useEffect(() => {
    let cancelled = false;
    api
      .agentModelAssignments()
      .then(({ assignments }) => {
        if (cancelled) return;
        setAgentModels((prev) => {
          const next = { ...prev };
          for (const [id, row] of Object.entries(assignments)) {
            if (row.primary) next[id] = row.primary as ModelId;
          }
          return next;
        });
      })
      .catch(() => {
        /* offline — registry primaries only */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Full board hydrate on load (roster + topic + stances; Chief-first lists).
  useEffect(() => {
    let cancelled = false;
    api
      .board()
      .then((b) => {
        if (cancelled) return;
        applyBoardSnapshot(b);
        boardHydratedRef.current = true;
        const pending = pendingBoardPutRef.current;
        const flush: BoardPutPending = {};
        if (pending.boardIds && !boardIdsEqual(pending.boardIds, serverBoardRef.current.boardIds)) {
          const next = withChiefIds(pending.boardIds);
          setBoardIdsRaw(next);
          flush.boardIds = next;
        }
        if (pending.stances !== undefined) {
          setBoardStances(pending.stances);
          flush.stances = pending.stances;
        }
        if (pending.topic !== undefined && pending.topic !== serverBoardRef.current.topic) {
          setBoardTopicRaw(pending.topic);
          flush.topic = pending.topic;
        }
        if (flush.boardIds || flush.stances !== undefined || flush.topic !== undefined) {
          scheduleBoardPut(flush);
        } else {
          pendingBoardPutRef.current = {};
        }
      })
      .catch(() => {
        boardHydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [applyBoardSnapshot, scheduleBoardPut]);

  useEffect(() => {
    let cancelled = false;
    fetchAndApplyAgents()
      .then(({ agents: list }) => {
        if (cancelled) return;
        setAgentModels((prev) => {
          const next = { ...prev };
          for (const a of list) {
            next[a.id] = a.primary;
          }
          return next;
        });
        setTree(() =>
          orgTreeFromAgents(
            list.map((a) => ({
              id: a.id,
              reportsTo: a.reportsTo,
              isChief: a.isChief,
            }))
          )
        );
        setRosterTick((n) => n + 1);
      })
      .catch(() => {
        /* AgentsProvider owns empty/error UX; keep prior desk models/tree */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const log = useCallback((entry: Omit<ActivityEntry, 'id' | 'time'>) => {
    setControlLog((prev) => [{ ...entry, id: createId(), time: nowTime() }, ...prev]);
  }, []);

  const clearControlLog = useCallback(() => {
    setControlLog([]);
  }, []);

  const pauseAll = useCallback(() => {
    setPausedAt(nowTime());
    setPanicOpen(false);
    log({ actor: 'You', text: 'Panic — all agents paused', tone: 'danger' });
    void api.browserPanic().catch(() => undefined);
  }, [log]);
  const resumeAll = useCallback(() => {
    setPausedAt(null);
    log({ actor: 'You', text: 'Resumed all agents', tone: 'success' });
  }, [log]);
  const requestPanic = useCallback(() => setPanicOpen(true), []);
  const cancelPanic = useCallback(() => setPanicOpen(false), []);

  const setAgentModel = useCallback((agentId: string, model: ModelId) => {
    setAgentModels((prev) => ({ ...prev, [agentId]: model }));
    void api.patchAgentModels(agentId, { primaryModelId: model }).catch(() => {
      /* offline — local override until server is back */
    });
  }, []);

  const moveInto = useCallback((d: string, t: string) => {
    if (d === CHIEF_ID) return;
    setTree((prev) => moveIntoFn(prev, d, t));
    void api.patchAgent(d, { reportsTo: t }).catch(() => undefined);
  }, []);
  const moveBefore = useCallback((d: string, t: string) => {
    if (d === CHIEF_ID) return;
    setTree((prev) => {
      const next = moveBeforeFn(prev, d, t);
      const parentId = next.find((n) => n.id === d)?.parentId ?? null;
      void api.patchAgent(d, { reportsTo: parentId }).catch(() => undefined);
      return next;
    });
  }, []);
  const shift = useCallback((id: string, dir: -1 | 1) => setTree((prev) => shiftSibling(prev, id, dir)), []);
  const setReportsTo = useCallback((id: string, parentId: string | null) => {
    if (id === CHIEF_ID) return;
    setTree((prev) => setReportsToFn(prev, id, parentId));
    void api.patchAgent(id, { reportsTo: parentId }).catch(() => undefined);
  }, []);

  const resolveApproval = useCallback(
    (id: string, state: ApprovalState) => {
      setApprovals((prev) => prev.map((a) => a.id === id ? { ...a, state } : a));
      log({ actor: 'You', text: `Approval ${id}: ${state === 'local' ? 'kept local' : state}`, tone: state === 'approved' ? 'success' : 'neutral' });
    },
    [log]
  );

  const requestApproval = useCallback(
    (input: Omit<Approval, 'id' | 'state' | 'time'> & { state?: ApprovalState }) => {
      const id = createId();
      const approval: Approval = {
        id,
        threadId: input.threadId,
        agentId: input.agentId,
        kind: input.kind,
        title: input.title,
        detail: input.detail,
        model: input.model,
        state: input.state ?? 'open',
        time: nowTime(),
      };
      setApprovals((prev) => [approval, ...prev]);
      notify({
        kind: 'approval',
        title: input.title,
        detail: input.detail,
        to: `/chat/${input.threadId}`,
      });
      return id;
    },
    [notify]
  );

  const raiseRedAlert = useCallback(
    (kind: RedAlert['kind']) => {
      setRedAlert({ id: createId(), kind, time: nowTime(), ...redAlertTemplates[kind] });
      notify({ kind: 'redAlert', title: `Red alert: ${redAlertTemplates[kind].title}`, detail: redAlertTemplates[kind].detail });
    },
    [notify]
  );
  const resolveRedAlert = useCallback(
    (action: 'approve' | 'deny' | 'acknowledge') => {
      setRedAlert((cur) => {
        if (cur) log({ actor: 'You', text: `Red alert "${cur.title}" — ${action}`, tone: action === 'approve' ? 'warn' : 'danger' });
        return null;
      });
    },
    [log]
  );

  const addTodo = useCallback((textOrOpts: string | AddTodoOptions) => {
    const opts: AddTodoOptions = typeof textOrOpts === 'string' ? { text: textOrOpts } : textOrOpts;
    const title = opts.text.trim();
    if (!title) return;
    void (async () => {
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
        if (todo.agentId && todo.agentId !== 'boss') {
          notify({
            kind: 'approval',
            title: `Assigned to ${todo.agentId}`,
            detail: kickoff?.chatSeeded
              ? `${todo.text} — chat seeded (waiting for model).`
              : `${todo.text} — assigned.`,
            to: `/chat/${todo.agentId === 'chief' ? 'chief' : todo.agentId}`,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not add to-do';
        const detail = /failed to fetch|could not reach|network/i.test(msg)
          ? 'API unreachable — is ASI on :3445?'
          : msg;
        notify({ kind: 'router', title: 'Could not add to-do', detail });
        log({ actor: 'System', text: `To-do add failed: ${detail}`, tone: 'danger' });
      }
    })();
  }, [notify, log]);
  const toggleTodo = useCallback((id: string) => {
    setTodos((p) => {
      const cur = p.find((t) => t.id === id);
      if (!cur) return p;
      const nextStatus = toggleTaskStatus(cur.status);
      const nextDone = nextStatus === 'completed';
      void api.patchTask(id, { status: nextStatus }).catch(() => {
        /* optimistic; revert not required for desk quick toggle */
      });
      return p.map((t) => (t.id === id ? { ...t, done: nextDone, status: nextStatus } : t));
    });
  }, []);
  const removeTodo = useCallback((id: string) => {
    setTodos((p) => p.filter((t) => t.id !== id));
    void api.deleteTask(id).catch(() => {
      /* ignore */
    });
  }, []);

  const startInstall = useCallback(() => {
    setDeskInstall('installing');
    installTimer.current = window.setTimeout(() => setDeskInstall('installed'), 1400);
  }, []);
  const uninstallDesk = useCallback(() => setDeskInstall('none'), []);

  const value = useMemo(
    () => {
      void rosterTick;
      return {
      mode, setMode, isTeamMode: mode !== 'super', councilTick,
      pausedAt, pauseAll, resumeAll, panicOpen, requestPanic, cancelPanic,
      agentModels, setAgentModel, tree, moveInto, moveBefore, shift, setReportsTo,
      approvals, resolveApproval, requestApproval, openApprovals: approvals.filter((a) => a.state === 'open').length,
      redAlert, raiseRedAlert, resolveRedAlert, controlLog, log, clearControlLog,
      todos, addTodo, toggleTodo, removeTodo, routerOffline: routerOffline || !localOn, setRouterOffline,
      localOn, setLocalOn, onlineOn, setOnlineOn, boardIds, setBoardIds, boardTopic, setBoardTopic,
      boardStances, setAgentBoardStance, setBoardStances: setBoardStancesBulk, applyBoardSnapshot,
      deskModule, setDeskModule, deskInstall, startInstall, uninstallDesk, watching, setWatching
    };
    },
    [mode, councilTick, pausedAt, pauseAll, resumeAll, panicOpen, requestPanic, cancelPanic, agentModels, setAgentModel, tree, moveInto, moveBefore, shift, setReportsTo, approvals, resolveApproval, requestApproval, redAlert, raiseRedAlert, resolveRedAlert, controlLog, log, clearControlLog, todos, addTodo, toggleTodo, removeTodo, routerOffline, setRouterOffline, localOn, setLocalOn, onlineOn, setOnlineOn, boardIds, setBoardIds, boardTopic, setBoardTopic, boardStances, setAgentBoardStance, setBoardStancesBulk, applyBoardSnapshot, deskModule, deskInstall, startInstall, uninstallDesk, watching, rosterTick]
  );

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useDesk(): DeskContextValue {
  const ctx = useContext(DeskContext);
  if (!ctx) throw new Error('useDesk must be used inside DeskProvider');
  return ctx;
}