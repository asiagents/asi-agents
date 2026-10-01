import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  Maximize2Icon,
  PencilIcon,
  RotateCcwIcon,
} from 'lucide-react';
import {
  settingsHubBlockIds,
  settingsHubBlocks,
  type SettingsPageId,
} from '../../data/settingsPages';
import { readJson, writeJson, STORAGE_KEYS } from '../../utils/storage';

type HubSpan = 1 | 2;

type HubLayout = {
  order: SettingsPageId[];
  hidden: SettingsPageId[];
  /** Optional wider cards (span 2 on sm+). */
  spans: Partial<Record<SettingsPageId, HubSpan>>;
};

const DEFAULT_LAYOUT: HubLayout = {
  order: [...settingsHubBlockIds],
  hidden: [],
  spans: {},
};

function normalizeLayout(raw: HubLayout | null): HubLayout {
  const known = new Set(settingsHubBlockIds);
  const order = (raw?.order ?? []).filter((id): id is SettingsPageId => known.has(id));
  for (const id of settingsHubBlockIds) {
    if (!order.includes(id)) order.push(id);
  }
  const hidden = (raw?.hidden ?? []).filter((id): id is SettingsPageId => known.has(id));
  const spans: HubLayout['spans'] = {};
  const rawSpans = raw?.spans ?? {};
  for (const id of settingsHubBlockIds) {
    const v = rawSpans[id];
    if (v === 2) spans[id] = 2;
  }
  return { order, hidden, spans };
}

function loadLayout(): HubLayout {
  return normalizeLayout(readJson<HubLayout | null>(STORAGE_KEYS.settingsHubLayout, null));
}

function saveLayout(layout: HubLayout): void {
  writeJson(STORAGE_KEYS.settingsHubLayout, normalizeLayout(layout));
}

/**
 * Visual Settings landing — thumbnail blocks with optional edit layout
 * (reorder / hide / width span), persisted in localStorage.
 */
export function SettingsHub() {
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<HubLayout>(loadLayout);

  const byId = useMemo(() => {
    const map = new Map(settingsHubBlocks.map((p) => [p.id, p]));
    return map;
  }, []);

  const visibleIds = layout.order.filter((id) => !layout.hidden.includes(id));
  const hiddenIds = layout.order.filter((id) => layout.hidden.includes(id));

  const persist = (next: HubLayout) => {
    const normalized = normalizeLayout(next);
    setLayout(normalized);
    saveLayout(normalized);
  };

  const move = (id: SettingsPageId, dir: -1 | 1) => {
    const i = layout.order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= layout.order.length) return;
    const order = [...layout.order];
    [order[i], order[j]] = [order[j], order[i]];
    persist({ ...layout, order });
  };

  const toggleHidden = (id: SettingsPageId) => {
    const hidden = layout.hidden.includes(id)
      ? layout.hidden.filter((x) => x !== id)
      : [...layout.hidden, id];
    persist({ ...layout, hidden });
  };

  const cycleSpan = (id: SettingsPageId) => {
    const cur = layout.spans[id] ?? 1;
    const next = cur === 1 ? 2 : 1;
    const spans = { ...layout.spans };
    if (next === 1) delete spans[id];
    else spans[id] = 2;
    persist({ ...layout, spans });
  };

  const reset = () => persist(DEFAULT_LAYOUT);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors duration-150 ${
            editing
              ? 'bg-accent/10 text-accent-ink ring-accent/30'
              : 'text-ink ring-line hover:bg-overlay/[0.04]'
          }`}
        >
          <PencilIcon size={14} aria-hidden="true" />
          {editing ? 'Done editing' : 'Edit layout'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted ring-1 ring-line transition-colors duration-150 hover:text-ink"
          >
            <RotateCcwIcon size={14} aria-hidden="true" />
            Reset
          </button>
        )}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Settings areas">
        {visibleIds.map((id) => {
          const page = byId.get(id);
          if (!page) return null;
          const Icon = page.icon;
          const orderIndex = layout.order.indexOf(id);
          const span = layout.spans[id] ?? 1;
          const spanClass = span === 2 ? 'sm:col-span-2' : '';

          if (editing) {
            return (
              <li
                key={id}
                className={`flex flex-col gap-3 rounded-card bg-surface p-4 ring-1 ring-line ${spanClass}`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-raised text-ink ring-1 ring-line">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">{page.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{page.description}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted ring-1 ring-line">
                    {span}×
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={orderIndex <= 0}
                    onClick={() => move(id, -1)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted ring-1 ring-line hover:text-ink disabled:opacity-30"
                    aria-label={`Move ${page.label} up`}
                  >
                    <ArrowUpIcon size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={orderIndex >= layout.order.length - 1}
                    onClick={() => move(id, 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted ring-1 ring-line hover:text-ink disabled:opacity-30"
                    aria-label={`Move ${page.label} down`}
                  >
                    <ArrowDownIcon size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleSpan(id)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted ring-1 ring-line hover:text-ink"
                    aria-label={`Toggle width of ${page.label} (now ${span} column${span === 1 ? '' : 's'})`}
                  >
                    <Maximize2Icon size={13} aria-hidden="true" />
                    {span === 1 ? 'Wider' : 'Narrower'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleHidden(id)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted ring-1 ring-line hover:text-ink"
                    aria-label={`Hide ${page.label}`}
                  >
                    <EyeOffIcon size={13} aria-hidden="true" />
                    Hide
                  </button>
                </div>
              </li>
            );
          }

          return (
            <li key={id} className={spanClass}>
              <Link
                to={page.to}
                className="group flex h-full flex-col gap-3 rounded-card bg-surface p-4 ring-1 ring-line transition-colors duration-150 hover:bg-raised/60 hover:ring-accent/35"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-raised text-ink ring-1 ring-line transition-colors duration-150 group-hover:bg-accent/10 group-hover:text-accent-ink group-hover:ring-accent/25">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-ink">{page.label}</span>
                  <span className={`mt-0.5 block text-[12px] leading-relaxed text-muted ${span === 2 ? 'line-clamp-3' : 'line-clamp-2'}`}>
                    {page.description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {editing && hiddenIds.length > 0 && (
        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-ink">Hidden blocks</h2>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {hiddenIds.map((id) => {
              const page = byId.get(id);
              if (!page) return null;
              const Icon = page.icon;
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-card bg-raised/50 p-3 ring-1 ring-dashed ring-line"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-muted ring-1 ring-line">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{page.label}</span>
                  <button
                    type="button"
                    onClick={() => toggleHidden(id)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-accent-ink ring-1 ring-accent/30 hover:bg-accent/10"
                    aria-label={`Show ${page.label}`}
                  >
                    <EyeIcon size={13} aria-hidden="true" />
                    Show
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
