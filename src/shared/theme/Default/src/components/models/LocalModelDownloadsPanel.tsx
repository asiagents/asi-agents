import React, { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api, type ModelDownloadItem, type ModelDownloadsResponse } from '@asi-api';
import { SettingsSection } from '../settings/SettingsUI';
import { AMS_HF_ORG, AMS_PLACE_PATH, amsHfUrl } from '../../utils/amsHf';

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setOk(true);
          window.setTimeout(() => setOk(false), 2000);
        });
      }}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-accent-ink ring-1 ring-line hover:bg-overlay/[0.04]"
    >
      {ok ? <CheckIcon size={12} aria-hidden="true" /> : <CopyIcon size={12} aria-hidden="true" />}
      Copy
    </button>
  );
}

function StatusBadge({ item }: { item: ModelDownloadItem }) {
  if (item.kind !== 'ams' || !item.status) return null;
  const installed = item.status === 'installed';
  const label = !installed
    ? 'Recipe only'
    : item.weightFormat === 'onnx'
      ? 'Installed · ONNX on disk'
      : item.weightFormat === 'gguf'
        ? 'Installed · GGUF'
        : 'Installed';
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
        installed ? 'bg-success/10 text-success' : 'bg-overlay/[0.06] text-muted'
      }`}
    >
      {label}
    </span>
  );
}

function formatPullPct(completed?: number, total?: number): string | null {
  if (typeof completed !== 'number' || typeof total !== 'number' || total <= 0) return null;
  return `${Math.min(100, Math.round((completed / total) * 100))}%`;
}

function DownloadRow({ item, onRefresh }: { item: ModelDownloadItem; onRefresh?: () => void }) {
  const [pulling, setPulling] = useState(false);
  const [amsBusy, setAmsBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const ollamaTag =
    item.ollamaTag?.trim() ||
    (item.method === 'ollama' ? /^ollama\s+pull\s+(\S+)/i.exec(item.command ?? '')?.[1] : undefined);
  const hfUrl =
    item.hfUrl?.trim() ||
    (item.kind === 'ams' ? amsHfUrl(item.id) : item.docsUrl?.startsWith('https://huggingface.co') ? item.docsUrl : null);
  const isAms = item.kind === 'ams';
  const placePath = item.pathHint?.trim() || (isAms ? AMS_PLACE_PATH : undefined);
  const amsRecipeId =
    item.id === 'ams-agent-chat'
      ? 'agent-chat-50-100m'
      : item.id === 'ams-ultra-gate'
        ? 'ultra-gate-1m'
        : item.id;

  const runOllamaPull = async () => {
    if (!ollamaTag || pulling) return;
    setPulling(true);
    setProgress('Starting…');
    try {
      await api.ollamaPull(ollamaTag, (ev) => {
        if (ev.error) {
          setProgress(ev.error);
          return;
        }
        const pct = formatPullPct(ev.completed, ev.total);
        setProgress(pct ? `${ev.status} · ${pct}` : ev.status || 'Pulling…');
      });
      setProgress('Done');
      toast.success(`Pulled ${ollamaTag} — Browse → Scan to list it`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Pull failed';
      setProgress(null);
      toast.error(msg);
    } finally {
      setPulling(false);
    }
  };

  const runAmsDownload = async () => {
    if (amsBusy) return;
    setAmsBusy(true);
    setProgress('Fetching from Hugging Face…');
    try {
      const res = await api.amsDownload(amsRecipeId);
      const row = res.results?.find((r) => r.id === amsRecipeId);
      if (row?.status === 'installed') {
        setProgress(null);
        toast.success(`${item.name} installed → ${row.matchedFile ?? AMS_PLACE_PATH}`);
        onRefresh?.();
      } else {
        const detail = row?.note || row?.error || res.error || 'Still recipe — set HF_TOKEN or place GGUF/ONNX manually';
        setProgress(detail);
        toast.message(detail);
        onRefresh?.();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AMS download failed';
      setProgress(null);
      toast.error(msg);
    } finally {
      setAmsBusy(false);
    }
  };

  const actionBtn =
    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium ring-1 transition-colors disabled:opacity-50';

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            <DownloadIcon size={14} className="text-muted" aria-hidden="true" />
            {item.name}
            <StatusBadge item={item} />
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {item.method} · {item.kind}
            {item.matchedFile
              ? ` · matched ${item.matchedFile}${item.weightFormat ? ` (${item.weightFormat})` : ''}`
              : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {item.capabilities.map((c) => (
            <span key={c} className="rounded-md bg-overlay/[0.06] px-2 py-0.5 text-[10px] text-muted">
              {c}
            </span>
          ))}
        </div>
      </div>
      {(item.diskSizeHint || item.ramHint || item.hardwareHint) && (
        <p className="mt-2 text-[12px] text-muted">
          {[item.diskSizeHint, item.ramHint, item.hardwareHint].filter(Boolean).join(' · ')}
        </p>
      )}
      {item.suggestedFileName && (
        <p className="mt-1 text-[12px] text-muted">
          Suggested file:{' '}
          <code className="text-ink">
            {item.pathHint ?? ''}
            {item.suggestedFileName}
          </code>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isAms && item.status !== 'installed' && (
          <button
            type="button"
            disabled={amsBusy}
            onClick={() => void runAmsDownload()}
            className={`${actionBtn} bg-accent-strong text-white ring-accent-strong/40 hover:bg-accent-2`}
            title="Pull GGUF or ONNX into models/ams/ (needs HF_TOKEN for gated repos)"
          >
            <DownloadIcon size={13} aria-hidden="true" />
            {amsBusy ? progress || 'Downloading…' : 'Download'}
          </button>
        )}
        {ollamaTag && (
          <button
            type="button"
            disabled={pulling}
            onClick={() => void runOllamaPull()}
            className={`${actionBtn} bg-accent-strong text-white ring-accent-strong/40 hover:bg-accent-2`}
            title={`ollama pull ${ollamaTag}`}
          >
            <DownloadIcon size={13} aria-hidden="true" />
            {pulling ? progress || 'Pulling…' : 'Download (Ollama)'}
          </button>
        )}
        {(isAms || hfUrl) && (
          <a
            href={hfUrl ?? AMS_HF_ORG}
            target="_blank"
            rel="noreferrer"
            className={`${actionBtn} text-accent-ink ring-line hover:bg-overlay/[0.04]`}
          >
            <ExternalLinkIcon size={13} aria-hidden="true" />
            Open on Hugging Face
          </a>
        )}
        {item.docsUrl?.startsWith('http') && item.docsUrl !== hfUrl && (
          <a
            href={item.docsUrl}
            target="_blank"
            rel="noreferrer"
            className={`${actionBtn} text-muted ring-line hover:bg-overlay/[0.04] hover:text-ink`}
          >
            Docs <ExternalLinkIcon size={12} aria-hidden="true" />
          </a>
        )}
      </div>
      {(pulling || amsBusy) && progress && (
        <p className="mt-1 text-[11px] text-muted" aria-live="polite">
          {progress}
        </p>
      )}
      {isAms && item.status !== 'installed' && !amsBusy && (
        <p className="mt-2 text-[12px] text-muted">
          Download places matching <code className="text-ink">.gguf</code> or{' '}
          <code className="text-ink">.onnx</code> under <code className="text-ink">{placePath}</code>.
          Gated HF needs <code className="text-ink">HF_TOKEN</code>. Then Browse → Scan (or{' '}
          <code className="text-ink">npm run verify:ams</code>).
        </p>
      )}
      {isAms && item.status === 'installed' && item.weightFormat === 'onnx' && (
        <p className="mt-2 text-[12px] text-muted">
          ONNX on disk — Select / pool enabled. Reference router (:7821) is still Ollama/llama.cpp only (does not load
          ONNX yet).
        </p>
      )}

      {item.command && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-bg px-3 py-2 ring-1 ring-line">
          <code className="flex-1 text-[12px] text-ink">{item.command}</code>
          <CopyButton text={item.command} />
        </div>
      )}
      {item.pathHint && !item.suggestedFileName && (
        <p className="mt-2 text-[12px] text-muted">
          Path: <code className="text-ink">{item.pathHint}</code>
        </p>
      )}
      {item.installSteps && item.installSteps.length > 0 && (
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] text-muted">
          {item.installSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {item.notes && <p className="mt-2 text-[12px] text-muted">{item.notes}</p>}
      {item.docsUrl && !item.docsUrl.startsWith('http') && (
        <p className="mt-2 text-[12px] text-faint">Guide: {item.docsUrl}</p>
      )}
    </li>
  );
}

export function LocalModelDownloadsPanel() {
  const [items, setItems] = useState<ModelDownloadItem[]>([]);
  const [amsMeta, setAmsMeta] = useState<ModelDownloadsResponse['ams']>();
  const [filter, setFilter] = useState<string>('all');

  const refresh = () => {
    api
      .modelDownloads()
      .then((res) => {
        setItems(res.items);
        setAmsMeta(res.ams);
      })
      .catch(() => {
        setItems([]);
        setAmsMeta(undefined);
      });
  };

  useEffect(() => {
    refresh();
  }, []);

  const kinds = ['all', ...Array.from(new Set(items.map((i) => i.kind)))];
  const shown = filter === 'all' ? items : items.filter((i) => i.kind === filter);
  const amsItems = shown.filter((i) => i.kind === 'ams');
  const otherItems = shown.filter((i) => i.kind !== 'ams');

  return (
    <div>
      <p className="mb-4 text-[13px] text-muted">
        Ship AMS list is <strong className="font-medium text-ink">Micro 70M + Hybrid 120M</strong> only.
        <strong className="font-medium text-ink"> Download</strong> pulls GGUF or ONNX into{' '}
        <code className="text-[11px]">{AMS_PLACE_PATH}</code> when HF allows (set{' '}
        <code className="text-[11px]">HF_TOKEN</code> for gated repos). Ollama rows use{' '}
        <code className="text-[11px]">ollama pull</code>. Advanced AMS recipes need{' '}
        <code className="text-[11px]">ASI_AMS_SHOW_ADVANCED=1</code>.
      </p>

      {amsMeta && (
        <p className="mb-4 rounded-lg bg-bg px-3 py-2 text-[12px] text-muted ring-1 ring-line">
          AMS probe: {amsMeta.installedCount} installed · {amsMeta.recipeCount} recipe(s) ·{' '}
          {amsMeta.installedGgufFiles} .gguf · {amsMeta.installedOnnxFiles ?? 0} .onnx in{' '}
          <code className="text-ink">{amsMeta.amsDir}</code>
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full px-2.5 py-1 text-[12px] font-medium capitalize ${
              filter === k ? 'bg-accent/15 text-accent-ink' : 'text-muted ring-1 ring-line'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {(filter === 'all' || filter === 'ams') && amsItems.length > 0 && (
        <SettingsSection
          title="ASI AMS Micro / Hybrid"
          stacked
          description="Download into models/ams/ or place manually — never auto-faked as installed"
        >
          <p className="mb-3 px-1 text-[12px] text-muted">
            Weight updates:{' '}
            <a
              href={AMS_HF_ORG}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent-ink hover:underline"
            >
              huggingface.co/vvarghese
            </a>
            {' '}· Micro:{' '}
            <a
              href={`${AMS_HF_ORG}/ams-micro-70m`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent-ink hover:underline"
            >
              ams-micro-70m
            </a>
            {' · '}Hybrid:{' '}
            <a
              href={`${AMS_HF_ORG}/ams-hybrid-120m`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent-ink hover:underline"
            >
              ams-hybrid-120m
            </a>
          </p>
          <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
            {amsItems.map((item) => (
              <DownloadRow key={item.id} item={item} onRefresh={refresh} />
            ))}
          </ul>
        </SettingsSection>
      )}

      {otherItems.length > 0 && (
        <div className={amsItems.length > 0 && (filter === 'all' || filter === 'ams') ? 'mt-8' : undefined}>
          <SettingsSection title="Download recipes" stacked description="Audio, vision, OCR, decks, parsers">
            <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
              {otherItems.map((item) => (
                <DownloadRow key={item.id} item={item} onRefresh={refresh} />
              ))}
            </ul>
          </SettingsSection>
        </div>
      )}
    </div>
  );
}
