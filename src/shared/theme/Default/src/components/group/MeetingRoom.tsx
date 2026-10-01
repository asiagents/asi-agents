import React, { useEffect, useMemo, useState } from 'react';
import { EyeIcon, PlusIcon, UserPlusIcon, XIcon } from 'lucide-react';
import { MeetingSeat } from '../office/MeetingSeat';
import { AgentAvatar } from '../AgentAvatar';
import { useDesk } from '../../contexts/DeskContext';
import { isUserModerator, USER_MODERATOR_ID } from '../../utils/withChief';
import type { Agent } from '../../types/agents';

/** Pixar-style Round-table view of the council with MeetingSeat components. */
const MEETING_BG = '/assets/fireheads/meeting_room.jpg';

/** Minimum chairs around the table (filled + placeholders). */
const MIN_SEATS = 8;

type SeatSlot =
  | { kind: 'member'; agent: Agent; seatIndex: number }
  | { kind: 'observer'; agent: Agent; seatIndex: number }
  | { kind: 'add-agent'; seatIndex: number }
  | { kind: 'add-observer'; seatIndex: number };

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function EmptySeat({
  label,
  hint,
  seatIndex,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  seatIndex: number;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group relative flex w-full flex-col items-center rounded-2xl border border-dashed border-line bg-surface/40 p-3 text-center transition-all duration-200 hover:border-accent/50 hover:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
    >
      <span className="absolute left-2.5 top-2.5 rounded-full bg-bg px-2 py-0.5 text-[9px] font-mono font-semibold text-faint ring-1 ring-line">
        Seat #{seatIndex}
      </span>
      <div className="my-3 grid h-14 w-14 place-items-center rounded-full bg-overlay/[0.04] ring-1 ring-line group-hover:ring-accent/40">
        {label.includes('observer') ? (
          <EyeIcon size={20} className="text-muted" aria-hidden="true" />
        ) : (
          <UserPlusIcon size={20} className="text-muted" aria-hidden="true" />
        )}
      </div>
      <h4 className="text-[13px] font-semibold text-ink">{label}</h4>
      <p className="mt-0.5 text-[11px] font-medium text-muted">{hint}</p>
    </button>
  );
}

