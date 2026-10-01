import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenIcon, Building2Icon, GraduationCapIcon, PinIcon, RefreshCwIcon } from 'lucide-react';
import {
  api,
  type BriefingFreshness,
  type CompanyBriefing,
  type Lesson,
  type TrainingDiffReport,
  type TrainingStatusResponse,
} from '@asi-api';
import { SettingsSection, StatusPill, inputClass } from '../../components/settings/SettingsUI';

function freshnessTone(level: BriefingFreshness['level']): 'success' | 'warn' | 'muted' {
  if (level === 'fresh') return 'success';
  if (level === 'aging') return 'warn';
  if (level === 'stale') return 'warn';
  return 'muted';
}

export function SettingsCompanyTraining() {
  const [briefing, setBriefing] = useState<CompanyBriefing | null>(null);
  const [status, setStatus] = useState<TrainingStatusResponse | null>(null);
  const [url, setUrl] = useState('');
  const [paste, setPaste] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [diff, setDiff] = useState<TrainingDiffReport | null>(null);
  const [busy, setBusy] = useState<'load' | 'fetch' | 'paste' | 'train' | 'clear' | null>('load');

  const refresh = useCallback(async () => {
    setBusy((b) => (b === null ? 'load' : b));
    setError(null);
    try {
      const [b, t] = await Promise.all([api.companyBriefing(), api.agentsTraining()]);
      setBriefing(b.briefing);
      setStatus(t);
      if (b.briefing?.sourceUrl) setUrl(b.briefing.sourceUrl);
      if (b.briefing?.text) setPaste(b.briefing.text);
    } catch (e) {
      setBriefing(null);
      setStatus(null);
      setError(e instanceof Error ? e.message : 'Could not load company training — is the API on :3445?');
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onFetchUrl(e: React.FormEvent) {
    e.preventDefault();
    setBusy('fetch');
    setError(null);
    setInfo(null);
    try {
      const next = await api.fetchCompanyBriefing(url.trim());
      setBriefing(next.briefing);
      setPaste(next.briefing.text);
      setInfo(`Fetched ${next.briefing.charCount.toLocaleString()} characters from the page.`);
      const t = await api.agentsTraining();
      setStatus(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed (fail-closed — nothing saved).');
    } finally {
      setBusy(null);
    }
  }

  async function onSavePaste(e: React.FormEvent) {
    e.preventDefault();
    setBusy('paste');
    setError(null);
    setInfo(null);
    try {
      const next = await api.putCompanyBriefing(paste);
      setBriefing(next.briefing);
      setInfo(`Saved pasted briefing (${next.briefing.charCount.toLocaleString()} characters).`);
      const t = await api.agentsTraining();
      setStatus(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(null);
    }
  }

  async function onTrain() {
    setBusy('train');
    setError(null);
    setInfo(null);
    setDiff(null);
    try {
      const result = await api.sendAllAgentsToTraining();
      setDiff(result.diff ?? null);
      setInfo(
        `Trained ${result.trainedCount} agent${result.trainedCount === 1 ? '' : 's'} with company briefing + roles + self-learning note.`
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training failed.');
      setBusy(null);
    }
  }

  async function onClear() {
    setBusy('clear');
    setError(null);
    setInfo(null);
    setDiff(null);
    try {
      await api.clearCompanyBriefing();
      setBriefing(null);
      setPaste('');
      setInfo('Company briefing cleared.');
      const t = await api.agentsTraining();
      setStatus(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clear failed.');
    } finally {
      setBusy(null);
    }
  }

  const canTrain = Boolean(briefing?.text) && busy == null;
  const freshness = status?.freshness;
  const groupFinals: Lesson[] = status?.groupFinalLessons ?? [];

  return (
    <>
      <SettingsSection
        title="Company briefing"
        description="Paste your About Us page URL or the text itself. The server fetches and extracts readable text (size-limited). Failures do not invent content."
      >
        <form onSubmit={onFetchUrl} className="space-y-3">
          <label className="block text-[12px] font-medium text-muted" htmlFor="company-url">
            About Us URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="company-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/about"
              className={inputClass}
              disabled={busy != null}
            />
            <button
              type="submit"
              disabled={busy != null || !url.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent-strong px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
            >
              <Building2Icon size={14} aria-hidden="true" />
              {busy === 'fetch' ? 'Fetching…' : 'Fetch page'}
            </button>
          </div>
        </form>

        <form onSubmit={onSavePaste} className="mt-6 space-y-3">
          <label className="block text-[12px] font-medium text-muted" htmlFor="company-paste">
            Or paste About Us text
          </label>
          <textarea
            id="company-paste"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={8}
            placeholder="Paste company About Us / mission / product overview…"
            className={`${inputClass} min-h-[10rem] font-normal leading-relaxed`}
            disabled={busy != null}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy != null || !paste.trim()}
              className="rounded-lg bg-accent-strong px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
            >
              {busy === 'paste' ? 'Saving…' : 'Save pasted text'}
            </button>
            <button
              type="button"
              onClick={() => void onClear()}
              disabled={busy != null || !briefing}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-line disabled:opacity-40"
            >
              Clear briefing
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={busy != null}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted ring-1 ring-line disabled:opacity-40"
            >
              <RefreshCwIcon size={13} aria-hidden="true" /> Refresh
            </button>
          </div>
        </form>

        {briefing ? (
          <div className="mt-4 rounded-card bg-surface px-4 py-3 ring-1 ring-line">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="success">Saved</StatusPill>
              {freshness ? (
                <StatusPill tone={freshnessTone(freshness.level)}>{freshness.label}</StatusPill>
              ) : null}
              <span className="text-[12px] text-muted">
                {briefing.source === 'url' ? 'From URL' : 'Pasted'} · {briefing.charCount.toLocaleString()} chars ·{' '}
                {new Date(briefing.fetchedAt).toLocaleString()}
              </span>
            </div>
            {briefing.title ? <p className="mt-1 text-sm font-medium text-ink">{briefing.title}</p> : null}
            {briefing.sourceUrl ? (
              <p className="mt-0.5 truncate font-mono text-[11px] text-faint">{briefing.sourceUrl}</p>
            ) : null}
            <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
              {briefing.text.slice(0, 1200)}
              {briefing.text.length > 1200 ? '…' : ''}
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusPill tone="muted">{freshness?.label ?? 'No briefing'}</StatusPill>
            <p className="text-[12px] text-muted">No company briefing stored yet.</p>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Send all agents to training"
        description="Writes the company briefing, each agent's role, and a self-learning note into app-state memory. Chat and council system prompts pick it up — plus pinned Lessons from Settings → Lessons."
      >
        <button
          type="button"
          onClick={() => void onTrain()}
          disabled={!canTrain}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-strong px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-40"
        >
          <GraduationCapIcon size={15} aria-hidden="true" />
          {busy === 'train' ? 'Training…' : 'Send all agents to training'}
        </button>
        {!briefing ? (
          <p className="mt-2 text-[12px] text-muted">Save a briefing first, then train.</p>
        ) : null}
        {status ? (
          <p className="mt-3 text-[12px] text-muted">
            {status.trainedCount > 0
              ? `${status.trainedCount} agent${status.trainedCount === 1 ? '' : 's'} trained`
              : 'No agents trained yet'}
            {status.lastTrainedAt
              ? ` · last ${new Date(status.lastTrainedAt).toLocaleString()}`
              : ''}
            {status.pinnedLessonCount > 0
              ? ` · ${status.pinnedLessonCount} pinned Lesson${status.pinnedLessonCount === 1 ? '' : 's'} inject`
              : ''}
          </p>
        ) : null}

        {diff ? (
          <div className="mt-4 rounded-card bg-surface px-4 py-3 ring-1 ring-line">
            <p className="text-[13px] font-medium text-ink">Training diff</p>
            <p className="mt-1 text-[12px] text-muted">{diff.summary}</p>
            <ul className="mt-2 space-y-1 text-[12px] text-muted">
              <li>
                New: {diff.newlyTrainedIds.length}
                {diff.newlyTrainedIds.length
                  ? ` (${diff.newlyTrainedIds.slice(0, 6).join(', ')}${diff.newlyTrainedIds.length > 6 ? '…' : ''})`
                  : ''}
              </li>
              <li>
                Re-trained: {diff.retrainedIds.length}
                {diff.retrainedIds.length
                  ? ` (${diff.retrainedIds.slice(0, 6).join(', ')}${diff.retrainedIds.length > 6 ? '…' : ''})`
                  : ''}
              </li>
              <li>
                Briefing chars:{' '}
                {diff.previousBriefingChars == null
                  ? diff.briefingChars.toLocaleString()
                  : `${diff.previousBriefingChars.toLocaleString()} → ${diff.briefingChars.toLocaleString()}`}
                {diff.briefingChanged ? ' (changed)' : ' (same)'}
              </li>
            </ul>
          </div>
        ) : null}

        <p className="mt-4 text-[12px] text-muted">
          <Link to="/settings/lessons" className="inline-flex items-center gap-1.5 font-medium text-accent-ink hover:underline">
            <BookOpenIcon size={13} aria-hidden="true" />
            Open Lessons
          </Link>
          <span> — pin takeaways to inject them; training pushes also save a Lesson there.</span>
        </p>
      </SettingsSection>

      <SettingsSection
        title="Group Finals → Lessons"
        description="Successful council Finals are auto-tagged as Final and listed here and on Settings → Lessons. Pin any of them to inject into training context."
      >
        {groupFinals.length === 0 ? (
          <p className="text-[12px] text-muted">
            No group Final Lessons yet. Conclude a Group session with a Final answer to surface one here.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-card ring-1 ring-line">
            {groupFinals.map((l) => (
              <li key={l.id} className="border-t border-line px-3 py-2.5 first:border-t-0">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-overlay/[0.06] px-2 py-0.5 text-[11px] font-medium text-muted">
                        Final
                      </span>
                      {l.pinned ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-ink">
                          <PinIcon size={11} aria-hidden="true" /> Pinned
                        </span>
                      ) : null}
                      <span className="truncate text-[13px] font-medium text-ink">{l.title}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">
                      {l.body.replace(/\s+/g, ' ').trim()}
                    </p>
                  </div>
                  <Link
                    to="/settings/lessons"
                    className="shrink-0 text-[12px] font-medium text-accent-ink hover:underline"
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      {(error || info) && (
        <div className="mt-2 space-y-2">
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
    </>
  );
}
