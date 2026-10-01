import { useAgents } from '../contexts/AgentsContext';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@asi-api';
import { Link, useParams } from 'react-router-dom';
import {
  Building2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GavelIcon,
  UserMinusIcon,
  UserPlusIcon,
  XIcon,
} from 'lucide-react';
import { GroupSidebar } from '../components/group/GroupSidebar';
import { ConcludePanel } from '../components/group/ConcludePanel';
import { EmptyVisual } from '../components/EmptyVisual';
import { ModelChip } from '../components/ModelChip';
import { AgentAvatar } from '../components/AgentAvatar';
import { ChatFeed } from '../components/chat/ChatFeed';
import { Composer } from '../components/chat/Composer';
import { ProposalCard } from '../components/chat/ProposalCard';
import { PanicButton } from '../components/chat/PanicButton';
import type { Decision } from '../components/chat/ProposalCard';
import { PermissionsAsideStrip } from '../components/permissions/PermissionsAsideStrip';
import { MeetingRoom } from '../components/group/MeetingRoom';
import { councilRoster } from '../components/group/councilRoster';
import { TeamBanner } from '../components/TeamGate';
import { LocalBackendAlertBanner } from '../components/LocalBackendAlertBanner';
import { useDesk } from '../contexts/DeskContext';
import { useSettings } from '../contexts/SettingsContext';
import { emitCompanionTyping } from '../companion';
import { useGroupThread } from '../hooks/useGroupThread';
import { useLocalBackendAlert } from '../hooks/useLocalBackendAlert';
import { createId, nowTime } from '../utils/time';
import { isChiefId, isUserModerator, USER_MODERATOR_ID } from '../utils/withChief';
import { readSidebarOpenPref, STORAGE_KEYS, writeFlag } from '../utils/storage';
import type { ModelId } from '../types/models';
import type { Proposal } from '../types/chat';
import { emptyGroupProposal, hasGroupProposalContent } from '../data/threads';
import { getAgent } from '../utils/lookup';
import { formatAgentDisplayName, formatAgentRoleChip } from '../utils/agentDisplay';

