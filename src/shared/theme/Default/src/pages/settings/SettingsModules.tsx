import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PuzzleIcon } from 'lucide-react';
import { SettingsSection, SettingsRow, StatusPill } from '../../components/settings/SettingsUI';
import { Toggle } from '../../components/Toggle';
import {
  COMPANION_SKINS,
  COMPANION_SKIN_LABELS,
  isCompanionTestBed,
  isSquariEnabled,
  readCompanionSettings,
  setCompanionCelebrationJump,
  setCompanionLookAt,
  setCompanionSize,
  setCompanionSkin,
  setSquariEnabled,
  type CompanionSize,
  type CompanionSkinId,
} from '../../companion';

type ModuleEntry = {
  id: string;
  name: string;
  version: string | null;
  status: 'live' | 'off' | 'partial' | 'planned';
  detail: string;
  docsPath: string | null;
  enableHint: string | null;
  folder: string | null;
};

type ModulesPayload = {
  pluginModel?: string;
  howToAdd?: string[];
  modules?: ModuleEntry[];
  error?: string;
};

const tone: Record<ModuleEntry['status'], 'success' | 'muted' | 'warn'> = {
  live: 'success',
  off: 'muted',
  partial: 'warn',
  planned: 'muted',
};

const statusLabel: Record<ModuleEntry['status'], string> = {
  live: 'Live',
  off: 'Off',
  partial: 'Partial',
  planned: 'Planned',
};

