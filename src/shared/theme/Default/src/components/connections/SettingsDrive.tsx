import React, { useCallback, useEffect, useState } from 'react';
import { FolderIcon, HardDriveIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type DriveFileItem, type DriveStatus } from '@asi-api';
import { StatusPill } from '../settings/SettingsUI';
import { OAuthConfigureForm } from './OAuthConfigureForm';

const driveBanner: Record<string, string> = {
  connected: 'Google Drive connected.',
  denied: 'Drive sign-in was cancelled.',
  invalid_state: 'OAuth session expired — try Connect again.',
  exchange_failed: 'Could not finish Drive sign-in.',
  no_refresh: 'Google did not return a refresh token — revoke access and retry with consent.',
};

/** Opt-in Google Drive — separate from Gmail; drive.readonly only. */
export function SettingsDrive() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const st = await api.driveStatus();
      setStatus(st);
      if (st.connected) {
        const folderId = folderStack.length ? folderStack[folderStack.length - 1].id : undefined;
        const list = await api.driveFiles(folderId);
        setFiles(list.files ?? []);
      } else {
        setFiles([]);
      }
    } catch {
      setStatus(null);
      setFiles([]);
    }
  }, [folderStack]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const key = searchParams.get('drive_oauth');
    if (!key) return;
    setFlash(driveBanner[key] ?? 'Drive OAuth finished.');
    searchParams.delete('drive_oauth');
    setSearchParams(searchParams, { replace: true });
    void refresh();
  }, [searchParams, setSearchParams, refresh]);

  const openFolder = (f: DriveFileItem) => {
    if (!f.folder) return;
    setFolderStack((s) => [...s, { id: f.id, name: f.name }]);
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
            <HardDriveIcon size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">Google Drive</h2>
              {status?.connected ? (
                <StatusPill tone="success">Connected</StatusPill>
              ) : status?.oauthConfigured ? (
                <StatusPill tone="muted">Not connected</StatusPill>
              ) : (
                <StatusPill tone="muted">Needs setup</StatusPill>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-muted">
              Optional. Explicit <code className="text-ink">drive.readonly</code> consent — Gmail Connect does not
              request Drive. OneDrive later.
            </p>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <OAuthConfigureForm slot="google_drive" onSaved={() => void refresh()} />
          <p className="text-[12px] text-muted">{status?.message}</p>
          <div className="flex flex-wrap gap-2">
            {status?.oauthConfigured && !status.connected ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => api.driveConnect()}
                className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-2 disabled:opacity-50"
              >
                Connect Google Drive
              </button>
            ) : null}
            {status?.connected ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void api.driveDisconnect().then(() => refresh()).finally(() => setBusy(false));
                }}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.04]"
              >
                Disconnect
              </button>
            ) : null}
            <Link to="/files" className="text-[13px] font-medium text-accent-ink hover:underline">
              Open local File manager
            </Link>
          </div>

          {status?.connected ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-1 text-[12px] text-muted">
                <button
                  type="button"
                  className="text-accent-ink hover:underline"
                  onClick={() => setFolderStack([])}
                >
                  My Drive
                </button>
                {folderStack.map((f, i) => (
                  <span key={f.id}>
                    {' / '}
                    <button
                      type="button"
                      className="text-accent-ink hover:underline"
                      onClick={() => setFolderStack((s) => s.slice(0, i + 1))}
                    >
                      {f.name}
                    </button>
                  </span>
                ))}
              </div>
              <ul className="divide-y divide-line rounded-lg ring-1 ring-line">
                {files.length === 0 ? (
                  <li className="px-3 py-4 text-[12px] text-muted">Empty folder.</li>
                ) : (
                  files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                      <FolderIcon size={14} className={f.folder ? 'text-accent-ink' : 'text-muted'} aria-hidden />
                      {f.folder ? (
                        <button type="button" className="text-left text-ink hover:underline" onClick={() => openFolder(f)}>
                          {f.name}
                        </button>
                      ) : f.webViewLink ? (
                        <a href={f.webViewLink} target="_blank" rel="noreferrer" className="text-ink hover:underline">
                          {f.name}
                        </a>
                      ) : (
                        <span className="text-ink">{f.name}</span>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
