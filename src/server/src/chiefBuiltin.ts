import type { RegistryAgent } from "./agents.js";

/**
 * Default AMS/basic skills for Chief of staff: triage, scheduling, handoffs, briefs.
 * Catalog ids must exist in config/ams-skills.catalog.json (filtered at seed time).
 */
export const CHIEF_DEFAULT_SKILLS = [
  "mail-triage",
  "scheduling",
  "ticket-summarize",
  "proposal-draft",
  "shift-handoff",
] as const;

/** Canonical Chief row when registry/scan omit him (product rule). */
export function builtinChiefAgent(): RegistryAgent {
  return {
    id: "chief",
    name: "Chief",
    role: "Chief of staff",
    roleTag: "chief",
    status: "active",
    modelId: "micro",
    skills: [...CHIEF_DEFAULT_SKILLS],
    source: "registry",
    updatedAt: null,
    avatar: "e2b650a4-4c63-42fc-b52f-60d2a4fb8025.jpg",
    initials: "CH",
    isChief: true,
    currentTask: "Online · flat with you",
  };
}

/** Inject or normalize Chief in a merged roster map. */
export function ensureChiefInMap(byId: Map<string, RegistryAgent>): void {
  const existing = byId.get("chief");
  if (!existing) {
    byId.set("chief", builtinChiefAgent());
    return;
  }
  const skills =
    Array.isArray(existing.skills) && existing.skills.length > 0
      ? existing.skills
      : [...CHIEF_DEFAULT_SKILLS];
  byId.set("chief", {
    ...existing,
    isChief: true,
    name: existing.name || "Chief",
    role: existing.role || "Chief of staff",
    roleTag: existing.roleTag || "chief",
    skills,
  });
}

/** Chief first, then stable order for the rest. */
export function sortAgentsChiefFirst(agents: RegistryAgent[]): RegistryAgent[] {
  const chief = agents.filter((a) => a.id === "chief");
  const rest = agents.filter((a) => a.id !== "chief");
  return [...chief, ...rest];
}
