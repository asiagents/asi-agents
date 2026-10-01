import React from 'react';

function formatCheckedAt(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function WifiSpeedOverlay({
  open,
  downloadMbps,
  checkedAt,
  loading,
  error,
  linkSpeedMbps,
}: {
  open: boolean;
  downloadMbps: number | null;
  checkedAt: string | null;
  loading: boolean;
  error: string | null;
  linkSpeedMbps: number | null;
}) {
  if (!open) return null;

  const speedLabel =
    loading ?
    'Testing…' :
    downloadMbps != null ?
    `${downloadMbps} Mbps down` :
    error ?
    error :
    'Speed unknown';

  return (
    <div
      role="tooltip"
      className="absolute left-1/2 top-full z-50 mt-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-surface px-3 py-2 text-[11px] text-ink shadow-lg ring-1 ring-line"
    >
      <div className="font-semibold">Internet speed</div>
      <div className="mt-0.5 text-muted">{speedLabel}</div>
      {linkSpeedMbps != null && (
        <div className="mt-1 text-faint">Adapter link · {linkSpeedMbps} Mbps</div>
      )}
      {checkedAt && !loading && (
        <div className="mt-1 text-faint">fast.com · {formatCheckedAt(checkedAt)}</div>
      )}
    </div>
  );
}
