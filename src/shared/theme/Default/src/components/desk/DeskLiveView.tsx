import React from 'react';
import { MonitorOffIcon } from 'lucide-react';
import {
  DESK_SETUP_STEPS,
  classifyDeskUiFailure,
  deskUiHeadline,
} from '@virtual-computer/integration/deskStatusMessage';
import { deskHasVnc } from '@virtual-computer/integration/deskSummary';
import { useDeskStatus } from '../../hooks/useDeskStatus';
import { DeskRosterCards } from './DeskRosterCards';

const DESK_URL = 'http://127.0.0.1:3456/?embed=1';

/** Live virtual desktop: roster from /api/desk/status; console embed when useful — never blank when desks run. */
export function DeskLiveView({ compact = false }: { compact?: boolean }) {
  const { live, status, desks, summary, statusLine, apiUnreachable, loading, error } = useDeskStatus();
  const height = compact ? 'min-h-0 h-full flex-1' : 'min-h-[280px]';
  const bodyH = compact ? 'h-full min-h-[7.5rem]' : 'h-[min(420px,50vh)]';
  const offlineH = compact ? 'h-full min-h-[7.5rem]' : 'min-h-[240px]';

  const consoleUrl = status?.consoleUrl ?? DESK_URL;
  const kind = classifyDeskUiFailure({
    apiUnreachable,
    live: status?.live,
    dockerAvailable: status?.dockerAvailable,
    state: status?.state,
  });
  const detail =
    error ?? status?.setupMessage ?? 'Start the desk daemon on :3456.';
  const dockerNote =
    live && status?.dockerAvailable === false
      ? status.dockerMessage ?? 'Docker off (optional) — local Playwright desks still work.'
      : null;
  const steps = status?.setupSteps?.length ? status.setupSteps : [...DESK_SETUP_STEPS];
  const hasVnc = desks.some(deskHasVnc);
  const showConsole = live && (hasVnc || summary.deskCount === 0) && !compact;

  return (
    <section
      aria-label="Virtual desktop display"
      className={`flex flex-col overflow-hidden rounded-card bg-[#0a0c11] ring-1 ring-line ${height}`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-[#f87171]" />
          <span className="h-2 w-2 rounded-full bg-[#fbbf24]" />
          <span className="h-2 w-2 rounded-full bg-[#34d399]" />
        </span>
        <span className="ml-1 truncate text-[11px] text-[#9aa3b5]">ASI Agents Desk</span>
        <span
          className={`ml-auto truncate text-[11px] font-medium ${
            live ? 'text-[#34d399]' : apiUnreachable ? 'text-[#f87171]' : 'text-[#9aa3b5]'
          }`}
          title={live ? statusLine : detail}
        >
          {loading && !status ? 'Checking…' : live ? statusLine : apiUnreachable ? 'API down' : 'Offline'}
        </span>
      </div>
      {live && dockerNote && !compact ? (
        <p className="border-b border-white/10 px-3 py-1.5 text-[10px] text-[#9aa3b5]" role="note">
          {dockerNote}
        </p>
      ) : null}
      <div className="relative min-h-0 flex-1">
        {live ? (
          <div className={`flex flex-col gap-2 overflow-y-auto p-2 ${compact ? '' : bodyH}`}>
            {summary.deskCount > 0 ? (
              <DeskRosterCards desks={desks} compact={compact} max={compact ? 2 : 6} enableSnap={!compact} />
            ) : (
              <p className="px-1 py-2 text-[11px] text-[#9aa3b5]">Daemon live — no desks yet.</p>
            )}
            {showConsole ? (
              <iframe
                title="Virtual desktop console"
                src={consoleUrl}
                className="mt-1 min-h-[180px] w-full flex-1 rounded border-0 bg-[#0b0d13]"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            ) : null}
            {!hasVnc && summary.deskCount > 0 && !compact ? (
              <p className="px-1 text-[10px] text-[#6b7385]">
                Headless desks have no noVNC stream. Use Snap for a Playwright screenshot, or open the console at{' '}
                <span className="font-mono text-[#9aa3b5]">:3456</span>.
              </p>
            ) : null}
          </div>
        ) : (
          <div className={`grid place-items-center overflow-y-auto bg-[#0b0d13] p-4 text-center ${offlineH}`}>
            <MonitorOffIcon size={compact ? 22 : 28} className="text-[#6b7385]" aria-hidden="true" />
            <p className={`mt-2 font-semibold text-[#e8eaf0] ${compact ? 'text-[12px]' : 'text-[14px]'}`}>
              {deskUiHeadline(kind)}
            </p>
            <p
              className={`mt-1 max-w-sm leading-relaxed text-[#9aa3b5] ${
                compact ? 'text-[11px] line-clamp-3' : 'text-[12px]'
              }`}
            >
              {detail}
            </p>
            {!apiUnreachable && !compact && (
              <pre className="mt-3 max-w-full overflow-x-auto rounded-lg border border-white/10 bg-[#12151c] px-3 py-2 text-left font-mono text-[10px] text-[#c5cad6]">
                {steps.slice(0, 4).join('\n')}
              </pre>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
