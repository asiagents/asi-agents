import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BriefcaseIcon, HomeIcon, LockIcon, LogOutIcon, MoonIcon, PencilIcon, SunIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { usePrefs } from '../../contexts/PrefsContext';
import { useProfile } from '../../contexts/ProfileContext';
import { DEFAULT_DISPLAY_NAME } from '../../types/settings';
import { DEFAULT_AVATAR_EMOJI } from '../../utils/storage';
import type { UserProfileId } from '@asi-api';

export function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
}

export function UserMenu() {
  const { s, set, logout } = useSettings();
  const { theme, setTheme } = usePrefs();
  const { activeProfile, slice, setActiveProfile } = useProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = s.displayName ?? DEFAULT_DISPLAY_NAME;
  const emoji = (s.avatarEmoji || DEFAULT_AVATAR_EMOJI).trim() || DEFAULT_AVATAR_EMOJI;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-ink transition-colors duration-150 hover:bg-overlay/[0.05]';
  const switchTo = (id: UserProfileId) => {
    void setActiveProfile(id).then(() => setOpen(false));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.04] xl:pr-3"
      >
        <span
          className="grid h-7 w-7 place-items-center rounded-full bg-overlay/[0.08] text-[15px] leading-none ring-1 ring-line"
          aria-hidden="true"
          title={`${name} · change emoji in Settings`}
        >
          {emoji}
        </span>
        <span className="hidden min-w-0 flex-col xl:flex">
          <span className="whitespace-nowrap text-xs font-medium text-ink">{name}</span>
          <span className="truncate text-[10px] font-medium text-muted">
            {activeProfile === 'work' ? 'Work' : 'Personal'}
            {slice.displayContext ? ` · ${slice.displayContext}` : ''}
          </span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute right-0 top-11 z-50 w-56 rounded-xl bg-surface p-1 shadow-xl ring-1 ring-line"
          >
            <div className="px-3 py-2 text-[12px] text-muted">
              Signed in as <span className="font-medium text-ink">{name}</span>
            </div>
            <div className="mx-1 mb-1 rounded-lg bg-bg p-1 ring-1 ring-line" role="group" aria-label="Profile">
              <button
                role="menuitem"
                type="button"
                className={`${item} ${activeProfile === 'work' ? 'bg-accent/10 text-accent-ink' : ''}`}
                onClick={() => switchTo('work')}
              >
                <BriefcaseIcon size={15} aria-hidden="true" /> Work profile
              </button>
              <button
                role="menuitem"
                type="button"
                className={`${item} ${activeProfile === 'personal' ? 'bg-accent/10 text-accent-ink' : ''}`}
                onClick={() => switchTo('personal')}
              >
                <HomeIcon size={15} aria-hidden="true" /> Personal profile
              </button>
            </div>
            <button
              role="menuitem"
              type="button"
              className={item}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <SunIcon size={15} aria-hidden="true" /> : <MoonIcon size={15} aria-hidden="true" />}
              {theme === 'dark' ? 'Light theme' : 'Dark theme'}
            </button>
            <Link
              role="menuitem"
              to="/settings/lock"
              className={item}
              onClick={() => setOpen(false)}
            >
              <PencilIcon size={15} aria-hidden="true" /> Edit lock screen
            </Link>
            <button
              role="menuitem"
              type="button"
              className={item}
              onClick={() => {
                set('locked', true);
                setOpen(false);
              }}
            >
              <LockIcon size={15} aria-hidden="true" /> Lock
            </button>
            <button
              role="menuitem"
              type="button"
              className={`${item} text-danger`}
              onClick={() => {
                logout();
                setOpen(false);
              }}
            >
              <LogOutIcon size={15} aria-hidden="true" /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
