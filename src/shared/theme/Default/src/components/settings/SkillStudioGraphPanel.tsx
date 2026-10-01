import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SparklesIcon } from 'lucide-react';
import { api, type SkillGraphNode, type SkillsGraphResponse } from '@asi-api';
import { SettingsSection, StatusPill } from './SettingsUI';

type Pos = { x: number; y: number };

function layoutNodes(nodes: SkillGraphNode[]): Map<string, Pos> {
  const pos = new Map<string, Pos>();
  const groups = nodes.filter((n) => n.kind === 'group');
  const agents = nodes.filter((n) => n.kind === 'agent');
  const skills = nodes.filter((n) => n.kind === 'skill');

  agents.forEach((n, i) => {
    pos.set(n.id, { x: 40, y: 40 + i * 56 });
  });

  const colW = 220;
  const startX = agents.length ? 200 : 40;
  groups.forEach((g, gi) => {
    const gx = startX + gi * colW;
    pos.set(g.id, { x: gx, y: 36 });
    const members = skills.filter((s) => s.group === g.group);
    members.forEach((s, si) => {
      pos.set(s.id, { x: gx, y: 100 + si * 44 });
    });
  });

  // Orphan skills (no group match) — rare
  skills.forEach((s, i) => {
    if (!pos.has(s.id)) pos.set(s.id, { x: startX + groups.length * colW, y: 100 + i * 44 });
  });

  return pos;
}

