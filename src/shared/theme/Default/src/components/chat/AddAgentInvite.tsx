import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, UserPlusIcon, XIcon } from 'lucide-react';
import { api } from '@asi-api';
import { AgentAvatar } from '../AgentAvatar';
import { useAgents } from '../../contexts/AgentsContext';
import { useDesk } from '../../contexts/DeskContext';
import { CUSTOM_SET, usePro } from '../../contexts/ProContext';
import { isChiefId } from '../../utils/withChief';
import type { Agent } from '../../types/agents';
import type { ProAgent } from '../../types/pro';

type Variant = 'button' | 'block';

/**
 * Multi / Pro: hire or pick an agent into the chat roster / Custom Pro set.
 * Do not render in Super (Chief + visible handoffs only).
 */
export function AddAgentInvite({
  variant = 'button',
  className = '',
  open: openProp,
  onOpenChange,
}: {
  variant?: Variant;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const agents = useAgents();
  const { mode, isTeamMode } = useDesk();
  const { activeSetId, activeAgents, setActiveSet, addCustomAgent, customAgents } = usePro();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rosterIds, setRosterIds] = useState<string[] | null>(null);
  const [rosterFiltered, setRosterFiltered] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const open = openProp ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (openProp === undefined) setInternalOpen(next);
    },
    [onOpenChange, openProp]
  );

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

  useEffect(() => {
    if (!isTeamMode) return;
    refreshRoster();
  }, [isTeamMode, refreshRoster]);

  const listedIds = useMemo(() => {
    if (mode === 'pro') {
      return new Set([...activeAgents.map((a) => a.id), ...customAgents.map((a) => a.id)]);
    }
    if (rosterFiltered && rosterIds) return new Set(rosterIds);
    return new Set(agents.filter((a) => !isChiefId(a.id)).map((a) => a.id));
  }, [mode, activeAgents, customAgents, rosterFiltered, rosterIds, agents]);

  const available = useMemo(
    () => agents.filter((a) => !isChiefId(a.id) && !listedIds.has(a.id)),
    [agents, listedIds]
  );

  if (!isTeamMode) return null;

  const addMulti = async (agentId: string) => {
    if (busy || isChiefId(agentId)) return;
    setBusy(true);
    setHint(null);
    try {
      const r = await api.addChatRosterMember(agentId);
      setRosterFiltered(r.filtered);
      setRosterIds(r.agentIds);
      setOpen(false);
      navigate(`/chat/${agentId}`);
    } catch {
      setHint('Could not add agent — API unavailable.');
    } finally {
      setBusy(false);
    }
  };

  const agentToProStub = (a: Agent): Omit<ProAgent, 'id' | 'categoryId'> => ({
    name: a.name,
    role: a.roleTag || a.role || 'Specialist',
    look: 'coder',
    height: 'mid',
    skills: a.skills.filter((s) => s.enabled).map((s) => s.name).slice(0, 8),
    model: a.primary,
    deskAgentId: a.id,
  });

  const addPro = (agent: Agent) => {
    if (busy || isChiefId(agent.id)) return;
    setBusy(true);
    setHint(null);
    try {
      if (activeSetId !== CUSTOM_SET) setActiveSet(CUSTOM_SET);
      addCustomAgent(agentToProStub(agent));
      setOpen(false);
      navigate('/settings/pro');
    } catch {
      setHint('Could not add to Custom Pro set.');
    } finally {
      setBusy(false);
    }
  };

  const onPick = (a: Agent) => {
    if (mode === 'pro') addPro(a);
    else void addMulti(a.id);
  };

  const panel = (
    <div className="rounded-lg bg-surface p-3 shadow-lg ring-1 ring-line">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-ink">
          {mode === 'pro' ? 'Add to Custom Pro set' : 'Add agent to chat'}
        </p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-faint hover:text-ink">
          <XIcon size={14} />
        </button>
      </div>
      {mode === 'pro' && activeSetId !== CUSTOM_SET ? (
        <p className="mb-2 text-[11px] leading-relaxed text-muted">
          Preset sets are fixed. Picking someone switches you to{' '}
          <span className="font-medium text-ink">Custom</span> and adds them there.
        </p>
      ) : null}
      {available.length === 0 ? (
        <p className="text-[12px] text-muted">
          Everyone on the roster is already listed.{' '}
          <Link to="/agents?create=1" className="font-medium text-accent-ink hover:underline" onClick={() => setOpen(false)}>
            Hire a new agent
          </Link>
        </p>
      ) : (
        <ul className="max-h-52 space-y-1 overflow-y-auto">
          {available.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(a)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-overlay/[0.05] disabled:opacity-40"
              >
                <AgentAvatar agent={a} size="sm" showStatus />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{a.name}</span>
                <span className="shrink-0 text-[11px] text-faint">[{a.roleTag}]</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2 text-[12px]">
        <Link
          to="/agents?create=1"
          onClick={() => setOpen(false)}
          className="font-medium text-accent-ink hover:underline"
        >
          Hire / create agent
        </Link>
        <Link to="/group" onClick={() => setOpen(false)} className="font-medium text-accent-ink hover:underline">
          Invite to Group council
        </Link>
        {mode === 'pro' ? (
          <Link
            to="/settings/pro"
            onClick={() => setOpen(false)}
            className="font-medium text-accent-ink hover:underline"
          >
            Pro set builder
          </Link>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-[11px] text-danger">{hint}</p> : null}
    </div>
  );

  if (variant === 'block') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent/10 py-2 text-[13px] font-medium text-accent-ink ring-1 ring-accent/30 transition-colors duration-150 hover:bg-accent/15"
        >
          <UserPlusIcon size={14} aria-hidden="true" />
          Add agent
        </button>
        {open ? <div className="mt-2">{panel}</div> : null}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title="Add agent to chat or council"
        className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-[12px] font-medium text-accent-ink ring-1 ring-accent/30 transition-colors duration-150 hover:bg-accent/15"
      >
        <PlusIcon size={13} aria-hidden="true" />
        Add agent
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-[min(20rem,calc(100vw-2rem))]">{panel}</div>
      ) : null}
    </div>
  );
}
