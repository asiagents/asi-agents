import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRightIcon, MessageSquareIcon, UsersIcon } from 'lucide-react';
import { AgentLoop } from '../AgentAvatar';
import { ModelChip } from '../ModelChip';
import { useDesk } from '../../contexts/DeskContext';
import { getAgent } from '../../utils/lookup';

const starters = ['What can you help me with?', 'Summarize my inbox', "What's waiting on me?"];

/** Super Agent home: one thread with Chief is the whole point. No org, no board. */
export function SuperHero() {
  const chief = getAgent('chief');
  const { agentModels, openApprovals, routerOffline } = useDesk();
  const navigate = useNavigate();

  if (!chief) {
    return (
      <section aria-label="No agents yet" className="mb-6 rounded-card bg-surface p-5 ring-1 ring-line md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent-ink">
            <UsersIcon size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-ink">No agents yet</h2>
            <p className="mt-1 text-sm text-muted">Add agents to the on-disk registry or run a scan. The Agents page shows the live roster.</p>
            <Link to="/agents?create=1" className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2">
              Create agent
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Your thread with Chief" className="mb-6 grid gap-5 rounded-card bg-surface p-5 ring-1 ring-line md:grid-cols-[168px_minmax(0,1fr)] md:p-6">
      <div className="h-40 w-40 overflow-hidden rounded-2xl bg-[#1f2433] md:h-[168px] md:w-[168px]">
        <AgentLoop agent={chief} alt="Chief" />
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-ink">Chief <span className="font-normal text-muted">[Lead]</span></h2>
          <ModelChip id={routerOffline ? 'offline' : agentModels.chief} size="xs" />
        </div>
        <p className="mt-1 text-sm text-muted">{chief.currentTask}. Specialists join only through handoffs you can see.</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {starters.map((s) =>
          <li key={s}>
              <button
              type="button"
              onClick={() => navigate('/chat/chief')}
              className="rounded-full bg-bg px-3 py-1.5 text-[13px] text-ink ring-1 ring-line transition-colors duration-150 hover:ring-accent/40">
              
                {s}
              </button>
            </li>
          )}
        </ul>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
          <Link to="/chat/chief" className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2">
            <MessageSquareIcon size={15} aria-hidden="true" /> Continue with Chief
          </Link>
          {openApprovals > 0 &&
          <Link to="/chat/chief" className="inline-flex items-center gap-1 text-[13px] font-medium text-warn hover:underline">
              {openApprovals} waiting on you in chat <ArrowRightIcon size={13} aria-hidden="true" />
            </Link>
          }
        </div>
      </div>
    </section>);

}