export function GroupChat() {
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>();
  const agents = useAgents();
  const { isTeamMode, pausedAt, boardIds, setBoardIds, councilTick } = useDesk();
  const { s } = useSettings();
  const [groupId, setGroupId] = useState<string | null>(routeGroupId ?? null);
  const [groupName, setGroupName] = useState('Group council');
  const [memberIds, setMemberIds] = useState<string[]>(boardIds);
  const [observerIds, setObserverIds] = useState<string[]>([]);
  const [moderatorId, setModeratorId] = useState<string>('chief');
  const [maxDurationMinutes, setMaxDurationMinutes] = useState<number | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [decision, setDecision] = useState<Decision>('open');
  const [proposal, setProposal] = useState<Proposal>(emptyGroupProposal);
  const [session, setSession] = useState<'open' | 'closed'>('open');
  const [pickOpen, setPickOpen] = useState(false);
  const [concludeOpen, setConcludeOpen] = useState(false);
  const [concludeBusy, setConcludeBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [concludeError, setConcludeError] = useState<string | null>(null);
  const threadLive = session === 'open';
  const { items, typing, send, append, reset, clear: clearMessages, offline, decide, conclude, reload } = useGroupThread(
    threadLive,
    groupId
  );
  const { alert: localBackendAlert, runScan: rescanLocalBackend } = useLocalBackendAlert();

  useEffect(() => {
    emitCompanionTyping(Boolean(typing));
    return () => emitCompanionTyping(false);
  }, [typing]);

  const [groupTopic, setGroupTopic] = useState('');
  const [topicDraft, setTopicDraft] = useState('');
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicBusy, setTopicBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const applySessionSnapshot = useCallback((g: Awaited<ReturnType<typeof api.groupSession>>) => {
    if (g.id) setGroupId(g.id);
    if (g.name) setGroupName(g.name);
    setGroupTopic(typeof g.topic === 'string' ? g.topic : '');
    setSession(g.session === 'closed' ? 'closed' : 'open');
    if (g.memberIds?.length) {
      setMemberIds(g.memberIds);
      setBoardIds(g.memberIds);
    }
    setObserverIds(Array.isArray(g.observerIds) ? g.observerIds : []);
    if (typeof g.moderatorId === 'string' && g.moderatorId.trim()) {
      setModeratorId(g.moderatorId.trim());
    }
    setMaxDurationMinutes(
      typeof g.maxDurationMinutes === 'number' && g.maxDurationMinutes > 0
        ? g.maxDurationMinutes
        : null
    );
    setSessionExpiresAt(typeof g.sessionExpiresAt === 'string' ? g.sessionExpiresAt : null);
    setSessionExpired(g.sessionExpired === true);
    if (g.proposal) {
      setProposal({
        ...g.proposal,
        model: g.proposal.model as ModelId,
      });
    }
    const d = g.proposalDecision;
    setDecision(d === 'approved' || d === 'rejected' ? d : 'open');
  }, [setBoardIds]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (routeGroupId) {
          await api.activateGroup(routeGroupId).catch(() => undefined);
          const g = await api.groupSession(routeGroupId);
          if (!cancelled) applySessionSnapshot(g);
        } else {
          const list = await api.listGroups().catch(() => null);
          if (list?.activeGroupId) {
            const g = await api.groupSession(list.activeGroupId);
            if (!cancelled) applySessionSnapshot(g);
          } else {
            const g = await api.groupSession();
            if (!cancelled) applySessionSnapshot(g);
          }
        }
        if (!cancelled) await reload().catch(() => undefined);
      } catch {
        /* offline — keep last local snapshot; Super stays read-only */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // councilTick: bumps after Multi/Pro/Super council mode switch applies seats/session.
  }, [routeGroupId, applySessionSnapshot, councilTick, reload]);

  // Local countdown: flip sessionExpired when wall clock passes sessionExpiresAt.
  useEffect(() => {
    if (!sessionExpiresAt || session !== 'open') return;
    const tick = () => {
      if (Date.now() >= Date.parse(sessionExpiresAt)) setSessionExpired(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sessionExpiresAt, session]);

  const [view, setView] = useState<'thread' | 'room'>('thread');
  const [railOpen, setRailOpen] = useState(() => readSidebarOpenPref(STORAGE_KEYS.groupRailOpen, true));
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const setRail = useCallback((open: boolean) => {
    setRailOpen(open);
    writeFlag(STORAGE_KEYS.groupRailOpen, open);
  }, []);
  const locked = !isTeamMode || !!pausedAt;

  const log = (text: string, tone: 'neutral' | 'success' | 'danger') =>
    append({ kind: 'system', id: createId(), time: nowTime(), text, tone });

  const moderatorLabel = isUserModerator(moderatorId)
    ? 'You'
    : getAgent(moderatorId)?.name ?? moderatorId;

  const setModerator = async (next: string) => {
    if (!groupId || locked) return;
    const prev = moderatorId;
    setModeratorId(next);
    try {
      const g = await api.patchGroup(groupId, { moderatorId: next });
      applySessionSnapshot(g);
    } catch {
      setModeratorId(prev);
      log('Could not save moderator', 'danger');
    }
  };

  const setMaxDuration = async (minutes: number | null) => {
    if (!groupId || locked) return;
    const prev = maxDurationMinutes;
    setMaxDurationMinutes(minutes);
    try {
      const g = await api.patchGroup(groupId, { maxDurationMinutes: minutes });
      applySessionSnapshot(g);
    } catch {
      setMaxDurationMinutes(prev);
      log('Could not save max time', 'danger');
    }
  };

  const beginEditTopic = () => {
    if (locked || !groupId) return;
    setTopicDraft(groupTopic);
    setEditingTopic(true);
  };

  const saveTopic = async () => {
    if (!groupId || topicBusy) return;
    const next = topicDraft.trim().slice(0, 500);
    setTopicBusy(true);
    try {
      const g = await api.patchGroup(groupId, {
        topic: next || null,
        announceTopic: true,
      });
      applySessionSnapshot(g);
      setEditingTopic(false);
      await reload();
    } catch {
      log('Could not save topic — API unavailable (fail closed)', 'danger');
    } finally {
      setTopicBusy(false);
    }
  };

  const clearChat = async () => {
    if (clearBusy) return;
    setClearBusy(true);
    try {
      await clearMessages();
      log('Chat cleared · members kept', 'neutral');
      setConfirmClear(false);
    } catch {
      log('Could not clear chat — API unavailable (fail closed)', 'danger');
    } finally {
      setClearBusy(false);
    }
  };

  const runAgentConclude = async () => {
    if (locked || concludeBusy) return;
    setConcludeBusy(true);
    setConcludeError(null);
    try {
      const res = await conclude();
      if (!res.ok) {
        log(res.error ?? res.label ?? 'Conclude failed closed', 'danger');
      }
    } catch {
      log('Could not conclude — check API / models', 'danger');
    } finally {
      setConcludeBusy(false);
    }
  };

  const onConcludeClick = () => {
    if (locked) return;
    if (isUserModerator(moderatorId)) {
      setConcludeOpen(true);
      setConcludeError(null);
      return;
    }
    void runAgentConclude();
  };

  const recordDecide = async (
    action: 'approve' | 'reject',
    next: Decision,
    fallback: string
  ) => {
    try {
      const res = await decide(action);
      setDecision(res.proposalDecision ?? next);
    } catch {
      log(fallback, 'danger');
    }
  };

  const startSession = () => {
    if (!isTeamMode) return;
    reset();
    setSession('open');
    void api
      .patchGroupSession('open', groupId || undefined)
      .then((g) => applySessionSnapshot(g))
      .catch(() => {
        setDecision('open');
      });
  };

  const endSession = () => {
    setSession('closed');
    setConcludeOpen(false);
    void api.patchGroupSession('closed', groupId || undefined).catch(() => undefined);
  };

  const removeMember = async (agentId: string) => {
    if (!groupId || isChiefId(agentId)) return;
    try {
      const g = await api.removeGroupMember(agentId, groupId);
      applySessionSnapshot(g);
    } catch {
      log('Could not remove member', 'danger');
    }
  };

  const addMember = async (agentId: string) => {
    if (!groupId || isChiefId(agentId)) return;
    try {
      const g = await api.addGroupMember(agentId, groupId);
      applySessionSnapshot(g);
      setPickOpen(false);
    } catch {
      log('Could not add member', 'danger');
    }
  };

  const addObserver = async (agentId: string) => {
    if (!groupId || isChiefId(agentId)) return;
    try {
      const g = await api.addGroupObserver(agentId, groupId);
      applySessionSnapshot(g);
    } catch {
      log('Could not add observer', 'danger');
    }
  };

  const removeObserver = async (agentId: string) => {
    if (!groupId) return;
    try {
      const g = await api.removeGroupObserver(agentId, groupId);
      applySessionSnapshot(g);
    } catch {
      log('Could not remove observer', 'danger');
    }
  };

  const modelsUsed = Array.from(
    new Set(items.flatMap((i) => (i.kind === 'message' && i.model ? [i.model] : [])))
  ) as ModelId[];
  const members = councilRoster(memberIds);
  const observers = observerIds
    .map((id) => getAgent(id))
    .filter((a): a is NonNullable<typeof a> => !!a);
  const seatedIds = new Set([...members.map((a) => a.id), ...observerIds]);
  const unavailable = agents.filter((a) => a.status === 'offline' && !seatedIds.has(a.id));
  const available = agents.filter((a) => !isChiefId(a.id) && !seatedIds.has(a.id));
  const selectedMember =
    members.find((a) => a.id === selectedMemberId) ?? members[0] ?? null;
  const generateBlocked = locked || sessionExpired;

  return (
    <div className="grid h-full w-full md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)_auto] xl:grid-cols-[320px_minmax(0,1fr)_auto]">
      <GroupSidebar
        className="hidden md:flex"
        activeGroupId={groupId}
        memberIds={memberIds}
        moderatorId={moderatorId}
        onMembersChange={(ids) => {
          setMemberIds(ids);
          setBoardIds(ids);
        }}
        onModeratorChange={(id) => void setModerator(id)}
      />

      <section className="flex min-h-0 flex-col bg-bg pb-[84px]" aria-label="Council thread">
        {!isTeamMode && (
          <TeamBanner text="Switch to Multi or Pro for council. You can read this thread, but topic, voting, and moderator controls stay off." />
        )}
        <LocalBackendAlertBanner alert={localBackendAlert} onRescan={rescanLocalBackend} />

        <div className="shrink-0 border-b border-line bg-surface px-4 py-3 md:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto min-w-0">
              <h1 className="text-[15px] font-semibold text-ink">
                {groupName} <span className="text-[12px] font-medium text-muted">[Group]</span>
              </h1>
              {editingTopic ? (
                <div className="mt-1.5 flex max-w-xl flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={topicDraft}
                    onChange={(e) => setTopicDraft(e.target.value.slice(0, 500))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void saveTopic();
                      }
                      if (e.key === 'Escape') setEditingTopic(false);
                    }}
                    placeholder="Discussion topic…"
                    disabled={topicBusy}
                    className="min-w-[12rem] flex-1 rounded-md bg-bg px-2.5 py-1 text-[13px] text-ink ring-1 ring-line focus:outline-none focus:ring-accent/40 disabled:opacity-40"
                    aria-label="Group topic"
                    autoFocus
                  />
                  <button
                    type="button"
                    disabled={topicBusy}
                    onClick={() => void saveTopic()}
                    className="rounded-full bg-accent-strong px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
                  >
                    {topicBusy ? 'Saving…' : 'Save topic'}
                  </button>
                  <button
                    type="button"
                    disabled={topicBusy}
                    onClick={() => setEditingTopic(false)}
                    className="rounded-full px-2.5 py-1 text-[12px] font-medium text-muted ring-1 ring-line disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={locked || !groupId}
                  onClick={beginEditTopic}
                  title="Edit topic"
                  className="mt-0.5 max-w-full truncate text-left text-[12px] text-muted transition-colors hover:text-ink disabled:cursor-default disabled:hover:text-muted"
                >
                  {groupTopic.trim()
                    ? `Topic: ${groupTopic.trim()}`
                    : session === 'open'
                      ? 'No topic · click to set'
                      : 'No topic'}
                </button>
              )}
              <p className="text-[12px] text-muted">
                {offline
                  ? 'Council API offline — thread empty until the server is up (npm run start or npm run dev)'
                  : session === 'open'
                    ? isTeamMode
                      ? `${members.length} voting${observers.length ? ` · ${observers.length} observing` : ''} · Moderator: ${moderatorLabel}${
                          sessionExpired
                            ? ' · Time expired'
                            : maxDurationMinutes
                              ? ` · Max ${maxDurationMinutes}m`
                              : ''
                        }`
                      : `${members.length} council · read-only`
                    : 'No council in session'}
              </p>
            </div>
            {session === 'open' && isTeamMode && (
              <>
                <label className="flex items-center gap-1.5 text-[12px] text-muted">
                  <span className="whitespace-nowrap">Moderator</span>
                  <select
                    value={moderatorId}
                    disabled={locked || !groupId}
                    onChange={(e) => void setModerator(e.target.value)}
                    className="max-w-[9.5rem] truncate rounded-full bg-bg px-2.5 py-1 text-[12px] font-medium text-ink ring-1 ring-line focus:outline-none focus:ring-accent/40 disabled:opacity-40"
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
                {confirmClear ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={clearBusy || locked}
                      onClick={() => void clearChat()}
                      className="rounded-full bg-danger/15 px-3 py-1.5 text-[12px] font-medium text-danger ring-1 ring-danger/30 disabled:opacity-40"
                    >
                      {clearBusy ? 'Clearing…' : 'Confirm clear'}
                    </button>
                    <button
                      type="button"
                      disabled={clearBusy}
                      onClick={() => setConfirmClear(false)}
                      className="rounded-full px-3 py-1.5 text-[12px] font-medium text-muted ring-1 ring-line"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setConfirmClear(true)}
                    className="rounded-full px-3 py-1.5 text-[12px] font-medium text-muted ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] hover:text-ink disabled:opacity-40"
                    title="Clear messages (keep members)"
                  >
                    Clear…
                  </button>
                )}
                <button
                  type="button"
                  disabled={locked || !groupId}
                  onClick={() => {
                    setRail(true);
                    setPickOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-[12px] font-medium text-accent-ink ring-1 ring-accent/30 transition-colors duration-150 hover:bg-accent/15 disabled:opacity-40"
                  title="Add agent to this council"
                >
                  <UserPlusIcon size={13} aria-hidden="true" />
                  Add agent
                </button>
                <button
                  type="button"
                  disabled={locked || concludeBusy}
                  onClick={onConcludeClick}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
                  title={
                    isUserModerator(moderatorId)
                      ? 'Open decide UI to post Final'
                      : `${moderatorLabel} synthesizes a Final answer`
                  }
                >
                  <GavelIcon size={13} aria-hidden="true" />
                  {concludeBusy ? 'Concluding…' : 'Get a response'}
                </button>
                <Link
                  to="/office"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]"
                >
                  <Building2Icon size={13} aria-hidden="true" /> Office
                </Link>
                <button
                  type="button"
                  onClick={endSession}
                  className="rounded-full px-3 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-overlay/[0.05] hover:text-ink"
                >
                  End session
                </button>
                <PanicButton />
              </>
            )}
          </div>
          {session === 'open' && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium text-muted">Models used</span>
              {modelsUsed.map((m) => (
                <ModelChip key={m} id={m} size="xs" />
              ))}
            </div>
          )}
        </div>

        {isTeamMode && session === 'open' && (
          <div role="tablist" aria-label="Council view" className="flex shrink-0 gap-1 border-b border-line bg-surface px-4 py-1.5">
            {(['thread', 'room'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                type="button"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors duration-150 ${view === v ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'}`}
              >
                {v === 'thread' ? 'Thread' : 'Meeting room'}
              </button>
            ))}
          </div>
        )}

        {session === 'closed' && isTeamMode ? (
          <div className="grid flex-1 place-items-center overflow-y-auto p-6">
            <div className="max-w-sm text-center">
              <EmptyVisual label="No council session" className="mx-auto w-64" />
              <h2 className="mt-5 text-lg font-semibold text-ink">No group decision open</h2>
              <p className="mt-1.5 text-sm text-muted">
                Start one and Chief gathers the council, collects views, and brings you a proposal to approve.
              </p>
              <button
                type="button"
                onClick={startSession}
                className="mt-5 rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2"
              >
                Start group decision
              </button>
            </div>
          </div>
        ) : (
          <>
            {isTeamMode && view === 'room' ? (
              <MeetingRoom
                members={members}
                observers={observers}
                speakingId={session === 'open' ? typing : null}
                moderatorId={moderatorId}
                onModeratorChange={(id) => void setModerator(id)}
                availableAgents={available}
                locked={locked || !groupId}
                maxDurationMinutes={maxDurationMinutes}
                sessionExpiresAt={sessionExpiresAt}
                sessionExpired={sessionExpired}
                onMaxDurationChange={(m) => void setMaxDuration(m)}
                onAddAgent={(id) => void addMember(id)}
                onAddObserver={(id) => void addObserver(id)}
                onRemoveObserver={(id) => void removeObserver(id)}
              />
            ) : items.length === 0 ? (
              <div className="grid flex-1 place-items-center overflow-y-auto p-6">
                <div className="max-w-md text-center">
                  <EmptyVisual label="Council ready" className="mx-auto w-56" />
                  <p className="mt-4 text-sm text-muted">
                    Send to debate · Conclude when ready · Moderator: {moderatorLabel}
                  </p>
                </div>
              </div>
            ) : (
              <ChatFeed items={items} typing={typing} />
            )}
            <div className="bg-surface">
              {hasGroupProposalContent(proposal) && (
                <ProposalCard
                  proposal={proposal}
                  decision={decision}
                  disabled={locked}
                  onApprove={() => void recordDecide('approve', 'approved', 'Could not record approval')}
                  onReject={() => void recordDecide('reject', 'rejected', 'Could not record rejection')}
                  onAskMore={(q) => {
                    void decide('ask', q).catch(() => log('Could not send question', 'danger'));
                  }}
                  onReopen={() => {
                    void decide('reopen')
                      .then((res) => setDecision(res.proposalDecision ?? 'open'))
                      .catch(() => log('Could not reopen proposal', 'danger'));
                  }}
                />
              )}
              {concludeOpen && isUserModerator(moderatorId) && (
                <ConcludePanel
                  busy={concludeBusy}
                  draftBusy={draftBusy}
                  error={concludeError}
                  onCancel={() => {
                    setConcludeOpen(false);
                    setConcludeError(null);
                  }}
                  onAskDraft={async () => {
                    setDraftBusy(true);
                    setConcludeError(null);
                    try {
                      const res = await conclude({ draftOnly: true });
                      if (!res.ok || !res.draft) {
                        setConcludeError(res.error ?? 'Chief draft failed closed');
                        return null;
                      }
                      return res.draft;
                    } catch {
                      setConcludeError('Could not reach API for Chief draft');
                      return null;
                    } finally {
                      setDraftBusy(false);
                    }
                  }}
                  onSubmit={({ shortlist, verdict }) => {
                    setConcludeBusy(true);
                    setConcludeError(null);
                    void conclude({ shortlist, verdict })
                      .then((res) => {
                        if (!res.ok) {
                          setConcludeError(res.error ?? res.label);
                          return;
                        }
                        setConcludeOpen(false);
                      })
                      .catch(() => setConcludeError('Could not post Final'))
                      .finally(() => setConcludeBusy(false));
                  }}
                />
              )}
              <Composer
                onSend={send}
                disabled={generateBlocked}
                placeholder={
                  pausedAt
                    ? 'All agents are paused'
                    : sessionExpired
                      ? 'Session time expired — generate blocked'
                      : isTeamMode
                        ? 'Message the council…'
                        : 'Switch to Multi to message the council'
                }
              />
            </div>
          </>
        )}
      </section>

      {!railOpen ? (
        <aside
          className="hidden w-11 shrink-0 flex-col items-center border-l border-line bg-surface py-3 lg:flex"
          aria-label="Council members (collapsed)"
        >
          <button
            type="button"
            onClick={() => setRail(true)}
            title="Show council members"
            aria-label="Expand council members"
            className="grid h-8 w-8 place-items-center rounded-full text-muted ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] hover:text-ink"
          >
            <ChevronLeftIcon size={16} aria-hidden="true" />
          </button>
          <div className="mt-3 flex flex-col items-center gap-2">
            {members.slice(0, 6).map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.name}
                onClick={() => setRail(true)}
                className="rounded-full"
              >
                <AgentAvatar agent={a} size="sm" showStatus />
              </button>
            ))}
          </div>
        </aside>
      ) : (
        <aside
          className="hidden min-h-0 w-[300px] flex-col overflow-y-auto border-l border-line bg-surface pb-24 xl:w-[320px] lg:flex"
          aria-label="Council members"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
            <p className="mr-auto text-[13px] font-semibold text-ink">Council</p>
            <button
              type="button"
              onClick={() => setRail(false)}
              aria-label="Collapse council rail"
              title="Collapse"
              className="grid h-7 w-7 place-items-center rounded-full text-faint transition-colors duration-150 hover:bg-overlay/[0.05] hover:text-ink"
            >
              <ChevronRightIcon size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="border-b border-line px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Moderator</p>
            <p className="mt-1 text-[13px] font-medium text-ink">{moderatorLabel}</p>
            {isTeamMode && groupId && (
              <select
                value={moderatorId}
                disabled={locked}
                onChange={(e) => void setModerator(e.target.value)}
                className="mt-2 w-full rounded-md bg-bg px-2 py-1.5 text-[12px] text-ink ring-1 ring-line focus:outline-none focus:ring-accent/40 disabled:opacity-40"
                aria-label="Select moderator"
              >
                <option value={USER_MODERATOR_ID}>You (user)</option>
                {members.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1.5 text-[11px] text-muted">
              {isUserModerator(moderatorId)
                ? 'You post the Final after debate.'
                : `${moderatorLabel} synthesizes one Final when you Conclude.`}
            </p>
          </div>
          <div className="pt-3">
            <PermissionsAsideStrip />
          </div>
          <div className="flex items-center gap-2 px-4 pb-2 pt-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              {isTeamMode ? 'Voting members' : 'Council members'}
            </h2>
            {isTeamMode && groupId && (
              <button
                type="button"
                onClick={() => setPickOpen((o) => !o)}
                className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-accent-ink hover:bg-accent/10"
              >
                <UserPlusIcon size={12} aria-hidden="true" /> Add
              </button>
            )}
          </div>
          {!isTeamMode && (
            <p className="px-4 pb-2 text-[11px] text-muted">Super: read-only — switch to Multi or Pro to vote and message.</p>
          )}
          {pickOpen && (
            <div className="mx-4 mb-3 rounded-lg bg-overlay/[0.03] p-2 ring-1 ring-line">
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-[11px] font-medium text-muted">Add to group</span>
                <button type="button" onClick={() => setPickOpen(false)} aria-label="Close">
                  <XIcon size={12} className="text-faint" />
                </button>
              </div>
              {available.length === 0 ? (
                <p className="px-1 text-[12px] text-muted">No agents left to add.</p>
              ) : (
                available.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => void addMember(a.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-overlay/[0.05]"
                  >
                    <AgentAvatar agent={a} size="sm" showStatus />
                    <span className="truncate text-[12px] text-ink">{a.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <ul>
            {members.map((a) => (
              <li key={a.id} className="group/row flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedMemberId(a.id)}
                  className={`flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-overlay/[0.04] ${
                    selectedMember?.id === a.id ? 'bg-accent/[0.06]' : ''
                  }`}
                >
                  <AgentAvatar agent={a} size="md" showStatus />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink">
                      {formatAgentDisplayName(a)}{' '}
                      {moderatorId === a.id && (
                        <span className="text-[10px] font-semibold uppercase text-accent-ink">Mod</span>
                      )}{' '}
                      {formatAgentRoleChip(a) ? (
                        <span className="text-[11px] font-normal text-faint">[{formatAgentRoleChip(a)}]</span>
                      ) : null}
                    </div>
                    <ModelChip
                      id={(a.primary && String(a.primary).trim() ? a.primary : 'pending') as ModelId}
                      size="xs"
                      className="mt-0.5"
                    />
                  </div>
                </button>
                {isTeamMode && groupId && !isChiefId(a.id) && (
                  <button
                    type="button"
                    title={`Remove ${a.name}`}
                    aria-label={`Remove ${a.name}`}
                    onClick={() => void removeMember(a.id)}
                    className="mr-3 grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint opacity-0 transition-opacity hover:bg-overlay/[0.06] hover:text-danger group-hover/row:opacity-100"
                  >
                    <UserMinusIcon size={13} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {observers.length > 0 && (
            <>
              <h2 className="px-4 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Observers
              </h2>
              <ul>
                {observers.map((a) => (
                  <li key={a.id} className="group/row flex items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5">
                      <AgentAvatar agent={a} size="md" showStatus />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-ink">
                          {formatAgentDisplayName(a)}{' '}
                          <span className="text-[10px] font-semibold uppercase text-faint">Obs</span>
                        </div>
                        <p className="text-[11px] text-muted">Non-voting</p>
                      </div>
                    </div>
                    {isTeamMode && groupId && (
                      <button
                        type="button"
                        title={`Remove observer ${a.name}`}
                        aria-label={`Remove observer ${a.name}`}
                        onClick={() => void removeObserver(a.id)}
                        className="mr-3 grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint opacity-0 transition-opacity hover:bg-overlay/[0.06] hover:text-danger group-hover/row:opacity-100"
                      >
                        <UserMinusIcon size={13} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {selectedMember && (
            <div className="mx-4 mt-4 rounded-lg bg-overlay/[0.03] p-3 ring-1 ring-line">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Member details</p>
              <p className="mt-1.5 text-[13px] font-medium text-ink">{selectedMember.name}</p>
              <p className="text-[12px] text-muted">{selectedMember.roleTag} · {selectedMember.status}</p>
              <div className="mt-2">
                <ModelChip
                  id={(selectedMember.primary && String(selectedMember.primary).trim() ? selectedMember.primary : 'pending') as ModelId}
                  size="xs"
                />
              </div>
              {selectedMember.skills.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1">
                  {selectedMember.skills.slice(0, 8).map((sk) => (
                    <li
                      key={sk.name}
                      className="rounded-full bg-overlay/[0.04] px-2 py-0.5 text-[11px] text-ink ring-1 ring-line"
                    >
                      {sk.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-muted">No registry skills on this member.</p>
              )}
              <Link
                to={selectedMember.isChief ? '/chat/chief' : `/chat/${selectedMember.id}`}
                className="mt-2 inline-block text-[12px] font-medium text-accent-ink hover:underline"
              >
                Open chat
              </Link>
            </div>
          )}
          {unavailable.length > 0 && (
            <>
              <h2 className="px-4 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wide text-faint">Unavailable</h2>
              {unavailable.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <AgentAvatar agent={a} size="md" showStatus />
                  <div>
                    <div className="text-[13px] font-medium text-ink">{a.name}</div>
                    <div className="text-[11px] text-danger">Model offline · fails closed</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </aside>
      )}
    </div>
  );
}
