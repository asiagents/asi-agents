import React, { useEffect, useState } from 'react';
import { CheckCircle2Icon, CircleSlashIcon, Loader2Icon } from 'lucide-react';
import { asiApiUnreachableMessage } from '@virtual-computer/integration/deskStatusMessage';
import { fetchDeskStatusWithAutostart } from '@virtual-computer/integration/ensureDeskClient';

type HealthRow = { id: string; label: string; detail: string; state: 'ok' | 'blocked' | 'pending' };

type DeskStatusPayload = {
  live?: boolean;
  error?: string;
  setupMessage?: string;
  dockerAvailable?: boolean;
  dockerMessage?: string | null;
  deskCount?: number;
  runningCount?: number;
  hibernatedCount?: number;
  stoppedCount?: number;
  headlessCount?: number;
  visibleCount?: number;
  url?: string;
  healthUrl?: string;
  probeOk?: boolean;
};

function rowsFromStatus(j: DeskStatusPayload, apiOk: boolean): HealthRow[] {
  if (!apiOk) {
    return [
      {
        id: 'asi',
        label: 'ASI API (:3445)',
        detail: asiApiUnreachableMessage(),
        state: 'blocked',
      },
      {
        id: 'daemon',
        label: 'Desk daemon (:3456)',
        detail: 'Cannot probe until the ASI API answers /api/desk/status.',
        state: 'pending',
      },
    ];
  }

  const daemonOk = j.live === true;
  const rows: HealthRow[] = [
    {
      id: 'asi',
      label: 'ASI API (:3445)',
      detail: j.probeOk === false ? j.setupMessage ?? 'Probe failed on the server.' : 'Desk status route reachable.',
      state: j.probeOk === false ? 'blocked' : 'ok',
    },
    {
      id: 'daemon',
      label: 'Desk daemon (:3456)',
      detail: daemonOk
        ? `${j.runningCount ?? 0} running · ${j.hibernatedCount ?? 0} hibernated · ${j.stoppedCount ?? 0} stopped · ${j.headlessCount ?? 0} headless`
        : j.error ?? j.setupMessage ?? 'Desk daemon not listening.',
      state: daemonOk ? 'ok' : 'blocked',
    },
  ];

  if (daemonOk) {
    rows.push({
      id: 'desks',
      label: 'Desks',
      detail:
        j.deskCount && j.deskCount > 0
          ? `${j.deskCount} desk(s) · ${j.runningCount ?? '—'} running · ${j.headlessCount ?? '—'} headless`
          : 'Daemon up — no desks listed yet.',
      state: (j.deskCount ?? 0) > 0 ? 'ok' : 'pending',
    });
  }

  if (daemonOk) {
    rows.push({
      id: 'docker',
      label: 'Docker Desktop (optional)',
      detail:
        j.dockerAvailable === false
          ? j.dockerMessage ??
            'Off — fine for local Playwright desks. Needed only for container/noVNC.'
          : j.dockerAvailable === true
            ? 'Available for container/noVNC desks.'
            : 'Not reported — optional for local Playwright browser tools.',
      state: j.dockerAvailable === false ? 'pending' : 'ok',
    });
  }

  return rows;
}

/** Live desk health from GET /api/desk/status — empty/honest until probe fills rows. */
export function DeskHealth({ compact = false }: {compact?: boolean;}) {
  const [rows, setRows] = useState<HealthRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchDeskStatusWithAutostart()
        .then(async (r) => {
          const j = (await r.json().catch(() => ({}))) as DeskStatusPayload;
          if (cancelled) return;
          setRows(rowsFromStatus(j, r.ok));
        })
        .catch(() => {
          if (cancelled) return;
          setRows(rowsFromStatus({}, false));
        });
    };
    load();
    const id = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (rows == null) {
    return (
      <p className={`flex items-center gap-2 ${compact ? 'text-[11px]' : 'text-[12px]'} text-muted`}>
        <Loader2Icon size={14} className="animate-spin" aria-hidden="true" />
        Probing Desk…
      </p>
    );
  }

  if (rows.length === 0) {
    return <p className={`${compact ? 'text-[11px]' : 'text-[12px]'} text-muted`}>No health checks yet.</p>;
  }

  return (
    <ul className={compact ? 'space-y-2' : 'space-y-3'}>
      {rows.map((h) => (
        <li key={h.id} className="flex items-start gap-2.5">
          {h.state === 'ok' ? (
            <CheckCircle2Icon size={compact ? 14 : 16} className="mt-0.5 shrink-0 text-success" aria-label="OK" />
          ) : h.state === 'pending' ? (
            <Loader2Icon size={compact ? 14 : 16} className="mt-0.5 shrink-0 animate-spin text-muted" aria-label="Pending" />
          ) : (
            <CircleSlashIcon size={compact ? 14 : 16} className="mt-0.5 shrink-0 text-danger" aria-label="Blocked" />
          )}
          <div className="min-w-0">
            <div className={`${compact ? 'text-[12px]' : 'text-sm'} text-ink`}>{h.label}</div>
            <div className={`${compact ? 'text-[11px]' : 'text-[12px]'} text-muted`}>{h.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
