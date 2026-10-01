import type { OrgNode } from '../types/agents';

type ReportsRow = {
  id: string;
  reportsTo?: string | null;
  isChief?: boolean;
};

/**
 * Build org tree from registry `reportsTo`.
 * Flat hire default: missing/null reportsTo → peer root (parentId null).
 * Chief is always a root and never reports to anyone.
 * Invalid / self / unknown parents are treated as flat (no invented nesting).
 */
export function orgTreeFromAgents(rows: ReportsRow[]): OrgNode[] {
  const ids = new Set(rows.map((r) => r.id));
  return rows.map((r) => {
    if (r.isChief || r.id === 'chief') return { id: r.id, parentId: null };
    const parent = r.reportsTo?.trim() || null;
    if (!parent || parent === r.id || !ids.has(parent)) {
      return { id: r.id, parentId: null };
    }
    return { id: r.id, parentId: parent };
  });
}
