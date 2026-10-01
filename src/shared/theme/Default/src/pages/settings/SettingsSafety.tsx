import React, { useState } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { notificationKinds } from '../../data/notifications';
import type { NotificationKind } from '../../types/notifications';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronRightIcon, DownloadIcon } from 'lucide-react';
import { SettingsRow, SettingsSection } from '../../components/settings/SettingsUI';
import { Toggle } from '../../components/Toggle';
import { PanicButton } from '../../components/chat/PanicButton';
import { useDesk } from '../../contexts/DeskContext';
import { useSettings } from '../../contexts/SettingsContext';
import { shortcuts } from '../../data/shortcuts';
import { exportControlLog } from '../../utils/exportLog';

export function SettingsSafety() {
  const { deskModule, setDeskModule, raiseRedAlert, controlLog, routerOffline, setRouterOffline } = useDesk();
  const { s, set } = useSettings();

  return (
    <>
      <SettingsSection title="Always on" description="These can't be turned off.">
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Fail closed" detail="Block when an agent is unsure or its model is offline."><Toggle label="Fail closed" checked locked /></SettingsRow>
          <SettingsRow title="Draft-first outbound" detail="Emails and channel posts wait for your Approve."><Toggle label="Draft-first" checked locked /></SettingsRow>
          <SettingsRow title="Visible handoffs" detail="Every model or agent switch shows in chat first."><Toggle label="Visible handoffs" checked locked /></SettingsRow>
          <SettingsRow title="Control log survives agent delete" detail="Stored in your vault; deleting an agent keeps its history."><Toggle label="Control log" checked locked /></SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection title="Panic" description="Pauses every agent after you confirm. Shortcut Ctrl + Shift + P. Mute (audio) is separate.">
        <PanicButton size="lg" />
      </SettingsSection>

      <SettingsSection title="Red alert" description="Full-page red takeover for urgent permission, intrusion, or injection. Only Approve / Deny / Acknowledge dismisses it.">
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Style" detail="Full page, or a red popup under the header.">
            <select value={s.redAlertStyle} onChange={(e) => set('redAlertStyle', e.target.value as 'page' | 'popup')} className="rounded-lg bg-bg px-2.5 py-1.5 text-[13px] text-ink ring-1 ring-line">
              <option value="page">Full page</option>
              <option value="popup">Header popup</option>
            </select>
          </SettingsRow>
          <SettingsRow title="Test" detail="Raise a sample alert.">
            <div className="flex flex-wrap gap-1.5">
              {(['permission', 'intrusion', 'injection'] as const).map((k) =>
              <button key={k} type="button" onClick={() => raiseRedAlert(k)} className="rounded-lg px-2.5 py-1 text-[12px] font-medium capitalize text-danger ring-1 ring-danger/30 transition-colors duration-150 hover:bg-danger/10">
                  {k}
                </button>
              )}
            </div>
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection title="Modules & failure tests">
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Virtual Computer module" detail="Sandbox agents use; watch it from Desk or the chat panel.">
            <Toggle label="Virtual Computer module" checked={deskModule} onChange={setDeskModule} />
          </SettingsRow>
          <SettingsRow title="Simulate local router offline" detail="See how chats fail closed.">
            <Toggle label="Router offline" checked={routerOffline} onChange={setRouterOffline} />
          </SettingsRow>
          <Link to="/permissions" className="flex items-center gap-3 border-t border-line px-4 py-3.5 text-sm text-ink transition-colors duration-150 hover:bg-overlay/[0.03]">
            Permissions: spend, shell, and skill gates
            <ChevronRightIcon size={16} className="ml-auto text-faint" aria-hidden="true" />
          </Link>
        </div>
      </SettingsSection>

      <SettingsSection title="Control log" description={`${controlLog.length} entries in your vault.`}>
        <button
          type="button"
          onClick={() => {
            exportControlLog(controlLog);
            toast.success('Control log downloaded');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2">
          
          <DownloadIcon size={15} aria-hidden="true" /> Export timeline (CSV)
        </button>
        <p className="mt-6 text-[13px] text-muted">Anonymized traffic relay — coming later.</p>
      </SettingsSection>
    </>);

}

export function SettingsNotifications() {
  const { s, set } = useSettings();
  const { notify } = useNotifications();
  const n = s.notify;
  const [perm, setPerm] = useState<string>(() => 'Notification' in window ? Notification.permission : 'unsupported');

  const askOs = async (v: boolean) => {
    if (v && 'Notification' in window && Notification.permission === 'default') {
      try {
        setPerm(await Notification.requestPermission());
      } catch {

        /* stub */}
    }
    set('notify', { ...n, os: v });
  };

  const samples: Record<NotificationKind, {title: string;detail: string;to?: string;}> = {
    approval: { title: 'Writer is waiting for your approval', detail: 'Use the cloud model for the abstract?', to: '/chat/chief' },
    agentDone: { title: 'Planner finished your week plan', detail: '5 blocks added, 1 conflict flagged.', to: '/tasks' },
    redAlert: { title: 'Red alert (test)', detail: 'Toast only — use Safety to test the full takeover.' },
    router: { title: 'Local router offline (test)', detail: 'Chats would fail closed.', to: '/settings/models' },
    mail: { title: 'New mail (test)', detail: 'Prof. Iyer: Re: capstone draft', to: '/inbox' }
  };

  return (
    <>
      <SettingsSection title="Notify me about" description="Everything lands in the bell tray. These toggles decide which ones also pop up.">
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          {notificationKinds.map((k) =>
          <SettingsRow key={k.kind} title={k.label} detail={'detail' in k ? k.detail : undefined}>
              <div className="flex items-center gap-3">
                <button
                type="button"
                onClick={() => notify({ kind: k.kind, ...samples[k.kind] })}
                className="rounded-md px-2 py-1 text-[12px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent/10">
                
                  Test
                </button>
                <Toggle label={k.label} checked={n[k.kind]} onChange={(v) => set('notify', { ...n, [k.kind]: v })} />
              </div>
            </SettingsRow>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Quiet & OS" description="Three different things: silence pop-ups (here), Mute all audio (Voice), and Panic (stops agents).">
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Silence notification pop-ups" detail="Toasts stop; the tray still collects everything. Audio and agents are unaffected.">
            <Toggle label="Silence notification pop-ups" checked={n.quiet} onChange={(v) => set('notify', { ...n, quiet: v })} />
          </SettingsRow>
          <SettingsRow title="OS notifications" detail={`Asks the browser for permission only. Current: ${perm}.`}>
            <Toggle label="OS notifications" checked={n.os} onChange={askOs} />
          </SettingsRow>
        </div>
        <ul className="mt-4 grid max-w-2xl gap-2 text-[12px] text-muted sm:grid-cols-3">
          <li className="rounded-xl bg-surface p-3 ring-1 ring-line"><span className="block font-semibold text-ink">Silence pop-ups</span>Hides toasts only.</li>
          <li className="rounded-xl bg-surface p-3 ring-1 ring-line"><span className="block font-semibold text-ink">Mute all audio</span>Header speaker. Agents keep working.</li>
          <li className="rounded-xl bg-surface p-3 ring-1 ring-line"><span className="block font-semibold text-danger">Panic</span>Pauses every agent.</li>
        </ul>
      </SettingsSection>
    </>);

}

export function SettingsShortcuts() {
  return (
    <SettingsSection title="Keyboard" description="Use Cmd instead of Ctrl on Mac.">
      <ul className="max-w-2xl divide-y divide-line rounded-card bg-surface ring-1 ring-line">
        {shortcuts.map((sc) =>
        <li key={sc.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1 text-sm text-ink">{sc.label}</span>
            <span className="flex gap-1">
              {sc.keys.map((k) =>
            <kbd key={k} className="rounded-md bg-bg px-2 py-0.5 font-mono text-[12px] text-ink ring-1 ring-line">{k}</kbd>
            )}
            </span>
          </li>
        )}
      </ul>
    </SettingsSection>);

}