import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ServerOffIcon } from 'lucide-react';
import { ThreadSidebar } from './ThreadSidebar';
import { ChatHeader } from './ChatHeader';
import { ChatFeed } from './ChatFeed';
import { Composer } from './Composer';
import { AgentPanel } from './AgentPanel';
import { ApprovalCard } from './ApprovalCard';
import { ResearchBriefSheet } from '../research/ResearchBriefSheet';
import { ResearchParticipationCard } from '../research/ResearchParticipationCard';
import { LocalBackendAlertBanner } from '../LocalBackendAlertBanner';
import { useAgentsMeta } from '../../contexts/AgentsContext';
import { useDesk } from '../../contexts/DeskContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useFailClosedChatThread } from '../../hooks/useFailClosedChatThread';
import { useLocalBackendAlert } from '../../hooks/useLocalBackendAlert';
import { useResearchBriefFlow } from '../../hooks/useResearchBriefFlow';
import { useChiefThread } from './useChiefThread';
import { useAgentThread } from './useAgentThread';
import { useProThread } from './useProThread';
import { getThread } from '../../utils/threads';
import { getAgent, laneOf } from '../../utils/lookup';
import { usePrefs } from '../../contexts/PrefsContext';
import { useChatModelOptions } from '../../hooks/useChatModelOptions';
import { isProThreadId, proAgentAsCore, proIdFromThread, findProAgent } from '../../utils/proLookup';
import { usePro } from '../../contexts/ProContext';
import { t } from '../../utils/i18n';
import { createId, nowTime } from '../../utils/time';
import { readSidebarOpenPref, STORAGE_KEYS, writeFlag } from '../../utils/storage';
import { shouldOpenResearchBrief } from '../../utils/researchBrief';
import { emitCompanionTyping, rememberLastChatThread } from '../../companion';
import type { ApprovalState, NextUp, ThreadDef } from '../../types/chat';
import type { Agent } from '../../types/agents';
import type { ModelId } from '../../types/models';

export function ChatWorkspace({ threadId }: {threadId: string;}) {
  // Subscribe to roster so /chat/finance resolves after GET /api/agents (not stuck on Chief empty-state).
  const { agents, loading } = useAgentsMeta();
  const { isTeamMode } = useDesk();
  const thread = getThread(threadId, agents);
  // Super: no left threads pane (Chief-primary + handoffs). Multi/Pro keep roster/threads.
  const gridClass = isTeamMode
    ? 'grid h-full w-full md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)_auto] xl:grid-cols-[320px_minmax(0,1fr)_auto]'
    : 'grid h-full w-full lg:grid-cols-[minmax(0,1fr)_auto]';
  return (
    <div className={gridClass}>
      {isTeamMode ? <ThreadSidebar className="hidden md:flex" /> : null}
      {thread ?
      <ThreadPane key={thread.id} thread={thread} agents={agents} /> :
      loading ?
      <div className="grid place-items-center p-6 text-center text-sm text-muted">
          Loading roster…
        </div> :

      <div className="grid place-items-center p-6 text-center text-sm text-muted">
          <div>
            That thread doesn't exist.{' '}
            <Link to="/chat/chief" className="font-medium text-accent-ink hover:underline">Back to Chief</Link>
          </div>
        </div>
      }
    </div>);

}

const outcomeText: Record<Exclude<ApprovalState, 'open'>, string> = {
  approved: 'You approved it once · logged',
  rejected: 'You rejected it · nothing happened',
  local: 'Kept local · nothing left this device'
};

