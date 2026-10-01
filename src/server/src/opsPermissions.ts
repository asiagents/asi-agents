/**
 * Permission-gated chat ops: diagnose backends, restart ASI process, suggest PC reboot.
 * Fail closed — no arbitrary shell from chat.
 */
import { getLlamaCppProbeSummary, getOllamaProbeSummary, listModels } from "./models.js";
import {
  getStandingPermissionRules,
  normalizePermissionPolicy,
} from "./standingPermissions.js";
import { loadState, saveState } from "./store.js";
import type { PermissionItem, PermissionPolicy } from "./types.js";

export const OPS_CAPABILITIES = ["ops.diagnose", "ops.restart_asi", "ops.suggest_reboot"] as const;
export type OpsCapability = (typeof OPS_CAPABILITIES)[number];

const OPS_LABELS: Record<OpsCapability, { title: string; description: string }> = {
  "ops.diagnose": {
    title: "Diagnose local backends",
    description: "Re-probe Ollama / llama.cpp / router and return a fix checklist from chat",
  },
  "ops.restart_asi": {
    title: "Restart ASI server process",
    description: "Exit the :3445 process for a supervisor (or ask you to run npm run start) — never reboots the PC",
  },
  "ops.suggest_reboot": {
    title: "Suggest PC reboot",
    description: "Suggest restarting this PC after repeated local failures — never forces a reboot",
  },
};

const ROUTER_BASE = (process.env.ASI_ROUTER_URL ?? "http://127.0.0.1:7821").replace(/\/$/, "");

