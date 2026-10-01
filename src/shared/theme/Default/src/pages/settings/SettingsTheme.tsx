import React from 'react';
import { CheckIcon } from 'lucide-react';
import { SettingsSection } from '../../components/settings/SettingsUI';
import { ThemeSettings } from '../../components/settings/ThemeSettings';
import { usePrefs } from '../../contexts/PrefsContext';
import { accentPresets } from '../../data/settings';

const defaults = {
  light: { bg: '#f4f5f8', card: '#ffffff' },
  dark: { bg: '#0f1117', card: '#1a1e2b' }
};

export function SettingsTheme() {
  const { accent, setAccent, theme, surfaces, setSurface } = usePrefs();
  const current = surfaces[theme] ?? defaults[theme];

  return (
    <>
      <SettingsSection title="Appearance" description="Light is the default. The sun/moon button in the header switches too.">
        <ThemeSettings />
      </SettingsSection>

      <SettingsSection title="Accent" description="Used for buttons, selection, and the active menu item.">
        <div className="flex flex-wrap items-center gap-3">
          {accentPresets.map((p) => {
            const active = accent.toLowerCase() === p.hex;
            return (
              <button
                key={p.hex}
                type="button"
                onClick={() => setAccent(p.hex)}
                aria-label={`${p.name} accent`}
                aria-pressed={active}
                className="flex flex-col items-center gap-1.5">
                
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full text-white ring-2 ring-offset-2 ring-offset-bg ${active ? 'ring-ink' : 'ring-transparent'}`}
                  style={{ background: p.hex }}>
                  
                  {active && <CheckIcon size={16} aria-hidden="true" />}
                </span>
                <span className="text-[11px] text-muted">{p.name}</span>
              </button>);

          })}
          <label className="flex flex-col items-center gap-1.5">
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-full border-0 bg-transparent p-0"
              aria-label="Custom accent color" />
            
            <span className="text-[11px] text-muted">Custom</span>
          </label>
        </div>
      </SettingsSection>

      <SettingsSection title="Surfaces" description={`Background and card colors for the ${theme} theme.`}>
        <div className="flex flex-wrap items-end gap-6">
          {(['bg', 'card'] as const).map((k) =>
          <label key={k} className="flex items-center gap-3">
              <input
              type="color"
              value={current[k]}
              onChange={(e) => setSurface(theme, { ...current, [k]: e.target.value })}
              className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
            
              <span>
                <span className="block text-sm text-ink">{k === 'bg' ? 'Background' : 'Cards & panels'}</span>
                <span className="block font-mono text-[11px] text-muted">{current[k]}</span>
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={() => setSurface(theme, null)}
            disabled={!surfaces[theme]}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40">
            
            Reset to default
          </button>
        </div>
        <div className="mt-6 rounded-card bg-bg p-4 ring-1 ring-line" aria-label="Preview">
          <div className="rounded-xl bg-surface p-4 ring-1 ring-line">
            <div className="text-sm font-semibold text-ink">Preview card</div>
            <p className="mt-1 text-[13px] text-muted">Muted text on your card color.</p>
            <button type="button" className="mt-3 rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white">Accent button</button>
          </div>
        </div>
      </SettingsSection>
    </>);

}