import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgents } from '../../contexts/AgentsContext';
import { BRAWL_QUIPS, pick } from './agentQuips';

/** Two-agent button-mash brawl with local HP bars. */
export function AgentBrawl() {
  const agents = useAgents();
  const pool = agents.length >= 2 ? agents : [];
  const [aId, setAId] = useState(pool[0]?.id ?? '');
  const [bId, setBId] = useState(pool[1]?.id ?? pool[0]?.id ?? '');
  const [hpA, setHpA] = useState(100);
  const [hpB, setHpB] = useState(100);
  const [log, setLog] = useState<string[]>([]);
  const [winner, setWinner] = useState<string | null>(null);

  const a = pool.find((x) => x.id === aId);
  const b = pool.find((x) => x.id === bId);

  const strike = (side: 'a' | 'b') => {
    if (winner || !a || !b) return;
    const dmg = 4 + Math.floor(Math.random() * 10);
    const line = `${side === 'a' ? a.name : b.name}: ${pick(BRAWL_QUIPS)}`;
    setLog((prev) => [line, ...prev].slice(0, 6));
    if (side === 'a') {
      const next = hpB - dmg;
      setHpB(Math.max(0, next));
      if (next <= 0) setWinner(a.name);
    } else {
      const next = hpA - dmg;
      setHpA(Math.max(0, next));
      if (next <= 0) setWinner(b.name);
    }
  };

  const reset = () => {
    setHpA(100);
    setHpB(100);
    setWinner(null);
    setLog([]);
  };

  if (pool.length < 2) {
    return (
      <p className="text-[13px] text-muted">
        Need at least two agents on the roster. <Link to="/agents" className="text-accent-ink">Open agents</Link>
      </p>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-[12px] text-muted">
          Fighter A
          <select value={aId} onChange={(e) => setAId(e.target.value)} className="mt-1 w-full rounded-lg bg-surface px-2 py-2 text-[13px] ring-1 ring-line">
            {pool.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-muted">
          Fighter B
          <select value={bId} onChange={(e) => setBId(e.target.value)} className="mt-1 w-full rounded-lg bg-surface px-2 py-2 text-[13px] ring-1 ring-line">
            {pool.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-card bg-surface p-4 ring-1 ring-line">
        <div className="mb-2 flex justify-between text-[13px] font-medium text-ink">
          <span>{a?.name}</span>
          <span>{b?.name}</span>
        </div>
        <div className="mb-1 h-2 overflow-hidden rounded-full bg-bg">
          <div className="h-full bg-accent-strong transition-all" style={{ width: `${hpA}%` }} />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg">
          <div className="h-full bg-danger transition-all" style={{ width: `${hpB}%` }} />
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => strike('a')} disabled={!!winner} className="flex-1 rounded-lg bg-accent-strong py-3 text-sm font-medium text-white disabled:opacity-40">
            {a?.name} attacks
          </button>
          <button type="button" onClick={() => strike('b')} disabled={!!winner} className="flex-1 rounded-lg bg-danger py-3 text-sm font-medium text-white disabled:opacity-40">
            {b?.name} attacks
          </button>
        </div>
      </div>

      {winner && (
        <p className="font-semibold text-ink">
          {winner} wins!{' '}
          <button type="button" onClick={reset} className="text-accent-ink underline">Rematch</button>
        </p>
      )}

      <ul className="space-y-1 text-[12px] text-muted">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>

      <Link to="/arcade" className="text-[13px] text-accent-ink hover:underline">← Arcade</Link>
    </div>
  );
}
