import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2Icon,
  CircleIcon,
  FlaskConicalIcon,
  ListChecksIcon,
  MessageSquareIcon,
  PaperclipIcon,
} from 'lucide-react';
import { PageHeader, PageScroll } from '../components/PageScroll';
import { api, type AgentTask, type TaskAttachment, type TaskComment } from '@asi-api';
import { useNotifications } from '../contexts/NotificationContext';
import {
  normalizeTaskStatus,
  taskBucket,
  toggleTaskStatus,
  type TaskBucket,
} from '../utils/taskStatus';

type TaskGroup = {
  key: string;
  researchId?: string;
  label: string;
  note?: string;
  tasks: AgentTask[];
};

const SECTIONS: { id: TaskBucket; label: string; empty: string }[] = [
  { id: 'ongoing', label: 'Ongoing', empty: 'Nothing in progress or blocked.' },
  { id: 'pending', label: 'Pending', empty: 'No pending tasks.' },
  { id: 'completed', label: 'Completed', empty: 'No completed tasks yet.' },
];

function groupTasks(tasks: AgentTask[]): TaskGroup[] {
  const researchOrder: string[] = [];
  const byResearch = new Map<string, AgentTask[]>();
  const other: AgentTask[] = [];

  for (const t of tasks) {
    const rid = t.researchId?.trim();
    if (!rid) {
      other.push(t);
      continue;
    }
    if (!byResearch.has(rid)) {
      byResearch.set(rid, []);
      researchOrder.push(rid);
    }
    byResearch.get(rid)!.push(t);
  }

  const groups: TaskGroup[] = researchOrder.map((rid) => {
    const list = byResearch.get(rid) ?? [];
    const scope = list.find((t) => t.step === 'scope') ?? list[0];
    const title = scope?.title?.replace(/^Scope\s*[—–-]\s*/i, '') ?? rid;
    return {
      key: rid,
      researchId: rid,
      label: title,
      note: scope?.note,
      tasks: list,
    };
  });

  if (other.length) {
    groups.push({
      key: 'other',
      label: 'Other tasks',
      tasks: other,
    });
  }
  return groups;
}

