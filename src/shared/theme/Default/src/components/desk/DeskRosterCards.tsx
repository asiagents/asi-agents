import React, { useCallback, useState } from 'react';
import { CameraIcon, MonitorOffIcon } from 'lucide-react';
import { deskHasVnc, type DeskRow } from '@virtual-computer/integration/deskSummary';

type ShotMap = Record<string, string>;

async function tryScreenshotForAgent(agentId: string): Promise<string | null> {
  try {
    const create = await fetch('/api/desk/browser/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, threadId: `desk-preview:${agentId}` }),
    });
    const created = (await create.json().catch(() => ({}))) as {
      ok?: boolean;
      sessionId?: string;
      offline?: boolean;
    };
    if (!created?.ok || !created.sessionId || created.offline) return null;
    const sid = created.sessionId;
    const shot = await fetch(`/api/desk/browser/sessions/${encodeURIComponent(sid)}/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'screenshot', args: {} }),
    });
    const body = (await shot.json().catch(() => ({}))) as {
      ok?: boolean;
      base64?: string;
      mime?: string;
    };
    void fetch(`/api/desk/browser/sessions/${encodeURIComponent(sid)}`, { method: 'DELETE' }).catch(() => undefined);
    if (body?.ok && typeof body.base64 === 'string' && body.base64) {
      return `data:${body.mime || 'image/png'};base64,${body.base64}`;
    }
  } catch {
    /* fail closed — status cards still show */
  }
  return null;
}

function DeskCard({
  desk,
  compact,
  shot,
  onSnap,
  snapping,
}: {
  desk: DeskRow;
  compact?: boolean;
  shot?: string | null;
  onSnap?: () => void;
  snapping?: boolean;
}) {
  const id = String(desk.deskId || desk.agentId || 'desk');
  const status = String(desk.status || 'unknown');
  const mode = String(desk.mode || 'unknown');
  const runtime = String(desk.runtime || '');
  const noVnc = !deskHasVnc(desk);
  const note = typeof desk.note === 'string' ? desk.note : null;

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-lg bg-[#0b0d13] ring-1 ring-white/10 ${
        compact ? 'min-h-[7rem]' : 'min-h-[9rem]'
      }`}
      aria-label={`${id} ${status}`}
    >
      <header className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-2.5 py-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status === 'running' ? 'bg-[#34d399]' : status === 'hibernated' ? 'bg-[#fbbf24]' : 'bg-[#6b7385]'
          }`}
          aria-hidden="true"
        />
        <span className="truncate font-mono text-[10px] font-medium text-[#e8eaf0]">{id}</span>
        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-[#9aa3b5] ring-1 ring-white/15">
          {status}
        </span>
        {mode === 'headless' || noVnc ? (
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-[#93c5fd] ring-1 ring-[#60a5fa]/40">
            headless
          </span>
        ) : null}
        {runtime === 'local' ? (
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-[#9aa3b5] ring-1 ring-white/15">
            local
          </span>
        ) : null}
        {onSnap ? (
          <button
            type="button"
            disabled={snapping}
            onClick={onSnap}
            className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium text-[#9aa3b5] ring-1 ring-white/15 hover:text-[#e8eaf0] disabled:opacity-40"
            title="Capture Playwright screenshot"
          >
            <CameraIcon size={10} aria-hidden="true" /> Snap
          </button>
        ) : null}
      </header>
      <div
        className={`relative flex flex-1 flex-col items-center justify-center gap-1 p-2 ${
          compact ? 'min-h-[4.5rem]' : 'min-h-[6rem]'
        }`}
      >
        {shot ? (
          <img src={shot} alt={`${id} screenshot`} className="max-h-full w-full object-contain" />
        ) : noVnc ? (
          <>
            <MonitorOffIcon size={compact ? 16 : 20} className="text-[#6b7385]" aria-hidden="true" />
            <p className={`text-center font-medium text-[#c5cad6] ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
              headless — no VNC stream
            </p>
            <p
              className={`max-w-[95%] text-center leading-snug text-[#6b7385] ${
                compact ? 'text-[9px] line-clamp-2' : 'text-[10px]'
              }`}
            >
              {note || 'Local Playwright — agents drive via browser API. Docker/noVNC optional.'}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-[#9aa3b5]">GUI desk — open Desk for noVNC</p>
        )}
      </div>
    </article>
  );
}

/** Live desk cards from /api/desk/status — honest headless/no-VNC state, optional screenshot. */
export function DeskRosterCards({
  desks,
  compact = false,
  max = 4,
  enableSnap = true,
  emptyLabel = 'No desks from daemon.',
}: {
  desks: DeskRow[];
  compact?: boolean;
  max?: number;
  enableSnap?: boolean;
  emptyLabel?: string;
}) {
  const list = desks.slice(0, max);
  const [shots, setShots] = useState<ShotMap>({});
  const [snapping, setSnapping] = useState<string | null>(null);

  const snapOne = useCallback(async (desk: DeskRow) => {
    const key = String(desk.deskId || desk.agentId || '');
    const agentId = String(desk.agentId || '').trim() || key.replace(/^desk-/, '');
    if (!key || !agentId) return;
    setSnapping(key);
    const data = await tryScreenshotForAgent(agentId);
    setSnapping(null);
    if (data) setShots((prev) => ({ ...prev, [key]: data }));
  }, []);

  if (list.length === 0) {
    return <p className={`text-muted ${compact ? 'text-[11px]' : 'text-[12px]'}`}>{emptyLabel}</p>;
  }

  return (
    <div className={`grid gap-2 ${list.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {list.map((d, i) => {
        const key = String(d.deskId || d.agentId || `desk-${i}`);
        return (
          <DeskCard
            key={key}
            desk={d}
            compact={compact}
            shot={shots[key]}
            snapping={snapping === key}
            onSnap={enableSnap ? () => void snapOne(d) : undefined}
          />
        );
      })}
    </div>
  );
}
