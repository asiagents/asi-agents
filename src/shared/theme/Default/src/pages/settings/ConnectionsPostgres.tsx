import React, { useCallback, useEffect, useState } from 'react';
import { DatabaseIcon, ExternalLinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, type PostgresModuleStatus } from '@asi-api';
import { StatusPill, inputClass } from '../../components/settings/SettingsUI';
import { Toggle } from '../../components/Toggle';

/** Optional Postgres module card — FileStore remains default; no fake DB connected. */
export function ConnectionsPostgres() {
  const [status, setStatus] = useState<PostgresModuleStatus | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const st = await api.postgresPrefs();
      setStatus(st);
      setError(null);
    } catch {
      setStatus(null);
      setError('Could not load Postgres prefs — is :3445 up?');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onToggle = async (v: boolean) => {
    setBusy(true);
    try {
      const st = await api.putPostgresPrefs({ usePostgres: v });
      setStatus(st);
    } catch {
      setError('Could not update Use Postgres.');
    } finally {
      setBusy(false);
    }
  };

  const onSaveUrl = async () => {
    setBusy(true);
    try {
      const st = await api.putPostgresPrefs({ connectionString: urlDraft.trim() || null });
      setStatus(st);
      setUrlDraft('');
    } catch {
      setError('Could not save connection string.');
    } finally {
      setBusy(false);
    }
  };

  const onClearUrl = async () => {
    setBusy(true);
    try {
      const st = await api.putPostgresPrefs({ connectionString: null });
      setStatus(st);
    } catch {
      setError('Could not clear connection string.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-2xl rounded-card bg-surface ring-1 ring-line" aria-labelledby="pg-title">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-ink">
          <DatabaseIcon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="pg-title" className="text-sm font-semibold text-ink">
              Use Postgres (optional)
            </h2>
            <StatusPill tone="warn">Module</StatusPill>
            {status?.configured ? (
              <StatusPill tone="success">Secret saved · ••••{status.last4}</StatusPill>
            ) : (
              <StatusPill tone="muted">No connection string</StatusPill>
            )}
            {status?.usePostgres ? (
              <StatusPill tone="success">Flag on</StatusPill>
            ) : (
              <StatusPill tone="muted">Off (files)</StatusPill>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-muted">
            Default stays <code className="text-ink">app-state.json</code>. Postgres is opt-in — see{' '}
            <span className="text-ink">docs/OPTIONAL-POSTGRES-MODULE.md</span>.
          </p>
        </div>
        <Toggle
          label="Use Postgres"
          checked={status?.usePostgres === true}
          disabled={busy || status?.envOverrides.usePostgres}
          onChange={(v) => void onToggle(v)}
        />
      </div>
      <div className="space-y-3 p-4">
        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
        <p className="text-[12px] text-muted">{status?.note ?? 'Loading…'}</p>
        <p className="text-[11px] text-faint">
          Active store: {status?.activeStore ?? 'file'}
          {status?.envOverrides.databaseUrl ? ' · ASI_DATABASE_URL overrides saved secret' : ''}
        </p>
        {!status?.envOverrides.databaseUrl ? (
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              aria-label="Postgres connection string"
              placeholder="postgresql://… (or leave empty)"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              className={`${inputClass} min-w-[16rem] flex-1`}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSaveUrl()}
              className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-2 disabled:opacity-40"
            >
              Save secret
            </button>
            {status?.configured ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onClearUrl()}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.05] disabled:opacity-40"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link to="/settings/company" className="text-[13px] font-medium text-accent-ink hover:underline">
            Company ops
          </Link>
          <a
            href="/api/control-plane/export"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink hover:underline"
          >
            <ExternalLinkIcon size={12} aria-hidden="true" />
            Export control-plane JSON
          </a>
        </div>
      </div>
    </section>
  );
}
