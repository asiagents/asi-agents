import type { Express } from "express";
import {
  exportControlPlaneSnapshot,
  importControlPlaneSnapshot,
} from "./controlPlaneStore.js";
import {
  getPostgresModuleStatus,
  setPostgresModulePrefs,
} from "./postgresPrefs.js";

export function mountControlPlaneRoutes(app: Express): void {
  /** Export control-plane overlays (tasks, lessons, training, cron, briefing) — no secrets. */
  app.get("/api/control-plane/export", (_req, res) => {
    res.json(exportControlPlaneSnapshot());
  });

  /** Import control-plane JSON into FileStore (never deletes app-state entirely). */
  app.post("/api/control-plane/import", (req, res) => {
    const result = importControlPlaneSnapshot(req.body);
    if ("error" in result) {
      return res.status(400).json(result);
    }
    res.json({ ok: true, snapshot: result });
  });

  /** Optional Postgres module status (honest — no fake connected DB). */
  app.get("/api/postgres/prefs", (_req, res) => {
    res.json(getPostgresModuleStatus());
  });

  app.put("/api/postgres/prefs", (req, res) => {
    const body = (req.body ?? {}) as {
      usePostgres?: unknown;
      dualWrite?: unknown;
      connectionString?: unknown;
    };
    const patch: {
      usePostgres?: boolean;
      dualWrite?: boolean;
      connectionString?: string | null;
    } = {};
    if ("usePostgres" in body) patch.usePostgres = body.usePostgres === true;
    if ("dualWrite" in body) patch.dualWrite = body.dualWrite === true;
    if ("connectionString" in body) {
      if (body.connectionString == null || body.connectionString === "") {
        patch.connectionString = null;
      } else if (typeof body.connectionString === "string") {
        patch.connectionString = body.connectionString;
      } else {
        return res.status(400).json({ error: "connectionString must be a string" });
      }
    }
    setPostgresModulePrefs(patch);
    res.json(getPostgresModuleStatus());
  });
}
