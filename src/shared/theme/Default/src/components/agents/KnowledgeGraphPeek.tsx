import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NetworkIcon, SearchIcon } from 'lucide-react';

type KgCounts = {
  agent: number;
  skill: number;
  task: number;
  lesson: number;
  edges: number;
};

type KgNode = {
  id: string;
  kind: string;
  label: string;
};

type KgSnapshot = {
  note?: string;
  engine?: string;
  counts?: KgCounts;
  nodes?: KgNode[];
  edges?: { id: string }[];
};

type KgQuery = {
  matchedNodes?: KgNode[];
  matchedEdges?: { id: string }[];
  neighborNodes?: KgNode[];
};

/** Compact Agents-page peek into GET /api/kg (local knowledge graph). */
export function KnowledgeGraphPeek() {
  const [snap, setSnap] = useState<KgSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState<KgQuery | null>(null);

  const load = useCallback(() => {
    fetch('/api/kg')
      .then(async (r) => {
        const j = (await r.json()) as KgSnapshot & { error?: string };
        if (!r.ok) throw new Error(j.error ?? `KG ${r.status}`);
        setSnap(j);
        setErr(null);
      })
      .catch(() => {
        setErr('Knowledge graph API offline — start :3445');
        setSnap(null);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runQuery = useCallback(() => {
    const term = q.trim();
    if (!term) {
      setQuery(null);
      return;
    }
    fetch(`/api/kg/query?q=${encodeURIComponent(term)}&limit=12`)
      .then(async (r) => {
        const j = (await r.json()) as KgQuery & { error?: string };
        if (!r.ok) throw new Error(j.error ?? `query ${r.status}`);
        setQuery(j);
      })
      .catch(() => setQuery({ matchedNodes: [], matchedEdges: [], neighborNodes: [] }));
  }, [q]);

  const counts = snap?.counts;

  return (
    <section className="rounded-card bg-surface p-4 ring-1 ring-line" aria-label="Knowledge graph">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <NetworkIcon size={16} className="mt-0.5 text-muted" aria-hidden="true" />
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Knowledge graph</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Local JSON graph (agents · skills · tasks · lessons) — not Neo4j.{' '}
              <Link to="/settings/modules" className="font-medium text-accent-ink hover:underline">
                Modules
              </Link>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg px-2 py-1 text-[11px] font-medium text-muted ring-1 ring-line hover:text-ink"
        >
          Refresh
        </button>
      </div>

      {err ? <p className="mt-3 text-[12px] text-warn">{err}</p> : null}

      {counts ? (
        <ul className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
          <li className="rounded-full bg-overlay/[0.04] px-2.5 py-1 ring-1 ring-line">
            {counts.agent} agents
          </li>
          <li className="rounded-full bg-overlay/[0.04] px-2.5 py-1 ring-1 ring-line">
            {counts.skill} skills
          </li>
          <li className="rounded-full bg-overlay/[0.04] px-2.5 py-1 ring-1 ring-line">
            {counts.task} tasks
          </li>
          <li className="rounded-full bg-overlay/[0.04] px-2.5 py-1 ring-1 ring-line">
            {counts.lesson} lessons
          </li>
          <li className="rounded-full bg-overlay/[0.04] px-2.5 py-1 ring-1 ring-line">
            {counts.edges} edges
          </li>
        </ul>
      ) : null}

      <div className="mt-3 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <SearchIcon size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runQuery();
            }}
            placeholder="Query nodes (e.g. chief, scheduling)"
            className="h-9 w-full rounded-lg bg-bg pl-8 pr-3 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/50"
          />
        </label>
        <button
          type="button"
          onClick={runQuery}
          className="shrink-0 rounded-lg bg-accent-strong px-3 text-[12px] font-medium text-white"
        >
          Query
        </button>
      </div>

      {query ? (
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-[12px]">
          {(query.matchedNodes ?? []).length === 0 ? (
            <li className="text-muted">No matches.</li>
          ) : (
            (query.matchedNodes ?? []).map((n) => (
              <li key={n.id} className="truncate text-ink">
                <span className="text-faint">[{n.kind}]</span> {n.label}{' '}
                <span className="font-mono text-[10px] text-faint">{n.id}</span>
              </li>
            ))
          )}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-faint">
          {snap?.engine ?? 'local-json'} · GET /api/kg · GET /api/kg/query?q=
        </p>
      )}
    </section>
  );
}
