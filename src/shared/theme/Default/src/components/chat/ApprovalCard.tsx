import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2Icon, ShieldAlertIcon } from 'lucide-react';
import { AgentAvatar } from '../AgentAvatar';
import { ModelChip } from '../ModelChip';
import { getAgent } from '../../utils/lookup';
import type { Approval, ApprovalState } from '../../types/chat';

interface ApprovalCardProps {
  approval: Approval;
  disabled?: boolean;
  onResolve: (state: ApprovalState) => void;
  onAskMore: () => void;
}

const resolvedText: Record<Exclude<ApprovalState, 'open'>, string> = {
  approved: 'Approved once · logged',
  rejected: 'Rejected · nothing happened',
  local: 'Kept local · nothing left this device'
};

const primary =
'rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-40';
const ghost =
'rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:cursor-not-allowed disabled:opacity-40';
const danger =
'rounded-lg px-3 py-1.5 text-[13px] font-medium text-danger transition-colors duration-150 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40';

/** Inline approval inside the chat — the only place approvals are decided. */
export function ApprovalCard({ approval, disabled, onResolve, onAskMore }: ApprovalCardProps) {
  const agent = getAgent(approval.agentId);
  const open = approval.state === 'open';

  return (
    <motion.div
      id={`approval-${approval.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className={`ml-11 scroll-mt-4 rounded-card p-4 ring-1 ${open ? 'bg-warn/[0.06] ring-warn/30' : 'bg-surface ring-line'}`}
      role="group"
      aria-label={`Approval: ${approval.title}`}>
      
      <div className="flex items-center gap-2 text-[12px] font-medium">
        {open ?
        <ShieldAlertIcon size={14} className="text-warn" aria-hidden="true" /> :

        <CheckCircle2Icon size={14} className="text-success" aria-hidden="true" />
        }
        <span className={open ? 'text-warn' : 'text-muted'}>{open ? 'Needs your approval' : resolvedText[approval.state as Exclude<ApprovalState, 'open'>]}</span>
        <span className="ml-auto text-[11px] text-faint">{approval.time}</span>
      </div>
      <div className="mt-2 flex items-start gap-2.5">
        {agent && <AgentAvatar agent={agent} size="sm" />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{approval.title}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{approval.detail}</p>
          {approval.model &&
          <div className="mt-1.5">
              <ModelChip id={approval.model} size="xs" showRole />
            </div>
          }
        </div>
      </div>
      {open &&
      <div className="mt-3 flex flex-wrap gap-2">
          {approval.kind === 'escalation' ?
        <>
              <button type="button" disabled={disabled} className={primary} onClick={() => onResolve('approved')}>Approve once</button>
              <button type="button" disabled={disabled} className={ghost} onClick={() => onResolve('local')}>Keep local</button>
              <button type="button" disabled={disabled} className={ghost} onClick={onAskMore}>Ask more</button>
              <button type="button" disabled={disabled} className={danger} onClick={() => onResolve('rejected')}>Reject</button>
            </> :

        <>
              <button type="button" disabled={disabled} className={primary} onClick={() => onResolve('approved')}>Approve</button>
              <button type="button" disabled={disabled} className={ghost} onClick={onAskMore}>Ask more</button>
              <button type="button" disabled={disabled} className={danger} onClick={() => onResolve('rejected')}>Reject</button>
            </>
        }
        </div>
      }
    </motion.div>);

}