/** Board decision stances persisted in app-state (Lane 7). */

export type BoardStanceKind = "for" | "info" | "against";

export interface BoardAgentStance {
  stance: BoardStanceKind;
  note: string;
}

export type BoardStancesMap = Record<string, BoardAgentStance>;

const VALID: ReadonlySet<string> = new Set(["for", "info", "against"]);

export function normalizeBoardStances(raw: unknown): BoardStancesMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: BoardStancesMap = {};
  for (const [agentId, val] of Object.entries(raw as Record<string, unknown>)) {
    const id = String(agentId).trim();
    if (!id || !val || typeof val !== "object" || Array.isArray(val)) continue;
    const stance = (val as { stance?: unknown }).stance;
    if (typeof stance !== "string" || !VALID.has(stance)) continue;
    const noteRaw = (val as { note?: unknown }).note;
    const note = noteRaw != null ? String(noteRaw).slice(0, 2000) : "";
    out[id] = { stance: stance as BoardStanceKind, note };
  }
  return out;
}
