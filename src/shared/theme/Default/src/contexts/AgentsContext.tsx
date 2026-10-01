import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { builtinAgents } from '../data/builtinAgents';
import { agents as roster, fetchAndApplyAgents, subscribeAgents } from '../data/agents';
import type { Agent } from '../types/agents';

type AgentsContextValue = {
  agents: Agent[];
  lastScanAt: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const AgentsContext = createContext<AgentsContextValue | null>(null);

function fallbackRoster(): Agent[] {
  return roster.length ? [...roster] : [...builtinAgents];
}

/**
 * Thin React bridge over the landed roster module (fetchAndApplyAgents / subscribeAgents).
 * Keeps useAgents() consumers working without a second source of truth.
 */
export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(() => fallbackRoster());
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(roster.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { agents: list, lastScanAt: scanAt } = await fetchAndApplyAgents();
      setAgents(list.length ? [...list] : fallbackRoster());
      setLastScanAt(scanAt);
      setError(list.length ? null : 'GET /api/agents returned no agents');
    } catch {
      setAgents(fallbackRoster());
      setError('Could not reach the agents API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeAgents(() => setAgents(fallbackRoster()));
    void refresh();
    return unsub;
  }, [refresh]);

  const value = useMemo<AgentsContextValue>(
    () => ({ agents, lastScanAt, loading, error, refresh }),
    [agents, lastScanAt, loading, error, refresh],
  );

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}

/** Live roster from GET /api/agents. Falls back to builtin Chief while loading if empty. */
export function useAgents(): Agent[] {
  const ctx = useContext(AgentsContext);
  if (!ctx) {
    return fallbackRoster();
  }
  if (ctx.loading && ctx.agents.length === 0) return builtinAgents;
  return ctx.agents.length ? ctx.agents : builtinAgents;
}

export function useAgentsMeta(): AgentsContextValue {
  const ctx = useContext(AgentsContext);
  if (!ctx) {
    return {
      agents: fallbackRoster(),
      lastScanAt: null,
      loading: false,
      error: null,
      refresh: async () => undefined,
    };
  }
  // Never hand assignment UI an empty list when builtins/registry exist.
  if (ctx.agents.length === 0 && !ctx.loading) {
    return { ...ctx, agents: fallbackRoster() };
  }
  return ctx;
}
