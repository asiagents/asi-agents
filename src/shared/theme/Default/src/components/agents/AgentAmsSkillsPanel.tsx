import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AgentAmsSnapshot } from '@asi-api';
import { LayersIcon, PencilIcon, PlayIcon, XIcon } from 'lucide-react';
import { AmsSkillMultiSelect } from './AmsSkillMultiSelect';

type Props = {
  agentId: string;
  compact?: boolean;
  /** Open in edit mode (catalog multi-select + save). */
  startEditing?: boolean;
};

const fieldCls =
  'mt-1 w-full rounded-lg bg-surface px-2.5 py-2 text-[13px] text-ink ring-1 ring-line placeholder:text-faint focus:outline-none focus:ring-accent/40';

/** Enabled AMS catalog skills for a registry agent (`GET /api/agents/:id/ams`). */
export function AgentAmsSkillsPanel({ agentId, compact, startEditing = false }: Props) {
  const [snap, setSnap] = useState<AgentAmsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(startEditing);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [skillId, setSkillId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runReply, setRunReply] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!agentId) {
      setSnap(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.agentAms(agentId);
      setSnap(data);
      setDraftIds(data.enabledSkillIds);
    } catch {
      setSnap(null);
      setError('AMS skills unavailable — is the API on :3445?');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setEditing(startEditing);
  }, [startEditing, agentId]);

  /** Catalog-backed enabled skills only (stubs use group "Registry"). */
  const runnable = useMemo(() => {
    if (!snap) return [];
    return snap.skills.filter((s) => s.enabled && s.group !== 'Registry');
  }, [snap]);

  useEffect(() => {
    if (!runnable.length) {
      setSkillId('');
      return;
    }
    if (!runnable.some((s) => s.id === skillId)) {
      setSkillId(runnable[0].id);
    }
  }, [runnable, skillId]);

  const onSave = useCallback(async () => {
    if (!agentId) return;
    setSaving(true);
    setSaveNote(null);
    try {
      const next = await api.putAgentAms(agentId, draftIds);
      setSnap(next);
      setDraftIds(next.enabledSkillIds);
      setEditing(false);
      setSaveNote(`Saved ${next.enabledSkillIds.length} catalog picks.`);
    } catch {
      setSaveNote('Could not save — is the API on :3445?');
    } finally {
      setSaving(false);
    }
  }, [agentId, draftIds]);

  const onCancelEdit = useCallback(() => {
    setDraftIds(snap?.enabledSkillIds ?? []);
    setEditing(false);
    setSaveNote(null);
  }, [snap]);

  const onRun = useCallback(async () => {
    if (!agentId || !skillId || !prompt.trim()) return;
    setBusy(true);
    setRunError(null);
    setRunReply(null);
    try {
      const result = await api.runAgentAms(agentId, { skillId, text: prompt.trim() });
      setRunReply(result.text);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Skill run failed');
    } finally {
      setBusy(false);
    }
  }, [agentId, skillId, prompt]);

  if (loading) {
    return <p className="text-[12px] text-muted">Loading AMS catalog skills…</p>;
  }

  if (error) {
    return (
      <p className="text-[12px] text-warn">
        {error}{' '}
        <button type="button" onClick={() => void load()} className="font-medium text-accent-ink hover:underline">
          Retry
        </button>
      </p>
    );
  }

  if (!snap) return null;

  const catalogEnabled = snap.enabledSkillIds.length;
  const merged = snap.skills.filter((s) => s.enabled);

  if (compact) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
        AMS catalog: {catalogEnabled} picked · {merged.length} merged
        <Link to={`/settings/skills?agent=${encodeURIComponent(agentId)}`} className="font-sans font-medium text-accent-ink hover:underline">
          Edit
        </Link>
      </span>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <LayersIcon size={15} className="mt-0.5 text-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-ink">AMS catalog skills</p>
            {!editing ? (
              <button
                type="button"
                onClick={() => {
                  setDraftIds(snap.enabledSkillIds);
                  setEditing(true);
                  setSaveNote(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-accent-ink ring-1 ring-line transition-colors hover:bg-overlay/[0.04]"
              >
                <PencilIcon size={11} aria-hidden="true" /> Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={onCancelEdit}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted ring-1 ring-line transition-colors hover:bg-overlay/[0.04]"
              >
                <XIcon size={11} aria-hidden="true" /> Cancel
              </button>
            )}
            <Link to="/settings/skills" className="text-[11px] font-medium text-accent-ink hover:underline">
              See all in Settings
            </Link>
          </div>
          <p className="mt-0.5 text-[12px] text-muted">
            {snap.catalogLabel} ({snap.catalogTotal} skills). Picks persist via{' '}
            <code className="text-[11px]">PUT /api/agents/:id/ams</code>. Multi-agent orchestration is not shipped.
          </p>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <AmsSkillMultiSelect selected={draftIds} onChange={setDraftIds} active defaultExpanded />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="rounded-lg bg-accent-strong px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save skills'}
            </button>
            <span className="text-[12px] text-muted">{draftIds.length} selected</span>
          </div>
        </div>
      ) : merged.length === 0 ? (
        <p className="text-[12px] text-muted">
          No catalog picks or registry skills yet. Use Edit above, or open{' '}
          <Link to="/settings/skills" className="font-medium text-accent-ink hover:underline">
            Settings → AMS skills
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label="AMS enabled skills">
          {merged.map((s) => (
            <li
              key={s.id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
                s.source === 'catalog'
                  ? 'bg-accent/10 text-accent-ink ring-accent/25'
                  : 'bg-overlay/[0.04] text-ink ring-line'
              }`}
              title={`${s.group} · ${s.source}`}
            >
              {s.name}
              {s.source === 'registry' && !snap.enabledSkillIds.includes(s.id) ? ' (registry)' : ''}
            </li>
          ))}
        </ul>
      )}

      {saveNote ? <p className="text-[12px] text-muted">{saveNote}</p> : null}

      {!editing && runnable.length > 0 && snap.singleSkillRunEnabled ? (
        <div className="space-y-2 rounded-lg bg-overlay/[0.03] p-3 ring-1 ring-line">
          <p className="text-[12px] font-semibold text-ink">Run skill</p>
          <p className="text-[11px] text-muted">
            Single llm-routing call with this agent’s context. Reply is appended to the agent thread (
            <code className="text-[10px]">source: ams</code>).
          </p>
          <label className="block text-[11px] font-medium text-muted">
            Skill
            <select
              className={fieldCls}
              value={skillId}
              disabled={busy}
              onChange={(e) => setSkillId(e.target.value)}
            >
              {runnable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.group})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] font-medium text-muted">
            Prompt
            <textarea
              className={`${fieldCls} min-h-[72px] resize-y`}
              value={prompt}
              disabled={busy}
              placeholder="What should this skill do?"
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy || !skillId || !prompt.trim()}
              onClick={() => void onRun()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-ink disabled:opacity-50"
            >
              <PlayIcon size={13} aria-hidden="true" />
              {busy ? 'Running…' : 'Run skill'}
            </button>
          </div>
          {runError ? <p className="text-[12px] text-warn">{runError}</p> : null}
          {runReply ? (
            <div className="rounded-md bg-surface p-2.5 text-[12px] text-ink ring-1 ring-line whitespace-pre-wrap">
              {runReply}
            </div>
          ) : null}
        </div>
      ) : !editing && runnable.length > 0 ? (
        <p className="text-[11px] text-faint">
          Skill run disabled — set <code className="text-[10px]">ASI_AMS_SKILL_RUN=1</code> (or unset in
          non-production). POST …/ams/run returns 501 until enabled.
        </p>
      ) : !editing ? (
        <p className="text-[11px] text-faint">
          Skill run preview:{' '}
          {snap.singleSkillRunEnabled
            ? 'enabled (pick a catalog skill to run)'
            : 'POST …/ams/run returns 501 until enabled'}
          .
        </p>
      ) : null}
    </div>
  );
}
