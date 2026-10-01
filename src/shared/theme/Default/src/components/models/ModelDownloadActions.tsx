import React, { useState } from 'react';
import { DownloadIcon, ExternalLinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@asi-api';
import { AMS_HF_ORG, AMS_PLACE_PATH, amsHfUrl, isAmsRecipeId } from '../../utils/amsHf';
import type { CatalogModel } from '../../data/modelCatalog';

function formatPullPct(completed?: number, total?: number): string | null {
  if (typeof completed !== 'number' || typeof total !== 'number' || total <= 0) return null;
  return `${Math.min(100, Math.round((completed / total) * 100))}%`;
}

/** Ollama pull via API; AMS ship pair via POST /api/models/ams/download; HF link as fallback. */
export function ModelDownloadActions({
  model,
  onPulled,
  compact,
}: {
  model: CatalogModel;
  /** Called after a successful Ollama pull or AMS install (caller should Scan). */
  onPulled?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [amsBusy, setAmsBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const isAms =
    model.provider === 'AMS' ||
    isAmsRecipeId(model.id) ||
    model.id.startsWith('ams-') ||
    model.id === 'agent-chat-50-100m' ||
    model.id === 'ultra-gate-1m';
  const hfUrl = isAms
    ? amsHfUrl(model.id)
    : model.hfRepo
      ? `https://huggingface.co/${model.hfRepo}`
      : null;
  const ollamaTag = model.ollamaPull?.trim() || null;
  const canAmsPull = model.id === 'ams-micro-70m' || model.id === 'ams-hybrid-120m';

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
      toast.success(`Pulled ${ollamaTag} — Scan now to list it`);
      onPulled?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Pull failed';
      setProgress(null);
      toast.error(msg);
    } finally {
      setPulling(false);
    }
  };

  const runAmsDownload = async () => {
    if (!canAmsPull || amsBusy) return;
    setAmsBusy(true);
    setProgress('Fetching from Hugging Face…');
    try {
      const res = await api.amsDownload(model.id);
      const row = res.results?.find((r) => r.id === model.id);
      if (row?.status === 'installed') {
        setProgress(null);
        toast.success(`${model.name} installed → ${row.matchedFile ?? AMS_PLACE_PATH}`);
        onPulled?.();
      } else {
        const detail = row?.note || row?.error || res.error || 'Still recipe — HF gated or no weights published';
        setProgress(detail);
        toast.message(detail);
      }
    } catch (e) {
      setProgress(null);
      toast.error(e instanceof Error ? e.message : 'AMS download failed');
    } finally {
      setAmsBusy(false);
    }
  };

  const btn =
    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium ring-1 transition-colors disabled:opacity-50';

  return (
    <div className={compact ? 'text-right' : 'text-right'}>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {canAmsPull && (
          <button
            type="button"
            disabled={amsBusy}
            onClick={() => void runAmsDownload()}
            className={`${btn} bg-accent-strong text-white ring-accent-strong/40 hover:bg-accent-2`}
            title="Pull GGUF or ONNX into models/ams/ (HF_TOKEN for gated repos)"
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
            className={`${btn} bg-accent-strong text-white ring-accent-strong/40 hover:bg-accent-2`}
            title={`ollama pull ${ollamaTag}`}
          >
            <DownloadIcon size={13} aria-hidden="true" />
            {pulling ? progress || 'Pulling…' : 'Download (Ollama)'}
          </button>
        )}
        {isAms && (
          <a
            href={hfUrl ?? AMS_HF_ORG}
            target="_blank"
            rel="noreferrer"
            className={`${btn} text-accent-ink ring-line hover:bg-overlay/[0.04]`}
            title={`Open ${hfUrl ?? AMS_HF_ORG}`}
          >
            <ExternalLinkIcon size={13} aria-hidden="true" />
            Open on Hugging Face
          </a>
        )}
        {!isAms && hfUrl && !ollamaTag && (
          <a
            href={hfUrl}
            target="_blank"
            rel="noreferrer"
            className={`${btn} text-accent-ink ring-line hover:bg-overlay/[0.04]`}
          >
            <ExternalLinkIcon size={13} aria-hidden="true" />
            Open on Hugging Face
          </a>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${btn} text-muted ring-line hover:bg-overlay/[0.04] hover:text-ink`}
        >
          <DownloadIcon size={13} aria-hidden="true" />
          {open ? 'Hide details' : isAms ? 'How to install' : 'Details'}
        </button>
      </div>
      {(pulling || amsBusy) && progress && (
        <p className="mt-1 text-[11px] text-muted" aria-live="polite">
          {progress}
        </p>
      )}
      {open && (
        <div className="mt-2 max-w-sm rounded-lg bg-bg p-3 text-left text-[12px] text-muted ring-1 ring-line">
          <p className="font-medium text-ink">{model.name}</p>
          {isAms ? (
            <>
              <p className="mt-2">
                Use <strong className="font-medium text-ink">Download</strong> to place matching{' '}
                <code className="text-[11px]">.gguf</code> or <code className="text-[11px]">.onnx</code> under{' '}
                <code className="text-[11px]">{AMS_PLACE_PATH}</code> (needs{' '}
                <code className="text-[11px]">HF_TOKEN</code> for gated HF), or copy manually, then{' '}
                <strong className="text-ink">Scan now</strong>.
              </p>
              <p className="mt-2">
                HF:{' '}
                <a
                  href={hfUrl ?? AMS_HF_ORG}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-accent-ink hover:underline"
                >
                  {(hfUrl ?? AMS_HF_ORG).replace('https://', '')}
                </a>
              </p>
              <p className="mt-2 text-faint">
                Status stays <strong className="text-ink">AMS recipe</strong> until Scan lists a matching file. Or run{' '}
                <code className="text-[11px]">npm run install:ams</code>. ONNX installs show{' '}
                <strong className="text-ink">ONNX on disk</strong> (never claimed as GGUF).
              </p>
            </>
          ) : (
            <>
              {ollamaTag && (
                <p className="mt-2">
                  <span className="text-faint">Ollama:</span>{' '}
                  <code className="text-[11px] text-ink">ollama pull {ollamaTag}</code>
                  <span className="text-faint"> — use Download (Ollama) above, or run in a terminal.</span>
                </p>
              )}
              {hfUrl && (
                <p className="mt-2">
                  <a href={hfUrl} target="_blank" rel="noreferrer" className="font-medium text-accent-ink hover:underline">
                    {model.hfRepo} on Hugging Face
                  </a>
                </p>
              )}
              <p className="mt-2">
                Or drop a matching <strong className="font-medium text-ink">.gguf</strong> into{' '}
                <code className="text-[11px]">{AMS_PLACE_PATH}</code> or{' '}
                <code className="text-[11px]">models/custom</code>, then <strong className="text-ink">Scan now</strong>.
              </p>
              <p className="mt-2 text-faint">Not installed until scan lists it.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
