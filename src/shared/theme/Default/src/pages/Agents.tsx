import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { NetworkIcon, PlusIcon, SearchIcon, StarIcon, UsersIcon, XIcon } from 'lucide-react';
import { api } from '@asi-api';
import { AgentNameSetPicker } from '../components/agents/AgentNameSetPicker';
import { AmsSkillMultiSelect } from '../components/agents/AmsSkillMultiSelect';
import { KnowledgeGraphPeek } from '../components/agents/KnowledgeGraphPeek';
import { HierarchyTree } from '../components/office/HierarchyTree';
import { PageHeader, PageScroll } from '../components/PageScroll';
import { FireheadSprite } from '../components/office/FireheadSprite';
import { ModelChip } from '../components/ModelChip';
import { useProfile } from '../contexts/ProfileContext';
import { fetchAndApplyAgents } from '../data/agents';
import { useSelectedModelPool } from '../hooks/useSelectedModelPool';
import {
  formatNameRolePreview,
  parseNameRoleInput,
  pickModelFromPoolClient,
  suggestHireSkills,
} from '../utils/hireHeuristics';
import { modelLabel } from '../utils/modelScanBridge';
import type { ModelId } from '../types/models';

type RegistryAgent = {
  id: string;
  name: string;
  role: string;
  status: string;
  modelId: string | null;
  skills: string[];
  source: 'registry' | 'ams-scan';
  updatedAt: string | null;
  /** Flat by default on hire — only set when user opts into hierarchy. */
  reportsTo?: string | null;
  isChief?: boolean;
};

type AgentsPayload = {
  agents: RegistryAgent[];
  lastScanAt: string | null;
  sources?: { registry: string; amsScan: string | null; amsScanPresent: boolean };
};

const statusDot: Record<string, string> = {
  active: 'bg-success',
  working: 'bg-success',
  idle: 'bg-faint',
  waiting: 'bg-warn',
  offline: 'bg-danger',
  unknown: 'bg-faint',
};

const field =
  'mt-1 h-9 w-full rounded-lg bg-surface px-3 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60';

async function loadRegistry(): Promise<AgentsPayload> {
  const urls = ['/api/agents', 'http://127.0.0.1:3445/api/agents'];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return (await res.json()) as AgentsPayload;
    } catch {
      /* try next */
    }
  }
  return { agents: [], lastScanAt: null };
}

