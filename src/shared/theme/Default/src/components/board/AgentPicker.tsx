import { useAgents } from '../../contexts/AgentsContext';
import React from 'react';
import { CheckIcon, LockIcon } from 'lucide-react';
import { AgentAvatar } from '../AgentAvatar';
import { isChiefId, withChiefIds } from '../../utils/withChief';

interface AgentPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  layout?: 'list' | 'grid';
}

/** Choose which agents sit on the decision board. Chief is always selected and cannot be removed. */
export function AgentPicker({ selected, onChange, layout = 'list' }: AgentPickerProps) {
  const agents = useAgents();
  const selectedWithChief = withChiefIds(selected);

  const toggle = (id: string) => {
    if (isChiefId(id)) return; // product rule: Chief stays
    const next = selectedWithChief.includes(id)
      ? selectedWithChief.filter((x) => x !== id)
      : [...selectedWithChief, id];
    onChange(withChiefIds(next));
  };

  return (
    <ul className={layout === 'grid' ? 'grid gap-2 sm:grid-cols-3 lg:grid-cols-4' : 'space-y-1'} aria-label="Pick agents">
      {agents.map((a) => {
        const locked = isChiefId(a.id);
        const on = selectedWithChief.includes(a.id) || locked;
        const offline = a.status === 'offline';
        return (
          <li key={a.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-disabled={locked}
              title={locked ? 'Chief is always on the board' : undefined}
              onClick={() => toggle(a.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ring-1 transition-colors duration-150 ${
              on ? 'bg-accent/10 ring-accent/40' : 'ring-transparent hover:bg-overlay/[0.04]'}`
              }>
              
              <AgentAvatar agent={a} size="sm" showStatus />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{a.name}</span>
                <span className={`block truncate text-[11px] ${offline ? 'text-danger' : 'text-muted'}`}>
                  {locked ? 'Always included' : offline ? 'Offline' : a.roleTag}
                </span>
              </span>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 ${on ? 'bg-accent-strong text-white ring-accent-strong' : 'ring-line'}`} aria-hidden="true">
                {locked ? <LockIcon size={11} /> : on ? <CheckIcon size={12} /> : null}
              </span>
            </button>
          </li>);

      })}
    </ul>);

}
