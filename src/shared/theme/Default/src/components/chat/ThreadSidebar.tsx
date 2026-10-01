import { useAgents } from '../../contexts/AgentsContext';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { MessagesSquareIcon, PlusIcon, UserMinusIcon, UserPlusIcon, UsersIcon, XIcon } from 'lucide-react';
import { api, type GroupChatSummary } from '@asi-api';
import { AgentAvatar } from '../AgentAvatar';
import { ProAvatar } from '../pro/ProAvatar';
import { builtinAgents } from '../../data/builtinAgents';
import { primaryThreads } from '../../data/chatThreads';
import { useDesk } from '../../contexts/DeskContext';
import { categoryName, usePro } from '../../contexts/ProContext';
import { proThreadAgentId } from '../../utils/proLookup';
import { formatAgentDisplayName } from '../../utils/agentDisplay';
import { isChiefId } from '../../utils/withChief';
import { AddAgentInvite } from './AddAgentInvite';

const rowClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 ${isActive ? 'bg-accent/10' : 'hover:bg-overlay/[0.04]'}`;

/** Left pane — Multi/Pro only (ChatWorkspace hides this in Super). */
export function ThreadSidebar({ className = '' }: { className?: string }) {
  const agents = useAgents();
  const { isTeamMode, mode } = useDesk();
  const { activeAgents, activeSetId } = usePro();
  const navigate = useNavigate();
  const chief = agents.find((a) => a.isChief) ?? builtinAgents.find((a) => a.isChief);
  const [moreOpen, setMoreOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [rosterIds, setRosterIds] = useState<string[] | null>(null);
  const [rosterFiltered, setRosterFiltered] = useState(false);
  const [groups, setGroups] = useState<GroupChatSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const setLabel = mode === 'pro' ? categoryName(activeSetId) : null;

  const refreshRoster = useCallback(() => {
    api
      .chatRoster()
      .then((r) => {
        setRosterFiltered(r.filtered);
        setRosterIds(r.filtered ? r.agentIds : null);
      })
      .catch(() => {
        setRosterFiltered(false);
        setRosterIds(null);
      });
  }, []);

  const refreshGroups = useCallback(() => {
    api
      .listGroups()
      .then((r) => setGroups(r.groups))
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    refreshRoster();
    refreshGroups();
  }, [refreshRoster, refreshGroups]);

  const sidebarAgents = useMemo(() => {
    const rest = agents.filter((a) => !isChiefId(a.id));
    if (!rosterFiltered || rosterIds == null) return rest;
    const allow = new Set(rosterIds);
    return rest.filter((a) => allow.has(a.id));
  }, [agents, rosterFiltered, rosterIds]);

  const removeAgent = async (agentId: string) => {
    if (busy || isChiefId(agentId)) return;
    setBusy(true);
    try {
      const r = await api.removeChatRosterMember(agentId);
      setRosterFiltered(r.filtered);
      setRosterIds(r.agentIds);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await api.createGroup({ name, activate: true });
      setGroups(res.groups);
      setNewGroupName('');
      setCreateGroupOpen(false);
      navigate(`/group/${res.group.id}`);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className={`min-h-0 flex-col border-r border-line bg-surface ${className}`} aria-label="Threads">
      <div className="min-h-0 flex-1 overflow-y-auto pb-24">
        <h2 className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-faint">
          {mode === 'pro' && setLabel ? setLabel : 'Threads'}
        </h2>
        <ul>
          {mode !== 'pro' &&
            primaryThreads.map((t) => (
              <li key={t.id}>
                <NavLink to={`/chat/${t.id}`} className={rowClass}>
                  {t.id === 'chief' && chief ? (
                    <AgentAvatar agent={chief} size="md" showStatus />
                  ) : t.id === 'chief' ? (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-[11px] font-semibold text-accent-ink">
                      CH
                    </span>
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-ink">
                      <MessagesSquareIcon size={17} aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">
                      {t.id === 'chief' && chief ? formatAgentDisplayName(chief) : t.title}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      {t.id === 'chief' && chief ? chief.currentTask || t.subtitle : t.subtitle}
                    </span>
                  </div>
                </NavLink>
              </li>
            ))}
          {isTeamMode && mode !== 'pro' &&
            (groups.length > 0 ? (
              groups.map((g) => (
                <li key={g.id}>
                  <NavLink to={`/group/${g.id}`} className={rowClass}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn/10 text-warn">
                      <UsersIcon size={17} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{g.name}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {g.memberIds.length} members
                      </span>
                    </div>
                  </NavLink>
                </li>
              ))
            ) : (
              <li>
                <NavLink to="/group" className={rowClass}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn/10 text-warn">
                    <UsersIcon size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">Group council</span>
                    <span className="block truncate text-[12px] text-muted">Council meeting</span>
                  </div>
                </NavLink>
              </li>
            ))}
        </ul>

        {mode === 'pro' ? (
          <>
            {activeAgents.length === 0 ? (
              <p className="mx-4 mt-4 text-[12px] leading-relaxed text-muted">
                No agents in {setLabel}.{' '}
                <Link to="/settings/pro" className="font-medium text-accent-ink hover:underline">
                  Choose a set or build your own
                </Link>
              </p>
            ) : (
              <ul>
                {activeAgents.map((a) => (
                  <li key={a.id}>
                    <NavLink to={`/chat/${proThreadAgentId(a.id)}`} className={rowClass}>
                      <ProAvatar agent={a} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[14px] font-medium text-ink">{a.name}</span>
                          <span className="shrink-0 text-[11px] text-faint">({a.role})</span>
                        </div>
                        <div className="truncate text-[12px] text-muted">{setLabel}</div>
                      </div>
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
            {isTeamMode && (
              <p className="mx-4 mt-4 text-[12px] text-muted">
                Council decisions live in{' '}
                <Link to="/group" className="font-medium text-accent-ink hover:underline">
                  Group
                </Link>
                , separate from these specialist threads.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 pb-1 pt-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Agents</h2>
              <span className="text-[11px] text-faint">{sidebarAgents.length}</span>
            </div>
            <ul>
              {sidebarAgents.map((a) => (
                <li key={a.id} className="group/row flex items-center">
                  <NavLink to={`/chat/${a.id}`} className={({ isActive }) => `${rowClass({ isActive })} min-w-0 flex-1`}>
                    <AgentAvatar agent={a} size="md" showStatus />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-medium text-ink">{a.name}</span>
                        <span className="shrink-0 text-[11px] text-faint">[{a.roleTag}]</span>
                      </div>
                      <div
                        className={`truncate text-[12px] ${a.status === 'offline' ? 'text-danger' : 'text-muted'}`}
                      >
                        {a.currentTask}
                      </div>
                    </div>
                  </NavLink>
                  <button
                    type="button"
                    title={`Remove ${a.name} from chat list`}
                    aria-label={`Remove ${a.name} from chat list`}
                    onClick={() => void removeAgent(a.id)}
                    className="mr-3 grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint opacity-0 transition-opacity hover:bg-overlay/[0.06] hover:text-danger group-hover/row:opacity-100"
                  >
                    <UserMinusIcon size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {isTeamMode && (
          <div className="mx-4 mt-5 space-y-2 border-t border-line pt-4">
            <AddAgentInvite variant="block" />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium text-muted ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.04] hover:text-ink"
              >
                <PlusIcon size={14} aria-hidden="true" /> More…
              </button>
              {moreOpen && (
                <ul className="absolute bottom-full left-0 right-0 z-10 mb-1 overflow-hidden rounded-lg bg-surface py-1 shadow-lg ring-1 ring-line">
                  <li>
                    <Link
                      to="/agents?create=1"
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink hover:bg-overlay/[0.04]"
                    >
                      <UserPlusIcon size={14} aria-hidden="true" /> Hire / create agent
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        setCreateGroupOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-overlay/[0.04]"
                    >
                      <UsersIcon size={14} aria-hidden="true" /> New group chat
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        )}

        {createGroupOpen && (
          <div className="mx-4 mt-3 rounded-lg bg-overlay/[0.03] p-3 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-semibold text-ink">New group</p>
              <button
                type="button"
                onClick={() => setCreateGroupOpen(false)}
                aria-label="Close"
                className="text-faint hover:text-ink"
              >
                <XIcon size={14} />
              </button>
            </div>
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-md bg-surface px-2.5 py-1.5 text-[13px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-accent/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createGroup();
              }}
            />
            <button
              type="button"
              disabled={!newGroupName.trim() || busy}
              onClick={() => void createGroup()}
              className="mt-2 w-full rounded-md bg-accent-strong py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
            >
              Create
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
