import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react';
import { SettingsRow, SettingsSection } from '../../components/settings/SettingsUI';
import { Toggle } from '../../components/Toggle';
import { AddWidgetList } from '../../components/home/AddWidgetList';
import { WidgetGrid } from '../../components/home/WidgetGrid';
import { LockClock } from '../../components/lock/LockClock';
import { useSettings } from '../../contexts/SettingsContext';
import { usePrefs } from '../../contexts/PrefsContext';
import { widgetCatalog } from '../../data/widgets';
import { canNudgeSpan, formatSpan, nudgeWidgetSpan, removeWidget, shiftWidget } from '../../utils/widgets';
import {
  isSquariEnabled,
  readCompanionSettings,
  setSquariOnLock,
} from '../../companion';


const iconBtn = 'grid h-8 w-8 place-items-center rounded-lg text-muted ring-1 ring-line transition-colors duration-150 hover:text-ink disabled:opacity-30';

export function SettingsWidgets() {
  const { s, set } = useSettings();
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-card bg-bg px-4 py-3 ring-1 ring-line">
        <p className="mr-auto text-[13px] text-muted">
          Reorder and set grid span (W×H) here, or use the full Home editor with drag-and-drop. Panic card is off by default — add it from Add below if you want it on the layout (header Panic stays).
        </p>
        <Link
          to="/?edit=1"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2">
          <PencilIcon size={14} aria-hidden="true" /> Edit on Home
        </Link>
      </div>
      <SettingsSection title="On Home" description="Same as editing on Home. Order here is the grid order. Span is columns × rows (up to 4×3).">
        {s.widgets.length === 0 ?
        <p className="text-sm text-muted">No widgets on Home.</p> :

        <ol className="max-w-2xl divide-y divide-line rounded-card bg-surface ring-1 ring-line">
            {s.widgets.map((w, i) => {
            const meta = widgetCatalog.find((m) => m.type === w.type)!;
            return (
              <li key={w.id} className="flex flex-wrap items-center gap-1.5 px-4 py-2.5">
                  <span className="min-w-0 flex-1 text-sm text-ink">{meta.label}</span>
                  <span className="w-10 text-center text-[12px] font-semibold tabular-nums text-muted" title="Grid span W×H">{formatSpan(w)}</span>
                  <button type="button" className={iconBtn} disabled={!canNudgeSpan(w, 'cols', -1)} onClick={() => set('widgets', nudgeWidgetSpan(s.widgets, w.id, 'cols', -1))} aria-label={`Narrow ${meta.label}`}><MinusIcon size={13} aria-hidden="true" /></button>
                  <button type="button" className={iconBtn} disabled={!canNudgeSpan(w, 'cols', 1)} onClick={() => set('widgets', nudgeWidgetSpan(s.widgets, w.id, 'cols', 1))} aria-label={`Widen ${meta.label}`}><PlusIcon size={13} aria-hidden="true" /></button>
                  <button type="button" className={iconBtn} disabled={!canNudgeSpan(w, 'rows', -1)} onClick={() => set('widgets', nudgeWidgetSpan(s.widgets, w.id, 'rows', -1))} aria-label={`Shorten ${meta.label}`}><ChevronUpIcon size={14} aria-hidden="true" /></button>
                  <button type="button" className={iconBtn} disabled={!canNudgeSpan(w, 'rows', 1)} onClick={() => set('widgets', nudgeWidgetSpan(s.widgets, w.id, 'rows', 1))} aria-label={`Make ${meta.label} taller`}><ChevronDownIcon size={14} aria-hidden="true" /></button>
                  <button type="button" className={iconBtn} disabled={i === 0} onClick={() => set('widgets', shiftWidget(s.widgets, w.id, -1))} aria-label={`Move ${meta.label} up`}><ArrowUpIcon size={14} aria-hidden="true" /></button>
                  <button type="button" className={iconBtn} disabled={i === s.widgets.length - 1} onClick={() => set('widgets', shiftWidget(s.widgets, w.id, 1))} aria-label={`Move ${meta.label} down`}><ArrowDownIcon size={14} aria-hidden="true" /></button>
                  <button type="button" className={`${iconBtn} hover:text-danger`} onClick={() => set('widgets', removeWidget(s.widgets, w.id))} aria-label={`Remove ${meta.label}`}><XIcon size={14} aria-hidden="true" /></button>
                </li>);

          })}
          </ol>
        }
      </SettingsSection>
      <SettingsSection title="Add">
        <AddWidgetList />
      </SettingsSection>
    </>);

}

