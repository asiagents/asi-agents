import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  DAEMON_SCRIPT,
  DESK_CONSOLE_URL,
  DESK_CONTROL_URL,
  EXTERNAL_REPO_PATH,
  isDeskAutostartEnabled,
} from "./config.js";
import { probeDesk, type DeskProbeResult } from "./probe.js";

export type DeskEnsureResult = {
  ok: boolean;
  live: boolean;
  started: boolean;
  autostartEnabled: boolean;
  message: string;
  error?: string;
  externalRepoPath: string;
  consoleUrl: string;
  launchHint: string;
  probe?: DeskProbeResult;
};

const POLL_MS = 500;
const DEFAULT_WAIT_MS = 20_000;

let spawning: Promise<DeskEnsureResult> | null = null;
let child: ChildProcess | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function resolvePython(): { cmd: string; argsPrefix: string[] } | { error: string } {
  const override = process.env.ASI_DESK_PYTHON?.trim();
  if (override) {
    if (!fs.existsSync(override) && path.isAbsolute(override)) {
      return { error: `ASI_DESK_PYTHON points to a missing binary: ${override}` };
    }
    return { cmd: override, argsPrefix: [] };
  }
  // Prefer `python` on PATH (Windows + Unix). Fail closed if spawn later fails.
  return { cmd: process.platform === "win32" ? "python" : "python3", argsPrefix: [] };
}

function daemonScriptPath(): string {
  return path.join(EXTERNAL_REPO_PATH, DAEMON_SCRIPT);
}

function missingPrereqError(): string | null {
  if (!EXTERNAL_REPO_PATH || !fs.existsSync(EXTERNAL_REPO_PATH)) {
    return "Virtual Computer Desk is optional. Set ASI_DESK_REPO (or DESK_ROOT) to a Desk install to enable autostart; core chat works without it.";
  }
  const script = daemonScriptPath();
  if (!fs.existsSync(script)) {
    return `Desk daemon script missing: ${script}. Expected python daemon/desk_daemon.py under the Desk repo.`;
  }
  return null;
}

async function waitUntilLive(timeoutMs: number): Promise<DeskProbeResult> {
  const deadline = Date.now() + timeoutMs;
  let last = await probeDesk();
  while (!last.live && Date.now() < deadline) {
    await sleep(POLL_MS);
    last = await probeDesk();
  }
  return last;
}

function spawnDaemon(): { ok: true } | { ok: false; error: string } {
  const missing = missingPrereqError();
  if (missing) return { ok: false, error: missing };

  const py = resolvePython();
  if ("error" in py) return { ok: false, error: py.error };

  try {
    const scriptRel = DAEMON_SCRIPT.replace(/\\/g, "/");
    const proc = spawn(py.cmd, [...py.argsPrefix, scriptRel], {
      cwd: EXTERNAL_REPO_PATH,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env },
    });
    proc.unref();
    child = proc;
    proc.on("error", (err) => {
      // Surface spawn failures on next ensure (ENOENT = python missing).
      child = null;
      console.error("[virtual-computer] desk daemon spawn error:", err.message);
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/ENOENT|not found|can't find/i.test(message)) {
      return {
        ok: false,
        error: `Python not found on PATH — install Python 3 and retry, or set ASI_DESK_PYTHON. (${message})`,
      };
    }
    return { ok: false, error: `Failed to spawn desk daemon: ${message}` };
  }
}

/**
 * Ensure Desk daemon is live on :3456. Fail-closed when python/repo missing or autostart off.
 * Idempotent — concurrent callers share one spawn attempt.
 */
export async function ensureDeskDaemon(opts?: {
  waitMs?: number;
  /** When true, refuse even if ASI_DESK_AUTOSTART=1 (ops gate). */
  forceOff?: boolean;
}): Promise<DeskEnsureResult> {
  const base = {
    externalRepoPath: EXTERNAL_REPO_PATH,
    consoleUrl: DESK_CONSOLE_URL,
    launchHint: `cd "${EXTERNAL_REPO_PATH}" && python ${DAEMON_SCRIPT}`,
  };

  const probeFirst = await probeDesk();
  if (probeFirst.live) {
    return {
      ok: true,
      live: true,
      started: false,
      autostartEnabled: isDeskAutostartEnabled(),
      message: "Desk daemon already live on 127.0.0.1:3456.",
      probe: probeFirst,
      ...base,
    };
  }

  if (opts?.forceOff || !isDeskAutostartEnabled()) {
    return {
      ok: false,
      live: false,
      started: false,
      autostartEnabled: false,
      message:
        "Desk autostart is off (ASI_DESK_AUTOSTART=0). Start manually: " + base.launchHint,
      error: probeFirst.error ?? "Daemon not running.",
      probe: probeFirst,
      ...base,
    };
  }

  if (spawning) return spawning;

  spawning = (async (): Promise<DeskEnsureResult> => {
    const missing = missingPrereqError();
    if (missing) {
      return {
        ok: false,
        live: false,
        started: false,
        autostartEnabled: true,
        message: missing,
        error: missing,
        probe: probeFirst,
        ...base,
      };
    }

    // Re-check in case another process brought it up.
    const again = await probeDesk();
    if (again.live) {
      return {
        ok: true,
        live: true,
        started: false,
        autostartEnabled: true,
        message: "Desk daemon already live on 127.0.0.1:3456.",
        probe: again,
        ...base,
      };
    }

    const spawned = spawnDaemon();
    if (!spawned.ok) {
      return {
        ok: false,
        live: false,
        started: false,
        autostartEnabled: true,
        message: spawned.error,
        error: spawned.error,
        probe: again,
        ...base,
      };
    }

    const waitMs = opts?.waitMs ?? DEFAULT_WAIT_MS;
    const probe = await waitUntilLive(waitMs);
    if (probe.live) {
      return {
        ok: true,
        live: true,
        started: true,
        autostartEnabled: true,
        message: "Desk daemon started and is live on 127.0.0.1:3456.",
        probe,
        ...base,
      };
    }

    const err =
      probe.error ??
      `Spawned desk daemon but :3456 did not become live within ${waitMs}ms. Check python logs in ${EXTERNAL_REPO_PATH}.`;
    return {
      ok: false,
      live: false,
      started: true,
      autostartEnabled: true,
      message: err,
      error: err,
      probe,
      ...base,
    };
  })().finally(() => {
    spawning = null;
  });

  return spawning;
}

/** Test helper — clears in-flight spawn lock (does not kill OS process). */
export function resetDeskAutostartStateForTests(): void {
  spawning = null;
  child = null;
}
