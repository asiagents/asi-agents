import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDownIcon, MenuIcon } from 'lucide-react';
import { useDesk } from '../contexts/DeskContext';
import { usePrefs } from '../contexts/PrefsContext';
import { useSettings } from '../contexts/SettingsContext';
import { resolveNavEntry, visibleNav } from '../data/nav';
import { emails } from '../data/inbox';
import type { NavEntry } from '../types/nav';

function isExternal(to: string): boolean {
  return /^https?:\/\//i.test(to);
}

/** Footer/lower rail — primary nav (expanded by default). */
export function BottomNav() {
  const { openApprovals, isTeamMode } = useDesk();
  const { navItems, emailProfiles, customNavLinks } = usePrefs();
  const { s } = useSettings();
  const { pathname } = useLocation();
  const emailOn = emailProfiles.length > 0;
  const [expanded, setExpanded] = useState(true);

  if (pathname.startsWith('/office') && !s.officeBottomNav) return null;

  const ids = visibleNav(navItems, isTeamMode, customNavLinks);
  const items = ids
    .map((id) => resolveNavEntry(id, customNavLinks))
    .filter(Boolean) as NavEntry[];
  const hasChat = ids.includes('chat');

  const isActive = (item: NavEntry) =>
    item.match.some((m) =>
      m === '/'
        ? pathname === '/' || (!hasChat && pathname.startsWith('/chat'))
        : pathname.startsWith(m)
    );

  const badgeFor = (id: string) => {
    if (id === (hasChat ? 'chat' : 'home')) return openApprovals;
    if (id === 'inbox') return emailOn ? emails.filter((e) => e.unread).length : 0;
    return 0;
  };

  const pos = s.footerStrip ? 'left-4' : 'left-1/2 -translate-x-1/2';

  if (!expanded) {
    return (
      <div className={`fixed bottom-4 z-40 flex items-center gap-2 ${pos}`}>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-controls="asi-bottom-nav"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-surface/95 px-4 text-[13px] font-semibold text-ink shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-1 ring-line backdrop-blur-xl hover:bg-raised"
        >
          <MenuIcon size={18} aria-hidden="true" />
          Menu
        </button>
      </div>
    );
  }

  return (
    <nav
      id="asi-bottom-nav"
      aria-label="Primary"
      className={`fixed bottom-4 z-40 flex max-w-[calc(100vw-16px)] items-center gap-1 overflow-x-auto rounded-full bg-surface/90 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-1 ring-line backdrop-blur-xl ${pos}`}
    >
      <button
        type="button"
        onClick={() => setExpanded(false)}
        aria-label="Collapse menu"
        className="relative flex h-[50px] w-[50px] shrink-0 flex-col items-center justify-center rounded-full text-muted hover:text-ink"
      >
        <ChevronDownIcon size={18} aria-hidden="true" />
        <span className="text-[10px] font-medium">Close</span>
      </button>
      {items.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        const badge = badgeFor(item.id);
        const className = `relative flex h-[50px] w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-150 sm:w-[66px] ${
          active ? 'text-accent-ink' : 'text-muted hover:text-ink'
        }`;
        const inner = (
          <>
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-accent/15"
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              />
            )}
            <span className="relative">
              <Icon size={18} aria-hidden="true" />
              {badge ? (
                <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-strong px-1 text-[10px] font-semibold text-white">
                  {badge}
                </span>
              ) : null}
            </span>
            <span className="relative whitespace-nowrap text-[11px] font-medium">{item.label}</span>
          </>
        );
        if (isExternal(item.to)) {
          return (
            <a
              key={item.id}
              href={item.to}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {inner}
            </a>
          );
        }
        return (
          <Link
            key={item.id}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className={className}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
