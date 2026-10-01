import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudIcon, CpuIcon, DownloadIcon, ExternalLinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@asi-api';
import { modelSuggestions } from '../../data/modelSuggestions';
import { hfDownloadCatalog } from '../../data/modelCatalog';
import { modeOptions } from '../../data/modes';
import { useDesk } from '../../contexts/DeskContext';
import { usePrefs } from '../../contexts/PrefsContext';
import type { DeskMode } from '../../types/settings';
import { AMS_HF_ORG } from '../../utils/amsHf';

function resolveDownloadMeta(name: string): { ollamaPull?: string; hfRepo?: string } {
  const hit = hfDownloadCatalog.find(
    (m) => m.name === name || m.name.toLowerCase().includes(name.toLowerCase().split(' ')[0] ?? '')
  );
  return { ollamaPull: hit?.ollamaPull, hfRepo: hit?.hfRepo };
}

function DownloadCell({ name, size }: { name: string; size: string }) {
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const meta = resolveDownloadMeta(name);
  const hfUrl = meta.hfRepo ? `https://huggingface.co/${meta.hfRepo}` : null;

  const runPull = async () => {
    if (!meta.ollamaPull || pulling) return;
    setPulling(true);
    setProgress('Starting…');
    try {
      await api.ollamaPull(meta.ollamaPull, (ev) => {
        if (ev.error) {
          setProgress(ev.error);
          return;
        }
        if (typeof ev.completed === 'number' && typeof ev.total === 'number' && ev.total > 0) {
          setProgress(`${ev.status} · ${Math.min(100, Math.round((ev.completed / ev.total) * 100))}%`);
        } else {
          setProgress(ev.status || 'Pulling…');
        }
      });
      setProgress('Done');
      toast.success(`Pulled ${meta.ollamaPull} — Browse → Scan`);
    } catch (e) {
      setProgress(null);
      toast.error(e instanceof Error ? e.message : 'Pull failed');
    } finally {
      setPulling(false);
    }
  };

  return (
    <td className="px-3 py-3">
      <span className="block text-ink">{name}</span>
      <span className="text-[11px] text-muted">{size} · not installed</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {meta.ollamaPull && (
          <button
            type="button"
            disabled={pulling}
            onClick={() => void runPull()}
            className="inline-flex items-center gap-1 rounded-lg bg-accent-strong px-2 py-1 text-[11px] font-medium text-white hover:bg-accent-2 disabled:opacity-50"
            title={`ollama pull ${meta.ollamaPull}`}
          >
            <DownloadIcon size={11} aria-hidden="true" />
            {pulling ? progress || 'Pulling…' : 'Download'}
          </button>
        )}
        {hfUrl && (
          <a
            href={hfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-accent-ink ring-1 ring-line hover:bg-overlay/[0.04]"
          >
            <ExternalLinkIcon size={11} aria-hidden="true" />
            HF
          </a>
        )}
      </div>
    </td>
  );
}

/** Per task kind: three picks — already scanned on this device · downloadable · online via a connected API. */
export function ModelSuggestions({ mode, onModeChange }: { mode: DeskMode; onModeChange?: (m: DeskMode) => void }) {
  const { onlineOn } = useDesk();
  const { providers } = usePrefs();
  const rows = modelSuggestions[mode];
  const providerOn = (name: string) =>
    onlineOn &&
    providers.some(
      (p) =>
        p.enabled &&
        p.lane !== 'local' &&
        (p.name.includes(name.split('-')[0]) || (name === 'Escalation relay' && p.id === 'relay'))
    );

  return (
    <div>
      {onModeChange && (
        <div role="tablist" aria-label="Suggestions for mode" className="mb-3 inline-flex rounded-full bg-surface p-1 ring-1 ring-line">
          {modeOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={mode === o.id}
              onClick={() => onModeChange(o.id)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                mode === o.id ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      <p className="mb-3 text-[12px] text-muted">
        Local AMS picks are catalog recipes until Scan finds matching weights — not claimed installed.
        Weight updates:{' '}
        <a href={AMS_HF_ORG} target="_blank" rel="noreferrer" className="font-medium text-accent-ink hover:underline">
          huggingface.co/vvarghese
        </a>
        . Downloadable column uses Ollama pull when a tag is known.
      </p>
      <div className="overflow-x-auto rounded-card bg-surface ring-1 ring-line">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="border-b border-line text-[11px] font-semibold uppercase tracking-wide text-faint">
            <tr>
              <th scope="col" className="px-4 py-2.5">
                Task
              </th>
              <th scope="col" className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1">
                  <CpuIcon size={12} aria-hidden="true" /> Local · scanned
                </span>
              </th>
              <th scope="col" className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1">
                  <DownloadIcon size={12} aria-hidden="true" /> Downloadable
                </span>
              </th>
              <th scope="col" className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1">
                  <CloudIcon size={12} aria-hidden="true" /> Online · connected API
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const on = providerOn(r.online.provider);
              return (
                <tr key={r.task}>
                  <th scope="row" className="px-4 py-3 font-medium text-ink">
                    {r.task}
                  </th>
                  <td className="px-3 py-3">
                    <span className="block text-ink">{r.local.name}</span>
                    <span className="text-[11px] text-success">{r.local.note}</span>
                  </td>
                  <DownloadCell name={r.download.name} size={r.download.size} />
                  <td className="px-3 py-3">
                    <span className="block text-ink">{r.online.name}</span>
                    {on ? (
                      <span className="text-[11px] text-muted">{r.online.provider} · connected</span>
                    ) : (
                      <Link
                        to={onlineOn ? '/settings/connections#providers' : '/settings/models'}
                        className="text-[11px] font-medium text-accent-ink hover:underline"
                      >
                        {onlineOn ? `Connect ${r.online.provider}` : 'Online is off'}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
