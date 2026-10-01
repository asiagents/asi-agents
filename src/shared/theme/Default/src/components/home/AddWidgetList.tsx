import React from 'react';
import { PlusIcon } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { widgetCatalog } from '../../data/widgets';
import { addWidget } from '../../utils/widgets';

type WidgetTarget = 'home' | 'lock';

/** Catalog of widgets. Some can appear more than once; shows how many are already placed. */
export function AddWidgetList({ target = 'home' }: { target?: WidgetTarget }) {
  const { s, set } = useSettings();
  const list = target === 'lock' ? s.lockWidgets : s.widgets;
  const placeLabel = target === 'lock' ? 'on Lock' : 'on Home';

  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {widgetCatalog.map((m) => {
        const count = list.filter((w) => w.type === m.type).length;
        return (
          <li key={m.type}>
            <button
              type="button"
              onClick={() => {
                if (target === 'lock') set('lockWidgets', addWidget(list, m.type));
                else set('widgets', addWidget(list, m.type));
              }}
              className="flex w-full items-center gap-3 rounded-xl bg-surface p-3 text-left ring-1 ring-line transition-colors duration-150 hover:ring-accent/40"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-ink">
                <PlusIcon size={15} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-ink">{m.label}</span>
                <span className="block truncate text-[12px] text-muted">
                  {m.description} · {m.sizes.join('/')}
                </span>
              </span>
              {count > 0 && (
                <span className="shrink-0 text-[11px] text-faint">
                  {count} {placeLabel}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
