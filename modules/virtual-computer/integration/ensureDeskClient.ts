import { DESK_STATUS_URLS, fetchDeskStatus } from "./fetchDeskStatus.js";

const DESK_START_URLS = ["/api/desk/start", "http://127.0.0.1:3445/api/desk/start"] as const;

export type DeskStartResponse = {
  ok: boolean;
  live: boolean;
  started?: boolean;
  autostartEnabled?: boolean;
  message?: string;
  error?: string;
};

/** One autostart attempt per page session — status poll must not re-spawn forever. */
let autostartAttempted = false;

/**
 * Ask ASI to spawn the Desk daemon when offline (server-side, ASI_DESK_AUTOSTART).
 * Safe to call on /desk or Home VD open — no-op when already live or autostart off.
 */
export async function requestDeskAutostart(): Promise<DeskStartResponse | null> {
  let lastError: unknown;
  for (let i = 0; i < DESK_START_URLS.length; i++) {
    const url = DESK_START_URLS[i];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waitMs: 20000 }),
      });
      return (await res.json().catch(() => ({}))) as DeskStartResponse;
    } catch (err) {
      lastError = err;
      if (i === DESK_START_URLS.length - 1) {
        console.warn("[desk] autostart request failed", lastError);
        return null;
      }
    }
  }
  return null;
}

/**
 * If status is offline, try server autostart once per session, then re-fetch status.
 * Never fabricates live:true — returns whatever the probe says.
 * If the retry throws after a usable first response, keep the first (avoids false "API down").
 */
export async function fetchDeskStatusWithAutostart(): Promise<Response> {
  const first = await fetchDeskStatus();
  if (first.ok) {
    try {
      const clone = first.clone();
      const j = (await clone.json()) as { live?: boolean; autostartEnabled?: boolean };
      if (j.live === true) return first;
      if (j.autostartEnabled === false) return first;
    } catch {
      return first;
    }
  } else if (autostartAttempted) {
    return first;
  }

  if (autostartAttempted) return first;
  autostartAttempted = true;
  await requestDeskAutostart();
  try {
    return await fetchDeskStatus();
  } catch (err) {
    if (first.ok) return first;
    throw err;
  }
}

export { DESK_STATUS_URLS };
