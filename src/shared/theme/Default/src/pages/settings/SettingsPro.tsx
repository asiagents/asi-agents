import React from 'react';
import { Link } from 'react-router-dom';
import { SettingsSection } from '../../components/settings/SettingsUI';
import { ProSetPicker } from '../../components/pro/ProSetPicker';
import { ProAgentEditor } from '../../components/pro/ProAgentEditor';
import { CustomSetBuilder } from '../../components/pro/CustomSetBuilder';
import { categoryName, usePro } from '../../contexts/ProContext';
import { useDesk } from '../../contexts/DeskContext';
import { apiToolSkillMap } from '../../data/settings';
import { SettingsProRoster } from './SettingsProRoster';
import { AgentSetSkillImportPanel } from '../../components/pro/AgentSetSkillImportPanel';

export function SettingsPro() {
  const { activeSetId, skillsCatalogMeta } = usePro();
  const { mode } = useDesk();
  return (
    <>
      <p className="mb-6 max-w-2xl rounded-xl bg-overlay/[0.04] px-4 py-3 text-[13px] text-ink ring-1 ring-line">
        Browse or edit the full AMS catalog ({skillsCatalogMeta.total} skills) on{' '}
        <Link to="/settings/skills" className="font-medium text-accent-ink hover:underline">
          Settings → AMS skills
        </Link>
        — search, categories, Show all, desk-agent edit, and custom sets.
      </p>
      <SettingsSection
        title="Desk roster"
        description="Live agents from GET /api/agents (config/agents.registry.json). Skills and persona come from the registry — nothing is invented here.">
        <SettingsProRoster />
      </SettingsSection>
      <SettingsSection
        title="API tools → skills"
        description="Connections API cards map to skill ids when wired. Until then, integrations stay stubbed and no skill is granted.">
        <ul className="max-w-2xl divide-y divide-line rounded-card bg-surface text-[12px] ring-1 ring-line">
          {apiToolSkillMap.map((row) => (
            <li key={row.integrationId} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <span className="font-medium text-ink">{row.summary}</span>
              <span className="font-mono text-muted">{row.skillIds.join(', ')}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-2xl text-[12px] text-muted">
          Configure stubs under{' '}
          <Link to="/settings/connections#apis" className="font-medium text-accent-ink hover:underline">
            Providers &amp; APIs → APIs
          </Link>
          . Add matching keys under API keys when a provider ships.
        </p>
      </SettingsSection>
      {mode !== 'pro' &&
      <p className="mb-6 max-w-2xl rounded-xl bg-warn/[0.08] px-4 py-3 text-[13px] text-ink ring-1 ring-warn/20">
          You're in {mode === 'super' ? 'Super Agent' : 'Multi Agents'}. Sets apply when you switch to Pro Agents in General.
        </p>
      }
      <SettingsSection title="Agent set" description="12 category sets. Expand one to see who's in it.">
        <ProSetPicker />
      </SettingsSection>
      <SettingsSection
        title="Agent sets — skill import"
        description="Pick a skill from another set, board member, or registry agent. Models are suggested only when they map to desk core ids."
      >
        <AgentSetSkillImportPanel />
      </SettingsSection>
      <SettingsSection
        title={`Edit ${categoryName(activeSetId)}`}
        description={`Pick skills from the AMS catalog (${skillsCatalogMeta.source === 'api' ? `${skillsCatalogMeta.total} via GET /api/skills/catalog` : `${skillsCatalogMeta.total} offline fallback`}) and the model each agent runs on.`}>
        <ProAgentEditor />
      </SettingsSection>
      <SettingsSection title="Build your own" description="Create agents from the shared catalog. They join the Custom set.">
        <CustomSetBuilder />
      </SettingsSection>
    </>);

}