export function Agents() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { slice, toggleFavorite } = useProfile();
  const { ids: poolIds } = useSelectedModelPool();
  const view: 'roster' | 'org' = searchParams.get('view') === 'org' ? 'org' : 'roster';
  const [q, setQ] = useState('');
  const [payload, setPayload] = useState<AgentsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(() => searchParams.get('create') === '1');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [brief, setBrief] = useState('');
  const [reportsTo, setReportsTo] = useState(''); // default empty = flat hire
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillsTouched, setSkillsTouched] = useState(false);
  const [modelMode, setModelMode] = useState<'auto' | 'manual'>('auto');
  const [manualModelId, setManualModelId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{ id: string; name: string; role: string } | null>(
    null
  );

  const refresh = useCallback(async () => {
    try {
      const data = await loadRegistry();
      setPayload(data);
      setError(null);
      void fetchAndApplyAgents().catch(() => undefined);
    } catch {
      setPayload({ agents: [], lastScanAt: null });
      setError('Could not reach the agents API — showing empty roster.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await loadRegistry();
        if (cancelled) return;
        setPayload(data);
        setError(null);
        // Keep shared roster in sync so /chat/:agentId resolves immediately after Agents.
        await fetchAndApplyAgents().catch(() => undefined);
      } catch {
        if (!cancelled) {
          setPayload({ agents: [], lastScanAt: null });
          setError('Could not reach the agents API — showing empty roster.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (searchParams.get('create') === '1') setCreateOpen(true);
  }, [searchParams]);

  // Auto-suggest skills from role/brief until the user edits skills manually.
  useEffect(() => {
    if (!createOpen || skillsTouched) return;
    const suggested = suggestHireSkills({ role, brief, limit: 4 });
    setSelectedSkills(suggested);
  }, [createOpen, role, brief, skillsTouched]);

  const suggestedModelId = useMemo(
    () =>
      pickModelFromPoolClient({
        poolIds,
        role,
        brief,
        skills: selectedSkills,
      }),
    [poolIds, role, brief, selectedSkills]
  );

  const openCreate = () => {
    setCreateOpen(true);
    setFormError(null);
    setJustCreated(null);
    if (searchParams.get('create') !== '1') {
      const next = new URLSearchParams(searchParams);
      next.set('create', '1');
      setSearchParams(next, { replace: true });
    }
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setFormError(null);
    if (searchParams.get('create')) {
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  };

  const resetForm = () => {
    setName('');
    setRole('');
    setBrief('');
    setReportsTo('');
    setSelectedSkills([]);
    setSkillsTouched(false);
    setModelMode('auto');
    setManualModelId('');
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseNameRoleInput(name);
    const trimmedName = parsed.name.trim();
    if (!trimmedName) {
      setFormError('Name is required. Use Name (role) or fill Role separately.');
      return;
    }
    const effectiveRole = (role.trim() || parsed.role || '').trim();
    setSaving(true);
    setFormError(null);
    try {
      // Flat by default: only send reportsTo when the user picks a manager.
      // Fully local create — no Ollama/OpenRouter required.
      const primary =
        modelMode === 'manual'
          ? manualModelId.trim() || null
          : suggestedModelId;
      const result = await api.createAgents({
        name: trimmedName,
        role: effectiveRole || undefined,
        brief: brief.trim() || undefined,
        count: 1,
        skills: selectedSkills,
        ...(reportsTo.trim() ? { reportsTo: reportsTo.trim() } : {}),
        ...(primary ? { primaryModelId: primary } : { skipAutoModel: poolIds.length === 0 }),
        seedWelcome: true,
      });
      const created = result.created?.[0];
      resetForm();
      closeCreate();
      await refresh();
      if (created) {
        setJustCreated({ id: created.id, name: created.name, role: created.role });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Create failed — is the API on :3445?');
    } finally {
      setSaving(false);
    }
  };

  const query = q.trim().toLowerCase();
  const shown = useMemo(() => {
    const list = payload?.agents ?? [];
    const fav = new Set(slice.favoriteAgentIds);
    return list
      .filter(
        (a) =>
          !query ||
          a.name.toLowerCase().includes(query) ||
          a.role.toLowerCase().includes(query) ||
          a.skills.some((s) => s.toLowerCase().includes(query))
      )
      .sort((a, b) => {
        const af = fav.has(a.id) ? 0 : 1;
        const bf = fav.has(b.id) ? 0 : 1;
        return af - bf;
      });
  }, [payload, query, slice.favoriteAgentIds]);

  const managerOptions = useMemo(() => payload?.agents ?? [], [payload]);

  const loading = payload === null;
  const empty = !loading && shown.length === 0;

  const setView = (next: 'roster' | 'org') => {
    const params = new URLSearchParams(searchParams);
    if (next === 'org') params.set('view', 'org');
    else params.delete('view');
    setSearchParams(params, { replace: true });
  };

  return (
    <PageScroll>
      <PageHeader
        title="Agents Roster"
        description="Live registry agents. New hires are flat peers (no reportsTo) until you set org chart later."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Agents view" className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'roster'}
                onClick={() => setView('roster')}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                  view === 'roster' ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'
                }`}
              >
                Roster
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'org'}
                onClick={() => setView('org')}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                  view === 'org' ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'
                }`}
              >
                <NetworkIcon size={13} aria-hidden="true" /> Org chart
              </button>
            </div>
            <label className="relative">
              <span className="sr-only">Filter agents</span>
              <SearchIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, role, or skill"
                className="h-9 w-60 rounded-full bg-surface pl-8 pr-3 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60"
              />
            </label>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent-strong px-4 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2"
            >
              <PlusIcon size={14} aria-hidden="true" /> Create agent
            </button>
          </div>
        }
      />

      <div className="mb-6">
        <KnowledgeGraphPeek />
      </div>

      {view === 'org' && (
        <div className="mb-6">
          <HierarchyTree />
        </div>
      )}

      {justCreated && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card bg-accent/10 px-4 py-3 ring-1 ring-accent/30">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink">
              Hired {formatNameRolePreview(justCreated.name, justCreated.role)}
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              Local hire — skills and model assigned without an LLM. Open chat for a welcome message.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/chat/${justCreated.id}`)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white hover:bg-accent-2"
            >
              Chat with your new agent
            </button>
            <button
              type="button"
              onClick={() => setJustCreated(null)}
              className="rounded-full px-3 py-2 text-[13px] font-medium text-muted hover:text-ink"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {view === 'roster' && createOpen && (
        <form
          onSubmit={(e) => void submitCreate(e)}
          className="mb-6 rounded-card bg-surface p-4 ring-1 ring-line"
          aria-label="Create agent"
        >
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-ink">Create agent</h2>
            <span className="text-[11px] text-muted">Fully local · no Ollama / OpenRouter required</span>
            <button
              type="button"
              onClick={closeCreate}
              aria-label="Close create form"
              className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-overlay/[0.05] hover:text-ink"
            >
              <XIcon size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="mb-3">
            <AgentNameSetPicker
              name={name}
              role={role}
              onPick={(pick) => {
                setName(pick.name);
                if (pick.role !== undefined) setRole(pick.role);
                setSkillsTouched(false);
              }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-medium text-muted">Name</span>
              <input
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  const parsed = parseNameRoleInput(v);
                  if (parsed.role && !role.trim()) setRole(parsed.role);
                }}
                placeholder="e.g. Mira or Mira (Research)"
                maxLength={80}
                autoFocus
                className={field}
              />
              <span className="mt-1 block text-[11px] text-muted">
                Name(role) format — preview:{' '}
                <span className="font-medium text-ink">
                  {formatNameRolePreview(
                    parseNameRoleInput(name).name || '…',
                    role.trim() || parseNameRoleInput(name).role
                  ) || '…'}
                </span>
              </span>
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-muted">Role / specialty (optional)</span>
              <input
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setSkillsTouched(false);
                }}
                placeholder="e.g. travel, research, coding"
                maxLength={120}
                className={field}
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-[12px] font-medium text-muted">What will this agent do? (optional)</span>
            <textarea
              value={brief}
              onChange={(e) => {
                setBrief(e.target.value);
                setSkillsTouched(false);
              }}
              placeholder="Short brief — used to auto-assign skills and a model from your Browse pool"
              rows={2}
              maxLength={400}
              className="mt-1 w-full rounded-lg bg-surface px-3 py-2 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60"
            />
          </label>
          <label className="mt-3 block max-w-md">
            <span className="text-[12px] font-medium text-muted">Reports to (optional)</span>
            <select
              value={reportsTo}
              onChange={(e) => setReportsTo(e.target.value)}
              className={field}
              aria-label="Reports to"
            >
              <option value="">Flat · no manager (default)</option>
              {managerOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted">
              Hiring stays flat unless you pick a manager. You can change this later on Org chart.
            </span>
          </label>
            <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-muted">Skills (auto from role/brief · editable)</span>
              <Link to="/settings/skills" className="text-[11px] font-medium text-accent-ink hover:underline">
                See all catalog
              </Link>
              {skillsTouched && (
                <button
                  type="button"
                  className="text-[11px] text-accent-ink underline"
                  onClick={() => {
                    setSkillsTouched(false);
                    setSelectedSkills(suggestHireSkills({ role, brief, limit: 4 }));
                  }}
                >
                  Re-auto from brief
                </button>
              )}
            </div>
            <div className="mt-1.5">
              <AmsSkillMultiSelect
                active={createOpen}
                selected={selectedSkills}
                onChange={(ids) => {
                  setSkillsTouched(true);
                  setSelectedSkills(ids);
                }}
              />
            </div>
          </div>
          <div className="mt-3 max-w-lg">
            <span className="text-[12px] font-medium text-muted">Model (from Browse pool)</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setModelMode('auto')}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 transition-colors ${
                  modelMode === 'auto'
                    ? 'bg-accent/15 text-accent-ink ring-accent/40'
                    : 'bg-surface text-muted ring-line hover:text-ink'
                }`}
              >
                Auto from skills / pool
              </button>
              <button
                type="button"
                onClick={() => {
                  setModelMode('manual');
                  if (!manualModelId && suggestedModelId) setManualModelId(suggestedModelId);
                }}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 transition-colors ${
                  modelMode === 'manual'
                    ? 'bg-accent/15 text-accent-ink ring-accent/40'
                    : 'bg-surface text-muted ring-line hover:text-ink'
                }`}
              >
                Manual selector
              </button>
            </div>
            {modelMode === 'auto' && (
              <p className="mt-1.5 text-[12px] text-muted">
                {suggestedModelId
                  ? `Will assign ${modelLabel(suggestedModelId)} (${suggestedModelId})`
                  : poolIds.length === 0
                    ? 'No Browse pool yet — agent still creates with local default (agentchat). Save a pool on Models → Browse.'
                    : 'Pool has ids but none matched — first pool model will be used server-side.'}
              </p>
            )}
            {modelMode === 'manual' && (
              <label className="mt-1.5 block">
                <span className="sr-only">Primary model</span>
                <select
                  value={manualModelId}
                  onChange={(e) => setManualModelId(e.target.value)}
                  className={field}
                  disabled={poolIds.length === 0}
                >
                  <option value="">— pick from pool —</option>
                  {poolIds.map((id) => (
                    <option key={id} value={id}>
                      {modelLabel(id)} ({id})
                    </option>
                  ))}
                </select>
                {poolIds.length === 0 && (
                  <span className="mt-1 block text-[11px] text-warn">
                    Save a model pool on Browse first, or leave Auto.
                  </span>
                )}
              </label>
            )}
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Saves to <code className="text-[11px]">config/agents.registry.json</code> via POST /api/agents.
            Seeds one random local hire welcome. Default: no <code className="text-[11px]">reportsTo</code> (flat peers).
          </p>
          {formError && <p className="mt-2 text-[13px] text-danger">{formError}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Add to roster'}
            </button>
            <button
              type="button"
              onClick={closeCreate}
              className="rounded-full px-3 py-2 text-[13px] font-medium text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {view === 'roster' && (
      <>
      <p className="mb-4 text-[12px] text-muted">
        Last scan: {payload?.lastScanAt ? new Date(payload.lastScanAt).toLocaleString() : 'never'}
        {error ? ` · ${error}` : ''}
      </p>

      {loading && (
        <div className="rounded-card bg-surface p-10 text-center ring-1 ring-line">
          <p className="text-sm text-muted">Loading roster from registry adapter…</p>
        </div>
      )}

      {empty && (
        <div className="rounded-card bg-surface p-10 text-center ring-1 ring-line">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent-ink">
            <UsersIcon size={22} aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-ink">
            {query ? `No agents match "${q}".` : 'No agents found — scan missing'}
          </p>
          <p className="mt-1 text-[13px] text-muted max-w-md mx-auto">
            Create an agent here, edit <code className="text-[12px]">config/agents.registry.json</code>, or write{' '}
            <code className="text-[12px]">config/ams-scan.agents.json</code> from an AMS scan.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {!query && (
              <button
                type="button"
                onClick={openCreate}
                className="rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white"
              >
                Create agent
              </button>
            )}
            {query && (
              <button type="button" onClick={() => setQ('')} className="rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white">
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && shown.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {shown.map((a) => {
            const fav = slice.favoriteAgentIds.includes(a.id);
            return (
            <li key={a.id} className="relative">
              <button
                type="button"
                aria-label={fav ? `Unpin ${a.name} from favorites` : `Pin ${a.name} to favorites`}
                title={fav ? 'Unpin favorite' : 'Favorite for this profile'}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void toggleFavorite(a.id);
                }}
                className={`absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-[#0f1117]/80 ring-1 ring-white/10 transition-colors ${
                  fav ? 'text-amber-300' : 'text-[#e8eaf0]/70 hover:text-amber-200'
                }`}
              >
                <StarIcon size={14} fill={fav ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
              <Link
                to={`/chat/${a.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-card bg-surface ring-1 ring-line transition-all duration-200 hover:ring-accent/50 hover:shadow-md"
              >
                <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-b from-[#1c2130] to-[#121622] p-4">
                  <FireheadSprite
                    id={a.id}
                    name={a.name}
                    role={a.role}
                    status={a.status}
                    size="xl"
                  />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#0f1117]/85 px-2.5 py-1 text-[11px] font-medium text-[#e8eaf0] ring-1 ring-white/10">
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot[a.status] ?? statusDot.unknown}`} aria-hidden="true" />
                    {a.status}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h2 className="text-[15px] font-semibold text-ink group-hover:text-accent-ink transition-colors">
                    {a.name}
                  </h2>
                  <p className="text-[12px] font-medium text-muted">{a.role || 'Specialist'}</p>
                  <p className="mt-1 text-[11px] text-faint">
                    {a.reportsTo ? `Reports to ${a.reportsTo}` : 'Flat · no manager'}
                  </p>

                  <div className="mt-auto pt-3 border-t border-line/50">
                    <div className="flex items-center justify-between gap-2">
                      {a.modelId ? (
                        <ModelChip id={a.modelId as ModelId} size="xs" />
                      ) : (
                        <span className="text-[10px] text-faint">Local model</span>
                      )}
                      <span className="text-[10px] text-faint shrink-0">{a.skills.length} skills</span>
                    </div>
                    {a.skills.length > 0 && (
                      <p className="mt-1.5 line-clamp-2 text-[10px] text-muted" title={a.skills.join(', ')}>
                        {a.skills.slice(0, 4).join(' · ')}
                        {a.skills.length > 4 ? ` · +${a.skills.length - 4}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
      </>
      )}
    </PageScroll>
  );
}
