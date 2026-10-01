import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenIcon, PinIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { api, type Lesson, type LessonSource } from '@asi-api';
import { PageHeader, PageScroll } from '../components/PageScroll';

const SOURCE_LABEL: Record<LessonSource, string> = {
  research: 'Research',
  training: 'Training',
  group_final: 'Final',
  manual: 'Manual',
};

const SOURCE_FILTERS: { id: LessonSource | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'research', label: 'Research' },
  { id: 'training', label: 'Training' },
  { id: 'group_final', label: 'Final' },
  { id: 'manual', label: 'Manual' },
];

function matchesQuery(lesson: Lesson, q: string): boolean {
  if (!q) return true;
  const hay = `${lesson.title}\n${lesson.body}\n${lesson.source}\n${SOURCE_LABEL[lesson.source]}`.toLowerCase();
  return hay.includes(q);
}

function Frame({
  embedded,
  children,
  actions,
}: {
  embedded: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  if (embedded) {
    return (
      <div className="max-w-3xl">
        {actions ? <div className="mb-4 flex justify-end">{actions}</div> : null}
        {children}
      </div>
    );
  }
  return (
    <PageScroll width="max-w-3xl">
      <PageHeader
        title="Lessons"
        description="Things the team learned — auto-tagged by source (research, training, Final, manual). Pin selected Lessons to inject them into agent training."
        actions={actions}
      />
      {children}
    </PageScroll>
  );
}

/** Also rendered inside Settings → Lessons (embedded, no duplicate page chrome). */
export function Lessons({ embedded = false }: { embedded?: boolean }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<LessonSource | 'all'>('all');

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.lessons();
      setLessons(res.lessons ?? []);
    } catch (e) {
      setLessons([]);
      setError(e instanceof Error ? e.message : 'Could not load Lessons — is the API on :3445?');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lessons.filter((l) => {
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
      return matchesQuery(l, q);
    });
  }, [lessons, query, sourceFilter]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.createLesson({ title: t, body: b, source: 'manual' });
      setTitle('');
      setBody('');
      setInfo('Lesson saved (tagged Manual).');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Lesson.');
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.deleteLesson(id);
      setLessons(res.lessons ?? []);
      setInfo('Lesson removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete Lesson.');
    } finally {
      setBusy(false);
    }
  }

  async function onTogglePin(lesson: Lesson) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.patchLesson(lesson.id, { pinned: !lesson.pinned });
      setLessons(res.lessons ?? []);
      setInfo(
        res.lesson.pinned
          ? 'Pinned — this Lesson injects into agent training context.'
          : 'Unpinned from training inject.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update pin.');
    } finally {
      setBusy(false);
    }
  }

  const companyLink = (
    <Link to="/settings/company" className="text-[13px] font-medium text-accent-ink hover:underline">
      Company training →
    </Link>
  );

  return (
    <Frame embedded={embedded} actions={companyLink}>
      <form
        onSubmit={(e) => void onAdd(e)}
        className="mb-6 space-y-3 rounded-card bg-surface p-4 ring-1 ring-line"
      >
        <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
          <PlusIcon size={15} aria-hidden="true" />
          Add a Lesson
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What did we learn?"
          className="w-full rounded-lg bg-bg px-3 py-2 text-[13px] text-ink ring-1 ring-line placeholder:text-faint"
          disabled={busy}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Takeaway, brief, or report notes…"
          className="w-full rounded-lg bg-bg px-3 py-2 text-[13px] leading-relaxed text-ink ring-1 ring-line placeholder:text-faint"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !title.trim() || !body.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
        >
          <BookOpenIcon size={14} aria-hidden="true" />
          Save Lesson
        </button>
      </form>

      <div className="mb-4 space-y-3">
        <label className="relative block">
          <SearchIcon
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Lessons…"
            className="w-full rounded-lg bg-surface py-2 pl-9 pr-3 text-[13px] text-ink ring-1 ring-line placeholder:text-faint"
            disabled={busy && lessons.length === 0}
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by source tag">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={sourceFilter === f.id}
              onClick={() => setSourceFilter(f.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors ${
                sourceFilter === f.id
                  ? 'bg-accent-strong text-white ring-accent-strong'
                  : 'bg-surface text-muted ring-line hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {(error || info) && (
        <div className="mb-4 space-y-2">
          {error ? (
            <p className="rounded-lg bg-warn/10 px-3 py-2 text-[13px] text-warn" role="alert">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-[13px] text-success">{info}</p>
          ) : null}
        </div>
      )}

      <ul className="overflow-hidden rounded-card ring-1 ring-line">
        {filtered.map((l) => {
          const open = expanded === l.id;
          return (
            <li key={l.id} className="border-t border-line first:border-t-0">
              <div className="flex items-start gap-2 px-4 py-3.5">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : l.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-overlay/[0.06] px-2 py-0.5 text-[11px] font-medium text-muted">
                      {SOURCE_LABEL[l.source] ?? l.source}
                    </span>
                    {l.pinned ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-ink">
                        Pinned → training
                      </span>
                    ) : null}
                    <span className="text-sm font-medium text-ink">{l.title}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-faint">
                    {new Date(l.createdAt).toLocaleString()}
                    {l.agentIds.length
                      ? ` · ${l.agentIds.slice(0, 4).join(', ')}${l.agentIds.length > 4 ? '…' : ''}`
                      : ''}
                  </p>
                  <p
                    className={`mt-1.5 text-[12px] leading-relaxed text-muted ${
                      open ? 'whitespace-pre-wrap' : 'line-clamp-2'
                    }`}
                  >
                    {open ? l.body : l.body.replace(/\s+/g, ' ').trim()}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => void onTogglePin(l)}
                  disabled={busy}
                  className={`shrink-0 rounded-lg p-2 disabled:opacity-40 ${
                    l.pinned
                      ? 'text-accent-ink hover:bg-accent/10'
                      : 'text-muted hover:bg-raised hover:text-ink'
                  }`}
                  aria-label={l.pinned ? `Unpin ${l.title}` : `Pin ${l.title} for training`}
                  title={l.pinned ? 'Unpin from training inject' : 'Pin into training context'}
                >
                  <PinIcon size={14} aria-hidden="true" className={l.pinned ? 'fill-current' : undefined} />
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(l.id)}
                  disabled={busy}
                  className="shrink-0 rounded-lg p-2 text-muted hover:bg-raised hover:text-danger disabled:opacity-40"
                  aria-label={`Delete ${l.title}`}
                >
                  <Trash2Icon size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
        {!busy && lessons.length === 0 && !error ? (
          <li className="px-4 py-10 text-center text-[13px] text-muted">
            No Lessons yet. Complete a research report, send agents to training, post a group Final, or add one above.
          </li>
        ) : null}
        {!busy && lessons.length > 0 && filtered.length === 0 ? (
          <li className="px-4 py-10 text-center text-[13px] text-muted">
            No Lessons match this search / filter.
          </li>
        ) : null}
        {busy && lessons.length === 0 ? (
          <li className="px-4 py-10 text-center text-[13px] text-muted">Loading…</li>
        ) : null}
      </ul>
    </Frame>
  );
}
