import type { ActivityEntry } from '../types/inbox';

/** Downloads the control log as CSV. The log lives in the user's vault and survives agent deletion. */
export function exportControlLog(entries: ActivityEntry[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [['time', 'actor', 'event', 'tone'], ...entries.map((e) => [e.time, e.actor, e.text, e.tone])];
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `asi-agents-control-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}