export function SettingsPerformance() {
  const { s, set } = useSettings();
  return (
    <>
      <SettingsSection title="Visuals" description="Agent motion is linked to real status: working moves, idle breathes slowly, offline is still.">
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Home hero image" detail="Small desk banner on Home. Off by default so it does not block content. Also toggle from Home.">
            <Toggle label="Home hero image" checked={s.homeHeroImage} onChange={(v) => set('homeHeroImage', v)} />
          </SettingsRow>
          <SettingsRow title="Live agent visuals" detail="Idle loops / GIFs on every agent. Off = static images.">
            <Toggle label="Live agent visuals" checked={s.liveVisuals} onChange={(v) => set('liveVisuals', v)} />
          </SettingsRow>
          <SettingsRow title="Low-end mode" detail="Static agents, TTS off, lighter Office. You can re-enable each one.">
            <Toggle label="Low-end mode" checked={s.lowEnd} onChange={(v) => set('lowEnd', v)} />
          </SettingsRow>
          <SettingsRow
            title="Show message timing"
            detail="Per-message duration / tokens under chat bubbles. Off by default — local intent is not metered; we never show $0 as if it were billing.">
            <Toggle label="Show message timing" checked={s.showMessageTiming} onChange={(v) => set('showMessageTiming', v)} />
          </SettingsRow>
        </div>
      </SettingsSection>
      <SettingsSection title="Model map" description="How Models → detail draws the route from agent to model.">
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Animated flow" detail="Moving dots along each route. Off = static lines.">
            <Toggle label="Animated flow" checked={s.mapViz} onChange={(v) => set('mapViz', v)} />
          </SettingsRow>
          <SettingsRow title="Show bypassed hops" detail="Draw skipped router / encryption steps as dashed lines.">
            <Toggle label="Show bypassed hops" checked={s.mapShowBypass} onChange={(v) => set('mapShowBypass', v)} />
          </SettingsRow>
        </div>
      </SettingsSection>
      <SettingsSection title="Office ambiance" description="Also on the Office floor.">
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Tower sign" detail="Neon ASI AGENT CORP header on the live floor.">
            <Toggle label="Tower sign" checked={s.officeSign} onChange={(v) => set('officeSign', v)} />
          </SettingsRow>
          <SettingsRow title="Floor toolbar" detail="Lighting and plant toggles on Office.">
            <Toggle label="Floor toolbar" checked={s.officeToolbar} onChange={(v) => set('officeToolbar', v)} />
          </SettingsRow>
          <SettingsRow title="Bottom nav on Office" detail="Primary menu while viewing the live floor.">
            <Toggle label="Bottom nav on Office" checked={s.officeBottomNav} onChange={(v) => set('officeBottomNav', v)} />
          </SettingsRow>
          <SettingsRow title="Lighting" detail="Auto follows your clock: dim from 19:00 to 07:00.">
            <select value={s.officeLight} onChange={(e) => set('officeLight', e.target.value as typeof s.officeLight)} className="rounded-lg bg-bg px-2.5 py-1.5 text-[13px] text-ink ring-1 ring-line">
              <option value="auto">Auto</option>
              <option value="bright">Bright</option>
              <option value="dim">Dim</option>
            </select>
          </SettingsRow>
          <SettingsRow title="Greenery" detail="Plants on the floor (off by default).">
            <Toggle label="Greenery" checked={s.greenery} onChange={(v) => set('greenery', v)} />
          </SettingsRow>
        </div>
      </SettingsSection>
    </>);

}

