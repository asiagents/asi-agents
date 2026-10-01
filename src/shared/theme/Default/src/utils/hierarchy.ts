import type { OrgNode } from '../types/agents';

export function isDescendant(tree: OrgNode[], ancestorId: string, nodeId: string): boolean {
  let cur = tree.find((n) => n.id === nodeId)?.parentId ?? null;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = tree.find((n) => n.id === cur)?.parentId ?? null;
  }
  return false;
}

export function canMove(tree: OrgNode[], dragId: string, targetId: string): boolean {
  if (dragId === targetId) return false;
  if (dragId === 'chief') return false;
  if (!tree.some((n) => n.id === dragId) || !tree.some((n) => n.id === targetId)) return false;
  // Flat-by-default: peers (parentId null) may still be assigned a parent later.
  return !isDescendant(tree, dragId, targetId);
}

/** Assign or clear reportsTo. parentId null = flat peer (no manager). */
export function setReportsTo(tree: OrgNode[], id: string, parentId: string | null): OrgNode[] {
  if (parentId !== null && !canMove(tree, id, parentId)) return tree;
  return tree.map((n) => (n.id === id ? { ...n, parentId } : n));
}

export function moveInto(tree: OrgNode[], dragId: string, targetId: string): OrgNode[] {
  if (!canMove(tree, dragId, targetId)) return tree;
  return [...tree.filter((n) => n.id !== dragId), { id: dragId, parentId: targetId }];
}

export function moveBefore(tree: OrgNode[], dragId: string, targetId: string): OrgNode[] {
  const target = tree.find((n) => n.id === targetId);
  // Allow reordering among flat peers (parentId null); never reorder onto Chief's slot alone.
  if (!target || targetId === 'chief' || !canMove(tree, dragId, targetId)) return tree;
  const rest = tree.filter((n) => n.id !== dragId);
  const idx = rest.findIndex((n) => n.id === targetId);
  rest.splice(idx, 0, { id: dragId, parentId: target.parentId });
  return rest;
}

export function shiftSibling(tree: OrgNode[], id: string, dir: -1 | 1): OrgNode[] {
  const node = tree.find((n) => n.id === id);
  if (!node) return tree;
  const siblings = tree.filter((n) => n.parentId === node.parentId);
  const pos = siblings.findIndex((n) => n.id === id);
  const swap = siblings[pos + dir];
  if (!swap) return tree;
  const next = [...tree];
  const a = next.findIndex((n) => n.id === id);
  const b = next.findIndex((n) => n.id === swap.id);
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export function childrenOf(tree: OrgNode[], parentId: string | null): OrgNode[] {
  return tree.filter((n) => n.parentId === parentId);
}