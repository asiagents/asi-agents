import React from 'react';
import { Link } from 'react-router-dom';
import { DownloadIcon, MaximizeIcon, MonitorIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { WatchSurface } from './WatchSurface';
import { DeskHealth } from './DeskHealth';
import { useDesk } from '../../contexts/DeskContext';

export function DeskPanel({ bare = false }: {bare?: boolean;}) {
  const { deskModule, deskInstall, startInstall, watching, setWatching } = useDesk();

  const status = !deskModule ? 'Off' : deskInstall === 'installed' ? 'Installed' : deskInstall === 'installing' ? 'Installing' : 'Not installed';

  return (
    <section className={bare ? '' : 'rounded-card bg-surface p-4 ring-1 ring-line'} aria-label="Virtual Computer">
      {!bare &&
      <div className="flex items-center gap-2">
          <MonitorIcon size={15} className="text-muted" aria-hidden="true" />
          <h2 className="text-[13px] font-semibold text-ink">Virtual Computer</h2>
          <span className="ml-auto rounded-full bg-overlay/[0.06] px-2 py-0.5 text-[11px] font-medium text-muted">{status}</span>
        </div>
      }
      {bare && <div className="text-[11px] font-medium text-muted">Desk · {status}</div>}

      {!deskModule ?
      <div className="mt-3">
          <p className="text-[12px] leading-relaxed text-muted">
            The module is off. Turn it on to let agents run commands in a sandbox you can watch from here.
          </p>
          <Link
          to="/settings/safety"
          aria-label="Enable Virtual Computer in Settings"
          className="mt-3 inline-flex rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
          
            Enable in Settings
          </Link>
        </div> :
      deskInstall === 'none' ?
      <div className="mt-3">
          <p className="text-[12px] leading-relaxed text-muted">Install the sandbox. It stays separate from your files.</p>
          <button
          type="button"
          onClick={startInstall}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 hover:bg-accent-2">
          
            <DownloadIcon size={13} aria-hidden="true" /> Install
          </button>
        </div> :
      deskInstall === 'installing' ?
      <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-overlay/[0.08]">
            <motion.div className="h-full bg-accent" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 1.3, ease: 'linear' }} />
          </div>
          <p className="mt-2 text-[11px] text-muted">Setting up sandbox…</p>
        </div> :

      <div className="mt-3 space-y-3">
          <WatchSurface watching={watching} compact />
          <DeskHealth compact />
          <div className="flex gap-2 border-t border-line pt-3">
            <button
            type="button"
            onClick={() => setWatching(!watching)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
            
              {watching ? <PauseIcon size={12} aria-hidden="true" /> : <PlayIcon size={12} aria-hidden="true" />}
              {watching ? 'Pause' : 'Watch'}
            </button>
            <Link
            to="/desk"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent/10">
            
              <MaximizeIcon size={12} aria-hidden="true" /> Full view
            </Link>
          </div>
        </div>
      }
    </section>);

}