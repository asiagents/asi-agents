import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpIcon,
  DownloadIcon,
  FolderIcon,
  FileIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';
import { api, type LocalFileEntry } from '@asi-api';

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Local-first file manager — uploads & My files under the ASI data directory. */
export function FilesPage() {
  const [roots, setRoots] = useState<{ id: string; label: string }[]>([]);
  const [root, setRoot] = useState('files');
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<LocalFileEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setErr(null);
    try {
      const list = await api.filesList(root, path);
      setEntries(list.entries ?? []);
    } catch (e) {
      setEntries([]);
      setErr(e instanceof Error ? e.message : 'Could not list files');
    }
  }, [root, path]);

  useEffect(() => {
    void (async () => {
      try {
        const st = await api.filesStatus();
        setRoots(st.roots ?? []);
        setNote(st.note ?? '');
        if (st.roots?.[0] && !st.roots.some((r) => r.id === root)) {
          setRoot(st.roots[0].id);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [root]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const crumbs = path ? path.split('/').filter(Boolean) : [];

  const goUp = () => {
    if (!path) return;
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    setPath(parts.join('/'));
  };

  const openDir = (e: LocalFileEntry) => {
    if (e.type !== 'dir') return;
    setPath(e.path);
  };

  const onUpload = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      const dataBase64 = btoa(binary);
      await api.filesUpload(root, path, file.name, dataBase64);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const onMkdir = async () => {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await api.filesMkdir(root, path, name.trim());
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create folder');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (e: LocalFileEntry) => {
    if (!window.confirm(`Delete ${e.name}?`)) return;
    setBusy(true);
    try {
      await api.filesDelete(root, e.path);
      await refresh();
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">File manager</h1>
        <p className="mt-1 text-[13px] text-muted">
          {note || 'Local files on this machine — uploads and research artifacts. No fake cloud.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {roots.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              setRoot(r.id);
              setPath('');
            }}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ring-1 ${
              root === r.id ? 'bg-accent/10 text-accent-ink ring-accent/30' : 'text-muted ring-line hover:text-ink'
            }`}
          >
            {r.label}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !path}
            onClick={goUp}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line disabled:opacity-40"
          >
            <ArrowUpIcon size={14} aria-hidden /> Up
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onMkdir()}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line"
          >
            <PlusIcon size={14} aria-hidden /> New folder
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-1 rounded-lg bg-accent-strong px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-accent-2"
          >
            <UploadIcon size={14} aria-hidden /> Upload
          </button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) void onUpload(f);
              ev.target.value = '';
            }}
          />
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 text-[12px] text-muted" aria-label="Path">
        <button type="button" className="text-accent-ink hover:underline" onClick={() => setPath('')}>
          {roots.find((r) => r.id === root)?.label ?? root}
        </button>
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`}>
            {' / '}
            <button
              type="button"
              className="text-accent-ink hover:underline"
              onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))}
            >
              {c}
            </button>
          </span>
        ))}
      </nav>

      {err ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger" role="alert">
          {err}
        </p>
      ) : null}

      <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface ring-1 ring-line">
        {entries.length === 0 ? (
          <li className="px-4 py-8 text-center text-[13px] text-muted">This folder is empty.</li>
        ) : (
          entries.map((e) => (
            <li key={e.path} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              {e.type === 'dir' ? (
                <FolderIcon size={16} className="shrink-0 text-accent-ink" aria-hidden />
              ) : (
                <FileIcon size={16} className="shrink-0 text-muted" aria-hidden />
              )}
              {e.type === 'dir' ? (
                <button type="button" className="min-w-0 flex-1 truncate text-left font-medium text-ink hover:underline" onClick={() => openDir(e)}>
                  {e.name}
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{e.name}</span>
              )}
              <span className="hidden text-[11px] text-faint sm:inline">
                {e.type === 'file' ? formatSize(e.size) : '—'}
              </span>
              {e.type === 'file' ? (
                <a
                  href={api.filesDownloadUrl(root, e.path)}
                  className="rounded p-1.5 text-muted hover:bg-overlay/[0.05] hover:text-ink"
                  title="Download"
                >
                  <DownloadIcon size={14} aria-hidden />
                </a>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDelete(e)}
                className="rounded p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                title="Delete"
              >
                <Trash2Icon size={14} aria-hidden />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
