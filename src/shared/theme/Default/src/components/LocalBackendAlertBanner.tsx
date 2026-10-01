import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangleIcon, RefreshCwIcon, ServerOffIcon } from 'lucide-react';
import type { LocalBackendAlert } from '../utils/localBackendAlert';

type Props = {
  alert: LocalBackendAlert | null;
  onRescan?: () => void;
  /** Compact single-line for Home model widget. */
  compact?: boolean;
};

/** Persistent banner when probes show Ollama / llama.cpp / models API down. */
export function LocalBackendAlertBanner({ alert, onRescan, compact }: Props) {
  if (!alert) return null;

  const Icon = alert.severity === 'danger' ? ServerOffIcon : AlertTriangleIcon;
  const border =
    alert.severity === 'danger' ? 'border-danger/25 bg-danger/[0.06]' : 'border-warn/25 bg-warn/[0.08]';
  const iconCls = alert.severity === 'danger' ? 'text-danger' : 'text-warn';

  if (compact) {
    return (
      <div role="status" className={`rounded-lg px-2.5 py-2 text-[11px] leading-snug ring-1 ring-line ${border}`}>
        <p className="font-semibold text-ink">{alert.title}</p>
        <p className="mt-0.5 text-muted">{alert.suggestions[0] ?? alert.detail}</p>
        <Link to="/settings/models" className="mt-1 inline-block font-medium text-accent-ink hover:underline">
          Models →
        </Link>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={`flex shrink-0 flex-wrap items-start gap-3 border-b px-4 py-3 text-[13px] text-ink md:px-5 ${border}`}
    >
      <Icon size={16} className={`mt-0.5 shrink-0 ${iconCls}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{alert.title}</p>
        <p className="mt-0.5 text-[12px] text-muted">{alert.detail}</p>
        {alert.suggestions.length > 0 && (
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[12px] text-muted">
            {alert.suggestions.slice(0, 3).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {onRescan && (
          <button
            type="button"
            onClick={() => void onRescan()}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]"
          >
            <RefreshCwIcon size={12} aria-hidden="true" /> Scan
          </button>
        )}
        <Link
          to="/settings/models"
          className="rounded-full px-2.5 py-1 text-[12px] font-medium text-accent-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]"
        >
          Models
        </Link>
      </div>
    </div>
  );
}
