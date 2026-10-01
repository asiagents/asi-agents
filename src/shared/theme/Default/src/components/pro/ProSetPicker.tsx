import React, { useState } from 'react';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { ProAvatar } from './ProAvatar';
import { proCategories } from '../../data/proSets';
import { CUSTOM_SET, usePro } from '../../contexts/ProContext';

/** Dropdown of the 12 category sets + Custom, and an expandable list showing each set's agents: Name (Role) · category. */
export function ProSetPicker() {
  const { activeSetId, setActiveSet, customAgents } = usePro();
  const [expanded, setExpanded] = useState<string | null>(activeSetId);

  return (
    <div className="space-y-3">
      <label className="flex max-w-md flex-col gap-1">
        <span className="text-[12px] font-medium text-muted">Active agent set</span>
        <select
          value={activeSetId}
          onChange={(e) => {
            setActiveSet(e.target.value);
            setExpanded(e.target.value);
          }}
          className="h-10 rounded-lg bg-surface px-3 text-sm text-ink ring-1 ring-line">
          
          {proCategories.map((c) =>
          <option key={c.id} value={c.id}>{c.name} · {c.agents.length} agents</option>
          )}
          <option value={CUSTOM_SET}>Custom (build your own) · {customAgents.length} agents</option>
        </select>
      </label>

      <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
        {proCategories.map((c) => {
          const open = expanded === c.id;
          const active = activeSetId === c.id;
          return (
            <li key={c.id}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : c.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  
                  <ChevronDownIcon size={15} className={`shrink-0 text-faint transition-transform duration-150 ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
                  <span className="flex -space-x-2" aria-hidden="true">
                    {c.agents.slice(0, 3).map((a) =>
                    <span key={a.id} className="rounded-[10px] ring-2 ring-surface"><ProAvatar agent={a} size={26} /></span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-ink">{c.name}</span>
                    <span className="block truncate text-[12px] text-muted">{c.blurb}</span>
                  </span>
                </button>
                {active ?
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-[12px] font-semibold text-accent-ink">
                    <CheckIcon size={12} aria-hidden="true" /> Active
                  </span> :

                <button type="button" onClick={() => setActiveSet(c.id)} className="shrink-0 rounded-full px-3 py-1 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
                    Use set
                  </button>
                }
              </div>
              {open &&
              <ul className="grid gap-2 px-4 pb-3 pl-11 sm:grid-cols-2">
                  {c.agents.map((a) =>
                <li key={a.id} className="flex items-center gap-2.5 rounded-lg bg-bg px-2.5 py-2">
                      <ProAvatar agent={a} size={32} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">
                          {a.name} <span className="font-normal text-muted">({a.role})</span>
                        </span>
                        <span className="block text-[11px] text-faint">{c.name}</span>
                      </span>
                    </li>
                )}
                </ul>
              }
            </li>);

        })}
      </ul>
    </div>);

}