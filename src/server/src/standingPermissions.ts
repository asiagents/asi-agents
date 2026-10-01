import { loadState, saveState } from "./store.js";
import type { PermissionPolicy, StandingPermissionRule } from "./types.js";

/** Canonical standing-rule catalog (labels fixed; policy is user-overridable). */
const CATALOG: readonly StandingPermissionRule[] = [
  {
    id: "r1",
    category: "spend",
    label: "Cloud model calls",
    detail: "Any call that leaves this device and costs money",
    policy: "ask",
  },
  {
    id: "r2",
    category: "spend",
    label: "Off-device escalation",
    detail: "Handoffs to Chat 1B or Chat 3B",
    policy: "ask",
  },
  {
    id: "r3",
    category: "shell",
    label: "Read-only commands",
    detail: "Listing files, reading logs in the Virtual Computer",
    policy: "ask",
  },
  {
    id: "r4",
    category: "shell",
    label: "Commands that write or delete",
    detail: "Anything that changes files",
    policy: "never",
  },
  {
    id: "r5",
    category: "skill",
    label: "Install new skills",
    detail: "Adding abilities to any agent",
    policy: "ask",
  },
  {
    id: "r6",
    category: "skill",
    label: "Web browsing",
    detail: "Fetching pages from the internet",
    policy: "ask",
  },
  {
    id: "r7",
    category: "skill",
    label: "Calendar read",
    detail: "Seeing your schedule",
    policy: "always",
  },
  {
    id: "ops.diagnose",
    category: "ops",
    label: "Diagnose backends from chat",
    detail: "Re-probe Ollama / models and return a fix checklist (no shell)",
    policy: "ask",
  },
  {
    id: "ops.restart_asi",
    category: "ops",
    label: "Restart ASI server from chat",
    detail: "Exit the product process for a supervisor — never reboots the PC; still needs chat confirm",
    policy: "ask",
  },
  {
    id: "ops.suggest_reboot",
    category: "ops",
    label: "Suggest PC reboot from chat",
    detail: "Suggest restarting this PC after repeated failures — never forces a reboot",
    policy: "ask",
  },
];

const CATALOG_IDS = new Set(CATALOG.map((r) => r.id));

export function normalizePermissionPolicy(value: unknown, fallback: PermissionPolicy = "ask"): PermissionPolicy {
  if (value === "ask" || value === "always" || value === "never") return value;
  return fallback;
}

function mergeRules(stored: Record<string, PermissionPolicy> | undefined): StandingPermissionRule[] {
  const overrides = stored ?? {};
  return CATALOG.map((rule) => ({
    ...rule,
    policy: normalizePermissionPolicy(overrides[rule.id], rule.policy),
  }));
}

export function getStandingPermissionRules(): StandingPermissionRule[] {
  return mergeRules(loadState().standingPermissionPolicies);
}

export function setStandingPermissionRules(
  updates: { id: string; policy: PermissionPolicy }[]
): StandingPermissionRule[] {
  const state = loadState();
  const next: Record<string, PermissionPolicy> = { ...(state.standingPermissionPolicies ?? {}) };
  for (const u of updates) {
    const id = String(u.id ?? "").trim();
    if (!CATALOG_IDS.has(id)) continue;
    next[id] = normalizePermissionPolicy(u.policy);
  }
  state.standingPermissionPolicies = next;
  saveState(state);
  return mergeRules(next);
}
