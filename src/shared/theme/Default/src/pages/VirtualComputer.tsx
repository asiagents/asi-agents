import { useEffect, useState } from 'react';

import { MonitorIcon } from 'lucide-react';

import { PageHeader, PageScroll } from '../components/PageScroll';

import { useDesk } from '../contexts/DeskContext';

import { VirtualComputerEmbed } from '@app-integrations/VirtualComputerEmbed';
import { asiApiUnreachableMessage } from '@virtual-computer/integration/deskStatusMessage';
import { deskStatusLine, summarizeDesks } from '@virtual-computer/integration/deskSummary';
import { fetchDeskStatusWithAutostart } from '@virtual-computer/integration/ensureDeskClient';

type DeskStatusChip = {
  live: boolean;
  setupMessage?: string;
  error?: string;
  dockerAvailable?: boolean;
  dockerMessage?: string;
  desks?: unknown;
  deskCount?: number;
  runningCount?: number;
  hibernatedCount?: number;
  stoppedCount?: number;
  headlessCount?: number;
  visibleCount?: number;
};

/** `/desk` — ASI Agents Virtual Computer (product Desk, not a lab strip). */
export function VirtualComputer() {
  const { deskModule, setDeskModule } = useDesk();

  const [status, setStatus] = useState<DeskStatusChip | null>(null);
  const [apiUnreachable, setApiUnreachable] = useState(false);

  useEffect(() => {
    if (!deskModule) return;

    let cancelled = false;

    const load = () => {
      fetchDeskStatusWithAutostart()
        .then(async (r) => {
          const j = (await r.json()) as DeskStatusChip;
          if (!cancelled) {
            setApiUnreachable(false);
            if (!r.ok) {
              setStatus({
                live: false,
                error: j.error ?? j.setupMessage ?? `Desk status API returned ${r.status}.`,
              });
              return;
            }
            setStatus(j);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setApiUnreachable(true);
            setStatus({
              live: false,
              error: asiApiUnreachableMessage(),
            });
          }
        });
    };

    load();

    const id = window.setInterval(load, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [deskModule]);

  if (!deskModule) {
    return (
      <div className="grid h-full place-items-center px-4 pb-28">
        <div className="max-w-md text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-overlay/[0.05] text-muted">
            <MonitorIcon size={22} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-ink">Virtual Computer is off</h1>
          <p className="mt-2 text-sm text-muted">
            An optional sandbox where ASI Agents work on a real desktop you can watch. It stays off until you turn it
            on.
          </p>
          <button
            type="button"
            onClick={() => setDeskModule(true)}
            className="mt-5 rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2"
          >
            Turn on module
          </button>
        </div>
      </div>
    );
  }

  const statusLabel = status
    ? apiUnreachable
      ? status.error ?? 'ASI Agents API unreachable'
      : status.live
        ? (() => {
            const fromList = summarizeDesks(status.desks);
            return deskStatusLine({
              deskCount: status.deskCount ?? fromList.deskCount,
              runningCount: status.runningCount ?? fromList.runningCount,
              hibernatedCount: status.hibernatedCount ?? fromList.hibernatedCount,
              stoppedCount: status.stoppedCount ?? fromList.stoppedCount,
              headlessCount: status.headlessCount ?? fromList.headlessCount,
              visibleCount: status.visibleCount ?? fromList.visibleCount,
            });
          })()
        : status.error ?? status.setupMessage ?? 'Desk offline'
    : 'Checking…';

  const dockerNote =
    status?.live && status.dockerAvailable === false
      ? status.dockerMessage ??
        'Docker is optional — local desks still work. Start Docker only for container previews.'
      : null;

  return (
    <PageScroll>
      <PageHeader
        title="Virtual Computer"
        description="Watch ASI Agents desks live — running and headless counts update from your Desk daemon."
        actions={
          <span
            className={`inline-flex max-w-[min(100%,320px)] items-center rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ${
              status?.live
                ? 'bg-success/10 text-success ring-success/30'
                : apiUnreachable
                  ? 'bg-danger/10 text-danger ring-danger/30'
                  : 'bg-overlay/[0.04] text-muted ring-line'
            }`}
            title={statusLabel}
          >
            <span
              className={`mr-2 h-2 w-2 shrink-0 rounded-full ${status?.live ? 'bg-success' : 'bg-faint'}`}
              aria-hidden="true"
            />
            <span className="truncate">{statusLabel}</span>
          </span>
        }
      />

      {dockerNote ? (
        <p className="mb-3 text-[12px] text-muted" role="note">
          {dockerNote}
        </p>
      ) : null}

      <VirtualComputerEmbed deskLive={status?.live} />
    </PageScroll>
  );
}
