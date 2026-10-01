import React, { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDownIcon,
  Loader2Icon,
  SparklesIcon,
  TicketIcon,
  UsersIcon,
} from 'lucide-react';
import { api } from '@asi-api';
import { PageHeader, PageScroll } from '../components/PageScroll';
import { TeamGate } from '../components/TeamGate';
import { AgentAvatar } from '../components/AgentAvatar';
import { ModelChip } from '../components/ModelChip';
import { AgentPicker } from '../components/board/AgentPicker';
import { type Stance } from '../data/decision';
import { useDesk } from '../contexts/DeskContext';
import { getAgent } from '../utils/lookup';
import { withChiefIds } from '../utils/withChief';
import type { BoardAgentStance } from '@asi-api';

const columns: { id: Stance; label: string; tone: string; dot: string }[] = [
  { id: 'for', label: 'For', tone: 'text-success', dot: 'bg-success' },
  { id: 'info', label: 'Needs info', tone: 'text-warn', dot: 'bg-warn' },
  { id: 'against', label: 'Against', tone: 'text-danger', dot: 'bg-danger' },
];

function StanceEditor({
  agentId,
  agentName,
  value,
  onChange,
}: {
  agentId: string;
  agentName: string;
  value: BoardAgentStance | undefined;
  onChange: (agentId: string, next: BoardAgentStance | null) => void;
}) {
  const current = value?.stance;
  const note = value?.note ?? '';

  return (
    <div className="rounded-lg bg-overlay/[0.03] px-2 py-2 ring-1 ring-line/60">
      <p className="truncate text-[12px] font-medium text-ink">{agentName}</p>
      <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label={`Override stance for ${agentName}`}>
        {columns.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={current === c.id}
            onClick={() => onChange(agentId, current === c.id ? null : { stance: c.id, note })}
            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 transition-colors ${
              current === c.id ? `${c.tone} ring-current bg-overlay/[0.06]` : 'text-muted ring-line hover:text-ink'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {current && (
        <label className="mt-2 block">
          <span className="sr-only">Note for {agentName}</span>
          <textarea
            rows={2}
            value={note}
            placeholder="Override reason…"
            onChange={(e) => onChange(agentId, { stance: current, note: e.target.value })}
            className="w-full resize-none rounded-md bg-surface px-2 py-1.5 text-[12px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-accent/50"
          />
        </label>
      )}
    </div>
  );
}

function formatStanceLabel(s: Stance | undefined): string {
  if (s === 'for') return 'For';
  if (s === 'against') return 'Against';
  if (s === 'info') return 'Needs info';
  return 'Unset';
}

/** Decision board: agents take sides; you visualize where they stand. */
export function MultiBoard() {
  const {
    isTeamMode,
    agentModels,
    boardIds,
    setBoardIds,
    boardTopic,
    setBoardTopic,
    boardStances,
    setAgentBoardStance,
    applyBoardSnapshot,
  } = useDesk();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [askLabel, setAskLabel] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [takingToGroup, setTakingToGroup] = useState(false);
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketMsg, setTicketMsg] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const topicTrim = boardTopic.trim();
  const picked = withChiefIds(boardIds).map((id) => getAgent(id)).filter((a): a is NonNullable<typeof a> => !!a);
  const tally = columns.map((c) => ({
    ...c,
    count: picked.filter((a) => boardStances[a.id]?.stance === c.id).length,
  }));
  const stanceCount = picked.filter((a) => boardStances[a.id]?.stance).length;

  const onAskAgents = useCallback(async () => {
    if (!topicTrim) {
      setAskError('Add a decision / question first.');
      return;
    }
    if (picked.length === 0) {
      setAskError('Pick at least one agent for the board.');
      return;
    }
    setAsking(true);
    setAskError(null);
    setAskLabel(null);
    try {
      const result = await api.askBoard({ topic: topicTrim });
      applyBoardSnapshot(result);
      setAskLabel(result.label);
      const fails = result.results.filter((r) => !r.ok);
      if (fails.length && !result.results.some((r) => r.ok)) {
        setAskError(fails[0]?.error || 'Agents could not take sides.');
      }
    } catch (e) {
      setAskError(e instanceof Error ? e.message : 'Ask agents failed.');
    } finally {
      setAsking(false);
    }
  }, [topicTrim, picked.length, applyBoardSnapshot]);

  const onTakeToGroup = useCallback(async () => {
    setTakingToGroup(true);
    try {
      const members = withChiefIds(boardIds);
      await api.putGroupMembers(members).catch(() => undefined);

      if (topicTrim) {
        const lines = [
          `Board decision: ${topicTrim}`,
          '',
          'Agent stances so far:',
        ];
        for (const a of picked) {
          const s = boardStances[a.id];
          const label = formatStanceLabel(s?.stance);
          const reason = s?.note?.trim() ? ` — ${s.note.trim()}` : '';
          lines.push(`• ${a.name}: ${label}${reason}`);
        }
        if (stanceCount === 0) {
          lines.push('(No stances yet — ask agents on the Board, or debate here.)');
        }
        await api.groupDecide('message', { text: lines.join('\n') }).catch(() => undefined);
      }
      navigate('/group');
    } finally {
      setTakingToGroup(false);
    }
  }, [boardIds, topicTrim, picked, boardStances, stanceCount, navigate]);

  const onCreateTicket = useCallback(async () => {
    if (!topicTrim) {
      setTicketError('Add a decision / question first.');
      return;
    }
    setTicketBusy(true);
    setTicketError(null);
    setTicketMsg(null);
    try {
      const res = await api.createBoardTicket();
      setTicketMsg(`Ticket created — assigned to ${res.task.agentId}.`);
      navigate(`/tasks`);
    } catch (e) {
      setTicketError(e instanceof Error ? e.message : 'Could not create ticket.');
    } finally {
      setTicketBusy(false);
    }
  }, [topicTrim, navigate]);

  if (!isTeamMode) {
    return (
      <TeamGate
        feature="The decision board"
        description="Pick agents, ask them to take sides on a decision, and see where each one stands."
      />
    );
  }

  return (
    <PageScroll>
      <PageHeader
        title="Board"
        description="Agents take sides on a decision — you visualize their positions. Use Group when you want them to debate."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={ticketBusy || !topicTrim}
              onClick={() => void onCreateTicket()}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-raised disabled:opacity-50"
            >
              {ticketBusy ? (
                <Loader2Icon size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <TicketIcon size={15} aria-hidden="true" />
              )}
              Create ticket
            </button>
            <button
              type="button"
              disabled={takingToGroup}
              onClick={() => void onTakeToGroup()}
              className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-60"
            >
              {takingToGroup ? (
                <Loader2Icon size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <UsersIcon size={15} aria-hidden="true" />
              )}
              Take it to Group
            </button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-card bg-surface p-3 ring-1 ring-line">
          <div className="mb-2 flex items-center px-1">
            <h2 className="text-[13px] font-semibold text-ink">On the board</h2>
            <span className="ml-auto text-[12px] text-muted">{picked.length} picked</span>
          </div>
          <AgentPicker selected={boardIds} onChange={setBoardIds} />
          {picked.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <button
                type="button"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((o) => !o)}
                className="flex w-full items-center gap-1 px-1 text-[12px] font-semibold text-muted hover:text-ink"
              >
                <ChevronDownIcon
                  size={14}
                  className={`transition-transform ${advancedOpen ? 'rotate-0' : '-rotate-90'}`}
                  aria-hidden="true"
                />
                Manual override
              </button>
              {advancedOpen && (
                <div className="mt-2 space-y-2">
                  <p className="px-1 text-[11px] leading-snug text-muted">
                    Optional. Prefer Ask agents so models author their own stances.
                  </p>
                  {picked.map((a) => (
                    <StanceEditor
                      key={a.id}
                      agentId={a.id}
                      agentName={a.name}
                      value={boardStances[a.id]}
                      onChange={setAgentBoardStance}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        <section aria-labelledby="decision-title">
          <div className="rounded-card bg-surface p-5 ring-1 ring-line">
            <h2 id="decision-title" className="text-lg font-semibold leading-snug text-ink">
              {topicTrim || 'No open decision'}
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              {topicTrim
                ? 'Where each picked agent stands after they respond.'
                : 'Enter a decision below, then ask agents to take sides.'}
            </p>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12px] font-semibold text-ink">Decision / question</span>
              <textarea
                rows={3}
                value={boardTopic}
                onChange={(e) => setBoardTopic(e.target.value)}
                placeholder="What should the council weigh in on?"
                className="w-full resize-y rounded-lg bg-overlay/[0.03] px-3 py-2.5 text-[14px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-accent/50"
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={asking || !topicTrim || picked.length === 0}
                onClick={() => void onAskAgents()}
                className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-50"
              >
                {asking ? (
                  <Loader2Icon size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <SparklesIcon size={15} aria-hidden="true" />
                )}
                {asking ? 'Asking agents…' : 'Ask agents'}
              </button>
              <span className="text-[12px] text-muted">Have them take sides with a short reason.</span>
            </div>

            {askError && <p className="mt-2 text-[13px] text-danger">{askError}</p>}
            {askLabel && !askError && <p className="mt-2 text-[13px] text-success">{askLabel}</p>}
            {ticketError && <p className="mt-2 text-[13px] text-danger">{ticketError}</p>}
            {ticketMsg && !ticketError && <p className="mt-2 text-[13px] text-success">{ticketMsg}</p>}

            {picked.length > 0 && (
              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-overlay/[0.06]" aria-hidden="true">
                {tally.map(
                  (c) =>
                    c.count > 0 && (
                      <span key={c.id} className={c.dot} style={{ width: `${(c.count / picked.length) * 100}%` }} />
                    )
                )}
              </div>
            )}
          </div>

          {picked.length === 0 ? (
            <div className="mt-4 rounded-card bg-surface p-10 text-center ring-1 ring-line">
              <p className="text-sm font-medium text-ink">No one on the board yet.</p>
              <p className="mt-1 text-[13px] text-muted">
                Pick two or three agents on the left, then ask them to take sides.
              </p>
            </div>
          ) : stanceCount === 0 && !asking ? (
            <div className="mt-4 rounded-card bg-surface p-10 text-center ring-1 ring-line">
              <p className="text-sm font-medium text-ink">Waiting for agent positions.</p>
              <p className="mt-1 text-[13px] text-muted">
                {topicTrim
                  ? 'Press Ask agents — they form For / Needs info / Against, not you.'
                  : 'Add a decision / question, then press Ask agents.'}
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {tally.map((c) => (
                <div key={c.id}>
                  <h3 className={`mb-2 flex items-center gap-1.5 text-[13px] font-semibold ${c.tone}`}>
                    <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden="true" /> {c.label}
                    <span className="font-normal text-muted">· {c.count}</span>
                  </h3>
                  <ul className="space-y-2">
                    {picked
                      .filter((a) => boardStances[a.id]?.stance === c.id)
                      .map((a) => (
                        <li key={a.id} className="rounded-xl bg-surface p-3 ring-1 ring-line">
                          <div className="flex items-center gap-2">
                            <AgentAvatar agent={a} size="sm" showStatus />
                            <Link
                              to={`/chat/${a.id}`}
                              className="min-w-0 truncate text-[13px] font-semibold text-ink hover:underline"
                            >
                              {a.name} <span className="font-normal text-muted">({a.roleTag})</span>
                            </Link>
                          </div>
                          <p className="mt-2 text-[13px] leading-snug text-ink">
                            {boardStances[a.id]?.note || '—'}
                          </p>
                          <div className="mt-2">
                            <ModelChip id={a.status === 'offline' ? 'offline' : agentModels[a.id]} size="xs" />
                          </div>
                        </li>
                      ))}
                    {c.count === 0 && (
                      <li className="rounded-xl bg-overlay/[0.02] p-3 text-[12px] text-muted ring-1 ring-line/60">
                        No one here yet.
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageScroll>
  );
}
