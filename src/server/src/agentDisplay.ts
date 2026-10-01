/** Staff aliases for the Chief agent (display paren label). */
export type StaffRoleLabel = "chief" | "secretary" | "buddy";

const STAFF_LABELS = new Set<StaffRoleLabel>(["chief", "secretary", "buddy"]);

/** Map free-text / legacy tags → chief | secretary | buddy. */
export function normalizeStaffRoleLabel(raw: string | null | undefined): StaffRoleLabel {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return "chief";
  if (t === "secretary" || t === "secratary" || t === "secretaries") return "secretary";
  if (t === "buddy" || t === "bud" || t === "pal") return "buddy";
  if (t === "chief" || t === "staff" || t === "chief of staff" || t === "cos") return "chief";
  if (STAFF_LABELS.has(t as StaffRoleLabel)) return t as StaffRoleLabel;
  return "chief";
}

export function isStaffRoleLabel(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim().toLowerCase();
  return (
    STAFF_LABELS.has(t as StaffRoleLabel) ||
    t === "staff" ||
    t === "chief of staff" ||
    t === "secratary" ||
    t === "secretaries" ||
    t === "bud" ||
    t === "pal" ||
    t === "cos"
  );
}

/**
 * UI / reply heading: Chief uses `Name (chief|secretary|buddy)`.
 * Default: `Chief (chief)`.
 */
export function formatAgentDisplayName(agent: {
  name: string;
  roleTag?: string | null;
  isChief?: boolean;
  id?: string;
}): string {
  const name = (agent.name ?? "").trim() || "Chief";
  const isChief = agent.isChief === true || agent.id === "chief" || isStaffRoleLabel(agent.roleTag);
  if (!isChief) return name;
  return `${name} (${normalizeStaffRoleLabel(agent.roleTag)})`;
}
