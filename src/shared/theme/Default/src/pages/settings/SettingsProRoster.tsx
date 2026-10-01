import React from 'react';
import { Link } from 'react-router-dom';
import { AgentAvatar } from '../../components/AgentAvatar';
import { ModelChip } from '../../components/ModelChip';
import { StatusPill } from '../../components/settings/SettingsUI';
import { useAgentsMeta } from '../../contexts/AgentsContext';
import { AgentAmsSkillsPanel } from '../../components/agents/AgentAmsSkillsPanel';

/** Registry roster for Pro settings — only GET /api/agents rows; no invented agents. */
export function SettingsProRoster() {
  const { agents, loading, error, lastScanAt, refresh } = useAgentsMeta();

  if (loading) {
    return <p className="text-sm text-muted">Loading roster from the agents API…</p>;
  }

  if (error) {
    return (
      <div className="rounded-card bg-surface p-4 ring-1 ring-line">
        <p className="text-sm text-muted">{error}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-3 rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
          Retry
        </button>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <p className="text-sm text-muted">
        No agents in the registry yet. Add rows to{' '}
        <code className="text-[12px]">config/agents.registry.json</code> or run an AMS scan — the list stays empty until the API returns data.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {lastScanAt && (
        <p className="text-[12px] text-faint">Registry last scan: {new Date(lastScanAt).toLocaleString()}</p>
      )}
      <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
        {agents.map((agent) => (
          <li key={agent.id} className="flex flex-wrap gap-4 p-4">
            <AgentAvatar agent={agent} size="md" showStatus />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{agent.name}</span>
                <StatusPill tone="muted">{agent.roleTag}</StatusPill>
                {agent.isChief && <StatusPill tone="success">Chief</StatusPill>}
              </div>
              <p className="mt-0.5 text-[12px] text-muted">{agent.role}</p>
              <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-faint">SouL persona</dt>
                  <dd className="text-ink">{agent.role || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-faint">Model</dt>
                  <dd className="mt-0.5">
                    <ModelChip id={agent.primary} />
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-medium text-faint">Skills (registry)</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {agent.skills.length === 0 ?
                      <span className="text-muted">None listed</span> :
                      agent.skills.map((s) => (
                        <span
                          key={s.name}
                          className="rounded-full bg-overlay/[0.06] px-2 py-0.5 font-mono text-[11px] text-ink">
                          {s.name}
                        </span>
                      ))}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-medium text-faint">AMS catalog (enabled)</dt>
                  <dd className="mt-1">
                    <AgentAmsSkillsPanel agentId={agent.id} compact />
                  </dd>
                </div>
              </dl>
              <Link
                to={`/agents/${agent.id}`}
                className="mt-2 inline-block text-[12px] font-medium text-accent-ink hover:underline">
                Open agent profile
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
