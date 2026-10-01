import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAgents } from '../../contexts/AgentsContext';
import { CHAOS_QUIPS, pick } from './agentQuips';

type Blob = { id: string; name: string; x: number; y: number; vx: number; vy: number; quip: string };

/** Agents bounce in a pit with random silly status lines. */
export function AgentChaos() {
  const agents = useAgents();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobsRef = useRef<Blob[]>([]);

  const lineup = agents.slice(0, 12);

  useEffect(() => {
    blobsRef.current = lineup.map((a, i) => ({
      id: a.id,
      name: a.name,
      x: 80 + (i % 4) * 120,
      y: 60 + Math.floor(i / 4) * 90,
      vx: (Math.random() - 0.5) * 2.2,
      vy: (Math.random() - 0.5) * 2.2,
      quip: '',
    }));
  }, [lineup]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || lineup.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const loop = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#374151';
      ctx.strokeRect(8, 8, w - 16, h - 16);

      for (const b of blobsRef.current) {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < 24 || b.x > w - 24) b.vx *= -1;
        if (b.y < 24 || b.y > h - 24) b.vy *= -1;
        if (Math.random() < 0.01) b.quip = pick(CHAOS_QUIPS);

        for (const o of blobsRef.current) {
          if (o.id === b.id) continue;
          const dx = o.x - b.x;
          const dy = o.y - b.y;
          if (dx * dx + dy * dy < 900) {
            b.vx -= dx * 0.002;
            b.vy -= dy * 0.002;
            if (Math.random() < 0.05) b.quip = `${b.name} bumps ${o.name}`;
          }
        }

        ctx.beginPath();
        ctx.arc(b.x, b.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#6366f1';
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(b.name.slice(0, 8), b.x, b.y + 32);
        if (b.quip) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px system-ui';
          ctx.fillText(b.quip, b.x, b.y - 28);
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [lineup]);

  if (lineup.length < 2) {
    return <p className="text-[13px] text-muted">Load agents first.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">Watch the roster bounce and collide. No API calls — just vibes.</p>
      <canvas ref={canvasRef} width={640} height={400} className="w-full max-w-2xl rounded-card ring-1 ring-line" />
      <Link to="/arcade" className="text-[13px] text-accent-ink hover:underline">← Arcade</Link>
    </div>
  );
}
