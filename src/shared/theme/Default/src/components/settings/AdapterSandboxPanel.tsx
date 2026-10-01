import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayersIcon, PlayIcon, Trash2Icon } from 'lucide-react';
import { api, type AdapterEntry, type AdapterKind } from '@asi-api';
import { SettingsSection, StatusPill, inputClass } from './SettingsUI';

/** Allowlisted subprocess/HTTP adapters — Settings → Company (#adapters). */
export function AdapterSandboxPanel() {
  const [adapters, setAdapters] = useState<AdapterEntry[]>([]);
  const [gateOn, setGateOn] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AdapterKind>('http');
  const [command, setCommand] = useState('');
  const [argsText, setArgsText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [invokeInput, setInvokeInput] = useState('');
  const [invokeId, setInvokeId] = useState<string | null>(null);
  const [invokeOut, setInvokeOut] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.adapters();
      setAdapters(res.adapters ?? []);
      setGateOn(Boolean(res.singleSkillRunEnabled));
      setNote(res.note ?? null);
      setError(null);
    } catch {
      setError('Could not load adapters — is the API on :3445?');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const argsPreview = useMemo(() => {
    if (!argsText.trim()) return [] as string[];
    try {
      const parsed = JSON.parse(argsText) as unknown;
      return Array.isArray(parsed) ? parsed.map((a) => String(a)) : [];
    } catch {
      return argsText
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }, [argsText]);

  const addAdapter = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createAdapter({
        name: name.trim() || 'Adapter',
        kind,
        command: kind === 'subprocess' ? command.trim() : undefined,
        args: kind === 'subprocess' ? argsPreview : undefined,
        url: kind === 'http' ? url.trim() : undefined,
        enabled: false,
      });
      setName('');
      setCommand('');
      setArgsText('');
      setUrl('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create adapter');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a: AdapterEntry) => {
    try {
      await api.patchAdapter(a.id, { enabled: !a.enabled });
      await refresh();
    } catch {
      setError('Could not update adapter');
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteAdapter(id);
      await refresh();
    } catch {
      setError('Could not delete adapter');
    }
  };

  const invoke = async (id: string) => {
    setInvokeId(id);
    setInvokeOut(null);
    setError(null);
    try {
      const res = await api.invokeAdapter(id, { input: invokeInput.trim() });
      if (res.kind === 'subprocess') {
        setInvokeOut(
          [`exit ${res.exitCode ?? '?'}`, res.stdout ? `stdout:\n${res.stdout}` : '', res.stderr ? `stderr:\n${res.stderr}` : '']
            .filter(Boolean)
            .join('\n\n')
        );
      } else {
        setInvokeOut(`HTTP ${res.status}\n${res.body ?? ''}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invoke failed');
    } finally {
      setInvokeId(null);
    }
  };

  return (
    <SettingsSection
      id="adapters"
      title="BYO adapters (sandbox)"
      description="Allowlisted subprocess or HTTP targets only. Invoke requires AMS skill-run enabled. No arbitrary shell from chat."
      stacked
    >
      {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
      {note ? <p className="mb-2 text-[12px] text-muted">{note}</p> : null}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusPill tone={gateOn ? 'success' : 'warn'}>
          {gateOn ? 'AMS skill-run gate ON' : 'AMS skill-run gate OFF — invoke 501'}
        </StatusPill>
      </div>

      <div className="space-y-3 rounded-card bg-surface p-4 ring-1 ring-line">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[11px] font-medium text-muted">
            Name
            <input className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-[11px] font-medium text-muted">
            Kind
            <select
              className={`${inputClass} mt-1`}
              value={kind}
              onChange={(e) => setKind(e.target.value as AdapterKind)}
            >
              <option value="http">HTTP POST</option>
              <option value="subprocess">Subprocess (argv)</option>
            </select>
          </label>
        </div>
        {kind === 'http' ? (
          <label className="block text-[11px] font-medium text-muted">
            Allowlisted URL
            <input
              className={`${inputClass} mt-1`}
              placeholder="https://127.0.0.1:9xxx/hook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="block text-[11px] font-medium text-muted">
              Command (executable only — no shell)
              <input
                className={`${inputClass} mt-1`}
                placeholder="node"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
            </label>
            <label className="block text-[11px] font-medium text-muted">
              Args (JSON array or comma-separated)
              <input
                className={`${inputClass} mt-1`}
                placeholder='["--version"]'
                value={argsText}
                onChange={(e) => setArgsText(e.target.value)}
              />
            </label>
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void addAdapter()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
        >
          <LayersIcon size={14} aria-hidden="true" /> Add (disabled until you enable)
        </button>
      </div>

      <label className="mt-3 block text-[11px] font-medium text-muted">
        Invoke input (optional)
        <input
          className={`${inputClass} mt-1`}
          value={invokeInput}
          onChange={(e) => setInvokeInput(e.target.value)}
          placeholder="Passed as ASI_ADAPTER_INPUT / JSON body — not as shell"
        />
      </label>

      <ul className="mt-3 overflow-hidden rounded-card ring-1 ring-line">
        {adapters.length === 0 ? (
          <li className="px-4 py-5 text-center text-[12px] text-muted">No adapters registered yet.</li>
        ) : (
          adapters.map((a) => (
            <li key={a.id} className="border-t border-line px-4 py-3 first:border-t-0">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{a.name}</span>
                    <StatusPill tone={a.enabled ? 'success' : 'warn'}>{a.enabled ? 'Enabled' : 'Disabled'}</StatusPill>
                    <span className="text-[11px] text-faint">{a.kind}</span>
                  </div>
                  <p className="mt-1 break-all text-[11px] text-muted">
                    {a.kind === 'http' ? a.url : `${a.command ?? ''} ${(a.args ?? []).join(' ')}`.trim()}
                  </p>
                  {a.lastInvokedAt ? (
                    <p className="mt-0.5 text-[10px] text-faint">Last invoke {new Date(a.lastInvokedAt).toLocaleString()}</p>
                  ) : null}
                </div>
                <button type="button" onClick={() => void toggle(a)} className="text-[12px] font-medium text-accent-ink hover:underline">
                  {a.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  disabled={!a.enabled || invokeId === a.id}
                  onClick={() => void invoke(a.id)}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-ink hover:underline disabled:opacity-40"
                >
                  <PlayIcon size={12} aria-hidden="true" /> Invoke
                </button>
                <button type="button" onClick={() => void remove(a.id)} className="text-[12px] text-danger hover:underline">
                  <Trash2Icon size={12} className="inline" aria-hidden="true" /> Delete
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
      {invokeOut ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-bg p-3 text-[11px] text-muted ring-1 ring-line">{invokeOut}</pre>
      ) : null}
    </SettingsSection>
  );
}
