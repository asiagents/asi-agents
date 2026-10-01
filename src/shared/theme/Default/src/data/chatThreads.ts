import type { ThreadDef } from '../types/chat';
import { chiefReply, chiefThread } from './threads';

/** Chief is always available; other threads come from roster / Pro. */
export const primaryThreads: ThreadDef[] = [
  {
    id: 'chief',
    title: 'Chief (chief)',
    subtitle: 'Chief of staff · flat with you',
    agentId: 'chief',
    items: chiefThread,
    reply: chiefReply,
    nextUp: null,
  },
];

export const liveLines: { agentId: string; text: string }[] = [];