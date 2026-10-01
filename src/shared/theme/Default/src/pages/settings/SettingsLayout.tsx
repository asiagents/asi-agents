import React, { useEffect, useMemo, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LinkIcon } from 'lucide-react';
import { settingsPages } from '../../data/settingsPages';
import { usePrefs } from '../../contexts/PrefsContext';

export function SettingsLayout() {
  const { pathname, hash } = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { customNavLinks } = usePrefs();
  const current =
    settingsPages.find((p) => p.to === pathname) ??
    (pathname === '/settings' ? settingsPages[0] : settingsPages.find((p) => p.id === 'general')!);

  const leftCustom = useMemo(
    () => customNavLinks.filter((c) => c.surfaces.includes('left')),
    [customNavLinks]
  );

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    else scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname, hash]);

  return (
    <div className="grid h-full w-full md:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="border-b border-line bg-surface md:border-b-0 md:border-r">
        <ul className="flex gap-1 overflow-x-auto p-2 md:block md:space-y-0.5 md:overflow-visible md:p-3">
          {settingsPages.map((p) => (
            <li key={p.id} className="shrink-0">
              <NavLink
                to={p.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 ${
                    isActive ? 'bg-accent/10 text-accent-ink' : 'text-muted hover:bg-overlay/[0.04] hover:text-ink'
                  }`
                }
              >
                <p.icon size={16} aria-hidden="true" className="shrink-0" />
                <span className="whitespace-nowrap text-[13px] font-medium">{p.label}</span>
              </NavLink>
            </li>
          ))}
          {leftCustom.length > 0 ? (
            <li className="mt-2 hidden border-t border-line pt-2 md:block" aria-hidden="true" />
          ) : null}
          {leftCustom.map((c) => {
            const external = /^https?:\/\//i.test(c.to);
            const className =
              'flex items-center gap-3 rounded-lg px-3 py-2 text-muted transition-colors duration-150 hover:bg-overlay/[0.04] hover:text-ink';
            return (
              <li key={c.id} className="shrink-0">
                {external ? (
                  <a href={c.to} target="_blank" rel="noopener noreferrer" className={className}>
                    <LinkIcon size={16} aria-hidden="true" className="shrink-0" />
                    <span className="whitespace-nowrap text-[13px] font-medium">{c.label}</span>
                  </a>
                ) : (
                  <Link to={c.to} className={className}>
                    <LinkIcon size={16} aria-hidden="true" className="shrink-0" />
                    <span className="whitespace-nowrap text-[13px] font-medium">{c.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div ref={scrollRef} className="min-h-0 overflow-y-auto px-4 pb-32 pt-6 md:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{current.label}</h1>
        <p className="mb-8 mt-1 text-sm text-muted">{current.description}</p>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
