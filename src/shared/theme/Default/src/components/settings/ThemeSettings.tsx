import React from 'react';
import { MoonIcon, SunIcon } from 'lucide-react';
import { usePrefs } from '../../contexts/PrefsContext';
import type { Theme } from '../../types/settings';

const options: {id: Theme;label: string;detail: string;icon: typeof SunIcon;swatch: string[];}[] = [
{ id: 'light', label: 'Light', detail: 'Default. Bright rooms and daytime.', icon: SunIcon, swatch: ['#f4f5f8', '#ffffff'] },
{ id: 'dark', label: 'Dark', detail: 'Calm for long evening sessions.', icon: MoonIcon, swatch: ['#0f1117', '#1a1e2b'] }];


export function ThemeSettings() {
  const { theme, setTheme, accent } = usePrefs();
  return (
    <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const active = theme === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.id)}
            className={`flex items-center gap-4 rounded-card p-4 text-left ring-1 transition-colors duration-150 ${
            active ? 'bg-accent/10 ring-accent/50' : 'bg-surface ring-line hover:bg-raised'}`
            }>
            
            <span className="flex overflow-hidden rounded-lg ring-1 ring-line" aria-hidden="true">
              {[...o.swatch, accent].map((c, i) =>
              <span key={i} className="h-9 w-5" style={{ background: c }} />
              )}
            </span>
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <o.icon size={14} aria-hidden="true" /> {o.label}
              </div>
              <div className="text-[12px] text-muted">{o.detail}</div>
            </div>
          </button>);

      })}
    </div>);

}