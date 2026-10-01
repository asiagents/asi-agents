import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import type { CatalogModel } from '../../data/modelCatalog';
import type { ModelUser } from '../../hooks/useModelUsers';

const W = 1000;
const NODE_H = 44;
const GAP = 58;
const COL = { agent: { x: 16, w: 220 }, router: { x: 320, w: 180 }, enc: { x: 575, w: 180 }, model: { x: 800, w: 190 } };

interface Point {
  x: number;
  y: number;
}

/**
 * Route map: Agent Name (Role) → optional App Router (or direct) → Encryption only if needed (else bypass) → Model · Provider [ms].
 * Animation and bypass lines follow Settings → Performance → Model map.
 */
export function NeuralMap({ model, users, online }: {model: CatalogModel;users: ModelUser[];online: boolean;}) {
  const { s } = useSettings();
  const list: ModelUser[] = users.length ? users : [{ id: 'none', name: 'No agent assigned', role: 'Unused' }];
  const rows = list.length;
  const H = Math.max(rows * GAP + 60, 260);
  const cy = H / 2;

  const viaRouter = (u: ModelUser) => !!u.isChief || model.lane !== 'local';
  const encActive = model.lane !== 'local' && model.encrypted;
  const routerActive = list.some(viaRouter) && users.length > 0;

  const routerY = routerActive ? cy : cy + 80;
  const encY = encActive ? cy : cy + 80;
  const showRouter = routerActive || s.mapShowBypass;
  const showEnc = encActive || s.mapShowBypass;

  const agentY = (i: number) => cy - (rows - 1) * GAP / 2 + i * GAP;
  const modelLeft: Point = { x: COL.model.x, y: cy };
  const encLeft: Point = { x: COL.enc.x, y: cy };
  const encRight: Point = { x: COL.enc.x + COL.enc.w, y: cy };
  const routerLeft: Point = { x: COL.router.x, y: cy };
  const routerRight: Point = { x: COL.router.x + COL.router.w, y: cy };
  const directLane: Point = { x: COL.router.x + COL.router.w / 2, y: cy - 90 };

  const curve = (a: Point, b: Point) => {
    const mx = (a.x + b.x) / 2;
    return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
  };

  const routeFor = (u: ModelUser, i: number) => {
    const start = { x: COL.agent.x + COL.agent.w, y: agentY(i) };
    const segs: string[] = [];
    const afterRouter = encActive ? encLeft : modelLeft;
    if (viaRouter(u)) {
      segs.push(curve(start, routerLeft));
      segs.push(curve(routerRight, afterRouter));
    } else {
      segs.push(curve(start, directLane));
      segs.push(curve(directLane, afterRouter));
    }
    if (encActive) segs.push(curve(encRight, modelLeft));
    return segs;
  };

  const lineCls = online ? 'stroke-accent' : 'stroke-faint';
  const flow = s.mapViz && online && users.length > 0;

  return (
    <figure className="overflow-x-auto rounded-card bg-surface p-3 ring-1 ring-line">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[720px]" role="img" aria-label={`Route map for ${model.name}`}>
        {/* Column labels */}
        {[
        { x: COL.agent.x, t: 'Agent' },
        { x: COL.router.x, t: 'App Router' },
        { x: COL.enc.x, t: 'Encryption' },
        { x: COL.model.x, t: 'Model · Provider' }].
        map((c) =>
        <text key={c.t} x={c.x} y={18} className="fill-faint text-[11px] font-semibold uppercase tracking-wider">{c.t}</text>
        )}

        {/* Bypass guides */}
        {s.mapShowBypass && !encActive &&
        <text x={COL.enc.x + COL.enc.w / 2} y={cy - 8} textAnchor="middle" className="fill-faint text-[11px]">bypass</text>
        }
        {s.mapShowBypass && list.some((u) => !viaRouter(u)) && users.length > 0 &&
        <text x={directLane.x} y={directLane.y - 8} textAnchor="middle" className="fill-faint text-[11px]">direct</text>
        }

        {/* Routes */}
        {users.length > 0 &&
        list.map((u, i) =>
        routeFor(u, i).map((d, j) =>
        <g key={`${u.id}-${j}`}>
                <path d={d} fill="none" strokeWidth={2} className={`${lineCls} opacity-30`} />
                <path d={d} fill="none" strokeWidth={2} className={`${lineCls} ${flow ? 'map-flow' : ''}`} strokeDasharray={flow ? '4 10' : undefined} />
              </g>
        )
        )}

        {/* Agent nodes */}
        {list.map((u, i) =>
        <g key={u.id}>
            <rect x={COL.agent.x} y={agentY(i) - NODE_H / 2} width={COL.agent.w} height={NODE_H} rx={10} className={`fill-bg ${users.length ? 'stroke-line' : 'stroke-line opacity-60'}`} strokeWidth={1} />
            <text x={COL.agent.x + 12} y={agentY(i) + 5} className={`text-[13px] ${users.length ? 'fill-ink font-semibold' : 'fill-muted'}`}>
              {u.name} <tspan className="fill-muted font-normal">({u.role})</tspan>
            </text>
          </g>
        )}

        {/* Router node */}
        {showRouter &&
        <g className={routerActive ? '' : 'opacity-50'}>
            <rect x={COL.router.x} y={routerY - NODE_H / 2} width={COL.router.w} height={NODE_H} rx={10} className={`fill-bg ${routerActive ? 'stroke-accent' : 'stroke-line'}`} strokeWidth={routerActive ? 1.5 : 1} strokeDasharray={routerActive ? undefined : '4 4'} />
            <text x={COL.router.x + 12} y={routerY - 2} className="fill-ink text-[13px] font-semibold">App Router</text>
            <text x={COL.router.x + 12} y={routerY + 13} className="fill-muted text-[11px]">{routerActive ? 'Micro 70M · visible handoff' : 'Skipped · direct'}</text>
          </g>
        }

        {/* Encryption node */}
        {showEnc &&
        <g className={encActive ? '' : 'opacity-50'}>
            <rect x={COL.enc.x} y={encY - NODE_H / 2} width={COL.enc.w} height={NODE_H} rx={10} className={`fill-bg ${encActive ? 'stroke-accent' : 'stroke-line'}`} strokeWidth={encActive ? 1.5 : 1} strokeDasharray={encActive ? undefined : '4 4'} />
            <text x={COL.enc.x + 12} y={encY - 2} className="fill-ink text-[13px] font-semibold">{encActive ? 'Encrypted' : 'Not needed'}</text>
            <text x={COL.enc.x + 12} y={encY + 13} className="fill-muted text-[11px]">{encActive ? 'Leaves device sealed' : 'Stays on this device'}</text>
          </g>
        }

        {/* Model node */}
        <g>
          <rect x={COL.model.x} y={cy - 30} width={COL.model.w} height={60} rx={12} className={`fill-bg ${online ? 'stroke-accent' : 'stroke-danger'}`} strokeWidth={1.5} />
          <text x={COL.model.x + 12} y={cy - 8} className="fill-ink text-[13px] font-semibold">{model.name}</text>
          <text x={COL.model.x + 12} y={cy + 8} className="fill-muted text-[11px]">{model.provider}</text>
          <text x={COL.model.x + 12} y={cy + 22} className={`text-[11px] font-medium ${online ? 'fill-success' : 'fill-danger'}`}>
            {model.baseStatus === 'dead' ? '[dead]' : online ? `[~${model.latencyMs} ms]` : '[offline]'}
          </text>
        </g>
      </svg>
      <figcaption className="px-1 pt-2 text-[12px] text-faint">
        Animation and bypass lines are set in Settings → Performance → Model map.
      </figcaption>
    </figure>);

}