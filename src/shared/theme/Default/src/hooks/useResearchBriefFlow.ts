import { useCallback, useRef, useState } from 'react';
import { api } from '@asi-api';
import { useDesk } from '../contexts/DeskContext';
import {
  formatParticipationReply,
  formatResearchBriefMessage,
  PARTICIPATION_PROMPTS,
  isMultiAgentResearchType,
  type ResearchBriefValues,
} from '../utils/researchBrief';
import type { ResearchParticipationState } from '../components/research/ResearchParticipationCard';

type PendingBrief = {
  question: string;
  agentId: string;
  agentLabel: string;
};

type SendFn = (text: string, modelId?: string) => void | Promise<void>;
type AppendSystemFn = (text: string, tone?: 'neutral' | 'success' | 'danger') => void;
type ReloadFn = () => void | Promise<void>;
type NavigateFn = (agentId: string) => void;

const PIPELINE_STEPS = new Set(['gather', 'draft', 'review', 'report']);
const POLL_MS = 1400;
const POLL_MAX_MS = 12 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForResearchSettled(
  researchId: string,
  reloadThread: ReloadFn | undefined,
  signal: { cancelled: boolean }
): Promise<'done' | 'blocked' | 'timeout'> {
  const started = Date.now();
  while (!signal.cancelled && Date.now() - started < POLL_MAX_MS) {
    try {
      await reloadThread?.();
      const { tasks } = await api.tasks();
      const linked = tasks.filter(
        (t) => t.researchId === researchId && t.step && PIPELINE_STEPS.has(t.step)
      );
      if (linked.length > 0) {
        const blocked = linked.some((t) => t.status === 'blocked');
        if (blocked) return 'blocked';
        const open = linked.some((t) => t.status === 'pending' || t.status === 'ongoing');
        if (!open) return 'done';
      }
    } catch {
      /* keep polling — API blips shouldn't kill the wait */
    }
    await sleep(POLL_MS);
  }
  return signal.cancelled ? 'done' : 'timeout';
}

/**
 * Intercepts Research sends: opens brief → POST /api/tasks/research (runs gather→draft→report)
 * → optional participation. Extra questions while a brief is open are queued.
 *
 * On confirm: closes the brief modal immediately, focuses the agent chat, and polls
 * the thread so fan-out / draft / report progress is visible while research runs.
 */