/** Simple AMS skill graph — not Paperclip Studio. */
export function SkillStudioGraphPanel() {
  const [graph, setGraph] = useState<SkillsGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SkillGraphNode | null>(null);
  const [filter, setFilter] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await api.skillsGraph();
      setGraph(data);
      setError(null);
    } catch {
      setError('Could not load skill graph — is the API on :3445?');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const q = filter.trim().toLowerCase();
  const visibleNodes = useMemo(() => {
    if (!graph) return [];
    if (!q) return graph.nodes;
    return graph.nodes.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        (n.group ?? '').toLowerCase().includes(q) ||
        (n.description ?? '').toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q)
    );
  }, [graph, q]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const edges = useMemo(() => {
    if (!graph) return [];
    return graph.edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to));
  }, [graph, visibleIds]);

  const positions = useMemo(() => layoutNodes(visibleNodes), [visibleNodes]);

  const bounds = useMemo(() => {
    let maxX = 400;
    let maxY = 240;
    for (const p of positions.values()) {
      maxX = Math.max(maxX, p.x + 160);
      maxY = Math.max(maxY, p.y + 48);
    }
    return { w: maxX, h: Math.max(maxY, 280) };
  }, [positions]);

  const linkedAgents = useMemo(() => {
    if (!graph || !selected || selected.kind !== 'skill') return [];
    return graph.edges
      .filter((e) => e.kind === 'agent' && e.to === selected.id)
      .map((e) => graph.nodes.find((n) => n.id === e.from))
      .filter((n): n is SkillGraphNode => Boolean(n));
  }, [graph, selected]);

  const skillId = selected?.kind === 'skill' ? selected.id.replace(/^skill:/, '') : null;

  return (
    <SettingsSection
      id="skill-studio"
      title="Skill Studio (graph)"
      description="Visual map of AMS catalog skills — group hubs and agent-pick edges. Click a skill to open details. Not full Paperclip Studio."
      stacked
    >
      {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
      {graph ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusPill tone="success">Shipped (simple)</StatusPill>
          <span className="text-[12px] text-muted">
            {graph.catalogTotal} catalog skills · {graph.nodes.filter((n) => n.kind === 'agent').length} agents with picks
          </span>
        </div>
      ) : null}
      {graph?.note ? <p className="mb-2 text-[12px] text-muted">{graph.note}</p> : null}

      <label className="mb-3 block text-[11px] font-medium text-muted">
        Filter
        <input
          className="mt-1 w-full max-w-md rounded-lg bg-surface px-2.5 py-2 text-[13px] text-ink ring-1 ring-line placeholder:text-faint focus:outline-none focus:ring-accent/40"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search skill, group, or agent…"
        />
      </label>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-auto rounded-card bg-bg ring-1 ring-line">
          {!graph ? (
            <p className="px-4 py-8 text-center text-[12px] text-muted">Loading graph…</p>
          ) : (
            <svg
              width={bounds.w}
              height={bounds.h}
              viewBox={`0 0 ${bounds.w} ${bounds.h}`}
              className="min-h-[280px] w-full"
              role="img"
              aria-label="AMS skills graph"
            >
              {edges.map((e) => {
                const a = positions.get(e.from);
                const b = positions.get(e.to);
                if (!a || !b) return null;
                return (
                  <line
                    key={e.id}
                    x1={a.x + 60}
                    y1={a.y + 14}
                    x2={b.x + 60}
                    y2={b.y + 14}
                    stroke={e.kind === 'agent' ? 'var(--color-accent, #3b82f6)' : 'var(--color-line, #d4d4d8)'}
                    strokeWidth={e.kind === 'agent' ? 1.5 : 1}
                    strokeOpacity={0.7}
                  />
                );
              })}
              {visibleNodes.map((n) => {
                const p = positions.get(n.id);
                if (!p) return null;
                const fill =
                  n.kind === 'group' ? 'var(--color-surface, #f4f4f5)' : n.kind === 'agent' ? 'var(--color-accent, #3b82f6)' : 'var(--color-bg, #fff)';
                const stroke = selected?.id === n.id ? 'var(--color-accent, #3b82f6)' : 'var(--color-line, #d4d4d8)';
                const textFill = n.kind === 'agent' ? '#fff' : 'var(--color-ink, #18181b)';
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x}, ${p.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelected(n)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setSelected(n);
                      }
                    }}
                  >
                    <rect width={120} height={28} rx={6} fill={fill} stroke={stroke} strokeWidth={selected?.id === n.id ? 2 : 1} />
                    <text x={8} y={18} fontSize={10} fill={textFill}>
                      {n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <aside className="rounded-card bg-surface p-4 ring-1 ring-line">
          <div className="flex items-center gap-2">
            <SparklesIcon size={14} className="text-accent-ink" aria-hidden="true" />
            <span className="text-sm font-medium text-ink">{selected ? selected.label : 'Select a node'}</span>
          </div>
          {selected ? (
            <>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-faint">{selected.kind}</p>
              {selected.group ? <p className="mt-1 text-[12px] text-muted">Group: {selected.group}</p> : null}
              {selected.description ? (
                <p className="mt-2 text-[12px] leading-relaxed text-muted">{selected.description}</p>
              ) : (
                <p className="mt-2 text-[12px] text-faint">No description in catalog.</p>
              )}
              {selected.kind === 'skill' && skillId ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] text-faint">id: {skillId}</p>
                  {linkedAgents.length ? (
                    <ul className="space-y-1">
                      {linkedAgents.map((a) => (
                        <li key={a.id}>
                          <Link
                            to={`/agents/${encodeURIComponent(a.id.replace(/^agent:/, ''))}`}
                            className="text-[12px] font-medium text-accent-ink hover:underline"
                          >
                            {a.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-muted">No agent picks yet — enable on an agent AMS panel.</p>
                  )}
                  <Link to="/settings/pro" className="inline-block text-[12px] font-medium text-accent-ink hover:underline">
                    Open Pro skills
                  </Link>
                </div>
              ) : null}
              {selected.kind === 'agent' ? (
                <Link
                  to={`/agents/${encodeURIComponent(selected.id.replace(/^agent:/, ''))}`}
                  className="mt-3 inline-block text-[12px] font-medium text-accent-ink hover:underline"
                >
                  Open agent
                </Link>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-[12px] text-muted">Click a skill, group, or agent node.</p>
          )}
        </aside>
      </div>
    </SettingsSection>
  );
}
