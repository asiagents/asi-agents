import React, { useEffect, useMemo, useState } from 'react';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, SearchIcon } from 'lucide-react';
import { api, type AmsSkillEntry } from '@asi-api';

const PREVIEW_LIMIT = 24;

type CatalogState =
  | { status: 'loading' }
  | { status: 'ok'; skills: AmsSkillEntry[]; label: string; total: number }
  | { status: 'empty'; label: string }
  | { status: 'error'; message: string };

type Props = {
  selected: string[];
  onChange: (ids: string[]) => void;
  /** When true, fetch catalog (defer until create form is open). */
  active?: boolean;
  /** Start with the full matching list expanded. */
  defaultExpanded?: boolean;
};

/**
 * Searchable multi-select over the real AMS catalog (GET /api/skills/catalog).
 * Fail-closed: no offline fallback list — empty or unreachable is shown honestly.
 */
export function AmsSkillMultiSelect({
  selected,
  onChange,
  active = true,
  defaultExpanded = false,
}: Props) {
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' });
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setCatalog({ status: 'loading' });
    void (async () => {
      try {
        const r = await api.skillsCatalog({ limit: 500 });
        if (cancelled) return;
        const skills = Array.isArray(r.skills) ? r.skills : [];
        if (skills.length === 0) {
          setCatalog({ status: 'empty', label: r.label || 'AMS skills catalog' });
        } else {
          setCatalog({
            status: 'ok',
            skills,
            label: r.label,
            total: r.total ?? skills.length,
          });
        }
      } catch {
        if (!cancelled) {
          setCatalog({
            status: 'error',
            message: 'AMS skills catalog unreachable — start the API on :3445, or create without skills.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!defaultExpanded) setExpanded(false);
  }, [q, group, defaultExpanded]);

  const groups = useMemo(() => {
    if (catalog.status !== 'ok') return ['All'];
    return ['All', ...Array.from(new Set(catalog.skills.map((s) => s.group))).sort()];
  }, [catalog]);

  const shown = useMemo(() => {
    if (catalog.status !== 'ok') return [];
    const query = q.trim().toLowerCase();
    return catalog.skills.filter(
      (s) =>
        (group === 'All' || s.group === group) &&
        (!query ||
          s.name.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query) ||
          s.group.toLowerCase().includes(query)),
    );
  }, [catalog, group, q]);

  const needsExpand = shown.length > PREVIEW_LIMIT;
  const visible = expanded || !needsExpand ? shown : shown.slice(0, PREVIEW_LIMIT);

  const groupCount = (g: string) => {
    if (catalog.status !== 'ok') return 0;
    return g === 'All' ? catalog.skills.length : catalog.skills.filter((s) => s.group === g).length;
  };

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (catalog.status === 'loading') {
    return <p className="text-[12px] text-muted">Loading AMS skills catalog…</p>;
  }

  if (catalog.status === 'error') {
    return <p className="text-[12px] text-warn">{catalog.message}</p>;
  }

  if (catalog.status === 'empty') {
    return (
      <p className="text-[12px] text-muted">
        {catalog.label} is empty — no skills to pick. Edit{' '}
        <code className="text-[11px]">config/ams-skills.catalog.json</code>.
      </p>
    );
  }

  return (
    <fieldset className="rounded-xl bg-bg p-3 ring-1 ring-line">
      <legend className="sr-only">AMS skills</legend>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[160px] flex-1">
          <span className="sr-only">Search skills</span>
          <SearchIcon
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search skills"
            className="h-8 w-full rounded-lg bg-surface pl-7 pr-2 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60"
          />
        </label>
        <span className="text-[12px] text-muted">
          {selected.length} selected · {shown.length} shown
        </span>
      </div>
      <div className="mt-2 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Skill group">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={group === g}
            onClick={() => setGroup(g)}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-150 ${
              group === g ? 'bg-ink text-bg' : 'text-muted hover:text-ink'
            }`}
          >
            {g}
            <span className="ml-1 opacity-70">{groupCount(g)}</span>
          </button>
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {visible.map((s) => {
          const on = selected.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={on}
                title={s.description || s.id}
                onClick={() => toggle(s.id)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset transition-colors duration-150 ${
                  on
                    ? 'bg-accent/15 text-accent-ink ring-accent/40'
                    : 'bg-surface text-ink ring-line hover:ring-overlay/25'
                }`}
              >
                {on && <CheckIcon size={11} aria-hidden="true" />}
                {s.name}
              </button>
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="text-[12px] text-muted">
            {q.trim() ? `No skill matches “${q.trim()}”.` : 'No skills in this group.'}
          </li>
        )}
      </ul>
      {needsExpand && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-accent-ink hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUpIcon size={13} aria-hidden="true" /> Show fewer
            </>
          ) : (
            <>
              <ChevronDownIcon size={13} aria-hidden="true" /> Show all {shown.length}
              {group !== 'All' || q.trim() ? ' matching' : ''}
            </>
          )}
        </button>
      )}
      <p className="mt-2 text-[11px] text-faint">
        {catalog.label}: {catalog.total} skills from GET /api/skills/catalog. Optional — leave empty to create with no
        catalog skills.
      </p>
    </fieldset>
  );
}
