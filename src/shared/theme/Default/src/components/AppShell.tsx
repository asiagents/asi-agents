import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { OctagonPauseIcon } from 'lucide-react';
import { Toaster } from 'sonner';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { HardwareFooter } from './HardwareFooter';
import { ConfirmDialog } from './ConfirmDialog';
import { LockScreen } from './LockScreen';
import { RedAlert } from './RedAlert';
import { useDesk } from '../contexts/DeskContext';
import { useSettings } from '../contexts/SettingsContext';
import { usePrefs } from '../contexts/PrefsContext';
import { useShortcuts } from '../hooks/useShortcuts';
import { ServiceStatusStrip } from './ServiceStatusStrip';
import { useLocalBackendAlert } from '../hooks/useLocalBackendAlert';
import { SquariCompanion } from '../companion';

export function AppShell() {
  const { pausedAt, resumeAll, panicOpen, pauseAll, cancelPanic } = useDesk();
  const { s } = useSettings();
  const { theme } = usePrefs();
  const location = useLocation();
  useShortcuts();
  // Toast once when Ollama / llama.cpp probes fail (banner also on Chat / Group / Home).
  useLocalBackendAlert({ toast: true });
  const [arcadeFullscreen, setArcadeFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const el = document.fullscreenElement;
      setArcadeFullscreen(Boolean(el && el.hasAttribute('data-arcade-shell')));
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const locked = s.locked || !s.displayName;
  const hideChrome = arcadeFullscreen;
  const needsOnboarding = !locked && !s.onboarded && location.pathname !== '/onboarding';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-ink">
      {!hideChrome && <Header />}
      {s.serviceStrip && <ServiceStatusStrip />}
      {pausedAt &&
      <div role="status" className="flex shrink-0 items-center gap-3 border-b border-danger/25 bg-danger/10 px-4 py-2 text-[13px] text-ink">
          <OctagonPauseIcon size={16} className="text-danger" aria-hidden="true" />
          <span>
            <span className="font-semibold">Panic: all agents paused at {pausedAt}.</span> Nothing runs, sends, or escalates. Logged.
          </span>
          <button type="button" onClick={resumeAll} className="ml-auto rounded-full bg-surface px-3 py-1 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-raised">
            Resume all
          </button>
        </div>
      }
      <main className="relative min-h-0 w-full flex-1">
        <Outlet />
      </main>
      {!hideChrome && <BottomNav />}
      {!hideChrome && <HardwareFooter />}

      <AnimatePresence>{locked && <LockScreen key="lock" onUnlock={() => undefined} />}</AnimatePresence>
      {needsOnboarding && <Navigate to="/onboarding" replace />}

      <RedAlert />
      <SquariCompanion />
      <ConfirmDialog
        open={panicOpen}
        title="Panic — stop every agent?"
        body="All agents pause immediately: no runs, sends, or escalations until you resume. This is different from Mute, which only silences audio."
        confirmLabel="Pause all agents"
        tone="danger"
        onConfirm={pauseAll}
        onCancel={cancelPanic} />
      
      <Toaster position="top-center" theme={theme} richColors closeButton />
    </div>);

}
