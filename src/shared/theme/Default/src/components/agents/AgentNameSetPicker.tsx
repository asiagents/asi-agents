import React, { useMemo, useState } from 'react';
import { DicesIcon } from 'lucide-react';
import {
  AGENT_NAME_SETS,
  getAgentNameSet,
  randomFromSet,
  type AgentNameSuggestion,
} from '../../data/agentNameSets';

export type AgentNamePick = {
  name: string;
  role?: string;
};

type Props = {
  /** Current typed/selected display name (keeps custom type-in in sync). */
  name: string;
  role: string;
  onPick: (pick: AgentNamePick) => void;
  /** When false, hide the optional role fill note (e.g. Pro builder always wants a role). */
  roleOptional?: boolean;
};

/**
 * Pick a suggestion set, then a name (or random from set).
 * Only fills local form fields — does not create an agent.
 */
export function AgentNameSetPicker({ name, role, onPick, roleOptional = true }: Props) {
  const [setId, setSetId] = useState(AGENT_NAME_SETS[0]?.id ?? '');
  const active = useMemo(() => getAgentNameSet(setId) ?? AGENT_NAME_SETS[0]!, [setId]);

  const apply = (s: AgentNameSuggestion) => {
    onPick({
      name: s.name,
      role: s.role ?? (roleOptional ? undefined : role),
    });
  };

  const pickRandom = () => {
    if (!active) return;
    apply(randomFromSet(active));
  };

  return (
    <fieldset className="rounded-xl bg-bg p-3 ring-1 ring-line">
      <legend className="px-1 text-[12px] font-medium text-muted">Name sets</legend>
      <p className="mb-2 text-[11px] text-faint">
        Choose a theme, then a suggested name{roleOptional ? ' (role fills when present)' : ''}. You can still type a
        custom name below.
      </p>

      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Name suggestion sets">
        {AGENT_NAME_SETS.map((s) => {
          const on = s.id === active.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={on}
              title={s.description}
              onClick={() => setSetId(s.id)}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-150 ${
                on ? 'bg-ink text-bg' : 'text-muted hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-[11px] text-muted">{active.description}</p>
        <button
          type="button"
          onClick={pickRandom}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-accent-ink ring-1 ring-inset ring-accent/30 transition-colors duration-150 hover:bg-accent/10"
        >
          <DicesIcon size={12} aria-hidden="true" /> Random from set
        </button>
      </div>

      <ul className="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto" aria-label={`${active.label} names`}>
        {active.names.map((s) => {
          const selected = name === s.name && (!s.role || role === s.role);
          return (
            <li key={`${active.id}:${s.name}`}>
              <button
                type="button"
                aria-pressed={selected}
                title={s.role ? `${s.name} — ${s.role}` : s.name}
                onClick={() => apply(s)}
                className={`inline-flex max-w-full flex-col items-start rounded-lg px-2.5 py-1.5 text-left ring-1 ring-inset transition-colors duration-150 ${
                  selected
                    ? 'bg-accent/15 text-accent-ink ring-accent/40'
                    : 'bg-surface text-ink ring-line hover:ring-overlay/25'
                }`}
              >
                <span className="text-[12px] font-medium leading-tight">{s.name}</span>
                {s.role && <span className="mt-0.5 text-[10px] text-muted leading-tight">{s.role}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
