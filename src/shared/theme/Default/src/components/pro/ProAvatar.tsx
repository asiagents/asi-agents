import React from 'react';
import { proLooks } from '../../data/proSets';
import { getAgent } from '../../utils/lookup';
import { useSettings } from '../../contexts/SettingsContext';
import type { ProAgent, ProHeight } from '../../types/pro';

const heightPx: Record<ProHeight, number> = { short: 96, mid: 128, tall: 164 };

export function lookFor(agent: ProAgent): {src: string;label: string;kind: string;} {
  const look = proLooks[agent.look];
  if (look) return look;
  return { src: getAgent(agent.look)?.cube ?? '', label: 'Soft cube', kind: 'cube' };
}

/** Square avatar for lists. */
export function ProAvatar({ agent, size = 40 }: {agent: ProAgent;size?: number;}) {
  const look = lookFor(agent);
  const initials = agent.name.slice(0, 2).toUpperCase();
  return (
    <span className="block shrink-0 overflow-hidden rounded-[10px] bg-[#1f2433]" style={{ width: size, height: size }}>
      {look.src ?
      <img src={look.src} alt="" className={`h-full w-full object-cover ${look.kind === 'human-pixel' ? '[image-rendering:pixelated]' : ''}`} /> :

      <span className="grid h-full w-full place-items-center text-[11px] font-semibold text-[#c9cfdb]">{initials}</span>
      }
    </span>);

}

/** Standing figure for the Pro lineup: height varies per agent, so the team reads as individuals. */
export function ProFigure({ agent, active = false }: {agent: ProAgent;active?: boolean;}) {
  const { s } = useSettings();
  const look = lookFor(agent);
  const h = heightPx[agent.height];
  return (
    <span
      className={`relative block overflow-hidden rounded-t-[18px] rounded-b-md bg-[#1f2433] ring-2 transition-[box-shadow] duration-150 ${active ? 'ring-accent' : 'ring-transparent'}`}
      style={{ width: Math.round(h * 0.72), height: h }}>
      
      {look.src ?
      <img
        src={look.src}
        alt=""
        style={{ animationDelay: `${agent.id.length % 5 * -0.5}s` }}
        className={`h-full w-full object-cover ${s.liveVisuals ? 'idle-loop-slow' : ''} ${look.kind === 'human-pixel' ? '[image-rendering:pixelated]' : ''}`} /> :

      <span className="grid h-full w-full place-items-center text-sm font-semibold text-[#c9cfdb]">{agent.name.slice(0, 2).toUpperCase()}</span>
      }
      
    </span>);

}