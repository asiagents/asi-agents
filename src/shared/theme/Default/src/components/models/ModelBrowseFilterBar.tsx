import React from 'react';
import type { BrowseFilterId } from '../../utils/modelBrowseFilters';
import { HOSTING_FILTERS, PRICING_FILTERS } from '../../utils/modelBrowseFilters';
import {
  ASSIGNMENT_ROLE_FILTERS,
  type AssignmentRoleFilter,
} from '../../utils/assignmentModelOptions';

type Props = {
  active: BrowseFilterId[];
  onToggle: (id: BrowseFilterId) => void;
  /** Shown under pills — explains what “free” means for this view. */
  hint?: string;
  className?: string;
  /** Optional skill / role filters (chat, coding, vision, …). */
  skillActive?: AssignmentRoleFilter[];
  onToggleSkill?: (id: AssignmentRoleFilter) => void;
};

const allFilters: { id: BrowseFilterId; label: string }[] = [...PRICING_FILTERS, ...HOSTING_FILTERS];

/** Shared Browse filters — Default theme pill styling. */
export function ModelBrowseFilterBar({
  active,
  onToggle,
  hint,
  className = '',
  skillActive,
  onToggleSkill,
}: Props) {
  const activeSet = new Set(active);
  const skillSet = new Set(skillActive ?? []);
  const showSkills = typeof onToggleSkill === 'function';

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Model browse filters">
        {allFilters.map((f) => {
          const on = activeSet.has(f.id);
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(f.id)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                on ? 'bg-accent/15 text-accent-ink' : 'bg-overlay/[0.06] text-muted hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      {showSkills && (
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Skill filters">
          {ASSIGNMENT_ROLE_FILTERS.map((f) => {
            const on = skillSet.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggleSkill(f.id)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                  on ? 'bg-accent/15 text-accent-ink' : 'bg-overlay/[0.06] text-muted hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}
      {hint && <p className="mt-2 text-[11px] text-faint">{hint}</p>}
    </div>
  );
}