export function useResearchBriefFlow(
  send: SendFn,
  modelId?: string,
  appendSystem?: AppendSystemFn,
  reloadThread?: ReloadFn,
  navigateToAgent?: NavigateFn
) {
  const { addTodo } = useDesk();
  const [queue, setQueue] = useState<PendingBrief[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [participation, setParticipation] = useState<ResearchParticipationState | null>(null);
  const sendRef = useRef(send);
  const appendRef = useRef(appendSystem);
  const reloadRef = useRef(reloadThread);
  const navigateRef = useRef(navigateToAgent);
  const modelRef = useRef(modelId);
  const pollSignal = useRef({ cancelled: false });
  sendRef.current = send;
  appendRef.current = appendSystem;
  reloadRef.current = reloadThread;
  navigateRef.current = navigateToAgent;
  modelRef.current = modelId;

  const pending = queue[0] ?? null;
  const queuedCount = Math.max(0, queue.length - 1);
  const queuedQuestions = queue.slice(1).map((q) => q.question);

  const openBrief = useCallback((question: string, agentId: string, agentLabel?: string) => {
    const next: PendingBrief = {
      question: question.trim(),
      agentId,
      agentLabel: agentLabel ?? 'Research',
    };
    if (!next.question) return;
    setQueue((prev) => {
      if (prev.length === 0) return [next];
      return [...prev, next];
    });
  }, []);

  const queueBrief = useCallback((question: string) => {
    if (!pending) return;
    const q = question.trim();
    if (!q) return;
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      return [
        ...prev,
        { question: q, agentId: pending.agentId, agentLabel: pending.agentLabel },
      ];
    });
    appendRef.current?.(`Queued research · “${q.slice(0, 48)}${q.length > 48 ? '…' : ''}”`, 'neutral');
  }, [pending]);

  const cancelBrief = useCallback(() => {
    if (submitting) return;
    setQueue((prev) => prev.slice(1));
  }, [submitting]);

  const skipBrief = useCallback(() => {
    if (!pending || submitting) return;
    const q = pending.question;
    setQueue((prev) => prev.slice(1));
    void sendRef.current(q, modelRef.current);
  }, [pending, submitting]);

  const confirmBrief = useCallback(
    async (brief: ResearchBriefValues) => {
      if (!pending || submitting) return;
      setSubmitting(true);
      const { question, agentId, agentLabel } = pending;
      const multi = isMultiAgentResearchType(brief.type);

      // Close the brief modal immediately so the user can see the chat.
      setQueue((prev) => prev.slice(1));
      setRunning(true);
      navigateRef.current?.(agentId);
      appendRef.current?.(
        multi
          ? `Deep research started for ${agentLabel} — watching this chat for virtual-agent progress…`
          : `Research started for ${agentLabel} — watching this chat for gather → draft → report…`,
        'neutral'
      );
      // Nudge focus back to the feed (modal had stolen it).
      window.setTimeout(() => {
        const feed = document.querySelector('[role="log"]') as HTMLElement | null;
        feed?.focus?.();
        feed?.scrollTo?.({ top: feed.scrollHeight, behavior: 'smooth' });
      }, 60);

      pollSignal.current = { cancelled: false };
      let pollLoop: Promise<'done' | 'blocked' | 'timeout'> | null = null;

      try {
        const res = await api.createResearchTasks({
          question,
          agentId,
          type: brief.type,
          depth: brief.depth,
          selection: brief.selection,
          format: brief.format,
          participate: brief.participate,
          maxVirtualAgents: brief.maxVirtualAgents,
          preferFree: true,
          liveWeb: brief.liveWeb,
        });
        const openCount = res.tasks.filter(
          (t) => t.status === 'pending' || t.status === 'ongoing'
        ).length;
        addTodo(`Research: ${question.slice(0, 60)}${question.length > 60 ? '…' : ''}`);

        const targetAgent = res.agentId?.trim() || agentId;
        if (targetAgent !== agentId) {
          navigateRef.current?.(targetAgent);
        }

        const ranPipeline = res.stub === false || res.pipelineOk != null || res.report != null || res.pipelineRunning;
        if (ranPipeline) {
          // Sync path (legacy): pipeline already finished in the POST.
          if (res.pipelineRunning !== true && res.pipelineOk != null) {
            await reloadRef.current?.();
            if (res.pipelineOk && res.report) {
              const multiNote =
                res.multiAgent && res.virtualPool?.agents?.length
                  ? ` · ${res.virtualPool.agents.length} virtual agent${res.virtualPool.agents.length === 1 ? '' : 's'}`
                  : '';
              const webNote =
                res.webSearchAvailable === false
                  ? ' · live web skipped'
                  : res.webSearchAvailable === true
                    ? ' · live web via Desk'
                    : '';
              appendRef.current?.(
                `Research report ready for ${agentLabel}${multiNote} · see chat + Tasks` + webNote,
                'success'
              );
            } else {
              appendRef.current?.(
                res.message ??
                  res.error ??
                  `Research pipeline stopped for ${agentLabel} — no report invented (fail closed). Check Tasks.`,
                'danger'
              );
            }
          } else {
            // Async path: POST returned immediately — poll chat + Tasks until settled.
            appendRef.current?.(
              res.message ??
                `Research pipeline running for ${agentLabel} — progress streams into this thread (also on Tasks).`,
              'neutral'
            );
            await reloadRef.current?.();
            pollLoop = waitForResearchSettled(res.researchId, () => reloadRef.current?.(), pollSignal.current);
            const outcome = await pollLoop;
            await reloadRef.current?.();
            if (outcome === 'done') {
              appendRef.current?.(
                `Research finished for ${agentLabel} — see the report above and Tasks.`,
                'success'
              );
            } else if (outcome === 'blocked') {
              appendRef.current?.(
                `Research stopped for ${agentLabel} (fail closed) — check the thread and Tasks for details.`,
                'danger'
              );
            } else {
              appendRef.current?.(
                `Research still running for ${agentLabel} — keep this chat open or check Tasks.`,
                'neutral'
              );
            }
          }
        } else {
          appendRef.current?.(
            `Research brief saved · ${openCount} open task${openCount === 1 ? '' : 's'} for ${agentLabel} on Tasks` +
              (res.stub ? ' (pipeline stubbed — mark steps done as you go)' : ''),
            'success'
          );
          await sendRef.current(formatResearchBriefMessage(question, brief), modelRef.current);
        }

        if (brief.participate) {
          setParticipation({
            researchId: res.researchId,
            question,
            brief,
            answeredIds: [],
          });
        }
      } catch {
        appendRef.current?.(
          'Could not create research tasks — is the API running on :3445? Question was not sent.',
          'danger'
        );
      } finally {
        pollSignal.current.cancelled = true;
        setSubmitting(false);
        setRunning(false);
        await reloadRef.current?.();
      }
    },
    [pending, submitting, addTodo]
  );

  const markPromptDone = useCallback((promptId: string) => {
    setParticipation((prev) =>
      prev && !prev.answeredIds.includes(promptId)
        ? { ...prev, answeredIds: [...prev.answeredIds, promptId] }
        : prev
    );
  }, []);

  const submitParticipation = useCallback(
    async (promptId: string, promptText: string, answer: string) => {
      if (!participation) return;
      const nextAnswered = participation.answeredIds.includes(promptId)
        ? participation.answeredIds
        : [...participation.answeredIds, promptId];
      markPromptDone(promptId);
      try {
        const { tasks } = await api.tasks();
        const participateTask = tasks.find(
          (t) =>
            t.researchId === participation.researchId &&
            t.step === 'participate' &&
            t.status !== 'completed' &&
            t.status !== 'blocked'
        );
        if (participateTask) {
          const remaining = PARTICIPATION_PROMPTS.length - nextAnswered.length;
          if (remaining <= 0) {
            await api.patchTask(participateTask.id, {
              status: 'done',
              note: 'User finished participation prompts',
            });
          } else {
            await api.patchTask(participateTask.id, {
              note: `Answered ${promptId}; ${remaining} prompt(s) left`,
            });
          }
        }
      } catch {
        /* best-effort */
      }
      await sendRef.current(
        formatParticipationReply(promptId, promptText, answer),
        modelRef.current
      );
    },
    [participation, markPromptDone]
  );

  return {
    pending,
    submitting,
    running,
    participation,
    queuedCount,
    queuedQuestions,
    openBrief,
    queueBrief,
    cancelBrief,
    skipBrief,
    confirmBrief,
    submitParticipation,
    dismissPrompt: markPromptDone,
  };
}
