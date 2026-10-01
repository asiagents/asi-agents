import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2Icon, Minimize2Icon, MoonIcon, SunIcon, WaypointsIcon } from 'lucide-react';
import { HeaderSearch } from './HeaderSearch';
import { LinkToggles } from './header/LinkToggles';
import { AudioControls } from './header/AudioControls';
import { UserMenu } from './header/UserMenu';
import { NotificationTray } from './header/NotificationTray';
import { PanicButton } from './chat/PanicButton';
import { usePrefs } from '../contexts/PrefsContext';
import { useDesk } from '../contexts/DeskContext';
import { modeOptions } from '../data/modes';

/** Brand · mode · search · Local/Online · bell · audio · theme · app fullscreen · Panic · user. */
export function Header() {
  const { theme, setTheme, appName } = usePrefs();
  const { mode } = useDesk();
  const isDark = theme === 'dark';
  const m = modeOptions.find((o) => o.id === mode)!;
  const [appFs, setAppFs] = useState(false);

  useEffect(() => {
    const sync = () => setAppFs(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleAppFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* browser denied — fail closed, stay windowed */
    }
  };

  return (
    <header className="relative z-30 flex h-[54px] w-full shrink-0 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-xl">
      <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${appName} home`}>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-strong text-white">
          <WaypointsIcon size={15} aria-hidden="true" />
        </span>
        <span className="hidden whitespace-nowrap text-[15px] font-semibold tracking-tight text-ink sm:block">{appName}</span>
      </Link>
      <Link
        to="/settings/general"
        title="Change mode in Settings → App settings (General)"
        className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium text-muted ring-1 ring-line transition-colors duration-150 hover:text-ink md:inline-flex"
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.accent }} aria-hidden="true" />
        {m.label}
      </Link>

      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="hidden w-56 md:block xl:w-72">
          <HeaderSearch />
        </div>
        <LinkToggles />
        <NotificationTray />
        <AudioControls />
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="hidden h-8 w-8 place-items-center rounded-full text-muted ring-1 ring-line transition-colors duration-150 hover:text-ink sm:grid"
        >
          {isDark ? <SunIcon size={15} aria-hidden="true" /> : <MoonIcon size={15} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => void toggleAppFullscreen()}
          aria-label={appFs ? 'Exit full screen' : 'Enter full screen'}
          title={appFs ? 'Exit full screen (Esc)' : 'Full screen (whole app)'}
          className="grid h-8 w-8 place-items-center rounded-full text-muted ring-1 ring-line transition-colors duration-150 hover:text-ink"
        >
          {appFs ? <Minimize2Icon size={15} aria-hidden="true" /> : <Maximize2Icon size={15} aria-hidden="true" />}
        </button>
        <PanicButton />
        <UserMenu />
      </div>
    </header>
  );
}