/** Settings → Modules — installed packs with honest status (not a marketplace). */
export function SettingsModules() {
  const [data, setData] = useState<ModulesPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [squariOn, setSquariOn] = useState(() => isSquariEnabled());
  const [lookAt, setLookAt] = useState(() => readCompanionSettings().lookAt);
  const [jumpOn, setJumpOn] = useState(() => readCompanionSettings().celebrationJump);
  const [size, setSize] = useState<CompanionSize>(() => readCompanionSettings().size);
  const [skin, setSkin] = useState<CompanionSkinId>(() => readCompanionSettings().skin);
  const testBed = isCompanionTestBed();

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/modules')
        .then(async (r) => {
          const j = (await r.json()) as ModulesPayload;
          if (cancelled) return;
          if (!r.ok) {
            setErr(j.error ?? `Modules API returned ${r.status}`);
            setData(j);
            return;
          }
          setErr(null);
          setData(j);
        })
        .catch(() => {
          if (!cancelled) {
            setErr('Could not reach GET /api/modules — is the ASI API on :3445 running?');
            setData(null);
          }
        });
    };
    load();
    const id = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const modules = (data?.modules ?? []).map((m) =>
    m.id === 'companion' || m.id === 'mascot'
      ? {
          ...m,
          id: 'companion',
          name: 'Squari Companion',
          status: (squariOn ? 'live' : 'off') as ModuleEntry['status'],
          detail: squariOn
            ? 'Squari on — states from to-dos, approvals, and chat typing.'
            : m.detail,
        }
      : m
  );

  return (
    <>
      <SettingsSection
        title="Companion characters"
        description={
          testBed
            ? 'ASI Agents Squari Companion — localhost/test bed defaults ON when unset. Prod stays OFF until enabled.'
            : 'ASI Agents Squari Companion — off by default. Enable Show Squari, pick a skin, optional lock toggle.'
        }
      >
        <div className="rounded-card bg-surface ring-1 ring-line">
          <SettingsRow
            title="Squari Companion"
            detail={
              testBed
                ? 'Bottom-right overlay (9:16 from 1080×1920). Click opens chat. Test bed / localhost: ON by default when unset.'
                : 'Bottom-right overlay (9:16 from 1080×1920). Click opens chat. Off by default. Lock needs Settings → Lock.'
            }
          >
            <Toggle
              label="Show Squari"
              checked={squariOn}
              onChange={(on) => {
                setSquariOn(on);
                setSquariEnabled(on);
              }}
            />
          </SettingsRow>
          {squariOn ? (
            <>
              <SettingsRow title="Size" detail="md = 280×498 · sm = 180×320 (narrow screens). Lock uses ~320×569.">
                <select
                  className="rounded-lg bg-raised px-2 py-1 text-[13px] text-ink ring-1 ring-line"
                  value={size}
                  aria-label="Companion size"
                  onChange={(e) => {
                    const next = e.target.value === 'sm' ? 'sm' : 'md';
                    setSize(next);
                    setCompanionSize(next);
                  }}
                >
                  <option value="md">md</option>
                  <option value="sm">sm</option>
                </select>
              </SettingsRow>
              <SettingsRow title="Look-at" detail="Cheap idle pointer follow (rAF-throttled). Off on lock and in urgent / typing / jump.">
                <Toggle
                  label="Enable look-at"
                  checked={lookAt}
                  onChange={(on) => {
                    setLookAt(on);
                    setCompanionLookAt(on);
                  }}
                />
              </SettingsRow>
              <SettingsRow title="Celebration jump" detail="Play jump ≤1.2s when a to-do completes.">
                <Toggle
                  label="Enable celebration jump"
                  checked={jumpOn}
                  onChange={(on) => {
                    setJumpOn(on);
                    setCompanionCelebrationJump(on);
                  }}
                />
              </SettingsRow>
              <SettingsRow
                title="Skin"
                detail="Seven skins under modules/Companion Agent/<skin>. Drakko is default for this build. Loads only the active skin + state."
              >
                <select
                  className="rounded-lg bg-raised px-2 py-1 text-[13px] text-ink ring-1 ring-line"
                  value={skin}
                  aria-label="Companion skin"
                  onChange={(e) => {
                    const next = e.target.value as CompanionSkinId;
                    setSkin(next);
                    setCompanionSkin(next);
                  }}
                >
                  {COMPANION_SKINS.map((id) => (
                    <option key={id} value={id}>
                      {COMPANION_SKIN_LABELS[id]}
                    </option>
                  ))}
                </select>
              </SettingsRow>
            </>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Installed modules"
        description="Optional packs mounted by ASI. Status is probed live — never pretended."
      >
        {err && (
          <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger ring-1 ring-danger/30">
            {err}
          </p>
        )}
        <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {modules.length === 0 && !err ? (
            <li className="flex items-center gap-3 p-4 text-[13px] text-muted">
              <PuzzleIcon size={16} className="text-faint" aria-hidden="true" />
              Loading module list…
            </li>
          ) : null}
          {modules.map((m) => (
            <li key={m.id} className="flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{m.name}</span>
                  <StatusPill tone={tone[m.status]}>{statusLabel[m.status]}</StatusPill>
                  {m.version ? <StatusPill tone="muted">v{m.version}</StatusPill> : null}
                </div>
                <p className="mt-1 text-[12px] text-muted">{m.detail}</p>
                {m.enableHint ? (
                  <p className="mt-1 text-[11px] text-faint">{m.enableHint}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                  {m.folder ? (
                    <span className="font-mono text-faint">{m.folder}</span>
                  ) : null}
                  {m.id === 'virtual-computer' ? (
                    <>
                      <Link to="/desk" className="font-medium text-accent-ink hover:underline">
                        Open Desk
                      </Link>
                      <span className="text-faint" title="Agent browser tools stay collapsed on Desk">
                        Advanced tools: Desk → Advanced · Agent browser tools
                      </span>
                    </>
                  ) : null}
                  {m.id === 'games' ? (
                    <Link to="/arcade" className="font-medium text-accent-ink hover:underline">
                      Open Arcade
                    </Link>
                  ) : null}
                  {m.id === 'ams' || m.id === 'router' ? (
                    <Link to="/settings/models" className="font-medium text-accent-ink hover:underline">
                      Models
                    </Link>
                  ) : null}
                  {m.id === 'postgres-store' ? (
                    <Link
                      to="/settings/connections#postgres"
                      className="font-medium text-accent-ink hover:underline"
                    >
                      Postgres prefs
                    </Link>
                  ) : null}
                  {m.id === 'companion' ? (
                    <button
                      type="button"
                      className="font-medium text-accent-ink hover:underline"
                      onClick={() => {
                        const next = !squariOn;
                        setSquariOn(next);
                        setSquariEnabled(next);
                      }}
                    >
                      {squariOn ? 'Disable' : 'Enable'}
                    </button>
                  ) : null}
                  {m.docsPath ? (
                    <span className="text-faint" title="Repo-relative docs path">
                      Docs: {m.docsPath}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection
        title="How to add more modules or versions"
        description="Honest plugin model — folders and Feature Flags, not an app store."
      >
        <div className="max-w-2xl space-y-3 rounded-card bg-surface p-4 text-[13px] text-muted ring-1 ring-line">
          <p className="text-ink">{data?.pluginModel ?? 'Optional packs live under modules/.'}</p>
          <ol className="list-decimal space-y-2 pl-5">
            {(data?.howToAdd ?? [
              'Add a workspace under modules/<name>.',
              'Mount routes from src/server.',
              'Document defaults in docs/FEATURE-FLAGS.md.',
            ]).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>
            Also see{' '}
            <code className="text-ink">modules/README.md</code>,{' '}
            <code className="text-ink">docs/MODULES.md</code>, and{' '}
            <code className="text-ink">docs/FEATURE-FLAGS.md</code>.
          </p>
        </div>
      </SettingsSection>
    </>
  );
}
