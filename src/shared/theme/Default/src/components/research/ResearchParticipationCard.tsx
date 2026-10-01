import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareIcon, UsersIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ResearchBriefValues } from '../../utils/researchBrief';
import { PARTICIPATION_PROMPTS } from '../../utils/researchBrief';

export interface ResearchParticipationState {
  researchId: string;
  question: string;
  brief: ResearchBriefValues;
  answeredIds: string[];
}

interface ResearchParticipationCardProps {
  session: ResearchParticipationState;
  disabled?: boolean;
  onSubmit: (promptId: string, promptText: string, answer: string) => void;
  onDismissPrompt?: (promptId: string) => void;
}

/** Inline prompts so the user can join research — notes/votes go to the agent thread. */
export function ResearchParticipationCard({
  session,
  disabled,
  onSubmit,
  onDismissPrompt,
}: ResearchParticipationCardProps) {
  const open = PARTICIPATION_PROMPTS.filter((p) => !session.answeredIds.includes(p.id));
  const [activeId, setActiveId] = useState<string | null>(open[0]?.id ?? null);
  const [draft, setDraft] = useState('');
  const active = PARTICIPATION_PROMPTS.find((p) => p.id === activeId) ?? open[0];

  if (!session.brief.participate) return null;

  if (open.length === 0) {
    return (
      <div className="ml-0 rounded-card bg-success/[0.06] p-4 ring-1 ring-success/25 md:ml-0">
        <div className="flex items-center gap-2 text-[12px] font-medium text-success">
          <UsersIcon size={14} aria-hidden="true" />
          You answered the research prompts
        </div>
        <p className="mt-1 text-[13px] text-muted">
          Agents see your notes in this thread. Track remaining steps on{' '}
          <Link to="/tasks" className="font-medium text-accent-ink hover:underline">
            Tasks
          </Link>
          .
        </p>
      </div>
    );
  }

  const submit = () => {
    const text = draft.trim();
    if (!text || !active || disabled) return;
    onSubmit(active.id, active.text, text);
    setDraft('');
    const next = open.find((p) => p.id !== active.id);
    setActiveId(next?.id ?? null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-card bg-accent/[0.07] p-4 ring-1 ring-accent/30"
      role="group"
      aria-label="Research participation"
    >
      <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-accent-ink">
        <UsersIcon size={14} aria-hidden="true" />
        Participate in research
        <Link to="/tasks" className="ml-auto text-[11px] font-medium text-muted hover:text-accent-ink hover:underline">
          View tasks
        </Link>
      </div>
      <p className="mt-1 text-[12px] text-muted line-clamp-2">{session.question}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PARTICIPATION_PROMPTS.map((p) => {
          const done = session.answeredIds.includes(p.id);
          const on = active?.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={done}
              onClick={() => {
                setActiveId(p.id);
                setDraft('');
              }}
              className={`rounded-lg px-2 py-1 text-[11px] font-medium ring-1 transition-colors ${
                done
                  ? 'bg-success/10 text-success ring-success/25'
                  : on
                    ? 'bg-accent/15 text-accent-ink ring-accent/40'
                    : 'bg-surface text-muted ring-line hover:text-ink'
              }`}
            >
              {done ? 'Done · ' : ''}
              {p.id}
            </button>
          );
        })}
      </div>

      {active && (
        <>
          <p className="mt-3 text-[13px] font-medium text-ink">{active.text}</p>
          <div className="mt-2 flex gap-2">
            <label htmlFor="research-participate" className="sr-only">
              Your research input
            </label>
            <input
              id="research-participate"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={disabled}
              placeholder="Add a note, vote, or answer…"
              className="min-w-0 flex-1 rounded-lg bg-bg px-3 py-2 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60 disabled:opacity-40"
            />
            <button
              type="button"
              disabled={disabled || !draft.trim()}
              onClick={submit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-2 text-[13px] font-medium text-white hover:bg-accent-2 disabled:opacity-40"
            >
              <MessageSquareIcon size={14} aria-hidden="true" />
              Send
            </button>
          </div>
          {onDismissPrompt && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDismissPrompt(active.id)}
              className="mt-2 text-[12px] font-medium text-muted hover:text-ink"
            >
              Skip this prompt
            </button>
          )}
        </>
      )}
    </motion.div>
  );
}
