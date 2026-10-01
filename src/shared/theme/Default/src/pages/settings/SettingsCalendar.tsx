import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDaysIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type CalendarStatus } from '@asi-api';
import { StatusPill } from '../../components/settings/SettingsUI';
import { Toggle } from '../../components/Toggle';
import { OAuthConfigureForm } from '../../components/connections/OAuthConfigureForm';

const oauthBanner: Record<string, string> = {
  connected: 'Google Calendar connected.',
  ms_connected: 'Microsoft Graph connected.',
  denied: 'Sign-in was cancelled.',
  invalid_state: 'OAuth session expired — try Connect again.',
  not_configured: 'Server OAuth credentials are missing — use Configure below.',
  exchange_failed: 'Could not finish sign-in. Check redirect URI and client secret.',
};

export function SettingsCalendar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const st = await api.calendarStatus();
      setStatus(st);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const key = searchParams.get('calendar_oauth');
    if (!key) return;
    setFlash(oauthBanner[key] ?? 'Calendar OAuth finished.');
    searchParams.delete('calendar_oauth');
    setSearchParams(searchParams, { replace: true });
    void refresh();
  }, [searchParams, setSearchParams, refresh]);

  const oauthReady = status?.oauthConfigured === true;
  const connected = status?.googleConnected === true && status?.live === true && status?.connector === 'google';
  const msConnected =
    status?.microsoftConnected === true && status?.live === true && status?.connector === 'microsoft';
  const enabled = status?.enabled === true;
  const connector = status?.connector;
  const microsoftShipped = status?.microsoftShipped === true;
  const msSelected = connector === 'microsoft';
  const msConfigured = status?.microsoftOAuthConfigured === true;

  const onToggleGoogle = async (v: boolean) => {
    setBusy(true);
    try {
      await api.putCalendarPrefs({
        enabled: v,
        connector: v ? 'google' : null,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onToggleMicrosoft = async (v: boolean) => {
    setBusy(true);
    try {
      await api.putCalendarPrefs({
        enabled: v,
        connector: v ? 'microsoft' : null,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onDisconnectGoogle = async () => {
    setBusy(true);
    try {
      await api.calendarGoogleDisconnect();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onDisconnectMs = async () => {
    setBusy(true);
    try {
      await api.calendarMicrosoftDisconnect();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      {flash ? (
        <p className="rounded-lg bg-accent/10 px-3 py-2 text-[13px] text-accent-ink" role="status">
          {flash}
        </p>
      ) : null}

      <section className="rounded-card bg-surface ring-1 ring-line">
        <div className="flex items-start gap-3 border-b border-line p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-ink">
            <CalendarDaysIcon size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">Google Calendar</h2>
              {connected ? (
                <StatusPill tone="success">Live</StatusPill>
              ) : oauthReady ? (
                <StatusPill tone="muted">Ready to connect</StatusPill>
              ) : (
                <StatusPill tone="muted">Needs setup</StatusPill>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-muted">
              Read-only today&apos;s primary calendar. Scope: calendar.readonly — not Drive.
            </p>
          </div>
          {oauthReady ? (
            <Toggle
              label="Google Calendar enabled"
              checked={enabled && (connector === 'google' || connector == null)}
              disabled={busy || msSelected}
              onChange={onToggleGoogle}
            />
          ) : null}
        </div>
        <div className="space-y-3 p-4">
          <OAuthConfigureForm slot="google_calendar" onSaved={() => void refresh()} />
          {oauthReady ? (
            <>
              <p className="text-sm text-ink">
                Account:{' '}
                <span className="text-muted">
                  {status?.accountLabel ?? (connected ? 'Connected' : 'Not signed in')}
                </span>
              </p>
              <p className="text-[12px] text-muted">{status?.message}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!connected ? (
                  <button
                    type="button"
                    disabled={busy || !enabled || msSelected}
                    onClick={() => api.calendarGoogleConnect()}
                    className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-2 disabled:opacity-50"
                  >
                    Connect Google
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy || !connected}
                  onClick={() => void onDisconnectGoogle()}
                  className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.05] disabled:opacity-50"
                >
                  Disconnect
                </button>
                {connected ? (
                  <Link to="/calendar" className="text-[13px] font-medium text-accent-ink hover:underline">
                    Open Calendar
                  </Link>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-[12px] text-muted">Save client id/secret above, then Connect appears.</p>
          )}
        </div>
      </section>

      <section className="rounded-card bg-surface ring-1 ring-line">
        <div className="flex items-start gap-3 border-b border-line p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-ink">
            <CalendarDaysIcon size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">Microsoft (Graph)</h2>
              <StatusPill tone={microsoftShipped ? 'success' : 'muted'}>
                {microsoftShipped ? (msConnected ? 'Live' : 'Shipped') : 'Not shipped'}
              </StatusPill>
            </div>
            <p className="mt-0.5 text-[12px] text-muted">
              Calendar.Read + Mail.Read on connect. Configure secrets, enable, then Connect.
            </p>
          </div>
          {microsoftShipped && msConfigured ? (
            <Toggle
              label="Microsoft Calendar enabled"
              checked={msSelected}
              disabled={busy}
              onChange={onToggleMicrosoft}
            />
          ) : null}
        </div>
        <div className="space-y-3 p-4">
          <OAuthConfigureForm slot="microsoft" onSaved={() => void refresh()} />
          {microsoftShipped && msConfigured ? (
            <>
              <p className="text-[12px] text-muted">{status?.message}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!msConnected ? (
                  <button
                    type="button"
                    disabled={busy || !msSelected}
                    onClick={() => api.calendarMicrosoftConnect()}
                    className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-2 disabled:opacity-50"
                  >
                    Connect Microsoft
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy || !msConnected}
                  onClick={() => void onDisconnectMs()}
                  className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.05] disabled:opacity-50"
                >
                  Disconnect
                </button>
                <Link to="/calendar" className="text-[13px] font-medium text-accent-ink hover:underline">
                  Open Calendar
                </Link>
              </div>
            </>
          ) : (
            <p className="text-[12px] text-muted">
              Connect stays hidden until client id/secret are saved (fail-closed). Redirect:{' '}
              <code className="text-ink">
                {status?.microsoftRedirectUri ?? 'http://127.0.0.1:3445/api/calendar/oauth/microsoft/callback'}
              </code>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
