import React, { useEffect, useState } from 'react';
import { usePrefs } from '../../contexts/PrefsContext';
import { PlusIcon } from 'lucide-react';
import { SettingsSection } from '../../components/settings/SettingsUI';
import { EmailProfileList } from '../../components/inbox/EmailProfileList';
import { EmailSetup } from '../../components/inbox/EmailSetup';
import { SettingsProviders } from './SettingsProviders';
import { SettingsKeys } from './SettingsKeys';
import { SettingsApis } from './SettingsApis';
import { SettingsCalendar } from './SettingsCalendar';
import { SettingsDrive } from '../../components/connections/SettingsDrive';
import { OAuthConfigureForm } from '../../components/connections/OAuthConfigureForm';
import { ConnectionsRuntimes } from './ConnectionsRuntimes';
import { ConnectionsPostgres } from './ConnectionsPostgres';
import { SettingsRow } from '../../components/settings/SettingsUI';
import { Toggle } from '../../components/Toggle';
import { useSettings } from '../../contexts/SettingsContext';
import { api } from '@asi-api';
import { Link } from 'react-router-dom';

/** Connections: Models providers | Runtimes | Postgres | email / calendar / Drive / API stubs. */
export function SettingsConnections() {
  const [adding, setAdding] = useState(false);
  const { s, set } = useSettings();
  const { refreshEmailConnection, gmailOAuthReady } = usePrefs();
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('email') === 'connected') void refreshEmailConnection();
  }, [refreshEmailConnection]);

  const testConnection = async () => {
    setTestMsg(null);
    try {
      const r = await api.testInboxEmailConnection();
      if (r.ok) {
        setTestMsg(`IMAP OK — ${r.mailbox ?? 'INBOX'} has ${r.messageCount ?? 0} messages (${r.host}:${r.port}).`);
      } else {
        setTestMsg(r.message ?? r.error ?? 'Test failed');
      }
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : 'Test failed');
    }
  };

  return (
    <>
      <SettingsSection title="Status banner" description="API and registry line under the header. Off by default.">
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Service status strip" detail="Shows :3445 health and registry live count.">
            <Toggle label="Service status strip" checked={s.serviceStrip} onChange={(v) => set('serviceStrip', v)} />
          </SettingsRow>
        </div>
      </SettingsSection>

      <div className="mb-6 max-w-2xl space-y-2 text-[13px] text-muted">
        <p>
          Cloud LLM keys and enable toggles persist in server app-state (secrets masked on read). Inbox and Calendar stay
          empty until you connect — no demo mail or events. Use{' '}
          <span className="font-medium text-ink">Configure / Set up</span> to save OAuth client secrets in-app (Secret
          saved + last4), or set env vars — see <code className="text-ink">docs/FEATURE-FLAGS.md</code>.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-ink">Email:</span> IMAP (host/port/user/app password) or Gmail OAuth after
            Configure. POP3 is coming later — use IMAP.
          </li>
          <li>
            <span className="font-medium text-ink">Calendar / Microsoft:</span> Configure client secrets, then Connect.
            Graph mail scope is requested with Microsoft Calendar connect.
          </li>
          <li>
            <span className="font-medium text-ink">Drive:</span> Optional separate card — never bundled into Gmail OAuth.
          </li>
          <li>
            <Link to="/files" className="font-medium text-accent-ink hover:underline">
              File manager
            </Link>{' '}
            — local uploads and artifacts on this machine.
          </li>
        </ul>
      </div>

      <SettingsSection
        id="providers"
        title="Models providers"
        description="Enable each cloud provider (persisted on :3445). Off fails closed. Inference needs a server-stored key."
      >
        <SettingsProviders />
      </SettingsSection>

      <SettingsSection
        id="keys"
        title="API keys"
        description="One key per cloud provider on the server. Configured cards show Secret saved + last4."
      >
        <SettingsKeys />
      </SettingsSection>

      <SettingsSection
        id="runtimes"
        title="Runtimes"
        description="Local and BYO runtime slots. Honest status — no fake connector adapters."
      >
        <ConnectionsRuntimes />
      </SettingsSection>

      <SettingsSection
        id="postgres"
        title="Postgres"
        description="Optional control-plane module. Default remains app-state.json files."
      >
        <ConnectionsPostgres />
      </SettingsSection>

      <SettingsSection
        id="email"
        title="Email profiles"
        description="BYO IMAP or Gmail. Configure OAuth secrets first if you want Sign in with Google. POP3 coming later."
      >
        <div className="max-w-2xl space-y-4">
          <OAuthConfigureForm slot="gmail" onSaved={() => void refreshEmailConnection()} />
          {!gmailOAuthReady ? (
            <p className="rounded-lg bg-bg px-3 py-2 text-[12px] text-muted ring-1 ring-line" role="status">
              Sign in with Google stays hidden until Gmail OAuth is configured above (or{' '}
              <code className="text-ink">ASI_GMAIL_*</code> env). Use IMAP / app password anytime.
            </p>
          ) : (
            <p className="text-[12px] text-success" role="status">
              Gmail OAuth ready — Sign in with Google appears in Add email profile.
            </p>
          )}
          <EmailProfileList />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void testConnection()}
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.04]"
            >
              Test IMAP connection
            </button>
            {testMsg ? <span className="text-[12px] text-muted">{testMsg}</span> : null}
          </div>
          {adding ? (
            <EmailSetup onDone={() => setAdding(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]"
            >
              <PlusIcon size={14} aria-hidden="true" /> Add email profile
            </button>
          )}
          <p className="text-[11px] text-faint">
            POP3: coming later. Prefer IMAP (host, port 993, user, app password) for any provider.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        id="calendar"
        title="Calendar"
        description="Configure OAuth app secrets, then Connect. Microsoft Graph is shipped when secrets are set."
      >
        <SettingsCalendar />
      </SettingsSection>

      <SettingsSection
        id="integrations"
        title="Cloud storage"
        description="Optional Google Drive (drive.readonly). OneDrive later. Local files stay under File manager."
      >
        <SettingsDrive />
      </SettingsSection>

      <SettingsSection id="apis" title="APIs" description="Voice and cloud stubs only. Live mail is under Email profiles.">
        <SettingsApis />
      </SettingsSection>
    </>
  );
}
