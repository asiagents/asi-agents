import React from 'react';

/** Visible under chat + group composers — not buried in settings. */
export const MODEL_DISCLAIMER =
  'ASI Agents and its models can make mistakes. Check important info.';

export function ModelDisclaimer({ className = '' }: { className?: string }) {
  return (
    <p
      role="note"
      className={`text-center text-[11px] leading-snug text-faint ${className}`.trim()}
    >
      {MODEL_DISCLAIMER}
    </p>
  );
}
