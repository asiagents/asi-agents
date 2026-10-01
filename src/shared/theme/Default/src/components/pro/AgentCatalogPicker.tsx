import React, { useState } from 'react';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { ProAvatar } from './ProAvatar';
import { proCategories } from '../../data/proSets';
import { usePro } from '../../contexts/ProContext';
import type { ProAgent } from '../../types/pro';

/** Pick existing catalog agents into the Custom set (skills come with the agent; edit later). */
export function AgentCatalogPicker() {
  const { customAgents, addCatalogAgent } = usePro();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const pool: ProAgent[] = proCategories.flatMap((c) => c.agents);
  const shown = pool.filter(
    (a) => !query || `${a.name} ${a.role}`.toLowerCase().includes(query)
  );

  return (
    <div className="space-y-3">
      <label className="relative block max-w-md">
        <span className="sr-only">Search catalog agents</span>
        <SearchIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search catalog…" className="h-9 w-full rounded-lg bg-surface pl-8 pr-3 text-[13px] text-ink ring-1 ring-line placeholder:text-faint focus:ring-accent/60" />
      </label>
      <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-card ring-1 ring-line">
        {shown.length === 0 ?
        <li className="px-4 py-8 text-center text-[13px] text-muted">No catalog agents match.</li> :

        shown.map((a) => {
          const added = customAgents.some((c) => c.name === a.name && c.role === a.role);
          return (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                <ProAvatar agent={a} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{a.name} <span className="font-normal text-muted">({a.role})</span></span>
                  <span className="block truncate text-[11px] text-faint">{a.skills.length} skills</span>
                </span>
                <button
                type="button"
                disabled={added}
                onClick={() => addCatalogAgent(a)}
                className="inline-flex items-center gap-1 rounded-lg bg-accent-strong px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40">
                
                  <PlusIcon size={12} aria-hidden="true" /> {added ? 'Added' : 'Add'}
                </button>
              </li>);

        })
        }
      </ul>
    </div>);

}
