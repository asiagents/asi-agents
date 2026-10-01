import { useEffect, useState } from 'react';
import { api, type AgentTask, type ChatMessage } from '@asi-api';
import { useAgents } from '../contexts/AgentsContext';
import { normalizeTaskStatus, taskBucket } from '../utils/taskStatus';

export type DayCount = { day: string; label: string; count: number };
export type AgentRunCount = { agentId: string; label: string; count: number };

export type TaskStatusCounts = {
  pending: number;
  ongoing: number;
  completed: number;
  blocked: number;
  total: number;
};

export type OutcomeCounts = {
  success: number;
  blocked: number;
  fail: number;
};

export type FailInspectItem = {
  id: string;
  at: string;
  agentId: string;
  agentLabel: string;
  text: string;
  reason: string;
};

export type SuccessInspectItem = {
  id: string;
  title: string;
  at: string;
  agentId?: string;
  agentLabel?: string;
};

function dayKey(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function isGenerateMessage(m: ChatMessage): boolean {
  return m.role === 'chief' || m.role === 'agent' || m.role === 'handoff';
}

function isFailClosedMessage(m: ChatMessage): boolean {
  const text = m.text ?? '';
  const reason = m.meta?.reason ?? '';
  return (
    /fail closed|fail-closed|generate_failed|generate unavailable|no generate backend/i.test(text) ||
    /fail_closed|generate_offline|intent_fail_closed|generate_failed/i.test(reason)
  );
}

function failReasonOf(m: ChatMessage): string {
  const reason = (m.meta?.reason ?? '').trim();
  if (reason) return reason;
  const text = (m.text ?? '').trim();
  if (!text) return 'Fail-closed (no detail)';
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

type MetricsSnapshot = {
  tasks: AgentTask[];
  runsByDay: DayCount[];
  runsByAgent: AgentRunCount[];
  chatFails: number;
  failItems: FailInspectItem[];
  error: string | null;
};

let cache: { key: string; at: number; promise: Promise<MetricsSnapshot> } | null = null;
const CACHE_MS = 8_000;

async function fetchMetrics(
  agentIds: string[],
  nameOf: (id: string) => string,
): Promise<MetricsSnapshot> {
  let taskList: AgentTask[] = [];
  let error: string | null = null;
  try {
    const r = await api.tasks();
    taskList = (r.tasks ?? []).map((t) => ({ ...t, status: normalizeTaskStatus(t.status) }));
  } catch {
    error = 'Tasks API unreachable';
  }

  const days = lastNDays(7);
  const dayMap = new Map(days.map((d) => [d, 0]));
  const agentMap = new Map<string, number>();
  const failItems: FailInspectItem[] = [];

  const ingest = (messages: ChatMessage[] | undefined, agentId: string) => {
    if (!messages?.length) return;
    for (const m of messages) {
      if (isFailClosedMessage(m)) {
        failItems.push({
          id: m.id,
          at: m.at,
          agentId,
          agentLabel: nameOf(agentId),
          text: (m.text ?? '').trim() || 'Fail-closed reply',
          reason: failReasonOf(m),
        });
      }
      if (!isGenerateMessage(m)) continue;
      const key = dayKey(m.at);
      if (key && dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
      agentMap.set(agentId, (agentMap.get(agentId) ?? 0) + 1);
    }
  };

  try {
    const chief = await api.chiefThread().catch(() => null);
    ingest(chief?.messages, 'chief');
  } catch {
    /* ignore */
  }

  await Promise.all(
    agentIds.map(async (id) => {
      try {
        const th = await api.agentThread(id);
        ingest(th.messages as ChatMessage[], id);
      } catch {
        /* ignore */
      }
    }),
  );

  failItems.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return {
    tasks: taskList,
    runsByDay: days.map((d) => ({ day: d, label: dayLabel(d), count: dayMap.get(d) ?? 0 })),
    runsByAgent: [...agentMap.entries()]
      .map(([agentId, count]) => ({ agentId, label: nameOf(agentId), count }))
      .sort((a, b) => b.count - a.count),
    chatFails: failItems.length,
    failItems: failItems.slice(0, 40),
    error,
  };
}

/**
 * Home metrics from /api/tasks + live chat threads.
 * Fail-closed: zeros when APIs are down — never invents runs.
 * Shared short TTL cache so multiple home widgets do not stampede the API.
 */
export function useHomeMetrics(): {
  loading: boolean;
  tasks: AgentTask[];
  taskCounts: TaskStatusCounts;
  outcomes: OutcomeCounts;
  runsByDay: DayCount[];
  runsByAgent: AgentRunCount[];
  failItems: FailInspectItem[];
  successItems: SuccessInspectItem[];
  error: string | null;
} {
  const agents = useAgents();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [runsByDay, setRunsByDay] = useState<DayCount[]>([]);
  const [runsByAgent, setRunsByAgent] = useState<AgentRunCount[]>([]);
  const [chatFails, setChatFails] = useState(0);
  const [failItems, setFailItems] = useState<FailInspectItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const agentIds = agents.filter((a) => a.id !== 'chief').map((a) => a.id);
    const key = agentIds.slice().sort().join(',');
    const nameOf = (id: string) =>
      id === 'chief' ? 'Chief' : agents.find((a) => a.id === id)?.name ?? id;

    const now = Date.now();
    if (!cache || cache.key !== key || now - cache.at > CACHE_MS) {
      cache = { key, at: now, promise: fetchMetrics(agentIds, nameOf) };
    }

    setLoading(true);
    void cache.promise.then((snap) => {
      if (cancelled) return;
      setTasks(snap.tasks);
      setRunsByDay(snap.runsByDay);
      setRunsByAgent(snap.runsByAgent);
      setChatFails(snap.chatFails);
      setFailItems(snap.failItems);
      setError(snap.error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [agents]);

  let pending = 0;
  let completed = 0;
  let blocked = 0;
  for (const t of tasks) {
    const s = normalizeTaskStatus(t.status);
    if (s === 'blocked') blocked += 1;
    else if (s === 'completed') completed += 1;
    else if (s === 'pending') pending += 1;
  }

  const taskCounts: TaskStatusCounts = {
    pending,
    ongoing: tasks.filter((t) => taskBucket(t.status) === 'ongoing').length,
    completed,
    blocked,
    total: tasks.length,
  };

  const successItems: SuccessInspectItem[] = tasks
    .filter((t) => normalizeTaskStatus(t.status) === 'completed')
    .map((t) => ({
      id: t.id,
      title: t.title || t.id,
      at: t.due || '',
      agentId: t.agentId,
      agentLabel: t.agentId
        ? agents.find((a) => a.id === t.agentId)?.name ?? t.agentId
        : undefined,
    }))
    .slice(0, 40);

  return {
    loading,
    tasks,
    taskCounts,
    outcomes: {
      success: completed,
      blocked,
      fail: chatFails,
    },
    runsByDay,
    runsByAgent,
    failItems,
    successItems,
    error,
  };
}