function LockPasswordSection() {
  const { s, set } = useSettings();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = confirm.length > 0 && pw !== confirm;
  const field = 'w-full rounded-lg bg-bg px-3 py-2 text-sm text-ink outline-none ring-1 ring-line focus:ring-accent/60';

  return (
    <SettingsSection title="Lock password" description="Optional. Demo only — kept in memory on this device, never sent anywhere.">
      {s.lockPassword ?
      <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-[12px] font-medium text-success">Password set</span>
          <button type="button" onClick={() => set('lockPassword', null)} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-danger ring-1 ring-danger/30 transition-colors duration-150 hover:bg-danger/10">
            Remove password
          </button>
        </div> :

      <form
        className="grid max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (pw.length < 4 || mismatch) return;
          set('lockPassword', pw);
          setPw('');
          setConfirm('');
        }}>
        
          <label className="block">
            <span className="text-[12px] font-medium text-muted">New password (4+ characters)</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={`mt-1 ${field}`} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Confirm</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} className={`mt-1 ${field} ${mismatch ? 'ring-danger' : ''}`} />
          </label>
          {mismatch && <p className="text-[12px] text-danger">Passwords don't match.</p>}
          <button type="submit" disabled={pw.length < 4 || pw !== confirm} className="mt-1 w-fit rounded-lg bg-accent-strong px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            Set password
          </button>
        </form>
      }
    </SettingsSection>);

}

const lockLabels: { key: keyof ReturnType<typeof useSettings>['s']['lockItems']; label: string }[] = [
  { key: 'counts', label: 'Agent counts (live / idle / offline)' },
  { key: 'vcs', label: 'Desks running + live preview' },
  { key: 'time', label: 'Time' },
  { key: 'weather', label: 'Weather' },
  { key: 'panic', label: 'Panic button' },
];

