import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgents } from '../../contexts/AgentsContext';
import { pick, RACE_QUIPS } from './agentQuips';

type Racer = { id: string; name: string; x: number; speed: number; color: string; quip: string };

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#ef4444', '#84cc16'];

/** Side-scrolling agent bike race — Space to boost your pick. */
export function AgentBikeRace() {
  const agents = useAgents();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const racersRef = useRef<Racer[]>([]);
  const finishRef = useRef(520);
  const runningRef = useRef(true);

  const lineup = useMemo(() => {
    const roster = agents.filter((a) => a.status !== 'offline').slice(0, 8);
    return roster.length >= 2 ? roster : agents.slice(0, 4);
  }, [agents]);

  const initRace = useCallback(() => {
    if (lineup.length === 0) return;
    setWinner(null);
    runningRef.current = true;
    racersRef.current = lineup.map((a, i) => ({
      id: a.id,
      name: a.name,
      x: 40 + i * 8,
      speed: 1.2 + Math.random() * 0.4,
      color: COLORS[i % COLORS.length],
      quip: '',
    }));
  }, [lineup]);

  useEffect(() => {
    if (lineup.length === 0) return;
    initRace();
    if (lineup[0]) setPlayerId((prev) => prev ?? lineup[0].id);
  }, [initRace, lineup]);

  const reset = () => initRace();

  useEffect(() => {
    if (lineup.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let raf = 0;

    const loop = () => {
      if (!runningRef.current) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#0f1419';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#334155';
      for (let i = 0; i < w; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i - (frame % 40), h * 0.72);
        ctx.lineTo(i + 20 - (frame % 40), h * 0.72);
        ctx.stroke();
      }

      const racers = racersRef.current;
      for (const r of racers) {
        const boost = r.id === playerId && frame % 120 < 30 ? 2.5 : 0;
        r.x += r.speed + boost + Math.random() * 0.15;
        if (Math.random() < 0.008) r.quip = pick(RACE_QUIPS);

        const y = 80 + racers.indexOf(r) * 36;
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x, y, 28, 14);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px system-ui';
        ctx.fillText(r.name.slice(0, 14), r.x, y - 6);
        if (r.quip) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px system-ui';
          ctx.fillText(r.quip, 8, y + 10);
        }

        if (r.x >= finishRef.current && runningRef.current) {
          runningRef.current = false;
          setWinner(r.name);
        }
      }

      ctx.strokeStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(finishRef.current, 40);
      ctx.lineTo(finishRef.current, h - 20);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.fillText('FINISH', finishRef.current - 24, 32);

      frame += 1;
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [lineup, playerId, winner]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (lineup.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        No agents on the roster yet. Open{' '}
        <Link to="/agents" className="text-accent-ink hover:underline">Agents</Link> when the API is up, then try again.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">
        Hold <kbd className="rounded bg-surface px-1.5 py-0.5 ring-1 ring-line">Space</kbd> for a boost.
        Pick your racer below.
      </p>
      <div className="flex flex-wrap gap-2">
        {lineup.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setPlayerId(a.id)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ring-1 transition-colors ${
              playerId === a.id ? 'bg-accent/20 text-accent-ink ring-accent/50' : 'bg-surface text-muted ring-line'
            }`}
          >
            {a.name}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} width={640} height={360} className="w-full max-w-2xl rounded-card ring-1 ring-line" />
      {winner && (
        <p className="text-[15px] font-semibold text-ink">
          {winner} wins!{' '}
          <button type="button" onClick={reset} className="ml-2 text-accent-ink underline">
            Race again
          </button>
        </p>
      )}
      <Link to="/arcade" className="text-[13px] text-accent-ink hover:underline">← Arcade</Link>
    </div>
  );
}
