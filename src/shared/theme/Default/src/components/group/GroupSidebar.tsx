import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { HomeIcon, PlusIcon, UserMinusIcon, UserPlusIcon, UsersIcon, XIcon } from 'lucide-react';
import { api, type GroupChatSummary } from '@asi-api';
import { AgentAvatar } from '../AgentAvatar';
import { useAgents } from '../../contexts/AgentsContext';
import { useDesk } from '../../contexts/DeskContext';
import { getAgent } from '../../utils/lookup';
import { isChiefId, isUserModerator, USER_MODERATOR_ID } from '../../utils/withChief';
import { councilRoster } from './councilRoster';

const rowClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 ${isActive ? 'bg-accent/10' : 'hover:bg-overlay/[0.04]'}`;

/** Council navigation — named groups + member shortcuts. */
export function GroupSidebar({
  className = '',
  activeGroupId,
  memberIds,
  moderatorId,
  onMembersChange,
  onModeratorChange,
}: {
  className?: string;
  activeGroupId?: string | null;
  memberIds?: string[];
  moderatorId?: string | null;
  onMembersChange?: (ids: string[]) => void;
  onModeratorChange?: (moderatorId: string) => void;
}) {
  const agents = useAgents();
  const { isTeamMode, boardIds } = useDesk();
  const navigate = useNavigate();
  const ids = memberIds?.length ? memberIds : boardIds;
  const members = councilRoster(ids);
  const [groups, setGroups] = useState<GroupChatSummary[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const modId = moderatorId ?? 'chief';
  const modLabel = isUserModerator(modId) ? 'You' : getAgent(modId)?.name ?? modId;

  const refreshGroups = useCallback(() => {
    api
      .listGroups()
      .then((r) => setGroups(r.groups))
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  const createGroup = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await api.createGroup({ name, memberIds: ids, activate: true });
      setNewName('');
      setCreateOpen(false);
      setGroups(res.groups);
      navigate(`/group/${res.group.id}`);
    } catch {
      /* keep form open */
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (agentId: string) => {
    if (!activeGroupId || isChiefId(agentId) || busy) return;
    setBusy(true);
    try {
      const g = await api.addGroupMember(agentId, activeGroupId);
      onMembersChange?.(g.memberIds);
      setPickOpen(false);
      refreshGroups();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (agentId: string) => {
    if (!activeGroupId || isChiefId(agentId) || busy) return;
    setBusy(true);
    try {
      const g = await api.removeGroupMember(agentId, activeGroupId);
      onMembersChange?.(g.memberIds);
      refreshGroups();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const available = agents.filter((a) => !isChiefId(a.id) && !ids.includes(a.id));

  return (
    <aside className={`min-h-0 flex-col border-r border-line bg-surface ${className}`} aria-label="Council">
      <div className="min-h-0 flex-1 overflow-y-auto pb-24">
        <h2 className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-faint">Groups</h2>
        <ul>
          {groups.map((g) => (
            <li key={g.id}>
              <NavLink to={`/group/${g.id}`} className={rowClass}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn/10 text-warn">
                  <UsersIcon size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{g.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {g.memberIds.length} members · {g.session}
                  </span>
                </div>
              </NavLink>
            </li>
          ))}
          {groups.length === 0 && (
            <li>
              <NavLink to="/group" className={rowClass} end>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn/10 text-warn">
                  <UsersIcon size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">Group council</span>
                  <span className="block truncate text-[12px] text-muted">Meeting & decisions</span>
                </div>
              </NavLink>
            </li>
          )}
          <li>
            <Link
              to="/"
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-muted hover:bg-overlay/[0.04] hover:text-ink"
            >
              <HomeIcon size={16} aria-hidden="true" /> Back to Home
            </Link>
          </li>
        </ul>

        {activeGroupId && (
          <div className="mx-4 mt-4 rounded-lg bg-overlay/[0.03] p-3 ring-1 ring-line">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Moderator</p>
            <p className="mt-1 text-[13px] font-medium text-ink">{modLabel}</p>
            {isTeamMode && onModeratorChange && (
              <select
                value={modId}
                onChange={(e) => onModeratorChange(e.target.value)}
                className="mt-2 w-full rounded-md bg-surface px-2 py-1.5 text-[12px] text-ink ring-1 ring-line focus:outline-none focus:ring-accent/40"
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
          </div>
        )}

        {members.length > 0 && (
          <>
            <h2 className="px-4 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wide text-faint">
              {isTeamMode ? 'Voting members' : 'Council members'}
            </h2>
            {!isTeamMode && (
              <p className="px-4 pb-2 text-[11px] text-muted">
                Super: read-only — switch to Multi or Pro to vote and message.
              </p>
            )}
            <ul>
              {members.map((a) => (
                <li key={a.id} className="group/row flex items-center">
                  <Link
                    to={a.isChief ? '/chat/chief' : `/chat/${a.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 hover:bg-overlay/[0.04]"
                  >
                    <AgentAvatar agent={a} size="md" showStatus />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-ink">
                        {a.name}
                        {modId === a.id ? (
                          <span className="ml-1 text-[10px] font-semibold uppercase text-accent-ink">Mod</span>
                        ) : null}
                      </div>
                      <div className="truncate text-[12px] text-muted">{a.currentTask}</div>
                    </div>
                  </Link>
                  {isTeamMode && activeGroupId && !isChiefId(a.id) && (
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
          </>
        )}

        <div className="relative mx-4 mt-5 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => {
              setPickOpen(true);
              setAddOpen(false);
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent/10 py-2 text-[13px] font-medium text-accent-ink ring-1 ring-accent/30 transition-colors duration-150 hover:bg-accent/15"
          >
            <UserPlusIcon size={14} aria-hidden="true" /> Add agent
          </button>
          <button
            type="button"
            onClick={() => setAddOpen((o) => !o)}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium text-muted ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.04] hover:text-ink"
          >
            <PlusIcon size={14} aria-hidden="true" /> More…
          </button>
          {addOpen && (
            <ul className="absolute bottom-full left-0 right-0 z-10 mb-1 overflow-hidden rounded-lg bg-surface py-1 shadow-lg ring-1 ring-line">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    setCreateOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-overlay/[0.04]"
                >
                  <UsersIcon size={14} aria-hidden="true" /> New group chat
                </button>
              </li>
              <li>
                <Link
                  to="/board"
                  onClick={() => setAddOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink hover:bg-overlay/[0.04]"
                >
                  <UserPlusIcon size={14} aria-hidden="true" /> Edit board roster
                </Link>
              </li>
            </ul>
          )}
        </div>

        {createOpen && (
          <div className="mx-4 mt-3 rounded-lg bg-overlay/[0.03] p-3 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-semibold text-ink">New group</p>
              <button type="button" onClick={() => setCreateOpen(false)} aria-label="Close" className="text-faint hover:text-ink">
                <XIcon size={14} />
              </button>
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-md bg-surface px-2.5 py-1.5 text-[13px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-accent/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createGroup();
              }}
            />
            <button
              type="button"
              disabled={!newName.trim() || busy}
              onClick={() => void createGroup()}
              className="mt-2 w-full rounded-md bg-accent-strong py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
            >
              Create
            </button>
          </div>
        )}

        {pickOpen && (
          <div className="mx-4 mt-3 rounded-lg bg-overlay/[0.03] p-3 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-semibold text-ink">Add agent</p>
              <button type="button" onClick={() => setPickOpen(false)} aria-label="Close" className="text-faint hover:text-ink">
                <XIcon size={14} />
              </button>
            </div>
            {available.length === 0 ? (
              <p className="text-[12px] text-muted">Everyone is already in this group.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {available.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => void addMember(a.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-overlay/[0.05]"
                    >
                      <AgentAvatar agent={a} size="sm" showStatus />
                      <span className="truncate text-[13px] text-ink">{a.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
