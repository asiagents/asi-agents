/** Desk control daemon (loopback). Always prefer 127.0.0.1:3456 — not legacy ports. */
export const DESK_CONTROL_URL = (process.env.ASI_DESK_URL ?? "http://127.0.0.1:3456").replace(
  /\/$/,
  "",
);

/**
 * Management console iframe URL. `embed=1` skips the mock login wall and trims
 * console chrome so it does not fight ASI /desk (default: no VNC / no auth).
 */
export const DESK_CONSOLE_URL = `${DESK_CONTROL_URL}/?embed=1`;

export const DESK_DESKS_PATH = "/api/v1/desks";
export const DESK_HEALTH_PATH = "/api/v1/health";

/** Relative path under the Desk repo (spawn cwd = EXTERNAL_REPO_PATH). */
export const DAEMON_SCRIPT = "daemon/desk_daemon.py";

/**
 * Full Desk runtime repo — not vendored into ASI Agents.
 * Prefer ASI_DESK_REPO; DESK_ROOT is an accepted alias.
 * Empty default = optional / fail-closed until the user points at a Desk install.
 */
export const EXTERNAL_REPO_PATH =
  process.env.ASI_DESK_REPO?.trim() || process.env.DESK_ROOT?.trim() || "";

export const DAEMON_LAUNCH_HINT = EXTERNAL_REPO_PATH
  ? `cd "${EXTERNAL_REPO_PATH}" && python ${DAEMON_SCRIPT}`
  : "Set ASI_DESK_REPO to your Desk install, then: python daemon/desk_daemon.py";

/**
 * Local default ON (`ASI_DESK_AUTOSTART=1`). Set `=0` on cheap VPS / ship-safe deploys
 * so ASI never spawns Python Desk.
 */
export function isDeskAutostartEnabled(): boolean {
  const raw = (process.env.ASI_DESK_AUTOSTART ?? "1").trim().toLowerCase();
  return !(raw === "0" || raw === "false" || raw === "off" || raw === "no");
}

/** Host setup steps returned by GET /api/desk/status (no fake desks). */
export const DESK_SETUP_STEPS = [
  "Set ASI_DESK_REPO to your Desk install folder (optional module)",
  "python -m pip install -r requirements-browser.txt",
  "python -m playwright install chromium",
  `python ${DAEMON_SCRIPT}`,
  "# Optional — container/noVNC desks only (Docker Desktop):",
  "docker compose up -d --build desk-chief",
];
