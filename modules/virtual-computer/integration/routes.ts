import type { Express, Request, Response } from "express";
import { ensureDeskDaemon } from "./autostart.js";
import {
  DAEMON_LAUNCH_HINT,
  DESK_CONSOLE_URL,
  DESK_CONTROL_URL,
  DESK_SETUP_STEPS,
  EXTERNAL_REPO_PATH,
  isDeskAutostartEnabled,
} from "./config.js";
import { proxyDesk } from "./browser-proxy.js";
import { deskStatusLine, summarizeDesks } from "./deskSummary.js";
import { probeDesk } from "./probe.js";

function sendProxy(res: Response, result: Awaited<ReturnType<typeof proxyDesk>>): void {
  res.status(result.status).json(result.body);
}

async function fetchHostUsage(): Promise<{
  dockerAvailable?: boolean;
  dockerMessage?: string | null;
  freeForDesksMb?: number;
  totalMb?: number;
} | null> {
  try {
    const r = await fetch(`${DESK_CONTROL_URL}/api/v1/host/usage`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return null;
    return (await r.json()) as {
      dockerAvailable?: boolean;
      dockerMessage?: string | null;
      freeForDesksMb?: number;
      totalMb?: number;
    };
  } catch {
    return null;
  }
}

export function mountDeskRoutes(app: Express): void {
  /**
   * Server-side Desk start — spawn `python daemon/desk_daemon.py` from DESK_ROOT /
   * ASI_DESK_REPO when ASI_DESK_AUTOSTART is on (default 1 for local). Fail-closed
   * if Python or the Desk repo is missing; never invent desks.
   */
  app.post("/api/desk/start", async (req, res) => {
    try {
      const waitRaw = Number(req.body?.waitMs ?? req.query.waitMs);
      const waitMs = Number.isFinite(waitRaw) && waitRaw > 0 ? Math.min(waitRaw, 60_000) : undefined;
      const forceOff = req.body?.forceOff === true || req.query.forceOff === "1";
      const result = await ensureDeskDaemon({ waitMs, forceOff });
      const summary = summarizeDesks(result.probe?.live ? result.probe.desks : []);
      res.status(result.ok ? 200 : result.autostartEnabled === false ? 403 : 503).json({
        ...result,
        desks: summary.desks,
        deskCount: summary.deskCount,
        runningCount: summary.runningCount,
        hibernatedCount: summary.hibernatedCount,
        stoppedCount: summary.stoppedCount,
        headlessCount: summary.headlessCount,
        visibleCount: summary.visibleCount,
        setupSteps: DESK_SETUP_STEPS,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Desk start failed.";
      res.status(500).json({
        ok: false,
        live: false,
        started: false,
        autostartEnabled: isDeskAutostartEnabled(),
        message,
        error: message,
        desks: [],
        deskCount: 0,
        runningCount: 0,
        hibernatedCount: 0,
        stoppedCount: 0,
        headlessCount: 0,
        visibleCount: 0,
        externalRepoPath: EXTERNAL_REPO_PATH,
        consoleUrl: DESK_CONSOLE_URL,
        launchHint: DAEMON_LAUNCH_HINT,
        setupSteps: DESK_SETUP_STEPS,
      });
    }
  });

  app.get("/api/desk/status", async (_req, res) => {
    try {
      const probe = await probeDesk();
      const usage = probe.live ? await fetchHostUsage() : null;
      // Daemon live = usable. Docker off is an optional note, not a hard failure.
      const kind = !probe.live
        ? probe.state === "http_error"
          ? "http_error"
          : "daemon_offline"
        : "daemon_live";
      const dockerNote =
        probe.live && usage?.dockerAvailable === false
          ? (usage.dockerMessage ??
            "Docker Desktop is off — optional. Local Playwright/CDP desks work without it. Start Docker only for container/noVNC desks.")
          : null;
      const summary = summarizeDesks(probe.live ? probe.desks : []);
      const setupMessage = probe.live
        ? summary.deskCount > 0
          ? `ASI Agents Desk is live — ${deskStatusLine(summary)}.`
          : "ASI Agents Desk daemon is reachable — no desks yet."
        : probe.error ?? "Desk daemon is not running yet.";
      res.json({
        ...probe,
        kind,
        desks: summary.desks,
        deskCount: summary.deskCount,
        runningCount: summary.runningCount,
        hibernatedCount: summary.hibernatedCount,
        stoppedCount: summary.stoppedCount,
        headlessCount: summary.headlessCount,
        visibleCount: summary.visibleCount,
        externalRepoPath: EXTERNAL_REPO_PATH,
        launchHint: DAEMON_LAUNCH_HINT,
        consoleUrl: DESK_CONSOLE_URL,
        setupMessage,
        setupSteps: DESK_SETUP_STEPS,
        probeOk: true,
        dockerAvailable: usage?.dockerAvailable,
        dockerMessage: dockerNote ?? usage?.dockerMessage ?? undefined,
        dockerOptionalNote: dockerNote ?? undefined,
        freeForDesksMb: usage?.freeForDesksMb,
        hostTotalMb: usage?.totalMb,
        autostartEnabled: isDeskAutostartEnabled(),
        autostartHint: isDeskAutostartEnabled()
          ? "POST /api/desk/start will spawn the Desk daemon when offline (ASI_DESK_AUTOSTART=1)."
          : "Autostart off — set ASI_DESK_AUTOSTART=1 or start the daemon manually.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Desk status probe failed.";
      res.status(500).json({
        live: false,
        kind: "probe_error",
        url: `${DESK_CONTROL_URL}/api/v1/desks`,
        healthUrl: `${DESK_CONTROL_URL}/api/v1/health`,
        state: "not_running",
        error: message,
        desks: [],
        deskCount: 0,
        runningCount: 0,
        hibernatedCount: 0,
        stoppedCount: 0,
        headlessCount: 0,
        visibleCount: 0,
        setupMessage:
          "ASI Agents could not reach the Desk daemon from this server.",
        setupSteps: DESK_SETUP_STEPS,
        externalRepoPath: EXTERNAL_REPO_PATH,
        launchHint: DAEMON_LAUNCH_HINT,
        consoleUrl: DESK_CONSOLE_URL,
        probeOk: false,
        autostartEnabled: isDeskAutostartEnabled(),
      });
    }
  });

  /** Browser/control health — honest offline when Desk down. */
  app.get("/api/desk/browser/health", async (_req, res) => {
    sendProxy(res, await proxyDesk("GET", "/api/v1/health"));
  });

  app.get("/api/desk/browser/status", async (_req, res) => {
    sendProxy(res, await proxyDesk("GET", "/api/v1/browser/status"));
  });

  app.get("/api/desk/browser/sessions/:id", async (req, res) => {
    sendProxy(res, await proxyDesk("GET", `/api/v1/browser/sessions/${encodeURIComponent(req.params.id)}`));
  });

  app.get("/api/desk/browser/sessions/:id/tabs", async (req, res) => {
    sendProxy(res, await proxyDesk("GET", `/api/v1/browser/sessions/${encodeURIComponent(req.params.id)}/tabs`));
  });

  app.post("/api/desk/browser/sessions", async (req, res) => {
    sendProxy(res, await proxyDesk("POST", "/api/v1/browser/sessions", req.body ?? {}));
  });

  app.post("/api/desk/browser/sessions/:id/tools", async (req, res) => {
    sendProxy(
      res,
      await proxyDesk("POST", `/api/v1/browser/sessions/${encodeURIComponent(req.params.id)}/tools`, req.body ?? {}),
    );
  });

  app.post("/api/desk/browser/panic", async (req, res) => {
    sendProxy(res, await proxyDesk("POST", "/api/v1/browser/panic", req.body ?? {}));
  });

  app.delete("/api/desk/browser/sessions/:id", async (req, res) => {
    sendProxy(res, await proxyDesk("DELETE", `/api/v1/browser/sessions/${encodeURIComponent(req.params.id)}`));
  });

  app.post("/api/desk/research/movie", async (req, res) => {
    sendProxy(res, await proxyDesk("POST", "/api/v1/research/movie", req.body ?? {}));
  });

  app.post("/api/desk/research/song", async (req, res) => {
    sendProxy(res, await proxyDesk("POST", "/api/v1/research/song", req.body ?? {}));
  });

  // Alias paths for @asi-api browser tools (same handlers as /api/desk/browser/*)
  app.get("/api/browser/health", async (_req, res) => {
    sendProxy(res, await proxyDesk("GET", "/api/v1/health"));
  });
  app.get("/api/browser/status", async (_req, res) => {
    sendProxy(res, await proxyDesk("GET", "/api/v1/browser/status"));
  });
  app.post("/api/browser/panic", async (req, res) => {
    sendProxy(res, await proxyDesk("POST", "/api/v1/browser/panic", req.body ?? {}));
  });
  app.post("/api/browser/sessions", async (req, res) => {
    sendProxy(res, await proxyDesk("POST", "/api/v1/browser/sessions", req.body ?? {}));
  });
  app.post("/api/browser/sessions/:id/tools", async (req, res) => {
    sendProxy(
      res,
      await proxyDesk(
        "POST",
        `/api/v1/browser/sessions/${encodeURIComponent(req.params.id)}/tools`,
        req.body ?? {},
      ),
    );
  });
}


/** @deprecated Browser tools are mounted by mountDeskRoutes under /api/desk/* — kept for import compatibility. */
export function mountBrowserRoutes(_app: Express): void {
  /* no-op: see mountDeskRoutes */
}

export { ensureDeskDaemon } from "./autostart.js";
export { isDeskAutostartEnabled, DESK_CONSOLE_URL, DESK_CONTROL_URL, EXTERNAL_REPO_PATH } from "./config.js";
export { deskHasVnc, normalizeDesks, summarizeDesks, deskStatusLine } from "./deskSummary.js";
export { probeDesk } from "./probe.js";
