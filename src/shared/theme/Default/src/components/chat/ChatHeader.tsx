import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CpuIcon, EraserIcon, SparklesIcon } from 'lucide-react';
import { AgentAvatar } from '../AgentAvatar';
import { ModelChip } from '../ModelChip';
import { PanicButton } from './PanicButton';
import { AddAgentInvite } from './AddAgentInvite';
import { laneOf } from '../../utils/lookup';
import { formatAgentDisplayName, formatAgentRoleChip } from '../../utils/agentDisplay';
import type { Agent } from '../../types/agents';
import type { NextUp } from '../../types/chat';
import type { ModelId } from '../../types/models';

interface ChatHeaderProps {
  agent: Agent;
  title?: string;
  /** Exact Pro set name (e.g. Education), not a generic label. */
  setName?: string;
  model: ModelId;
  nextUp: NextUp | null;
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  /** Persistently clear messages via API (confirm in header). */
  onClearChat?: () => void | Promise<void>;
  clearBusy?: boolean;
  /** Multi / Pro only — surface roster invite in chat chrome. */
  showAddAgent?: boolean;
}

function NextUpStrip({ nextUp }: {nextUp: NextUp;}) {
  const cls =
  'flex w-full items-center gap-2 border-t border-line bg-accent/[0.05] px-4 py-2 text-left text-[12px] transition-colors duration-150 hover:bg-accent/10 md:px-5';
  const inner =
  <>
      <SparklesIcon size={13} className="shrink-0 text-accent-ink" aria-hidden="true" />
      <span className="shrink-0 font-semibold text-accent-ink">Next up</span>
      <span className="truncate text-ink">{nextUp.label}</span>
      <span className="hidden truncate text-muted sm:inline">· {nextUp.detail}</span>
      <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-accent-ink">
        {nextUp.targetId ? 'Jump' : 'Open'} <ArrowRightIcon size={12} aria-hidden="true" />
      </span>
    </>;

  if (nextUp.targetId) {
    return (
      <button
        type="button"
        className={cls}
        onClick={() => document.getElementById(nextUp.targetId!)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
        
        {inner}
      </button>);

  }
  return (
    <Link to={nextUp.to ?? '/'} className={cls}>
      {inner}
    </Link>);

}

export function ChatHeader({
  agent,
  title: _title,
  setName,
  model,
  nextUp,
  panelOpen = false,
  onTogglePanel,
  onClearChat,
  clearBusy = false,
  showAddAgent = false,
}: ChatHeaderProps) {
  const offline = agent.status === 'offline';
  const lane = laneOf(model);
  const conn = offline ?
  { label: 'Offline', dot: 'bg-danger', text: 'text-danger' } :
  lane === 'local' ?
  { label: 'Local', dot: 'bg-success', text: 'text-success' } :
  { label: 'Online', dot: 'bg-info', text: 'text-info' };
  const [confirmClear, setConfirmClear] = useState(false);
  // Same source of truth as Agent details / message bubbles (live roster after rename).
  const heading = formatAgentDisplayName(agent);
  const roleChip = formatAgentRoleChip(agent);

  const runClear = () => {
    if (!onClearChat || clearBusy) return;
    void Promise.resolve(onClearChat()).finally(() => setConfirmClear(false));
  };

  return (
    <div className="shrink-0 border-b border-line bg-surface">
      <div className="flex items-center gap-3 px-4 py-2.5 md:px-5">
        <AgentAvatar agent={agent} size="md" showStatus />
        <div className="mr-auto min-w-0">
          <h1 className="flex items-baseline gap-1.5 text-[15px] font-semibold text-ink">
            <span className="truncate">{heading}</span>
            {roleChip ? (
              <span className="shrink-0 text-[12px] font-medium text-muted">[{roleChip}]</span>
            ) : null}
          </h1>
          {setName && <p className="text-[12px] text-muted">{setName}</p>}
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <ModelChip id={offline ? 'offline' : model} size="xs" />
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${conn.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${conn.dot}`} aria-hidden="true" />
              {conn.label}
            </span>
          </div>
        </div>
        {onClearChat && (
          confirmClear ? (
            <div className="flex items-center gap-1.5">
              <span className="hidden text-[11px] text-muted sm:inline">Clear all messages?</span>
              <button
                type="button"
                disabled={clearBusy}
                onClick={runClear}
                className="rounded-full bg-danger/15 px-3 py-1.5 text-[12px] font-medium text-danger ring-1 ring-danger/30 disabled:opacity-40"
              >
                {clearBusy ? 'Clearing…' : 'Confirm'}
              </button>
              <button
                type="button"
                disabled={clearBusy}
                onClick={() => setConfirmClear(false)}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium text-muted ring-1 ring-line hover:text-ink disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              title="Clear chat history"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-muted ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.04] hover:text-ink"
            >
              <EraserIcon size={13} aria-hidden="true" />
              Clear…
            </button>
          )
        )}
        {showAddAgent ? <AddAgentInvite variant="button" /> : null}
        {onTogglePanel && (
          <button
            type="button"
            onClick={onTogglePanel}
            aria-expanded={panelOpen}
            aria-controls="agent-panel"
            title={panelOpen ? 'Hide agent details' : 'Show agent details'}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 transition-colors duration-150 ${
              panelOpen
                ? 'bg-accent/10 text-accent-ink ring-accent/30'
                : 'bg-surface text-ink ring-line hover:bg-overlay/[0.04]'
            }`}
          >
            <CpuIcon size={14} aria-hidden="true" />
            <span className="lg:hidden">Details</span>
            <span className="hidden lg:inline">{panelOpen ? 'Hide' : 'Details'}</span>
          </button>
        )}
        <PanicButton />
      </div>
      {nextUp && <NextUpStrip nextUp={nextUp} />}
    </div>);

}
