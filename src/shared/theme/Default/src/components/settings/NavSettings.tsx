import React, { useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, LinkIcon, LockIcon, PlusIcon, XIcon } from 'lucide-react';
import { usePrefs } from '../../contexts/PrefsContext';
import { hiddenNavIds, lockedNav, navCatalog, resolveNavEntry } from '../../data/nav';
import type { CustomNavSurface, NavId, NavSlotId } from '../../types/nav';
import { isCustomNavId } from '../../types/nav';

const iconBtn = 'grid h-8 w-8 place-items-center rounded-lg text-muted ring-1 ring-line transition-colors duration-150 hover:text-ink disabled:opacity-30';

/** Add, remove, and reorder bottom-menu items (drag or arrows). Home and Settings stay. */
export function NavSettings() {
  const {
    navItems,
    setNavItems,
    customNavLinks,
    addCustomNavLink,
    updateCustomNavLink,
    removeCustomNavLink,
  } = usePrefs();
  const [dragId, setDragId] = useState<NavSlotId | null>(null);
  const [label, setLabel] = useState('');
  const [path, setPath] = useState('');
  const [surfaces, setSurfaces] = useState<CustomNavSurface[]>(['bottom']);
  const available = navCatalog.filter(
    (n) => !navItems.includes(n.id) && !hiddenNavIds.includes(n.id as NavId)
  );

  const move = (id: NavSlotId, dir: -1 | 1) => {
    const i = navItems.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= navItems.length) return;
    const next = [...navItems];
    [next[i], next[j]] = [next[j], next[i]];
    setNavItems(next);
  };

  const dropOn = (target: NavSlotId) => {
    if (!dragId || dragId === target) return;
    const rest = navItems.filter((n) => n !== dragId);
    rest.splice(rest.indexOf(target), 0, dragId);
    setNavItems(rest);
  };

  const toggleSurface = (s: CustomNavSurface) => {
    setSurfaces((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const onAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !path.trim() || surfaces.length === 0) return;
    addCustomNavLink({ label: label.trim(), to: path.trim(), surfaces });
    setLabel('');
    setPath('');
    setSurfaces(['bottom']);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <ol className="divide-y divide-line rounded-card bg-surface ring-1 ring-line" aria-label="Menu order">
        {navItems.map((id, i) => {
          const n = resolveNavEntry(id, customNavLinks);
          if (!n) return null;
          const locked = lockedNav.includes(id as NavId);
          const custom = isCustomNavId(id);
          const customDef = custom ? customNavLinks.find((c) => c.id === id) : null;
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDragId(id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(id)}
              onDragEnd={() => setDragId(null)}
              className={`flex flex-col gap-2 px-3 py-2.5 ${dragId === id ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <GripVerticalIcon size={16} className="cursor-grab text-faint" aria-hidden="true" />
                <n.icon size={17} className="text-muted" aria-hidden="true" />
                <span className="flex-1 text-sm text-ink">
                  {n.label}
                  {custom ? (
                    <span className="ml-2 text-[11px] font-normal text-faint">Custom</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className={iconBtn}
                  disabled={i === 0}
                  onClick={() => move(id, -1)}
                  aria-label={`Move ${n.label} left`}
                >
                  <ArrowUpIcon size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  disabled={i === navItems.length - 1}
                  onClick={() => move(id, 1)}
                  aria-label={`Move ${n.label} right`}
                >
                  <ArrowDownIcon size={14} aria-hidden="true" />
                </button>
                {locked ? (
                  <span
                    className="grid h-8 w-8 place-items-center text-faint"
                    title="Always in the menu"
                  >
                    <LockIcon size={14} aria-label="Always in the menu" />
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`${iconBtn} hover:text-danger`}
                    onClick={() =>
                      custom ? removeCustomNavLink(id) : setNavItems(navItems.filter((x) => x !== id))
                    }
                    aria-label={`Remove ${n.label}`}
                  >
                    <XIcon size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              {customDef ? (
                <div className="ml-9 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={customDef.label}
                    onChange={(e) => updateCustomNavLink(id, { label: e.target.value })}
                    aria-label="Custom link label"
                    className="rounded-lg bg-bg px-2.5 py-1.5 text-[12px] text-ink ring-1 ring-line"
                  />
                  <input
                    value={customDef.to}
                    onChange={(e) => updateCustomNavLink(id, { to: e.target.value })}
                    aria-label="Custom link path or URL"
                    className="rounded-lg bg-bg px-2.5 py-1.5 text-[12px] text-ink ring-1 ring-line"
                  />
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    {(['bottom', 'left'] as CustomNavSurface[]).map((s) => (
                      <label key={s} className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={customDef.surfaces.includes(s)}
                          onChange={() => {
                            const next = customDef.surfaces.includes(s)
                              ? customDef.surfaces.filter((x) => x !== s)
                              : [...customDef.surfaces, s];
                            if (next.length === 0) return;
                            updateCustomNavLink(id, { surfaces: next });
                          }}
                        />
                        {s === 'bottom' ? 'Bottom' : 'Left'}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {available.length > 0 && (
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-ink">Add menu item</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {available.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() =>
                    setNavItems([...navItems.slice(0, -1), n.id, navItems[navItems.length - 1]])
                  }
                  className="flex w-full items-center gap-3 rounded-xl bg-surface p-3 text-left ring-1 ring-line transition-colors duration-150 hover:ring-accent/40"
                >
                  <n.icon size={17} className="text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">{n.label}</span>
                    <span className="block truncate text-[12px] text-muted">{n.description}</span>
                  </span>
                  <PlusIcon size={15} className="text-accent-ink" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={onAddCustom} className="space-y-3 rounded-card bg-surface p-4 ring-1 ring-line">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <LinkIcon size={15} aria-hidden="true" />
          Add custom link
        </h3>
        <p className="text-[12px] text-muted">
          Manual label + path or URL. Show in the bottom menu, settings left sidebar, or both.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-[12px] font-medium text-muted">
            Label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Lessons"
              className="mt-1 w-full rounded-lg bg-bg px-3 py-2 text-[13px] text-ink ring-1 ring-line placeholder:text-faint"
            />
          </label>
          <label className="block text-[12px] font-medium text-muted">
            Path or URL
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/settings/lessons or https://…"
              className="mt-1 w-full rounded-lg bg-bg px-3 py-2 text-[13px] text-ink ring-1 ring-line placeholder:text-faint"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-[12px] text-muted">
          {(['bottom', 'left'] as CustomNavSurface[]).map((s) => (
            <label key={s} className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={surfaces.includes(s)}
                onChange={() => toggleSurface(s)}
              />
              {s === 'bottom' ? 'Bottom menu' : 'Settings left menu'}
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={!label.trim() || !path.trim() || surfaces.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
        >
          <PlusIcon size={14} aria-hidden="true" />
          Add link
        </button>
      </form>
    </div>
  );
}
