import { useAgents } from '../contexts/AgentsContext';
import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon } from 'lucide-react';
import { navCatalog } from '../data/nav';
import { primaryThreads } from '../data/chatThreads';
import { settingsPages } from '../data/settingsPages';

interface Result {
  id: string;
  label: string;
  hint: string;
  to: string;
}

export function HeaderSearch() {
  const agents = useAgents();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const all: Result[] = useMemo(
    () => [
    ...primaryThreads.map((t) => ({ id: `t-${t.id}`, label: t.title, hint: 'Thread', to: t.id === 'chief' ? '/' : `/chat/${t.id}` })),
    ...agents.map((a) => ({ id: `a-${a.id}`, label: a.name, hint: `Agent · ${a.roleTag}`, to: `/chat/${a.id}` })),
    ...navCatalog.map((n) => ({ id: `n-${n.id}`, label: n.label, hint: 'Page', to: n.to })),
    ...settingsPages.map((s) => ({ id: `s-${s.id}`, label: s.label, hint: 'Settings', to: s.to }))],

    []
  );

  const q = query.trim().toLowerCase();
  const results = q ? all.filter((r) => r.label.toLowerCase().includes(q)).slice(0, 7) : [];

  const go = (to: string) => {
    navigate(to);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full max-w-sm">
      <label htmlFor="global-search" className="sr-only">Search agents, threads, and settings</label>
      <SearchIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
      <input
        ref={inputRef}
        id="global-search"
        type="search"
        value={query}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) go(results[0].to);
          if (e.key === 'Escape') {
            setQuery('');
            setOpen(false);
          }
        }}
        placeholder="Search agents, threads, settings"
        className="h-9 w-full rounded-full bg-bg pl-9 pr-3 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60" />
      
      {open && q &&
      <ul role="listbox" className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl bg-surface p-1 shadow-lg ring-1 ring-line">
          {results.length === 0 ?
        <li className="px-3 py-2.5 text-[13px] text-muted">No matches</li> :

        results.map((r) =>
        <li key={r.id}>
                <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(r.to)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-overlay/[0.05]">
            
                  <span className="text-[13px] font-medium text-ink">{r.label}</span>
                  <span className="ml-auto text-[11px] text-faint">{r.hint}</span>
                </button>
              </li>
        )
        }
        </ul>
      }
    </div>);

}