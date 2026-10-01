import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, ArrowRightLeftIcon, ShieldAlertIcon } from 'lucide-react';
import { ModelChip } from '../ModelChip';
import { getAgent } from '../../utils/lookup';
import type { ChatHandoff } from '../../types/chat';

interface HandoffBeatProps {
  item: ChatHandoff;
  onDecision?: (id: string, approve: boolean) => void;
}

export function HandoffBeat({ item, onDecision }: HandoffBeatProps) {
  const from = getAgent(item.from);
  const to = getAgent(item.to);
  const self = item.from === item.to;

  if (item.state === 'awaiting') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="ml-11 rounded-card bg-warn/[0.06] p-4 ring-1 ring-warn/25"
        role="group"
        aria-label="Handoff waiting for approval">
        
        <div className="flex items-center gap-2 text-[13px] font-medium text-warn">
          <ShieldAlertIcon size={15} aria-hidden="true" />
          Handoff waiting on you
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-ink">
          <span className="font-medium">{from?.name}</span>
          <span className="text-muted">{self ? 'wants to escalate to' : `wants to hand off to ${to?.name} on`}</span>
          <ModelChip id={item.model} size="xs" />
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{item.reason}</p>
        {onDecision &&
        <div className="mt-3 flex flex-wrap gap-2">
            <button
            type="button"
            onClick={() => onDecision(item.id, true)}
            className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2">
            
              Approve once
            </button>
            <button
            type="button"
            onClick={() => onDecision(item.id, false)}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
            
              Keep local
            </button>
          </div>
        }
      </motion.div>);

  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3">
      
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-overlay/15 text-muted" aria-hidden="true">
        <ArrowRightLeftIcon size={14} />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="text-muted">Handoff</span>
          <span className="font-medium text-ink">{from?.name}</span>
          <ArrowRightIcon size={12} className="text-faint" aria-hidden="true" />
          {!self && <span className="font-medium text-ink">{to?.name}</span>}
          <ModelChip id={item.model} size="xs" />
          {item.state === 'declined' &&
          <span className="text-[11px] font-medium text-muted">Declined · stayed local</span>
          }
          <span className="text-[11px] text-faint">{item.time}</span>
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{item.reason}</p>
      </div>
    </motion.div>);

}