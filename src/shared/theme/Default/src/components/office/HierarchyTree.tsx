import React, { useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from 'lucide-react';
import { AgentAvatar } from '../AgentAvatar';
import { ModelChip } from '../ModelChip';
import { useDesk } from '../../contexts/DeskContext';
import { canMove, childrenOf } from '../../utils/hierarchy';
import { CHIEF_ID } from '../../utils/withChief';
import { getAgent } from '../../utils/lookup';
import { formatAgentDisplayName, formatAgentRoleChip } from '../../utils/agentDisplay';

type DropMode = 'before' | 'into';

export function HierarchyTree() {
  const { tree, moveInto, moveBefore, shift, agentModels, setReportsTo } = useDesk();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{id: string;mode: DropMode;} | null>(null);
  const [selected, setSelected] = useState<string>(CHIEF_ID);

  const selectedNode = tree.find((n) => n.id === selected);
  const selectedAgent = getAgent(selected);
  const possibleParents = tree.filter((n) => canMove(tree, selected, n.id));
  const isChiefSelected = selected === CHIEF_ID;

  const renderNode = (id: string, depth: number): React.ReactNode => {
    const agent = getAgent(id);
    if (!agent) return null;
    const node = tree.find((n) => n.id === id)!;
    const isChief = id === CHIEF_ID;
    const kids = childrenOf(tree, id);
    const valid = dragId ? canMove(tree, dragId, id) : false;
    const isOver = over?.id === id && valid;

    return (
      <li key={id}>
        {isOver && over.mode === 'before' && <div className="mb-1 h-0.5 rounded-full bg-accent" style={{ marginLeft: depth * 28 }} aria-hidden="true" />}
        <div
          draggable={!isChief}
          onDragStart={(e) => {
            if (isChief) return;
            setDragId(id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOver(null);
          }}
          onDragOver={(e) => {
            if (!dragId || !canMove(tree, dragId, id)) return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const mode: DropMode = e.clientY - rect.top < rect.height * 0.3 ? 'before' : 'into';
            if (over?.id !== id || over.mode !== mode) setOver({ id, mode });
          }}
          onDragLeave={() => setOver((o) => o?.id === id ? null : o)}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId && over) {
              if (over.mode === 'before') moveBefore(dragId, id);else
              moveInto(dragId, id);
              setSelected(dragId);
            }
            setDragId(null);
            setOver(null);
          }}
          onClick={() => setSelected(id)}
          style={{ marginLeft: depth * 28 }}
          className={`flex cursor-pointer items-center gap-3 rounded-xl bg-surface px-3 py-2.5 ring-1 transition-colors duration-150 ${
          isOver && over.mode === 'into' ? 'bg-accent/10 ring-accent' : selected === id ? 'ring-accent/50' : 'ring-line hover:ring-accent/30'} ${
          dragId === id ? 'opacity-50' : ''}`}>
          
          {isChief ?
          <span className="w-4" aria-hidden="true" /> :
          <GripVerticalIcon size={16} className="shrink-0 cursor-grab text-faint" aria-hidden="true" />
          }
          <AgentAvatar agent={agent} size="md" showStatus />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-ink">{formatAgentDisplayName(agent)}</span>
              {formatAgentRoleChip(agent) ? (
                <span className="shrink-0 text-[11px] text-faint">[{formatAgentRoleChip(agent)}]</span>
              ) : null}
            </div>
            <div className="text-[11px] text-muted">
              {kids.length > 0 ? `${kids.length} direct report${kids.length > 1 ? 's' : ''}` : node.parentId === null ? 'Flat · no manager' : 'No reports'}
            </div>
          </div>
          <span className="hidden sm:block">
            <ModelChip id={agent.status === 'offline' ? 'offline' : agentModels[agent.id]} size="xs" />
          </span>
        </div>
        {kids.length > 0 && <ul className="mt-2 space-y-2">{kids.map((k) => renderNode(k.id, depth + 1))}</ul>}
      </li>);

  };

  const root = childrenOf(tree, null);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Org hierarchy" className="rounded-card bg-bg p-4 ring-1 ring-line md:p-5">
        <p className="mb-4 text-[12px] text-muted">
          Hiring defaults to flat (no reportsTo). Drag an agent onto another to set a manager later, or use Reports to.
        </p>
        <ul className="space-y-2">{root.map((r) => renderNode(r.id, 0))}</ul>
      </section>

      {selectedAgent && selectedNode &&
      <aside className="h-fit rounded-card bg-surface p-5 ring-1 ring-line" aria-label="Selected agent">
          <div className="flex items-center gap-3">
            <AgentAvatar agent={selectedAgent} size="lg" showStatus />
            <div>
              <h2 className="text-[15px] font-semibold text-ink">{selectedAgent.name}</h2>
              <p className="text-[12px] text-muted">{selectedAgent.role}</p>
            </div>
          </div>
          {isChiefSelected ?
        <p className="mt-4 text-[13px] text-muted">Chief stays flat with you and can't report to anyone.</p> :

        <>
              <label htmlFor="reports-to" className="mt-5 block text-[12px] font-medium text-muted">Reports to</label>
              <select
            id="reports-to"
            value={selectedNode.parentId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setReportsTo(selected, v === '' ? null : v);
            }}
            className="mt-1.5 w-full rounded-lg bg-bg px-3 py-2 text-sm text-ink outline-none ring-1 ring-line focus:ring-accent/60">
            
                <option value="">Flat · no manager</option>
                {possibleParents.map((n) =>
            <option key={n.id} value={n.id}>{getAgent(n.id)?.name ?? n.id}</option>
            )}
              </select>
              {selectedNode.parentId !== null &&
            <div className="mt-3 flex gap-2">
                <button
              type="button"
              onClick={() => shift(selected, -1)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
              
                  <ArrowUpIcon size={13} aria-hidden="true" /> Move up
                </button>
                <button
              type="button"
              onClick={() => shift(selected, 1)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
              
                  <ArrowDownIcon size={13} aria-hidden="true" /> Move down
                </button>
              </div>
            }
            </>
        }
          <p className="mt-5 border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
            Changes are logged. Reporting lines decide who hands off to whom; approvals still come to you.
          </p>
        </aside>
      }
    </div>);

}