export function SettingsLock() {
  const { s, set } = useSettings();
  const { appName } = usePrefs();
  const [squariMaster, setSquariMaster] = useState(() => isSquariEnabled());
  const [squariOnLock, setSquariOnLockLocal] = useState(() => readCompanionSettings().showSquariOnLock);
  const roomy = s.lockLayout === 'roomy';

  useEffect(() => {
    const refresh = () => {
      setSquariMaster(isSquariEnabled());
      setSquariOnLockLocal(readCompanionSettings().showSquariOnLock);
    };
    window.addEventListener('asi:companion-settings', refresh);
    window.addEventListener('asi:companion-toggle', refresh);
    return () => {
      window.removeEventListener('asi:companion-settings', refresh);
      window.removeEventListener('asi:companion-toggle', refresh);
    };
  }, []);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-card bg-bg px-4 py-3 ring-1 ring-line">
        <p className="mr-auto text-[13px] text-muted">
          Toggle what shows while locked, rearrange widgets on the live canvas below, Squari on lock, optional password,
          and snapshot timing. Open from the user menu → Edit lock screen, or Ctrl + Shift + L to lock.
        </p>
        <button
          type="button"
          onClick={() => set('locked', true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2"
        >
          Preview lock screen
        </button>
      </div>
      <SettingsSection
        title="Show while locked"
        description="Lock anytime from the user menu or Ctrl + Shift + L. Desk preview stays available when Desks running is on."
      >
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          {lockLabels.map((l) => (
            <SettingsRow key={l.key} title={l.label}>
              <Toggle
                label={l.label}
                checked={s.lockItems[l.key]}
                onChange={(v) => set('lockItems', { ...s.lockItems, [l.key]: v })}
              />
            </SettingsRow>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Squari Companion on lock"
        description="Independent of Home overlay timing — still requires Modules → Show Squari. When Modules is off, this does nothing."
      >
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow
            title="Show Squari on lock screen"
            detail={
              squariMaster
                ? squariOnLock
                  ? 'Larger companion on lock (idle/humming; urgent_ask when needed). Click unlocks into chat when no lock password.'
                  : 'Modules Squari is on — enable here to show on Lock.'
                : 'Turn on Modules → Show Squari first.'
            }
          >
            <Toggle
              label="Squari Companion on lock"
              checked={squariOnLock && squariMaster}
              locked={!squariMaster}
              onChange={(v) => {
                setSquariOnLockLocal(v);
                setSquariOnLock(v);
              }}
            />
          </SettingsRow>
          {!squariMaster ? (
            <div className="border-t border-line px-4 py-3 text-[12px] text-muted">
              <Link to="/settings/modules" className="font-medium text-accent-ink hover:underline">
                Open Modules
              </Link>{' '}
              to enable Squari Companion (prod default off; local/test bed on when unset).
            </div>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Lock layout editor"
        description="Live lock canvas — drag widgets to rearrange; use card controls for W×H. Order and spans save on this device. Same catalog as Home."
      >
        <div
          className={`mb-4 overflow-hidden rounded-card bg-bg ring-1 ring-line ${
            roomy ? 'p-6 sm:p-8' : 'p-5 sm:p-6'
          }`}
          aria-label="Lock screen live preview"
        >
          <div className="mb-4 flex items-center border-b border-line/70 pb-3">
            <p className="truncate text-[13px] font-medium tracking-wide text-ink">{appName}</p>
            <span className="ml-auto text-[11px] text-faint">Live edit · drag to reorder</span>
          </div>
          {s.lockItems.time ? (
            <div className="mb-6 max-w-xl">
              <LockClock roomy={roomy} compact />
            </div>
          ) : null}
          <WidgetGrid
            editing
            target="lock"
            compact
            emptyMessage="No widgets on Lock yet — add any Home widget below, then drag them here."
          />
          {s.lockItems.vcs ? (
            <p className="mt-4 text-[12px] text-muted">
              Desk preview stays on the lock face when Desks running is enabled (Show while locked).
            </p>
          ) : null}
        </div>
        <AddWidgetList target="lock" />
        <p className="mt-3 text-[12px] text-muted">
          Dig / Ana / Mech clock style follows the Time widget on Home. Comfort size is under Layout below.
        </p>
      </SettingsSection>

      <SettingsSection title="Layout" description="Roomy uses larger clock type and a wider lock canvas. Independent of Home widget resize.">
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Comfort" detail={s.lockLayout === 'roomy' ? 'Roomy' : 'Normal'}>
            <div className="flex gap-1.5" role="group" aria-label="Lock screen layout">
              {(['normal', 'roomy'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set('lockLayout', opt)}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize transition-colors duration-150 ${
                    s.lockLayout === opt
                      ? 'bg-accent/10 text-accent-ink ring-1 ring-accent/30'
                      : 'text-muted ring-1 ring-line hover:text-ink'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </SettingsRow>
        </div>
        <p className="mt-3 max-w-2xl text-[12px] text-muted">
          Welcome line uses your name from{' '}
          <Link to="/settings/general" className="font-medium text-accent-ink hover:underline">
            App settings (General)
          </Link>
          . Colors come from{' '}
          <Link to="/settings/theme" className="font-medium text-accent-ink hover:underline">
            Theme
          </Link>
          .
        </p>
      </SettingsSection>
      <LockPasswordSection />
      <SettingsSection title="Desktop snapshots" description="Timed captures of each agent's virtual desktop. Oldest rotate out.">
        <div className="max-w-2xl space-y-5">
          <label className="block">
            <span className="text-sm text-ink">
              Every <span className="font-semibold">{s.snapshotMin} min</span>
            </span>
            <input
              type="range"
              min={1}
              max={30}
              value={s.snapshotMin}
              onChange={(e) => set('snapshotMin', Number(e.target.value))}
              className="mt-2 w-full accent-[rgb(var(--accent))]"
              aria-label="Snapshot interval in minutes"
            />
            <span className="flex justify-between text-[11px] text-faint">
              <span>1 min</span>
              <span>30 min</span>
            </span>
          </label>
          <label className="block">
            <span className="text-sm text-ink">
              Keep last <span className="font-semibold">{s.snapshotKeep}</span> per agent
            </span>
            <input
              type="range"
              min={1}
              max={20}
              value={s.snapshotKeep}
              onChange={(e) => set('snapshotKeep', Number(e.target.value))}
              className="mt-2 w-full accent-[rgb(var(--accent))]"
              aria-label="Snapshots kept per agent"
            />
          </label>
        </div>
      </SettingsSection>
    </>
  );
}