function ThreadPane({ thread, agents }: {thread: ThreadDef; agents: Agent[];}) {
  const navigate = useNavigate();
  const { agentModels, setAgentModel, pausedAt, approvals, resolveApproval, routerOffline, setRouterOffline, localOn, setLocalOn, onlineOn, isTeamMode } = useDesk();
  const { providerKeyStatus } = usePrefs();
  const { options: modelOptions } = useChatModelOptions();
  const cloudKeyReady = Object.values(providerKeyStatus).some((s) => s.configured);
  const { s } = useSettings();
  const { activeAgents } = usePro();
  const { alert: localBackendAlert, runScan: rescanLocalBackend } = useLocalBackendAlert();
  const [agentPanelOpen, setAgentPanelOpen] = useState(() =>
    readSidebarOpenPref(STORAGE_KEYS.agentPanelOpen, false)
  );
  const setPanelOpen = useCallback((open: boolean) => {
    setAgentPanelOpen(open);
    writeFlag(STORAGE_KEYS.agentPanelOpen, open);
  }, []);
  const togglePanel = useCallback(() => {
    setAgentPanelOpen((prev) => {
      const next = !prev;
      writeFlag(STORAGE_KEYS.agentPanelOpen, next);
      return next;
    });
  }, []);
  const proId = isProThreadId(thread.agentId) ? proIdFromThread(thread.agentId) : null;
  const proAgent = proId ? activeAgents.find((a) => a.id === proId) ?? findProAgent(proId) : undefined;
  const coreAgent = proAgent ? proAgentAsCore(proAgent, proAgent.model) : getAgent(thread.agentId, agents);
  if (!coreAgent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-medium text-ink">This thread has no agent on the roster.</p>
        <p className="text-[13px] text-muted">Add agents to the registry, then open Agents.</p>
        <Link to="/agents" className="mt-2 text-sm font-medium text-accent-ink hover:underline">Go to Agents</Link>
      </div>
    );
  }
  const agent = coreAgent;
  const model = proAgent ? proAgent.model : agentModels[agent.id] ?? agent.primary;
  const offline = agent.status === 'offline';
  const threadApprovals = approvals.filter((a) => a.threadId === thread.id);
  const firstOpen = threadApprovals.find((a) => a.state === 'open');

  const liveChief = thread.id === 'chief' || thread.agentId === 'chief';
  const liveAgent =
    !liveChief && !isProThreadId(thread.agentId) && !!getAgent(thread.agentId, agents);
  const livePro = !liveChief && isProThreadId(thread.agentId) && !!proAgent && !!proId;
  const fallback = useFailClosedChatThread();
  const chief = useChiefThread(liveChief);
  const agentLive = useAgentThread(agent.id, liveAgent);
  const proLive = useProThread(proId ?? '', livePro);
  const { items, typing, send, append, updateHandoff, clear: clearThread } = liveChief
    ? chief
    : liveAgent
      ? agentLive
      : livePro
        ? proLive
        : fallback;
  const chiefApiOffline = liveChief && chief.offline;
  const agentApiOffline = liveAgent && agentLive.offline;
  const proApiOffline = livePro && proLive.offline;
  const [clearBusy, setClearBusy] = useState(false);

  useEffect(() => {
    rememberLastChatThread(thread.id);
  }, [thread.id]);

  useEffect(() => {
    emitCompanionTyping(Boolean(typing));
    return () => emitCompanionTyping(false);
  }, [typing]);

  const nextUp: NextUp | null = firstOpen ?
  { label: firstOpen.title, detail: 'Approval waiting below', targetId: `approval-${firstOpen.id}` } :
  thread.nextUp;

  const handleDecision = (id: string, approve: boolean) => {
    updateHandoff(id, approve ? 'done' : 'declined');
    append({ kind: 'system', id: createId(), time: nowTime(), tone: approve ? 'success' : 'neutral', text: approve ? outcomeText.approved : outcomeText.local });
  };

  const resolve = (id: string, state: ApprovalState) => {
    resolveApproval(id, state);
    if (state !== 'open') {
      append({ kind: 'system', id: createId(), time: nowTime(), tone: state === 'approved' ? 'success' : state === 'rejected' ? 'danger' : 'neutral', text: outcomeText[state] });
    }
  };

  const changeModel = (m: ModelId) => {
    if (m === model) return;
    const opt = modelOptions.find((o) => o.id === m);
    const lane = laneOf(m);
    if (lane === 'online' || lane === 'pro' || m === 'cloud' || m === 'chat1b' || m === 'chat3b') {
      if (!cloudKeyReady || opt?.health === 'needs_key') {
        append({
          kind: 'system',
          id: createId(),
          time: nowTime(),
          tone: 'danger',
          text: 'Cloud models need a working provider key — add one under Settings → Connections before switching off-device.',
        });
        return;
      }
    }
    if (opt && !opt.selectable) {
      append({
        kind: 'system',
        id: createId(),
        time: nowTime(),
        tone: 'danger',
        text: 'That model is offline — pick a Live option in the model panel or start Ollama / the SLM router.',
      });
      return;
    }
    setAgentModel(agent.id, m);
    if (lane === 'local' || (typeof m === 'string' && (m.startsWith('ollama:') || m.startsWith('llamacpp:')))) {
      append({
        kind: 'handoff',
        id: createId(),
        from: agent.id,
        to: agent.id,
        model: m,
        time: nowTime(),
        state: 'done',
        reason: 'You switched this agent to an on-device model.',
      });
      return;
    }
    if (cloudKeyReady && (lane === 'online' || lane === 'pro')) {
      append({
        kind: 'handoff',
        id: createId(),
        from: agent.id,
        to: agent.id,
        model: m,
        time: nowTime(),
        state: 'done',
        reason:
          lane === 'online'
            ? 'You selected an off-device model — replies may use your cloud provider.'
            : 'Pro lane: cloud calls still ask you first.',
      });
    }
  };

  const onlineBlocked = !onlineOn && laneOf(model) !== 'local';
  const blocked = !!pausedAt || offline || routerOffline || onlineBlocked;
  const placeholder = pausedAt ?
  'All agents are paused' :
  !localOn ?
  'Local models are off — turn Local on in the header' :
  routerOffline ?
  'Local router offline — blocked (fail closed)' :
  onlineBlocked ?
  `${agent.name} is on an online model and Online is off — blocked` :
  offline ?
  `${agent.name} is offline — blocked (fail closed)` :
  `${t(s.language, 'message')} ${agent.name}…`;

  const appendSystem = useCallback(
    (text: string, tone: 'neutral' | 'success' | 'danger' = 'neutral') => {
      append({ kind: 'system', id: createId(), time: nowTime(), tone, text });
    },
    [append]
  );
  const navigateToAgent = useCallback(
    (agentId: string) => {
      const path = `/chat/${encodeURIComponent(agentId)}`;
      if (thread.id !== agentId && thread.agentId !== agentId) {
        navigate(path);
      }
    },
    [navigate, thread.agentId, thread.id]
  );
  const research = useResearchBriefFlow(
    send,
    model,
    appendSystem,
    liveAgent ? agentLive.reload : undefined,
    navigateToAgent
  );
  const { openBrief } = research;
  const handleSend = useCallback(
    (text: string) => {
      if (
        shouldOpenResearchBrief({ text, agent }) &&
        !text.trim().startsWith('[Research brief]') &&
        !text.trim().startsWith('[Research participation')
      ) {
        openBrief(text, agent.id, agent.name);
        return;
      }
      void send(text, model);
    },
    [agent, model, openBrief, send]
  );


  const handleClearChat = useCallback(async () => {
    setClearBusy(true);
    try {
      await clearThread();
      appendSystem('Chat cleared', 'neutral');
    } catch {
      appendSystem('Could not clear chat — API unavailable (fail closed).', 'danger');
    } finally {
      setClearBusy(false);
    }
  }, [appendSystem, clearThread]);

  const afterNodes = (
    <>
      {threadApprovals.map((a) => (
        <ApprovalCard
          key={a.id}
          approval={a}
          disabled={!!pausedAt}
          onResolve={(st) => resolve(a.id, st)}
          onAskMore={() =>
            send(`Before I decide on "${a.title}" — can you explain why and what leaves this device?`, model)
          }
        />
      ))}
      {research.participation && (
        <ResearchParticipationCard
          session={research.participation}
          disabled={blocked}
          onSubmit={(id, prompt, answer) => void research.submitParticipation(id, prompt, answer)}
          onDismissPrompt={research.dismissPrompt}
        />
      )}
    </>
  );

  return (
    <>
      <ResearchBriefSheet
        open={!!research.pending}
        question={research.pending?.question ?? ''}
        agentLabel={research.pending?.agentLabel}
        submitting={research.submitting}
        queuedCount={research.queuedCount}
        queuedQuestions={research.queuedQuestions}
        onConfirm={(brief) => void research.confirmBrief(brief)}
        onSkip={research.skipBrief}
        onCancel={research.cancelBrief}
        onQueueAnother={research.queueBrief}
      />
      <section className="relative flex min-h-0 flex-col bg-bg pb-[84px]" aria-label={`Chat with ${agent.name}`}>
        <ChatHeader
          agent={agent}
          title={thread.title}
          setName={thread.setName}
          model={model}
          nextUp={nextUp}
          panelOpen={agentPanelOpen}
          onTogglePanel={togglePanel}
          onClearChat={handleClearChat}
          clearBusy={clearBusy}
          showAddAgent={isTeamMode}
        />
        <LocalBackendAlertBanner alert={localBackendAlert} onRescan={rescanLocalBackend} />
        {(chiefApiOffline || agentApiOffline || proApiOffline) &&
        <div className="flex flex-wrap items-center gap-3 border-b border-warn/25 bg-warn/[0.08] px-4 py-3 text-[13px] text-ink md:px-5">
            <ServerOffIcon size={16} className="text-warn" aria-hidden="true" />
            <span>
              <span className="font-semibold">
                {liveChief ? 'Chief chat API offline.' : livePro ? 'Pro chat API offline.' : 'Agent chat API offline.'}
              </span> Start the product server on :3445 (`npm run dev` from the repo root). Sends fail closed until it is back.
            </span>
          </div>
        }
        {routerOffline &&
        <div className="flex flex-wrap items-center gap-3 border-b border-danger/20 bg-danger/[0.06] px-4 py-3 text-[13px] text-ink md:px-5">
            <ServerOffIcon size={16} className="text-danger" aria-hidden="true" />
            <span>
              <span className="font-semibold">{localOn ? 'Local router is offline.' : 'Local models are switched off.'}</span> Agents fail closed — nothing runs until ASI AMS Micro 70M is back.
            </span>
            <button
            type="button"
            onClick={() => localOn ? setRouterOffline(false) : setLocalOn(true)}
            className="ml-auto rounded-full bg-surface px-3 py-1 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-raised">
            
              {localOn ? 'Restart router' : 'Turn Local on'}
            </button>
          </div>
        }
        <ChatFeed
          items={items}
          typing={research.running ? agent.id : typing}
          onHandoffDecision={handleDecision}
          after={afterNodes}
        />
        
        <div className="bg-surface">
          <Composer onSend={handleSend} disabled={blocked} placeholder={placeholder} />
        </div>
        {/* Below lg: overlay drawer (header toggle). */}
        {agentPanelOpen && (
          <div className="lg:hidden">
            <button
              type="button"
              aria-label="Close details panel"
              className="absolute inset-0 z-30 bg-ink/15"
              onClick={() => setPanelOpen(false)}
            />
            <AgentPanel
              id="agent-panel-mobile"
              className="absolute inset-y-0 right-0 z-40 flex shadow-xl"
              agent={agent}
              model={model}
              onModelChange={changeModel}
              onClose={() => setPanelOpen(false)}
            />
          </div>
        )}
      </section>
      {/* lg+: persistent right rail (collapses to a thin discoverable strip). */}
      <AgentPanel
        id="agent-panel"
        className="hidden lg:flex"
        agent={agent}
        model={model}
        onModelChange={changeModel}
        collapsed={!agentPanelOpen}
        onExpand={() => setPanelOpen(true)}
        onClose={() => setPanelOpen(false)}
      />
    </>);

}