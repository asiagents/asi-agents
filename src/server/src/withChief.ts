/** Product rule: Chief is a member of every group, board, council, and Pro set. */
export const CHIEF_ID = "chief";

/** Sentinel assignee — Personal (Boss) to-dos, no agent owns the work. */
export const BOSS_ID = "boss";

/** Sentinel moderator id — the human user moderates / posts the Final. */
export const USER_MODERATOR_ID = "user";

export function isBossId(id: string): boolean {
  return id === BOSS_ID;
}

export function isChiefId(id: string): boolean {
  return id === CHIEF_ID;
}

export function isUserModerator(id: string): boolean {
  return id === USER_MODERATOR_ID;
}

/** Ensure Chief is first; never drop him from a roster id list. */
export function withChiefIds(ids: readonly string[]): string[] {
  const rest = ids.filter((id) => id && id !== CHIEF_ID);
  return [CHIEF_ID, ...rest];
}

/** True when removing this id would violate the Chief-always rule. */
export function wouldRemoveChief(_ids: readonly string[], removeId: string): boolean {
  return isChiefId(removeId);
}
