/** Product rule: Chief is a member of every group, board, council, and Pro set. */
export const CHIEF_ID = "chief";

/** Sentinel assignee — Personal (Boss) to-dos, no agent owns the work. */
export const BOSS_ID = "boss";

/** Sentinel moderator id — the human user moderates / posts the Final. */
export const USER_MODERATOR_ID = "user";

export function isChiefId(id: string): boolean {
  return id === CHIEF_ID;
}

export function isBossId(id: string): boolean {
  return id === BOSS_ID;
}

export function isUserModerator(id: string): boolean {
  return id === USER_MODERATOR_ID;
}
/** Ensure Chief is first; never drop him from a roster id list. */
export function withChiefIds(ids: readonly string[]): string[] {
  const rest = ids.filter((id) => id && id !== CHIEF_ID);
  return [CHIEF_ID, ...rest];
}

/** Order-sensitive equality after Chief normalization (board roster sync). */
export function boardIdsEqual(a: readonly string[], b: readonly string[]): boolean {
  const x = withChiefIds(a);
  const y = withChiefIds(b);
  if (x.length !== y.length) return false;
  return x.every((id, i) => id === y[i]);
}

/** True when removing this id would violate the Chief-always rule. */
export function wouldRemoveChief(ids: readonly string[], removeId: string): boolean {
  return isChiefId(removeId);
}

/** Council / group UI: Chief first, then board order, then any extras. */
export function councilFromBoard<T extends { id: string }>(
  roster: readonly T[],
  boardIds: readonly string[]
): T[] {
  const byId = new Map(roster.map((a) => [a.id, a]));
  const ordered = withChiefIds(boardIds)
    .map((id) => byId.get(id))
    .filter((a): a is T => !!a);
  const seen = new Set(ordered.map((a) => a.id));
  for (const a of roster) {
    if (!seen.has(a.id) && withChiefIds(boardIds).includes(a.id)) {
      ordered.push(a);
      seen.add(a.id);
    }
  }
  return ordered;
}
