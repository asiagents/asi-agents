import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { AgentNameSetPicker } from '../agents/AgentNameSetPicker';
import { ProAvatar } from './ProAvatar';
import { SkillCatalog } from './SkillCatalog';
import { AgentCatalogPicker } from './AgentCatalogPicker';
import { CUSTOM_SET, usePro } from '../../contexts/ProContext';
import type { ProHeight } from '../../types/pro';

const lookOptions = [
  { id: 'doctor', label: 'Human · doctor (pixel)' },
  { id: 'finance', label: 'Human · finance (pixel)' },
  { id: 'lawyer', label: 'Human · lawyer (pixel)' },
  { id: 'dragon', label: 'Creature · dragon' },
  { id: 'owl', label: 'Creature · owl' },
  { id: 'coder', label: 'Soft cube · coder' },
  { id: 'writer', label: 'Soft cube · writer' },
  { id: 'research', label: 'Soft cube · researcher' },
];

const field = 'h-9 w-full rounded-lg bg-surface px-3 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60';

/** Build your own set from the shared catalog. Agents land in category “Custom”. */
export function CustomSetBuilder() {
  const { customAgents, addCustomAgent, removeCustomAgent, setAgentSkills, activeSetId, setActiveSet, skillLabel } =
    usePro();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [look, setLook] = useState('owl');
  const [height, setHeight] = useState<ProHeight>('mid');
  const [skills, setSkills] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const valid = name.trim() && role.trim() && skills.length > 0;
  const editing = customAgents.find((a) => a.id === editingId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-semibold text-ink">Add from catalog</h3>
        <p className="mt-0.5 text-[12px] text-muted">
          Pick existing agents, then adjust their skills below or create a new one. Full catalog browse:{' '}
          <Link to="/settings/skills" className="font-medium text-accent-ink hover:underline">
            Settings → AMS skills
          </Link>
          .
        </p>
        <div className="mt-2">
          <AgentCatalogPicker />
        </div>
      </div>
      {customAgents.length > 0 && (
        <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {customAgents.map((a) => (
            <li key={a.id} className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <ProAvatar agent={a} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {a.name} <span className="font-normal text-muted">({a.role})</span>
                  </span>
                  <span className="block truncate text-[11px] text-faint">
                    Custom · {a.skills.map(skillLabel).join(', ') || 'No skills'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === a.id ? null : a.id)}
                  aria-label={`Edit skills for ${a.name}`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-overlay/[0.06] hover:text-ink"
                >
                  {editingId === a.id ? (
                    <XIcon size={14} aria-hidden="true" />
                  ) : (
                    <PencilIcon size={14} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editingId === a.id) setEditingId(null);
                    removeCustomAgent(a.id);
                  }}
                  aria-label={`Remove ${a.name}`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2Icon size={14} aria-hidden="true" />
                </button>
              </div>
              {editingId === a.id && editing && (
                <div className="mt-3">
                  <SkillCatalog
                    selected={editing.skills}
                    onChange={(ids) => setAgentSkills(a.id, ids)}
                    label={`${a.name} skills`}
                    defaultExpanded
                  />
                  <p className="mt-1.5 text-[11px] text-faint">
                    Custom-set skills save in this browser. Link a desk agent under Pro edit to persist via PUT …/ams.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="space-y-3 rounded-card bg-surface p-4 ring-1 ring-line"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          addCustomAgent({ name: name.trim(), role: role.trim(), look, height, skills, model: 'micro' });
          setName('');
          setRole('');
          setSkills([]);
        }}
      >
        <AgentNameSetPicker
          name={name}
          role={role}
          roleOptional={false}
          onPick={(pick) => {
            setName(pick.name.slice(0, 20));
            if (pick.role !== undefined) setRole(pick.role.slice(0, 28));
          }}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nova — or pick a set"
              maxLength={20}
              className={`mt-1 ${field}`}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Role</span>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Study coach"
              maxLength={28}
              className={`mt-1 ${field}`}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Look</span>
            <select value={look} onChange={(e) => setLook(e.target.value)} className={`mt-1 ${field}`}>
              {lookOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Height</span>
            <select
              value={height}
              onChange={(e) => setHeight(e.target.value as ProHeight)}
              className={`mt-1 ${field}`}
            >
              <option value="short">Short</option>
              <option value="mid">Medium</option>
              <option value="tall">Tall</option>
            </select>
          </label>
        </div>
        <SkillCatalog selected={skills} onChange={setSkills} label="New agent skills" />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!valid}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-40"
          >
            <PlusIcon size={14} aria-hidden="true" /> Add to custom set
          </button>
          {customAgents.length > 0 && activeSetId !== CUSTOM_SET && (
            <button
              type="button"
              onClick={() => setActiveSet(CUSTOM_SET)}
              className="text-[13px] font-medium text-accent-ink hover:underline"
            >
              Use custom set
            </button>
          )}
          {!valid && <span className="text-[12px] text-faint">Name, role, and at least one skill.</span>}
        </div>
      </form>
    </div>
  );
}
