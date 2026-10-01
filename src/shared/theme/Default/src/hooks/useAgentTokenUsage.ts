import { useEffect, useState } from 'react';
import { api, type ChatMessage } from '@asi-api';
import { useAgents } from '../contexts/AgentsContext';

export type AgentTokenRow = {
  agentId: string;
  tokens: number | null; // null = no real usage meta yet (fail-closed display)
};

function sumMessageTokens(messages: ChatMessage[] | undefined): number | null {
  if (!messages?.length) return null;
  let total = 0;
  let any = false;
  for (const m of messages) {
    const meta = m.meta;
    if (!meta) continue;
    const p = meta.promptTokens;
    const c = meta.completionTokens;
    if (p == null && c == null) continue;
    any = true;
    total += (p ?? 0) + (c ?? 0);
  }
  return any ? total : null;
}

/**
 * Aggregate prompt+completion tokens from live chat threads (chief + agents).
 * Fail-closed: null when the API is down or messages have no usage meta — never invents tokens.
 */
export function useAgentTokenUsage(): { rows: Record<string, number | null>; loading: boolean } {
  const agents = useAgents();
  const [rows, setRows] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const next: Record<string, number | null> = {};
      try {
        const chief = await api.chiefThread().catch(() => null);
        next.chief = sumMessageTokens(chief?.messages);
      } catch {
        next.chief = null;
      }
      await Promise.all(
        agents
          .filter((a) => a.id !== 'chief')
          .map(async (a) => {
            try {
              const th = await api.agentThread(a.id);
              next[a.id] = sumMessageTokens(th.messages as ChatMessage[]);
            } catch {
              next[a.id] = null;
            }
          }),
      );
      if (!cancelled) {
        setRows(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agents]);

  return { rows, loading };
}
