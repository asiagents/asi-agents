/** User-facing hint when the ASI API cannot be reached (network), not when a subsystem is merely offline. */
export function asiApiUnreachableMessage(): string {
  if (typeof window === "undefined") {
    return "Could not reach the ASI API on :3445.";
  }
  const { port, hostname } = window.location;
  const onViteDev =
    (hostname === "127.0.0.1" || hostname === "localhost") && port !== "" && port !== "3445";
  if (onViteDev) {
    return (
      "Could not reach the ASI API (:3445). From the package root run npm run dev " +
      "(both API + UI). npm run dev:app alone is not enough — Vite proxies /api to :3445."
    );
  }
  if (port === "3445" || port === "") {
    return "Could not reach /api/desk/status on this server. Restart with: npm run start";
  }
  return `Could not reach /api/desk/status from ${hostname}:${port}. Open http://127.0.0.1:3445/desk or run npm run start.`;
}

/** Numbered host steps — daemon on :3456 first; Docker containers optional. */
export const DESK_SETUP_STEPS = [
  "Set ASI_DESK_REPO to your Desk install folder (optional)",
  "python -m pip install -r requirements-browser.txt",
  "python -m playwright install chromium",
  "python daemon/desk_daemon.py",
  "# Optional — container/noVNC desks only:",
  "docker compose up -d --build desk-chief",
] as const;

export const DESK_DAEMON_HINT =
  "Set ASI_DESK_REPO, then: python daemon/desk_daemon.py (Desk is optional — core chat works without it)";

/** Client helper URL for server-side Desk spawn (ASI_DESK_AUTOSTART). */
export const DESK_START_PATH = "/api/desk/start";

export type DeskUiFailureKind = "asi_api" | "daemon_offline" | "http_error" | "checking";

export function deskUiHeadline(kind: DeskUiFailureKind): string {
  switch (kind) {
    case "asi_api":
      return "ASI API unreachable";
    case "http_error":
      return "Desk daemon error";
    case "checking":
      return "Checking Desk…";
    default:
      return "Virtual Computer is offline";
  }
}

/** Distinguish client→ASI API failure from ASI→Desk :3456 offline.
 * Docker off is never a hard failure when the daemon is live.
 */
export function classifyDeskUiFailure(opts: {
  apiUnreachable?: boolean;
  live?: boolean;
  dockerAvailable?: boolean | null;
  state?: string;
}): DeskUiFailureKind {
  if (opts.apiUnreachable) return "asi_api";
  if (opts.live) return "checking"; // live path should not use failure headlines
  if (opts.state === "http_error") return "http_error";
  if (opts.live == null && !opts.apiUnreachable) return "checking";
  return "daemon_offline";
}
