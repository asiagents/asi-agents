import React from 'react';
import { BookOpenIcon, RefreshCwIcon, SearchIcon } from 'lucide-react';
import { SettingsSection, StatusPill } from '../settings/SettingsUI';
import { useModelsCatalog, type CapabilityFilter } from '../../hooks/useModelsCatalog';
import { ModelBrowseFilterBar } from './ModelBrowseFilterBar';

const CAP_FILTERS: { id: CapabilityFilter; label: string }[] = [
  { id: 'vision', label: 'Vision' },
  { id: 'documents', label: 'Documents' },
  { id: 'pdf', label: 'PDF' },
  { id: 'spreadsheet', label: 'Spreadsheet' },
  { id: 'tools', label: 'Tools' },
  { id: 'code', label: 'Code' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'embed', label: 'Embed' },
];

function capPillTone(cap: string): 'success' | 'muted' | 'warn' {
  if (cap === 'vision' || cap === 'pdf' || cap === 'documents') return 'success';
  if (cap === 'spreadsheet') return 'warn';
  return 'muted';
}

/** Skills catalog — curated JSON or OpenRouter live (up to 500), never implied installed. */
export function ModelCapabilitiesCatalogPanel() {
  const {
    payload,
    loading,
    error,
    q,
    caps,
    browse,
    offset,
    pageSize,
    hasMore,
    setQuery,
    toggleCap,
    toggleBrowse,
    nextPage,
    prevPage,
    refresh,
  } = useModelsCatalog();

  return (
    <div className="space-y-4">
      <div className="rounded-card bg-bg/80 p-4 ring-1 ring-line">
        <div className="flex flex-wrap items-start gap-3">
          <BookOpenIcon size={18} className="mt-0.5 text-accent-ink" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-[13px] text-muted">
            <p className="font-medium text-ink">Multimodal & document picks</p>
            <p className="mt-1">
              Reference tables and honest API notes live in{' '}
              <code className="text-[12px]">docs/MODEL-RECOMMENDATIONS.md</code> in the repo. Rows here are{' '}
              <strong className="font-medium text-ink">not</strong> installed unless listed under <strong className="font-medium text-ink">On device</strong>.
            </p>
          </div>
        </div>
      </div>

      <SettingsSection
        title="Catalog"
        stacked
        description={`${payload.label} · ${payload.total} model${payload.total === 1 ? '' : 's'} in source${
          payload.source === 'openrouter' ? ' (live, cached 1h)' : ''
        }. Paginated search below.`}
      >
        <div className="w-full min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={payload.source === 'openrouter' ? 'success' : 'muted'}>{payload.label}</StatusPill>
            {payload.error && <span className="text-[12px] text-warn">{payload.error}</span>}
            {error && <span className="text-[12px] text-warn">{error}</span>}
            <button
              type="button"
              onClick={() => refresh()}
              disabled={loading}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-accent-ink ring-1 ring-line hover:bg-overlay/[0.04] disabled:opacity-60"
            >
              <RefreshCwIcon size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              Refresh
            </button>
          </div>

          <div className="relative max-w-md">
            <SearchIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search id, name, provider…"
              className="w-full rounded-lg bg-surface py-2 pl-9 pr-3 text-[13px] text-ink ring-1 ring-line placeholder:text-faint"
              aria-label="Search catalog"
            />
          </div>

          <ModelBrowseFilterBar
            active={browse}
            onToggle={toggleBrowse}
            hint="Free = OpenRouter :free / zero pricing, or local Ollama/GGUF recipes. Paid API rows and unknown cloud quotas are hidden when Free only is on."
            className="mb-1"
          />

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Capability filters">
            {CAP_FILTERS.map((f) => {
              const active = caps.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleCap(f.id)}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                    active ? 'bg-accent/15 text-accent-ink' : 'bg-overlay/[0.06] text-muted hover:text-ink'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-card ring-1 ring-line">
            <table className="min-w-full divide-y divide-line text-left text-[13px]">
              <thead className="bg-surface text-[11px] font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">Model</th>
                  <th className="px-4 py-2.5">Provider</th>
                  <th className="px-4 py-2.5">Skills</th>
                  <th className="px-4 py-2.5 hidden sm:table-cell">Context</th>
                  <th className="px-4 py-2.5 hidden md:table-cell">Pricing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {loading && payload.models.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">Loading catalog…</td>
                  </tr>
                ) : payload.models.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      No rows match — try clearing filters or add an OpenRouter key for the live catalog.
                    </td>
                  </tr>
                ) : (
                  payload.models.map((m) => (
                    <tr key={m.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{m.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-faint">{m.id}</p>
                        {m.notes && <p className="mt-1 text-[11px] text-muted">{m.notes}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted">{m.provider}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.capabilities.map((c) => (
                            <StatusPill key={c} tone={capPillTone(c)}>{c}</StatusPill>
                          ))}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-muted sm:table-cell">
                        {m.contextLength != null ? m.contextLength.toLocaleString() : '—'}
                      </td>
                      <td className="hidden px-4 py-3 text-muted md:table-cell">{m.pricingHint ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
            <span>
              Showing {payload.models.length ? offset + 1 : 0}–{offset + payload.models.length} of {payload.total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0 || loading}
                onClick={() => prevPage()}
                className="rounded-lg px-3 py-1.5 ring-1 ring-line disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasMore || loading}
                onClick={() => nextPage()}
                className="rounded-lg px-3 py-1.5 ring-1 ring-line disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          <p className="text-[11px] text-faint">
            OpenRouter key on the server unlocks up to {payload.limit || 500} live models. Without it you see the curated subset only — not “500 models installed”.
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}
