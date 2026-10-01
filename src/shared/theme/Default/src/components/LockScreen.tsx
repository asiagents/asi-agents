import { useAgents } from '../contexts/AgentsContext';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CloudSunIcon, FingerprintIcon, LockOpenIcon, MonitorIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AgentAvatar } from './AgentAvatar';
import { PanicButton } from './chat/PanicButton';
import { DeskLiveView } from './desk/DeskLiveView';
import { LockClock } from './lock/LockClock';
import { useSettings } from '../contexts/SettingsContext';
import { useDesk } from '../contexts/DeskContext';
import { usePrefs } from '../contexts/PrefsContext';
import { useDeskStatus } from '../hooks/useDeskStatus';
import { useWeather, weatherLabel } from '../hooks/useWeather';
import { DEFAULT_DISPLAY_NAME } from '../types/settings';
import { t } from '../utils/i18n';
import { WidgetGrid } from './home/WidgetGrid';

/** Lock glimpse. No password → one-tap unlock; first unlock applies default display name if unset. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const agents = useAgents();
  const { s, set } = useSettings();
  const { appName } = usePrefs();
  const { pausedAt, deskModule } = useDesk();
  const navigate = useNavigate();
  const location = useLocation();
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState(false);
  const needsPw = !!s.lockPassword;
  const weather = useWeather(s.weatherLocation, s.tempUnit);
  const items = s.lockItems;
  const roomy = s.lockLayout === 'roomy';
  const hasLockWidgets = s.lockWidgets.length > 0;
  /** Same /api/desk/status + summarizeDesks path as DeskLiveView (desk preview work). */
  const deskLive = useDeskStatus({
    enabled: Boolean(deskModule && (items.vcs || items.counts)),
  });

  const counts = {
    live: agents.filter((a) => a.status === 'active' || a.status === 'waiting').length,
    idle: agents.filter((a) => a.status === 'idle').length,
    offline: agents.filter((a) => a.status === 'offline').length,
  };
  // Honest running count from daemon — do not zero when agents are paused.
  const desksRunning = deskModule && deskLive.live ? deskLive.summary.runningCount : 0;
  const deskLine = !deskModule
    ? 'Desk off'
    : deskLive.loading && !deskLive.live
      ? 'Checking desks…'
      : deskLive.live
        ? deskLive.statusLine
        : 'Desk offline';

  /** Live agents only — avoid a decorative dump of idle icons. */
  const liveAgents = agents.filter((a) => a.status === 'active' || a.status === 'waiting').slice(0, 5);
  const liveExtra = Math.max(0, counts.live - liveAgents.length);

  const finishUnlock = (dest?: string) => {
    if (!s.displayName) set('displayName', DEFAULT_DISPLAY_NAME);
    setPw('');
    set('locked', false);
    const returnTo =
      dest ??
      (location.pathname && location.pathname !== '/lock' ? `${location.pathname}${location.search}` : '/');
    navigate(returnTo, { replace: true });
    onUnlock();
  };

  const unlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (needsPw) {
      if (pw !== s.lockPassword) {
        setPwError(true);
        return;
      }
    }
    finishUnlock();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg text-ink"
      style={{ opacity: 1 }}
    >
      {/* Single brand signal — edit lives in Settings → Lock / user menu */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center border-b border-line/80 bg-bg/90 px-4 py-3 backdrop-blur-md sm:px-8">
        <p className="truncate text-[13px] font-medium tracking-wide text-ink">{appName}</p>
      </div>

      <div
        className={`mx-auto grid w-full flex-1 px-6 py-10 lg:items-center lg:px-10 ${
          roomy
            ? 'max-w-7xl gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,480px)]'
            : 'max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_420px]'
        }`}
      >
        <div>
          {items.time && <LockClock roomy={roomy} />}
          {items.weather && (
            <p className={`mt-4 inline-flex items-center gap-2 text-muted ${roomy ? 'text-[15px]' : 'text-sm'}`}>
              <CloudSunIcon size={roomy ? 18 : 16} aria-hidden="true" />
              {weather.status === 'ready'
                ? `${weather.temp}°${s.tempUnit} · ${weatherLabel(weather.code)} · ${weather.place}`
                : weather.status === 'loading'
                  ? 'Weather…'
                  : !s.weatherLocation.trim()
                    ? 'Weather — set location in Settings'
                    : 'Weather unavailable'}
            </p>
          )}

          {(items.counts || items.vcs) && (
            <dl className={`mt-8 flex flex-wrap ${roomy ? 'gap-10' : 'gap-8'}`}>
              {items.counts && (
                <>
                  <Count label="Live" value={counts.live} dot="bg-success" roomy={roomy} />
                  <Count label="Idle" value={counts.idle} dot="bg-faint" roomy={roomy} />
                  <Count label="Offline" value={counts.offline} dot="bg-danger" roomy={roomy} />
                </>
              )}
              {items.vcs && (
                <Count label="Virtual computers working" value={desksRunning} dot="bg-accent" roomy={roomy} />
              )}
            </dl>
          )}
          {items.vcs && (
            <p className={`${items.counts || items.vcs ? 'mt-3' : 'mt-8'} text-sm text-muted`}>{deskLine}</p>
          )}

          {liveAgents.length > 0 ? (
            <div className="mt-6 flex items-center gap-3">
              <div className="flex -space-x-2" aria-label={`${counts.live} agents working`}>
                {liveAgents.map((a) => (
                  <span key={a.id} className="rounded-[12px] ring-2 ring-bg" title={a.name}>
                    <AgentAvatar agent={a} size="md" showStatus />
                  </span>
                ))}
              </div>
              <p className="text-[12px] text-muted">
                {counts.live} working
                {liveExtra > 0 ? ` · +${liveExtra}` : ''}
              </p>
            </div>
          ) : null}
          {pausedAt && <p className="mt-4 text-sm font-medium text-danger">All agents paused at {pausedAt}</p>}

          {hasLockWidgets ? (
            <section aria-label="Lock widgets" className="mt-10">
              <WidgetGrid
                editing={false}
                target="lock"
                compact
                emptyMessage="No widgets on this lock layout."
              />
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          {items.vcs && deskModule && (
            <section aria-label="Virtual desktop glimpse" className="rounded-card bg-surface p-4 ring-1 ring-line">
              <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
                <MonitorIcon size={14} className="text-muted" aria-hidden="true" /> Desk preview
                <span className="ml-auto text-[11px] font-normal text-faint">{deskLine}</span>
              </h2>
              <div className={`overflow-hidden ${roomy ? 'h-56' : 'h-44'}`}>
                <DeskLiveView compact />
              </div>
            </section>
          )}

          <form onSubmit={unlock} className="rounded-card bg-surface p-5 ring-1 ring-line">
            <p className="text-sm text-muted">
              {s.displayName ? <>Welcome back, {s.displayName}</> : <>Welcome back</>}
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              <button
                type="button"
                onClick={() => {
                  if (needsPw && pw !== s.lockPassword) {
                    setPwError(true);
                    return;
                  }
                  finishUnlock('/settings/general');
                }}
                className="font-medium text-accent-ink hover:underline"
              >
                Profile &amp; app settings
              </button>
            </p>

            {needsPw ? (
              <>
                <label htmlFor="lock-pw" className="mt-3 block text-[12px] font-medium text-muted">
                  Password
                </label>
                <input
                  id="lock-pw"
                  type="password"
                  autoFocus
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
                    setPwError(false);
                  }}
                  aria-invalid={pwError}
                  aria-describedby={pwError ? 'lock-pw-err' : undefined}
                  className={`mt-1 w-full rounded-lg bg-bg px-3 py-2.5 text-sm text-ink outline-none ring-1 focus:ring-accent/60 ${
                    pwError ? 'ring-danger' : 'ring-line'
                  }`}
                />
                {pwError && (
                  <p id="lock-pw-err" className="mt-1.5 text-[12px] text-danger">
                    That password doesn't match. Try again.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!pw}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-strong py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-40"
                >
                  <LockOpenIcon size={16} aria-hidden="true" /> {t(s.language, 'unlock')}
                </button>
              </>
            ) : (
              <div className="mt-5 flex flex-col items-center gap-3">
                <button
                  type="submit"
                  aria-label={t(s.language, 'unlock')}
                  className="grid h-20 w-20 place-items-center rounded-full bg-accent-strong text-white shadow-sm transition-colors duration-150 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <FingerprintIcon size={36} aria-hidden="true" />
                </button>
                <span className="text-sm font-medium text-ink">{t(s.language, 'unlock')}</span>
                <span className="text-[12px] text-muted">One tap · no password set</span>
              </div>
            )}
          </form>

          {items.panic && (
            <div className="flex items-center gap-3 rounded-card bg-surface p-4 ring-1 ring-line">
              <p className="flex-1 text-[13px] text-muted">Stop every agent without unlocking.</p>
              <PanicButton size="lg" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Count({
  label,
  value,
  dot,
  roomy,
}: {
  label: string;
  value: number;
  dot: string;
  roomy?: boolean;
}) {
  return (
    <div>
      <dt className={`flex items-center gap-1.5 text-muted ${roomy ? 'text-[13px]' : 'text-[12px]'}`}>
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" /> {label}
      </dt>
      <dd className={`mt-1 font-semibold tabular-nums text-ink ${roomy ? 'text-4xl' : 'text-3xl'}`}>{value}</dd>
    </div>
  );
}