function renderCommentText(text: string, mentions?: string[]) {
  if (!mentions?.length) return text;
  const parts: React.ReactNode[] = [];
  const re = /@([a-zA-Z0-9_.:-]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const id = m[1];
    if (mentions.includes(id)) {
      parts.push(
        <Link key={key++} to={`/agents/${encodeURIComponent(id)}`} className="font-medium text-accent-ink hover:underline">
          @{id}
        </Link>
      );
    } else {
      parts.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function TaskThread({
  task,
  onUpdate,
}: {
  task: AgentTask;
  onUpdate: (task: AgentTask) => void;
}) {
  const { notify } = useNotifications();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const comments: TaskComment[] = task.comments ?? [];
  const attachments: TaskAttachment[] = task.attachments ?? [];

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setErr(null);
    try {
      const { task: updated, mentions } = await api.addTaskComment(task.id, { text, author: 'you' });
      onUpdate({ ...updated, status: normalizeTaskStatus(updated.status) });
      setDraft('');
      if (mentions?.length) {
        notify({
          kind: 'agentDone',
          title: `Mentioned ${mentions.map((id) => `@${id}`).join(', ')}`,
          detail: text.slice(0, 120),
          to: '/tasks',
        });
      }
    } catch {
      setErr('Could not post comment');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const r = String(reader.result ?? '');
          const i = r.indexOf(',');
          resolve(i >= 0 ? r.slice(i + 1) : r);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const { task: updated } = await api.addTaskAttachment(task.id, {
        name: file.name,
        mime: file.type || 'application/octet-stream',
        dataBase64,
        uploadedBy: 'you',
      });
      onUpdate({ ...updated, status: normalizeTaskStatus(updated.status) });
    } catch {
      setErr('Could not upload attachment');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-ink hover:underline"
      >
        <MessageSquareIcon size={12} aria-hidden="true" />
        Thread ({comments.length})
        <span className="text-faint">{open ? '· hide' : '· open'}</span>
      </button>
      {open ? (
        <div className="mt-2 space-y-2 rounded-lg bg-bg p-2.5 ring-1 ring-line">
          {comments.length === 0 ? (
            <p className="text-[12px] text-muted">No comments yet. Mention agents with @id.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="text-[12px]">
                  <span className="font-medium text-ink">{c.author}</span>
                  <span className="ml-1.5 text-faint">{c.at}</span>
                  <p className="mt-0.5 text-muted">{renderCommentText(c.text, c.mentions)}</p>
                </li>
              ))}
            </ul>
          )}
          {attachments.length > 0 ? (
            <ul className="space-y-1 border-t border-line pt-2">
              {attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={`/api/tasks/${encodeURIComponent(task.id)}/attachments/${encodeURIComponent(a.id)}`}
                    className="inline-flex items-center gap-1 text-[12px] text-accent-ink hover:underline"
                  >
                    <PaperclipIcon size={11} aria-hidden="true" />
                    {a.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Comment… use @agentId"
              className="min-w-0 flex-1 rounded-md bg-surface px-2 py-1.5 text-[12px] text-ink outline-none ring-1 ring-line focus:ring-accent/60"
            />
            <button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() => void send()}
              className="rounded-md bg-accent-strong px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
            >
              Post
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-[12px] text-muted ring-1 ring-line hover:text-ink">
              <PaperclipIcon size={12} aria-hidden="true" />
              {uploading ? 'Uploading…' : 'Attach'}
              <input
                type="file"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {err ? <p className="text-[11px] text-danger">{err}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  busyId,
  onToggle,
  onThreadUpdate,
}: {
  task: AgentTask;
  busyId: string | null;
  onToggle: (task: AgentTask) => void;
  onThreadUpdate: (task: AgentTask) => void;
}) {
  const status = normalizeTaskStatus(task.status);
  const isDone = status === 'completed';
  const isBlocked = status === 'blocked';
  const isOngoing = status === 'ongoing';

  return (
    <li className="flex items-start gap-3 px-4 py-3 text-sm">
      <button
        type="button"
        disabled={busyId === task.id}
        onClick={() => onToggle(task)}
        aria-label={isDone ? 'Mark pending' : 'Mark completed'}
        title={isDone ? 'Mark pending' : 'Mark completed'}
        className="mt-0.5 shrink-0 text-muted transition-colors hover:text-accent-ink disabled:opacity-40"
      >
        {isDone ? (
          <CheckCircle2Icon size={18} className="text-success" aria-hidden="true" />
        ) : (
          <CircleIcon
            size={18}
            className={isBlocked ? 'text-warn' : isOngoing ? 'text-accent' : 'text-muted'}
            aria-hidden="true"
          />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-ink ${isDone ? 'line-through text-muted' : ''}`}>{task.title}</p>
        {(task.note || task.step || isBlocked) && (
          <p className="mt-0.5 text-[12px] text-faint">
            {[isBlocked ? 'blocked' : isOngoing ? 'ongoing' : null, task.step, task.note]
              .filter(Boolean)
              .join(' · ')}
            {task.step === 'participate' && !isDone ? ' · answer prompts in chat' : ''}
          </p>
        )}
        <TaskThread task={task} onUpdate={onThreadUpdate} />
      </div>
      <span className="shrink-0 text-[12px] text-muted">{task.agentId}</span>
      {task.category ? <span className="shrink-0 text-[11px] text-faint">{task.category}</span> : null}
      {task.due && <span className="shrink-0 text-[12px] tabular-nums text-faint">{task.due}</span>}
    </li>
  );
}

function SectionGroups({
  tasks,
  busyId,
  onToggle,
  onThreadUpdate,
  emptyLabel,
}: {
  tasks: AgentTask[];
  busyId: string | null;
  onToggle: (task: AgentTask) => void;
  onThreadUpdate: (task: AgentTask) => void;
  emptyLabel: string;
}) {
  const groups = useMemo(() => groupTasks(tasks), [tasks]);

  if (tasks.length === 0) {
    return (
      <p className="rounded-card bg-surface px-4 py-8 text-center text-[13px] text-muted ring-1 ring-line">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.key} className="overflow-hidden rounded-card bg-surface ring-1 ring-line">
          {g.researchId ? (
            <div className="flex items-start gap-2 border-b border-line px-4 py-2.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-ink">
                <FlaskConicalIcon size={14} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[13px] font-semibold text-ink">{g.label}</h2>
                <p className="text-[11px] text-muted">
                  Research · {g.tasks.length} step{g.tasks.length === 1 ? '' : 's'}
                  {g.note ? ` · ${g.note}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <div className="border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">{g.label}</h2>
            </div>
          )}
          <ul className="divide-y divide-line">
            {g.tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                busyId={busyId}
                onToggle={onToggle}
                onThreadUpdate={onThreadUpdate}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function statusFromSearch(raw: string | null): TaskBucket | null {
  if (raw === 'pending' || raw === 'ongoing' || raw === 'completed') return raw;
  if (raw === 'done') return 'completed';
  return null;
}

export function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<TaskBucket>(() => statusFromSearch(searchParams.get('status')) ?? 'ongoing');

  useEffect(() => {
    const fromUrl = statusFromSearch(searchParams.get('status'));
    if (fromUrl) setTab(fromUrl);
  }, [searchParams]);

  const refresh = useCallback(async () => {
    try {
      const r = await api.tasks();
      setTasks((r.tasks ?? []).map((t) => ({ ...t, status: normalizeTaskStatus(t.status) })));
      setError(null);
    } catch {
      setError('Could not load tasks — is the API running on :3445?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectTab = useCallback(
    (next: TaskBucket) => {
      setTab(next);
      setSearchParams({ status: next }, { replace: true });
    },
    [setSearchParams]
  );

  const toggleDone = useCallback(async (task: AgentTask) => {
    setBusyId(task.id);
    try {
      const next = toggleTaskStatus(task.status);
      const { task: updated } = await api.patchTask(task.id, { status: next });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === updated.id
            ? { ...updated, status: normalizeTaskStatus(updated.status), comments: t.comments }
            : t
        )
      );
    } catch {
      setError('Could not update task');
    } finally {
      setBusyId(null);
    }
  }, []);

  const onThreadUpdate = useCallback((updated: AgentTask) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === updated.id ? { ...updated, status: normalizeTaskStatus(updated.status) } : t
      )
    );
  }, []);

  const byBucket = useMemo(() => {
    const map: Record<TaskBucket, AgentTask[]> = { ongoing: [], pending: [], completed: [] };
    for (const t of tasks) {
      map[taskBucket(t.status)].push(t);
    }
    return map;
  }, [tasks]);

  const empty = tasks.length === 0;

  return (
    <PageScroll width="max-w-3xl">
      <PageHeader
        title="Tasks"
        description={
          loading
            ? 'Loading…'
            : empty
              ? 'Agent queue from /api/tasks'
              : `${tasks.length} task${tasks.length === 1 ? '' : 's'}`
        }
      />

      {error ? <p className="mb-3 text-[13px] text-danger">{error}</p> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Task sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={tab === s.id}
            onClick={() => selectTab(s.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors ${
              tab === s.id
                ? 'bg-accent/10 text-accent-ink ring-accent/40'
                : 'text-muted ring-line hover:text-ink'
            }`}
          >
            <ListChecksIcon size={14} aria-hidden="true" />
            {s.label}
            <span className="tabular-nums text-faint">{byBucket[s.id].length}</span>
          </button>
        ))}
        <Link to="/todos" className="ml-auto text-[12px] font-medium text-accent-ink hover:underline">
          Home to-dos →
        </Link>
      </div>

      {SECTIONS.map((s) =>
        tab === s.id ? (
          <div key={s.id} role="tabpanel" aria-label={s.label}>
            <SectionGroups
              tasks={byBucket[s.id]}
              busyId={busyId}
              onToggle={(t) => void toggleDone(t)}
              onThreadUpdate={onThreadUpdate}
              emptyLabel={s.empty}
            />
          </div>
        ) : null
      )}
    </PageScroll>
  );
}
