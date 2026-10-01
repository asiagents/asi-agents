import { DAEMON_LAUNCH_HINT, DESK_CONTROL_URL } from "./config.js";
import { probeDesk } from "./probe.js";

const TIMEOUT_MS = 45000;

export type DeskProxyResult =
  | { offline: false; status: number; body: unknown }
  | { offline: true; status: number; body: Record<string, unknown> };

function offlineBody(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ok: false,
    live: false,
    offline: true,
    error: "Desk daemon is not running on :3456 — start it before browser tools (no fake success).",
    setupMessage: DAEMON_LAUNCH_HINT,
    ...extra,
  };
}

/** Fail-closed proxy to Desk :3456. Never invent success when desk is down. */
export async function proxyDesk(
  method: string,
  deskPath: string,
  body?: unknown,
): Promise<DeskProxyResult> {
  const probe = await probeDesk();
  if (!probe.live) {
    return {
      offline: true,
      status: 503,
      body: offlineBody({
        probeState: probe.state,
        probeError: probe.error,
        url: probe.url,
      }),
    };
  }

  const url = `${DESK_CONTROL_URL}${deskPath.startsWith("/") ? deskPath : `/${deskPath}`}`;
  try {
    const init: RequestInit = {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    };
    const res = await fetch(url, init);
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text.slice(0, 2000) };
    }
    return { offline: false, status: res.status, body: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      offline: true,
      status: 503,
      body: offlineBody({ error: message, url }),
    };
  }
}
