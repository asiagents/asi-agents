import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircleIcon, MonitorIcon, Settings2Icon } from 'lucide-react';
import { ProFigure, lookFor } from '../pro/ProAvatar';
import { ModelChip } from '../ModelChip';
import { categoryName, usePro } from '../../contexts/ProContext';
import { proThreadAgentId } from '../../utils/proLookup';

/** Pro home: the active specialist set as a lineup of distinct figures. Desk agents open their virtual desktop. */
export function ProHero() {
  const { activeAgents, activeSetId, skillLabel } = usePro();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string | null>(null);
  const current = activeAgents.find((a) => a.id === picked) ?? null;

  const open = (id: string) => {
    const a = activeAgents.find((x) => x.id === id);
    if (a?.deskAgentId) {
      // Navigate only — never invent a desk assignment without the user (or a live daemon).
      navigate(`/desk?agent=${a.deskAgentId}`);
      return;
    }
    setPicked(id === picked ? null : id);
  };

  return (
    <section aria-label="Your specialists" className="mb-6 rounded-card bg-surface ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">{categoryName(activeSetId)}</h2>
        <span className="text-[12px] text-muted">{activeAgents.length} specialists</span>
        <Link to="/settings/pro" className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
          <Settings2Icon size={13} aria-hidden="true" /> Change set
        </Link>
      </div>

      {activeAgents.length === 0 ?
      <p className="px-5 py-8 text-[13px] text-muted">
          No agents in this set yet. <Link to="/settings/pro" className="font-medium text-accent-ink hover:underline">Build your own</Link>
        </p> :

      <ul className="flex items-end gap-5 overflow-x-auto border-b border-line px-5 pb-0 pt-5" aria-label="Lineup">
          {activeAgents.map((a) =>
        <li key={a.id} className="shrink-0">
              <button type="button" onClick={() => open(a.id)} aria-pressed={picked === a.id} className="flex flex-col items-center gap-1.5 text-center">
                <ProFigure agent={a} active={picked === a.id} />
                <span className="text-[13px] font-semibold text-ink">{a.name}</span>
                <span className="-mt-1 pb-3 text-[11px] text-muted">
                  ({a.role})
                  {a.deskAgentId && <MonitorIcon size={11} className="ml-1 inline text-accent-ink" aria-label="Opens virtual desktop" />}
                </span>
              </button>
            </li>
        )}
        </ul>
      }

      <div className="px-5 py-3 text-[13px]">
        {current ?
        <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{current.name} ({current.role})</span>
            <span className="text-faint">· {lookFor(current).label}</span>
            <ModelChip id={current.model} size="xs" />
            {current.skills.map((s) =>
          <span key={s} className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-ink">{skillLabel(s)}</span>
          )}
            <button
            type="button"
            onClick={() => navigate(`/chat/${proThreadAgentId(current.id)}`)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 hover:bg-accent-2">
            
              <MessageCircleIcon size={14} aria-hidden="true" /> Chat
            </button>
          </div> :

        <p className="text-muted">Tap a specialist to see skills and model. Ones with a monitor icon open their virtual desktop.</p>
        }
      </div>
    </section>);

}