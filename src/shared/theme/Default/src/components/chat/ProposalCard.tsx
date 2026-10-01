import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, MessageSquareIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import { ModelChip } from '../ModelChip';
import { getAgent } from '../../utils/lookup';
import type { Proposal } from '../../types/chat';

export type Decision = 'open' | 'approved' | 'rejected';

interface ProposalCardProps {
  proposal: Proposal;
  decision: Decision;
  onApprove: () => void;
  onReject: () => void;
  onAskMore: (question: string) => void;
  onReopen: () => void;
  disabled?: boolean;
}

export function ProposalCard({ proposal, decision, onApprove, onReject, onAskMore, onReopen, disabled = false }: ProposalCardProps) {
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const author = getAgent(proposal.by);

  const submitQuestion = () => {
    const q = question.trim();
    if (!q) return;
    onAskMore(q);
    setQuestion('');
    setAsking(false);
  };

  return (
    <div className="border-t border-line px-3 pt-3 md:px-4">
      <section
        aria-label="Council proposal"
        className={`mx-auto max-w-3xl rounded-card p-4 ring-1 ${
        decision === 'approved' ?
        'bg-success/[0.06] ring-success/25' :
        decision === 'rejected' ?
        'bg-danger/[0.05] ring-danger/20' :
        'bg-accent/[0.07] ring-accent/30'}`
        }>
        
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span>Proposal from {author?.name}</span>
          <ModelChip id={proposal.model} size="xs" />
          {decision !== 'open' &&
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
            decision === 'approved' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`
            }>
            
              {decision === 'approved' ? 'Approved' : 'Rejected'}
            </span>
          }
        </div>
        <h3 className="mt-2 text-[15px] font-semibold text-ink">{proposal.title}</h3>
        <ul className="mt-2 space-y-1 text-[13px] text-ink">
          {proposal.points.map((p) =>
          <li key={p} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
              {p}
            </li>
          )}
        </ul>
        <p className="mt-2 text-[12px] text-muted">{proposal.note}</p>

        {decision === 'open' ?
        <div className="mt-3 flex flex-wrap gap-2">
            <button
            type="button"
            onClick={onApprove}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-40">
            
              <CheckIcon size={14} aria-hidden="true" /> Approve
            </button>
            <button
            type="button"
            onClick={() => setAsking((v) => !v)}
            disabled={disabled}
            aria-expanded={asking}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:cursor-not-allowed disabled:opacity-40">
            
              <MessageSquareIcon size={14} aria-hidden="true" /> Ask more
            </button>
            <button
            type="button"
            onClick={onReject}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-danger transition-colors duration-150 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40">
            
              <XIcon size={14} aria-hidden="true" /> Reject
            </button>
          </div> :

        <button
          type="button"
          onClick={onReopen}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink">
          
            <RotateCcwIcon size={13} aria-hidden="true" /> Reopen for discussion
          </button>
        }

        <AnimatePresence initial={false}>
          {asking && decision === 'open' &&
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              submitQuestion();
            }}>
            
              <div className="mt-3 flex gap-2">
                <label htmlFor="ask-more" className="sr-only">
                  What should the council clarify?
                </label>
                <input
                id="ask-more"
                autoFocus
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What should the council clarify?"
                className="min-w-0 flex-1 rounded-lg bg-bg px-3 py-2 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60" />
              
                <button
                type="submit"
                disabled={!question.trim()}
                className="rounded-lg bg-raised px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.06] disabled:opacity-40">
                
                  Ask
                </button>
              </div>
            </motion.form>
          }
        </AnimatePresence>
      </section>
    </div>);

}