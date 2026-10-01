import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SettingsSection } from '../../components/settings/SettingsUI';
import { SkillCatalog } from '../../components/pro/SkillCatalog';
import { CustomSetBuilder } from '../../components/pro/CustomSetBuilder';
import { ProAgentEditor } from '../../components/pro/ProAgentEditor';
import { AgentAmsSkillsPanel } from '../../components/agents/AgentAmsSkillsPanel';
import { useAgentsMeta } from '../../contexts/AgentsContext';
import { usePro } from '../../contexts/ProContext';

/**
 * Dedicated AMS skills page: browse full catalog, edit desk-agent picks, edit Pro/custom sets.
 * Persists desk picks via PUT /api/agents/:id/ams.
 */
export function SettingsSkills() {
  const [params, setParams] = useSearchParams();
  const { agents, loading, error, refresh } = useAgentsMeta();
  const { skillsCatalogMeta } = usePro();
  const editable = useMemo(() => agents, [agents]);
  const paramAgent = params.get('agent') ?? '';
  const [agentId, setAgentId] = useState(paramAgent);

  useEffect(() => {
    if (paramAgent) setAgentId(paramAgent);
  }, [paramAgent]);

  useEffect(() => {
    if (!agentId && editable.length > 0) {
      setAgentId(editable[0].id);
    }
  }, [agentId, editable]);

  const onPickAgent = (id: string) => {
    setAgentId(id);
    const next = new URLSearchParams(params);
    if (id) next.set('agent', id);
    else next.delete('agent');
    setParams(next, { replace: true });
  };

  return (
    <>
      <SettingsSection
        stacked
        title="Browse AMS catalog"
        description={`Search and filter all ${skillsCatalogMeta.total} skills (${
          skillsCatalogMeta.source === 'api' ? 'live API' : 'offline fallback'
        }). Use Show all to expand beyond the preview.`}
      >
        <SkillCatalog selected={[]} onChange={() => undefined} label="AMS catalog browse" readOnly defaultExpanded={false} />
        <p className="mt-2 text-[12px] text-muted">
          To assign skills, pick a desk agent below, edit a Pro set, or build a custom set. Hire/create also uses this
          catalog on{' '}
          <Link to="/agents" className="font-medium text-accent-ink hover:underline">
            Agents
          </Link>
          .
        </p>
      </SettingsSection>

      <SettingsSection
        stacked
        title="Edit desk agent skills"
        description="Add or remove AMS catalog picks for a registry agent. Saves with PUT /api/agents/:id/ams."
      >
        {loading ? (
          <p className="text-[13px] text-muted">Loading agents…</p>
        ) : error ? (
          <div>
            <p className="text-[13px] text-muted">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-2 rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.05]"
            >
              Retry
            </button>
          </div>
        ) : editable.length === 0 ? (
          <p className="text-[13px] text-muted">
            No editable desk agents yet.{' '}
            <Link to="/agents" className="font-medium text-accent-ink hover:underline">
              Hire an agent
            </Link>{' '}
            first.
          </p>
        ) : (
          <div className="space-y-3">
            <label className="block max-w-md text-[12px] font-medium text-muted">
              Agent
              <select
                value={agentId}
                onChange={(e) => onPickAgent(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg bg-surface px-3 text-[13px] text-ink ring-1 ring-line"
              >
                {editable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.role}
                  </option>
                ))}
              </select>
            </label>
            {agentId ? (
              <div className="rounded-card bg-surface p-4 ring-1 ring-line">
                <AgentAmsSkillsPanel agentId={agentId} startEditing />
                <Link
                  to={`/agents/${agentId}`}
                  className="mt-3 inline-block text-[12px] font-medium text-accent-ink hover:underline"
                >
                  Open agent profile
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        stacked
        title="Edit Pro set skills"
        description="Pick skills from the AMS catalog for agents in the active Pro category set."
      >
        <ProAgentEditor />
        <p className="mt-2 text-[12px] text-muted">
          Switch sets under{' '}
          <Link to="/settings/pro" className="font-medium text-accent-ink hover:underline">
            Settings → Pro agents
          </Link>
          .
        </p>
      </SettingsSection>

      <SettingsSection
        stacked
        title="Custom skill sets"
        description="Create agents and edit skills on your Custom set. Pencil an existing row to add or remove catalog skills."
      >
        <CustomSetBuilder />
      </SettingsSection>
    </>
  );
}