async function probeRouterLive(): Promise<boolean> {
  try {
    const res = await fetch(`${ROUTER_BASE}/health`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

export function isOpsCapability(id: string): id is OpsCapability {
  return (OPS_CAPABILITIES as readonly string[]).includes(id);
}

export function getOpsPolicy(id: OpsCapability): PermissionPolicy {
  const rule = getStandingPermissionRules().find((r) => r.id === id);
  return normalizePermissionPolicy(rule?.policy, "ask");
}

/** Create a pending Permissions UI row (Chief / user can Approve / Always / Deny). */
export function enqueueOpsPermissionRequest(id: OpsCapability): PermissionItem {
  const meta = OPS_LABELS[id];
  const state = loadState();
  const prior = state.permissions.find((p) => p.id === id);
  if (prior) {
    prior.status = "pending";
    prior.title = meta.title;
    prior.description = meta.description;
    prior.kind = "ops";
    saveState(state);
    return prior;
  }
  const stable: PermissionItem = {
    id,
    title: meta.title,
    description: meta.description,
    kind: "ops",
    status: "pending",
  };
  state.permissions.unshift(stable);
  saveState(state);
  return stable;
}

/**
 * Gate an ops action.
 * - never → refuse
 * - always → allow (restart still uses chat confirm separately)
 * - ask → enqueue pending + require chat confirm
 */
export function gateOpsCapability(id: OpsCapability): {
  allow: boolean;
  policy: PermissionPolicy;
  message?: string;
  needConfirm?: boolean;
} {
  const policy = getOpsPolicy(id);
  if (policy === "never") {
    return {
      allow: false,
      policy,
      message:
        `${OPS_LABELS[id].title} is blocked by standing rule (${id} = Never). ` +
        "Change it under Settings → Permissions → Standing rules.",
    };
  }
  if (policy === "always") {
    return { allow: true, policy };
  }
  enqueueOpsPermissionRequest(id);
  return {
    allow: false,
    policy,
    needConfirm: true,
    message:
      `${OPS_LABELS[id].title} needs approval (standing rule ${id} = Ask). ` +
      "Reply yes to allow once, or Approve / Always under Settings → Permissions.",
  };
}

/** After Permissions UI Approve/Always for an ops id, treat as allowed for this session. */
export function opsPermissionGranted(id: OpsCapability): boolean {
  const policy = getOpsPolicy(id);
  if (policy === "always") return true;
  if (policy === "never") return false;
  const item = loadState().permissions.find((p) => p.id === id);
  return item?.status === "approved" || item?.status === "always";
}

/**
 * Resolve gate for handler execution (after chat confirm.yes).
 * Standing always → ok. Standing ask → ok only if pending was approved or confirm path.
 */
export function assertOpsAllowed(id: OpsCapability, opts?: { afterConfirm?: boolean }): {
  ok: boolean;
  message?: string;
} {
  const policy = getOpsPolicy(id);
  if (policy === "never") {
    return {
      ok: false,
      message:
        `${OPS_LABELS[id].title} is blocked (Never). Open Settings → Permissions to change ${id}.`,
    };
  }
  if (policy === "always") return { ok: true };
  // ask
  if (opts?.afterConfirm || opsPermissionGranted(id)) return { ok: true };
  enqueueOpsPermissionRequest(id);
  return {
    ok: false,
    message:
      `Approve ${id} under Settings → Permissions, set standing to Always, or reply yes when asked.`,
  };
}

export async function runOpsDiagnose(): Promise<string> {
  const [ollama, llama, routerLive] = await Promise.all([
    getOllamaProbeSummary(),
    getLlamaCppProbeSummary(),
    probeRouterLive(),
  ]);

  let scanNote = "";
  try {
    const scanned = await listModels();
    const n = scanned.models?.length ?? 0;
    scanNote = `Models scan: ${n} card(s).`;
  } catch (e) {
    scanNote = `Models scan failed: ${e instanceof Error ? e.message : "error"}`;
  }

  const lines = [
    "Local backend diagnose (permission ops.diagnose):",
    `• Ollama @ ${ollama.host}: ${ollama.reachable ? `reachable · ${ollama.count} tag(s)` : `down${ollama.error ? ` (${ollama.error})` : ""}`}`,
    `• llama.cpp: ${
      !llama.configured
        ? "not configured (LLAMA_CPP_HOST unset)"
        : llama.reachable
          ? `reachable @ ${llama.base} · ${llama.count} model(s)`
          : `unreachable @ ${llama.base}${llama.error ? ` (${llama.error})` : ""}`
    }`,
    `• SLM router @ ${ROUTER_BASE}: ${routerLive ? "live (GET /health OK)" : "not reachable"}`,
    `• ${scanNote}`,
    "",
    "Fix checklist:",
    "1. Start Ollama (`ollama serve` or tray) and pull a chat model if tags are empty",
    "2. Settings → Models → Scan models",
    "3. Settings → Connections — enable provider + add key if you need cloud",
    "4. Restart ASI only with ops.restart_asi (never from arbitrary shell)",
    "5. PC reboot is only a suggestion (ops.suggest_reboot) — never forced from chat",
  ];
  return lines.join("\n");
}

export function runOpsSuggestReboot(failureStreak: number): string {
  if (failureStreak < 3) {
    return (
      "PC reboot is a last resort. Fix Ollama / llama.cpp / Connections first, " +
      "or say diagnose backends. I will not reboot this machine from chat."
    );
  }
  return (
    "After repeated local failures, a PC restart can help (drivers / stuck GPU RAM). " +
    "I will not reboot from chat — please restart this PC yourself when ready, " +
    "then start Ollama / llama.cpp and `npm run start` again."
  );
}

const RESTART_EXIT = Number(process.env.ASI_RESTART_EXIT_CODE ?? 42);

let restartScheduled = false;

/**
 * Exit the Node process so a supervisor can restart it.
 * Does not spawn shell / npm — unmanaged installs: tell the user to run `npm run start`.
 */
export function scheduleAsiProcessRestart(): string {
  if (restartScheduled) {
    return "ASI restart already scheduled.";
  }
  restartScheduled = true;
  const code = Number.isFinite(RESTART_EXIT) ? RESTART_EXIT : 42;
  setTimeout(() => {
    console.warn(`[ops] exiting with code ${code} for supervisor restart`);
    process.exit(code);
  }, 750);
  return (
    `ASI server process will exit shortly (code ${code}) so a supervisor can restart it. ` +
    "If nothing restarts you automatically, run `npm run start` (or `npm.cmd run start` on Windows) from the repo root. " +
    "This does not reboot your PC."
  );
}
