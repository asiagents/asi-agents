import React, { useEffect, useMemo, useState } from 'react';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, SearchIcon } from 'lucide-react';
import { usePro } from '../../contexts/ProContext';

const PREVIEW_LIMIT = 24;

interface SkillCatalogProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  /** Start expanded so all matching chips are visible. */
  defaultExpanded?: boolean;
  /** When true, chips are display-only (no toggle). */
  readOnly?: boolean;
}

/** Search + group filter + multi-select chips. Catalog from GET /api/skills/catalog (ProContext). */
export function SkillCatalog({
  selected,
  onChange,
  label = 'Skills',
  defaultExpanded = false,
  readOnly = false,
}: SkillCatalogProps) {
  const { skillsCatalog, skillsCatalogMeta } = usePro();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');
  const [expanded, setExpanded] = useState(defaultExpanded);

  const groups = useMemo(
    () => ['All', ...Array.from(new Set(skillsCatalog.map((s) => s.group))).sort()],
    [skillsCatalog],
  );

  const query = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      skillsCatalog.filter(
        (s) =>
          (group === 'All' || s.group === group) &&
          (!query ||
            s.name.toLowerCase().includes(query) ||
            s.id.toLowerCase().includes(query) ||
            s.group.toLowerCase().includes(query)),
      ),
    [skillsCatalog, group, query],
  );

  // New search/filter → collapse so the truncated preview stays scannable.
  useEffect(() => {
    if (!defaultExpanded) setExpanded(false);
  }, [q, group, defaultExpanded]);

  const needsExpand = shown.length > PREVIEW_LIMIT;
  const visible = expanded || !needsExpand ? shown : shown.slice(0, PREVIEW_LIMIT);

  const toggle = (id: string) => {
    if (readOnly) return;
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const footer =
    skillsCatalogMeta.source === 'api'
      ? `AMS catalog: ${skillsCatalogMeta.total} skills from ${skillsCatalogMeta.label}.`
      : `Offline fallback: ${skillsCatalog.length} skills (API unavailable — start server on :3445).`;

  return (
    <fieldset className="rounded-xl bg-bg p-3 ring-1 ring-line">
      <legend className="sr-only">{label}</legend>
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
          {readOnly
            ? `${shown.length} of ${skillsCatalogMeta.total}`
            : `${selected.length} selected · ${shown.length} shown`}
        </span>
      </div>
      <div className="mt-2 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Skill group">
        {groups.map((g) => {
          const count =
            g === 'All' ? skillsCatalog.length : skillsCatalog.filter((s) => s.group === g).length;
          return (
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
              <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {visible.map((s) => {
          const on = selected.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={readOnly ? undefined : on}
                disabled={readOnly}
                title={s.id}
                onClick={() => toggle(s.id)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset transition-colors duration-150 ${
                  on
                    ? 'bg-accent/15 text-accent-ink ring-accent/40'
                    : 'bg-surface text-ink ring-line hover:ring-overlay/25'
                } ${readOnly ? 'cursor-default opacity-90' : ''}`}
              >
                {!readOnly && on && <CheckIcon size={11} aria-hidden="true" />}
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
              {group !== 'All' || query ? ' matching' : ''}
            </>
          )}
        </button>
      )}
      <p className="mt-2 text-[11px] text-faint">{footer}</p>
    </fieldset>
  );
}

export function skillName(id: string, catalog?: { id: string; name: string }[]) {
  const list = catalog;
  if (list) return list.find((s) => s.id === id)?.name ?? id;
  return id;
}
