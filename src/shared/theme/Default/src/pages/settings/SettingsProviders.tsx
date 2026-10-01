import React from 'react';
import { Link } from 'react-router-dom';
import { Toggle } from '../../components/Toggle';
import { StatusPill } from '../../components/settings/SettingsUI';
import { cloudInferenceProviderIds, providerStubIds } from '../../data/settings';
import { usePrefs } from '../../contexts/PrefsContext';

const laneLabel = { local: 'Local', online: 'Online', pro: 'Pro' };

const providerGroups: { title: string; lane: 'local' | 'online' | 'pro' }[] = [
  { title: 'On-device', lane: 'local' },
  { title: 'Online relay', lane: 'online' },
  { title: 'Cloud providers (Pro)', lane: 'pro' },
];

export function SettingsProviders() {
  const { providers, toggleProvider, apiKeys, providerKeyStatus } = usePrefs();

  return (
    <div className="space-y-6">
      {providerGroups.map((group) => {
        const rows = providers.filter((p) => p.lane === group.lane);
        if (rows.length === 0) return null;
        return (
          <div key={group.lane}>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-faint">{group.title}</h3>
            <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
        {rows.map((p) => {
          const keys = apiKeys.filter((k) => k.provider === p.id);
          const serverKey = cloudInferenceProviderIds.has(p.id) ? providerKeyStatus[p.id] : undefined;
          const needsKey = p.lane === 'pro';
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{p.name}</span>
                  <StatusPill tone="muted">{laneLabel[p.lane]}</StatusPill>
                  {providerStubIds.has(p.id) && <StatusPill tone="warn">Stub</StatusPill>}
                  {p.supportsFreeTier && <StatusPill tone="success">Free tier</StatusPill>}
                  {p.enabled ? <StatusPill tone="success">On</StatusPill> : <StatusPill tone="muted">Off</StatusPill>}
                </div>
                <p className="mt-0.5 text-[12px] text-muted">{p.description}</p>
                {needsKey &&
                <p className="mt-1 text-[12px]">
                    {serverKey?.configured ?
                  <span className="text-muted">Secret saved · ••••{serverKey.last4} · </span> :
                  keys.length > 0 ?
                  <span className="text-muted">Local key · </span> :

                  <span className="text-warn">No key yet · </span>
                  }
                    <Link
                      to={`/settings/connections?provider=${encodeURIComponent(p.id)}#keys`}
                      className="font-medium text-accent-ink hover:underline"
                    >
                      Manage keys
                    </Link>
                  </p>
                }
              </div>
              <Toggle label={`${p.name} enabled`} checked={p.enabled} locked={p.locked} onChange={() => toggleProvider(p.id)} />
            </li>);

        })}
            </ul>
          </div>
        );
      })}
      <p className="text-[12px] text-muted">
        Turning a provider off fails closed: agents on that lane fall back to asking you, never to a silent switch.
      </p>
    </div>);

}