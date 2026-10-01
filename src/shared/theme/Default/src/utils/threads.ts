import { primaryThreads } from '../data/chatThreads';
import { formatAgentDisplayName } from './agentDisplay';
import { getAgent } from './lookup';
import { findProAgent, isProThreadId, proIdFromThread, proSetLabel, proThreadAgentId } from './proLookup';
import type { Agent } from '../types/agents';
import type { ThreadDef } from '../types/chat';
import type { ModelId } from '../types/models';

const emptyReply = { author: '', model: 'micro' as ModelId, text: '' };

/** Resolve `/chat/:threadId` — pass live roster so chat re-resolves after GET /api/agents. */
export function getThread(id: string, roster?: readonly Agent[]): ThreadDef | null {
  const primary = primaryThreads.find((t) => t.id === id);
  if (primary) {
    // Overlay live display name so rename (app-state agentDisplayNames) refreshes header/threads.
    const live = getAgent(primary.agentId, roster);
    if (!live) return primary;
    return {
      ...primary,
      title: formatAgentDisplayName(live),
      subtitle: live.currentTask || primary.subtitle,
    };
  }

  if (isProThreadId(id)) {
    const pro = findProAgent(proIdFromThread(id));
    if (!pro) return null;
    const setName = proSetLabel(pro.categoryId);
    const chatId = proThreadAgentId(pro.id);
    return {
      id: chatId,
      title: pro.name,
      subtitle: `${setName} · ${pro.role}`,
      agentId: chatId,
      setName,
      items: [],
      reply: { ...emptyReply, author: chatId, model: pro.model },
      nextUp: null
    };
  }

  const agent = getAgent(id, roster);
  if (!agent) return null;
  return {
    id: agent.id,
    title: formatAgentDisplayName(agent),
    subtitle: agent.currentTask,
    agentId: agent.id,
    items: [],
    reply: { ...emptyReply, author: agent.id, model: agent.primary },
    nextUp: null
  };
}
