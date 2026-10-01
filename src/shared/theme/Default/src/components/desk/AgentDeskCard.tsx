import React from 'react';
import { Link } from 'react-router-dom';
import { CameraIcon, MonitorIcon, MonitorOffIcon } from 'lucide-react';
import { SnapshotFrame } from './SnapshotFrame';
import { useSnapshots } from '../../contexts/SnapshotContext';
import { useDesk } from '../../contexts/DeskContext';
import type { Agent } from '../../types/agents';

/** An agent's virtual desk on its profile: assign / remove + latest snapshot. */
export function AgentDeskCard({ agent }: {agent: Agent;}) {
  const { deskAgents, snapshots, assignDesk, unassignDesk, takeNow } = useSnapshots();
  const { deskModule } = useDesk();
  const hasDesk = deskAgents.includes(agent.id);
  const list = snapshots[agent.id] ?? [];
  const last = list[list.length - 1];

  return (
    <section className="rounded-card bg-surface p-5 ring-1 ring-line" aria-labelledby="agent-desk">
      <div className="flex items-center gap-2">
        <MonitorIcon size={15} className="text-muted" aria-hidden="true" />
        <h2 id="agent-desk" className="text-[15px] font-semibold text-ink">Virtual desk</h2>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${hasDesk ? 'bg-success/10 text-success' : 'bg-overlay/[0.06] text-muted'}`}>
          {hasDesk ? 'Assigned' : 'None'}
        </span>
      </div>

      {!deskModule ?
      <p className="mt-3 text-[13px] text-muted">
          The Virtual Computer module is off.{' '}
          <Link to="/settings/safety" className="font-medium text-accent-ink hover:underline">Enable in Settings</Link>
        </p> :
      hasDesk ?
      <>
          <div className="mt-3 h-36">{last ? <SnapshotFrame agentId={agent.id} snap={last} /> : <p className="text-[13px] text-muted">No snapshot yet.</p>}</div>
          <p className="mt-2 text-[11px] text-faint">{last ? `Latest snapshot ${last.time} · ${list.length} kept` : 'Waiting for the first snapshot'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={takeNow} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
              <CameraIcon size={13} aria-hidden="true" /> Snapshot now
            </button>
            <Link to="/desk" className="inline-flex items-center rounded-lg px-3 py-1.5 text-[12px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent/10">
              Open Desk
            </Link>
            <button type="button" onClick={() => unassignDesk(agent.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger">
              <MonitorOffIcon size={13} aria-hidden="true" /> Remove desk
            </button>
          </div>
        </> :

      <>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Give {agent.name} a sandboxed desk so you can watch what it sees. Snapshots follow your Lock screen interval.
          </p>
          <button
          type="button"
          onClick={() => assignDesk(agent.id)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2">
          
            <MonitorIcon size={14} aria-hidden="true" /> Assign virtual desk
          </button>
        </>
      }
    </section>);

}