export function MeetingRoom({
  members,
  observers = [],
  speakingId = null,
  moderatorId,
  onModeratorChange,
  availableAgents,
  locked = false,
  maxDurationMinutes,
  sessionExpiresAt,
  sessionExpired = false,
  onMaxDurationChange,
  onAddAgent,
  onAddObserver,
  onRemoveObserver,
}: {
  members: Agent[];
  observers?: Agent[];
  /** Agent id currently speaking in the council session (e.g. chat typing). */
  speakingId?: string | null;
  moderatorId: string;
  onModeratorChange?: (id: string) => void;
  availableAgents: Agent[];
  locked?: boolean;
  maxDurationMinutes: number | null;
  sessionExpiresAt: string | null;
  sessionExpired?: boolean;
  onMaxDurationChange?: (minutes: number | null) => void;
  onAddAgent?: (agentId: string) => void;
  onAddObserver?: (agentId: string) => void;
  onRemoveObserver?: (agentId: string) => void;
}) {
  const { agentModels, pausedAt } = useDesk();
  const speaking = pausedAt ? null : speakingId;
  const [pickMode, setPickMode] = useState<'agent' | 'observer' | null>(null);
  const [durationDraft, setDurationDraft] = useState(
    maxDurationMinutes != null ? String(maxDurationMinutes) : ''
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setDurationDraft(maxDurationMinutes != null ? String(maxDurationMinutes) : '');
  }, [maxDurationMinutes]);

  useEffect(() => {
    if (!sessionExpiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sessionExpiresAt]);

  const remainingMs = useMemo(() => {
    if (!sessionExpiresAt) return null;
    return Date.parse(sessionExpiresAt) - now;
  }, [sessionExpiresAt, now]);

  const expired =
    sessionExpired || (remainingMs != null && remainingMs <= 0);

  const seats: SeatSlot[] = useMemo(() => {
    const filled: SeatSlot[] = [
      ...members.map((agent, i) => ({
        kind: 'member' as const,
        agent,
        seatIndex: i + 1,
      })),
      ...observers.map((agent, i) => ({
        kind: 'observer' as const,
        agent,
        seatIndex: members.length + i + 1,
      })),
    ];
    const placeholders: SeatSlot[] = [
      { kind: 'add-agent', seatIndex: filled.length + 1 },
      { kind: 'add-observer', seatIndex: filled.length + 2 },
    ];
    // Extra empty agent chairs for capacity beyond the two labeled placeholders.
    while (filled.length + placeholders.length < MIN_SEATS) {
      placeholders.push({
        kind: 'add-agent',
        seatIndex: filled.length + placeholders.length + 1,
      });
    }
    return [...filled, ...placeholders];
  }, [members, observers]);

  const saveDuration = () => {
    if (!onMaxDurationChange || locked) return;
    const trimmed = durationDraft.trim();
    if (!trimmed) {
      onMaxDurationChange(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) {
      onMaxDurationChange(null);
      setDurationDraft('');
      return;
    }
    onMaxDurationChange(Math.min(1440, Math.max(1, Math.round(n))));
  };

  const centerStatus = pausedAt
    ? 'Meeting paused'
    : expired
      ? 'Time limit reached — generate blocked'
      : speaking
        ? `${members.find((m) => m.id === speaking)?.name ?? observers.find((o) => o.id === speaking)?.name ?? 'Agent'} is speaking…`
        : 'Waiting for council agent to speak…';

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 bg-gradient-to-b from-bg to-surface/40 rounded-card ring-1 ring-line">
      <img
        src={MEETING_BG}
        alt=""
        className="mb-3 h-32 w-full rounded-card object-cover opacity-90 ring-1 ring-line"
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-card bg-surface/80 px-3 py-2.5 ring-1 ring-line">
        <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Moderator
          <select
            value={moderatorId}
            disabled={locked || !onModeratorChange}
            onChange={(e) => onModeratorChange?.(e.target.value)}
            className="rounded-md bg-bg px-2.5 py-1.5 text-[12px] font-medium normal-case tracking-normal text-ink ring-1 ring-line focus:outline-none focus:ring-accent/40 disabled:opacity-40"
            aria-label="Select moderator"
          >
            <option value={USER_MODERATOR_ID}>You (user)</option>
            {members.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[8rem] flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Max time (min)
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={1440}
              placeholder="Off"
              value={durationDraft}
              disabled={locked || !onMaxDurationChange}
              onChange={(e) => setDurationDraft(e.target.value)}
              onBlur={saveDuration}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveDuration();
                }
              }}
              className="w-20 rounded-md bg-bg px-2.5 py-1.5 text-[12px] font-medium normal-case tracking-normal text-ink ring-1 ring-line focus:outline-none focus:ring-accent/40 disabled:opacity-40"
              aria-label="Maximum session duration in minutes"
            />
            <button
              type="button"
              disabled={locked || !onMaxDurationChange}
              onClick={saveDuration}
              className="rounded-full px-2.5 py-1.5 text-[11px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.05] disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </label>

        <div className="ml-auto flex flex-col items-end gap-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Remaining
          </span>
          <span
            className={`font-mono text-[15px] font-semibold ${
              expired ? 'text-danger' : remainingMs != null ? 'text-ink' : 'text-muted'
            }`}
          >
            {remainingMs == null
              ? 'Unlimited'
              : expired
                ? 'Expired'
                : formatRemaining(remainingMs)}
          </span>
        </div>
      </div>

      {expired && (
        <p className="mb-3 rounded-md bg-danger/10 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/25">
          Session time limit reached — new generate is blocked (fail closed). End or reopen the
          session, or raise Max time.
        </p>
      )}

      {pickMode && (
        <div className="mb-3 rounded-lg bg-surface p-3 ring-1 ring-line">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink">
              {pickMode === 'agent' ? 'Add voting agent' : 'Add observer (non-voting)'}
            </span>
            <button
              type="button"
              onClick={() => setPickMode(null)}
              aria-label="Close picker"
              className="grid h-7 w-7 place-items-center rounded-full text-faint hover:bg-overlay/[0.05] hover:text-ink"
            >
              <XIcon size={14} />
            </button>
          </div>
          {availableAgents.length === 0 ? (
            <p className="text-[12px] text-muted">No agents left on the roster.</p>
          ) : (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto">
              {availableAgents.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      if (pickMode === 'agent') onAddAgent?.(a.id);
                      else onAddObserver?.(a.id);
                      setPickMode(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-overlay/[0.05] disabled:opacity-40"
                  >
                    <AgentAvatar agent={a} size="sm" showStatus />
                    <span className="truncate text-[12px] text-ink">{a.name}</span>
                    <span className="ml-auto text-[10px] uppercase text-faint">
                      {pickMode === 'observer' ? 'Observer' : 'Agent'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="relative mx-auto aspect-[16/10] w-full max-w-4xl flex items-center justify-center p-6">
        <div className="absolute inset-[20%] flex flex-col items-center justify-center rounded-[50%] bg-gradient-to-br from-[#1b2130] to-[#121622] ring-2 ring-accent/30 shadow-2xl p-6 text-center">
          <div className="max-w-[80%] text-center">
            <div className="space-y-1">
              <span className="inline-block rounded-full bg-line px-2.5 py-0.5 text-[10px] font-mono text-muted">
                COUNCIL CHAMBER
              </span>
              <p className="text-[13px] text-muted font-medium">{centerStatus}</p>
              <p className="text-[11px] text-faint">
                {members.length} voting
                {observers.length > 0 ? ` · ${observers.length} observing` : ''}
                {' · '}
                Mod:{' '}
                {isUserModerator(moderatorId)
                  ? 'You'
                  : members.find((m) => m.id === moderatorId)?.name ?? moderatorId}
              </p>
            </div>
          </div>
        </div>

        {seats.map((slot, i) => {
          const angle = (i / seats.length) * Math.PI * 2 - Math.PI / 2;
          const left = 50 + Math.cos(angle) * 38;
          const top = 50 + Math.sin(angle) * 38;

          return (
            <div
              key={
                slot.kind === 'member' || slot.kind === 'observer'
                  ? `${slot.kind}-${slot.agent.id}`
                  : `${slot.kind}-${slot.seatIndex}`
              }
              className="absolute w-28 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              {slot.kind === 'member' || slot.kind === 'observer' ? (
                <div className="relative">
                  <MeetingSeat
                    id={slot.agent.id}
                    name={slot.agent.name}
                    role={
                      slot.kind === 'observer'
                        ? 'Observer'
                        : slot.agent.role || slot.agent.roleTag || 'Council Member'
                    }
                    status={slot.agent.status}
                    modelLabel={agentModels[slot.agent.id] || slot.agent.primary}
                    speaking={speaking === slot.agent.id}
                    seatIndex={slot.seatIndex}
                  />
                  {slot.kind === 'observer' && !locked && onRemoveObserver && (
                    <button
                      type="button"
                      title={`Remove observer ${slot.agent.name}`}
                      aria-label={`Remove observer ${slot.agent.name}`}
                      onClick={() => onRemoveObserver(slot.agent.id)}
                      className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-surface text-faint ring-1 ring-line hover:text-danger"
                    >
                      <XIcon size={12} />
                    </button>
                  )}
                  {slot.kind === 'observer' && (
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-bg/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted ring-1 ring-line">
                      Observer
                    </span>
                  )}
                </div>
              ) : (
                <EmptySeat
                  label={slot.kind === 'add-observer' ? 'Add observer' : 'Add agent'}
                  hint={slot.kind === 'add-observer' ? 'Non-voting' : 'Voting seat'}
                  seatIndex={slot.seatIndex}
                  disabled={locked || availableAgents.length === 0}
                  onClick={() =>
                    setPickMode(slot.kind === 'add-observer' ? 'observer' : 'agent')
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-2 flex max-w-4xl flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={locked || availableAgents.length === 0}
          onClick={() => setPickMode('agent')}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.05] disabled:opacity-40"
        >
          <PlusIcon size={13} aria-hidden="true" /> Add agent
        </button>
        <button
          type="button"
          disabled={locked || availableAgents.length === 0}
          onClick={() => setPickMode('observer')}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.05] disabled:opacity-40"
        >
          <EyeIcon size={13} aria-hidden="true" /> Add observer
        </button>
      </div>
    </div>
  );
}
