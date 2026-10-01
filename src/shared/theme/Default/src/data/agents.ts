import { apiFetchUrls } from '@asi-api';
import type { Agent } from '../types/agents';
import { mapRegistryAgent, type RegistryAgentRow } from './mapRegistryAgent';

/**
 * Live desk roster. Seeded/updated from GET /api/agents (config/agents.registry.json).
 * Mutated in place so existing `import { agents }` sites see updates after applyRegistryAgents.
 * No demo rows ship here.
 */
export const agents: Agent[] = [];

let lastAgentsScanAt: string | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeAgents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => l());
}

export function getAgentsLastScanAt(): string | null {
  return lastAgentsScanAt;
}

/** Replace the in-memory roster from API/registry rows (local avatars only). */
export function applyRegistryAgents(rows: RegistryAgentRow[], lastScanAt?: string | null): Agent[] {
  if (lastScanAt !== undefined) lastAgentsScanAt = lastScanAt;
  const next = rows.map(mapRegistryAgent);
  agents.length = 0;
  agents.push(...next);
  notify();
  return agents;
}

export type AgentsFetchResult = { agents: Agent[]; lastScanAt: string | null };

/**
 * GET /api/agents with same-origin → loopback fallback (matches model scan).
 * Never wipes a populated roster on total failure — callers keep prior/builtin rows.
 */
export async function fetchAndApplyAgents(): Promise<AgentsFetchResult> {
  const urls = apiFetchUrls('/api/agents');
  let lastError: unknown;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastError = new Error(`${res.status} ${url}`);
        continue;
      }
      const data = (await res.json()) as { agents?: RegistryAgentRow[]; lastScanAt?: string | null };
      const rows = Array.isArray(data.agents) ? data.agents : [];
      // Empty payload: try loopback before accepting (stale proxy / wrong handler).
      if (rows.length === 0) {
        lastError = new Error(`empty agents from ${url}`);
        continue;
      }
      const list = applyRegistryAgents(rows, data.lastScanAt ?? null);
      return { agents: list, lastScanAt: lastAgentsScanAt };
    } catch (err) {
      lastError = err;
    }
  }
  if (agents.length > 0) {
    return { agents, lastScanAt: lastAgentsScanAt };
  }
  throw lastError instanceof Error ? lastError : new Error('agents unreachable');
}
