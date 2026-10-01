import { DESK_CONTROL_URL, DESK_DESKS_PATH, DESK_HEALTH_PATH } from "./config.js";

export type DeskProbeState = "live" | "not_running" | "http_error";

export interface DeskProbeResult {
  live: boolean;
  url: string;
  healthUrl: string;
  state: DeskProbeState;
  httpStatus?: number;
  /** Human-readable reason when `live` is false. */
  error?: string;
  /** Raw desks list from daemon — never invent rows when offline. */
  desks?: unknown;
  /** Daemon /api/v1/health body when reachable. */
  health?: unknown;
}

function describeFetchError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ECONNREFUSED" || msg.includes("econnrefused")) {
      return "Nothing is listening on :3456 — Desk daemon optional; set ASI_DESK_REPO and start it, or ignore for core chat.";
    }
    if (msg.includes("timeout") || err.name === "TimeoutError") {
      return "Port :3456 did not respond in time — daemon may still be starting, hung, or blocked on loopback.";
    }
    return err.message;
  }
  return "Could not reach the desk control API on 127.0.0.1:3456.";
}

async function fetchHealth(): Promise<unknown | undefined> {
  try {
    const res = await fetch(`${DESK_CONTROL_URL}${DESK_HEALTH_PATH}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return undefined;
    return await res.json().catch(() => undefined);
  } catch {
    return undefined;
  }
}

/** Probe Desk :3456. Offline = empty desks, never fabricated agents. */
export async function probeDesk(): Promise<DeskProbeResult> {
  const url = `${DESK_CONTROL_URL}${DESK_DESKS_PATH}`;
  const healthUrl = `${DESK_CONTROL_URL}${DESK_HEALTH_PATH}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) {
      return {
        live: false,
        url,
        healthUrl,
        state: "http_error",
        httpStatus: res.status,
        error: `Desk daemon on :3456 responded with HTTP ${res.status} — check daemon logs.`,
      };
    }
    const desks = await res.json().catch(() => undefined);
    const health = await fetchHealth();
    return { live: true, url, healthUrl, state: "live", desks, health };
  } catch (err) {
    return {
      live: false,
      url,
      healthUrl,
      state: "not_running",
      error: describeFetchError(err),
    };
  }
}
