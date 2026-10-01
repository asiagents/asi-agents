/** Same-origin first; loopback :3445 when UI is served without an /api proxy. */
export const DESK_STATUS_URLS = ["/api/desk/status", "http://127.0.0.1:3445/api/desk/status"] as const;

export async function fetchDeskStatus(): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < DESK_STATUS_URLS.length; i++) {
    const url = DESK_STATUS_URLS[i];
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      const isLast = i === DESK_STATUS_URLS.length - 1;
      if (isLast || (res.status !== 404 && res.status < 502)) return res;
    } catch (err) {
      lastError = err;
      if (i === DESK_STATUS_URLS.length - 1) throw err;
    }
  }
  throw lastError ?? new Error("Could not reach desk status API.");
}
