/**
 * Honest modules catalog for Settings → Modules.
 * Not a marketplace — lists installed optional packs + core satellites with live probes.
 */
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probeDesk } from "@asi-agents/virtual-computer";
import { getPostgresModuleStatus } from "./postgresPrefs.js";
import { probeRouterHealth } from "./llm-routing.js";
import { routerReady } from "./modelPaths.js";
import { listAmsInstallSnapshot } from "./ams.models.js";

export type ModuleCatalogEntry = {
  id: string;
  name: string;
  version: string | null;
  status: "live" | "off" | "partial" | "planned";
  detail: string;
  docsPath: string | null;
  enableHint: string | null;
  folder: string | null;
};

function readPackageVersion(pkgDir: string): string | null {
  try {
    const raw = fs.readFileSync(path.join(pkgDir, "package.json"), "utf8");
    const j = JSON.parse(raw) as { version?: string };
    return typeof j.version === "string" ? j.version : null;
  } catch {
    return null;
  }
}

function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../..");
}

function readGamesCount(root: string): { ok: boolean; count: number } {
  try {
    const raw = fs.readFileSync(path.join(root, "config/games.catalog.json"), "utf8");
    const j = JSON.parse(raw) as { games?: unknown[] };
    return { ok: Array.isArray(j.games), count: Array.isArray(j.games) ? j.games.length : 0 };
  } catch {
    return { ok: false, count: 0 };
  }
}

export async function buildModulesCatalog(): Promise<{
  pluginModel: string;
  howToAdd: string[];
  modules: ModuleCatalogEntry[];
}> {
  const root = repoRoot();
  const howToAdd = [
    "Drop a new npm workspace under modules/<name>/ with package.json (see modules/README.md).",
    "Wire mount*Routes from src/server (keep core lean — do not dump heavy packs into src/).",
    "Document ship-safe defaults in docs/FEATURE-FLAGS.md; default heavy packs OFF on cheap VPS.",
    "There is no in-app marketplace yet — versions are whatever is in this repo / your Desk clone.",
  ];

  const deskProbe = await probeDesk();
  const vcDir = path.join(root, "modules/virtual-computer");
  const gamesDir = path.join(root, "modules/games");
  const pgDir = path.join(root, "modules/postgres-store");
  const games = readGamesCount(root);

  const pg = getPostgresModuleStatus();
  const routerProbe = await probeRouterHealth();
  const artifactsReady = routerReady();
  let amsDetail = "AMS catalog recipes — weights not claimed installed without Scan.";
  try {
    const snap = listAmsInstallSnapshot();
    amsDetail = `${snap.installedCount} installed · ${snap.recipeCount} recipe(s) · ${snap.installedGgufFiles} GGUF · ${snap.installedOnnxFiles} ONNX under models/ams/`;
  } catch {
    /* keep default */
  }

  const amsSkill =
    process.env.ASI_AMS_SKILL_RUN === "1" ||
    (process.env.ASI_AMS_SKILL_RUN !== "0" && process.env.NODE_ENV !== "production");

  const modules: ModuleCatalogEntry[] = [
    {
      id: "virtual-computer",
      name: "Virtual Computer / Desk",
      version: readPackageVersion(vcDir),
      status: deskProbe.live ? "live" : "off",
      detail: deskProbe.live
        ? "Daemon live on 127.0.0.1:3456 (ASI proxies /api/desk/*)."
        : deskProbe.error ??
          "Desk daemon offline — open /desk to autostart or run python daemon/desk_daemon.py.",
      docsPath: "docs/VIRTUAL-DESK-SETUP.md",
      enableHint:
        "Settings → Safety → Virtual Computer module · ASI_DESK_AUTOSTART=1 (local default)",
      folder: "modules/virtual-computer",
    },
    {
      id: "games",
      name: "Arcade / Games",
      version: readPackageVersion(gamesDir),
      status: games.ok ? "live" : "off",
      detail: games.ok
        ? `${games.count} game(s) in catalog · /arcade`
        : "Games catalog failed to load.",
      docsPath: "docs/MODULES.md",
      enableHint: "Nav → Arcade · module @asi-agents/games",
      folder: "modules/games",
    },
    {
      id: "postgres-store",
      name: "Postgres store (optional)",
      version: readPackageVersion(pgDir),
      status: pg.usePostgres ? (pg.configured ? "partial" : "off") : "off",
      detail: pg.usePostgres
        ? pg.configured
          ? `Prefs ON · dual-write ${pg.dualWrite ? "on" : "off"} · connection present (no fake DB health).`
          : "Prefs ON but no connection string — FileStore still primary."
        : "OFF by default — FileStore is primary (ASI_USE_POSTGRES=0).",
      docsPath: "docs/OPTIONAL-POSTGRES-MODULE.md",
      enableHint: "Settings → Connections → Postgres · or ASI_USE_POSTGRES=1",
      folder: "modules/postgres-store",
    },
    {
      id: "ams",
      name: "AMS (models + skill-run)",
      version: null,
      status: amsSkill ? "partial" : "off",
      detail: `${amsDetail} Skill-run gate: ${amsSkill ? "allowed" : "off (ASI_AMS_SKILL_RUN=0)"}.`,
      docsPath: "models/ams/README.md",
      enableHint: "Settings → Models · HF updates: https://huggingface.co/vvarghese",
      folder: "models/ams",
    },
    {
      id: "router",
      name: "Local SLM router (:7821)",
      version: null,
      status: routerProbe.live ? "live" : "off",
      detail: routerProbe.live
        ? "Router answering on :7821."
        : artifactsReady
          ? "Artifacts on disk — run npm run start:router (then Ollama / llama.cpp)."
          : "No router artifacts yet — not installed.",
      docsPath: "docs/INTENT-LAYER.md",
      enableHint: "npm run start:router",
      folder: "models/router",
    },
    {
      id: "research",
      name: "Research (virtual agents)",
      version: null,
      status: "partial",
      detail:
        "In-core research paths + Desk NL movie/song when Desk is live. Not a separate modules/ pack yet.",
      docsPath: "docs/FEATURE-FLAGS.md",
      enableHint: "Core feature · cap via ASI_RESEARCH_MAX_VIRTUAL_AGENTS",
      folder: null,
    },
    {
      id: "companion",
      name: "Squari Companion",
      version: null,
      status: "off",
      detail:
        "Bottom-right companion (9:16 from 1080×1920 GIFs). Seven skins; Drakko default. Prod OFF — Show Squari in Modules. Localhost/test bed ON when unset (ASI_COMPANION_TEST / VITE_ASI_COMPANION_TEST).",
      docsPath: "modules/Companion Agent/squari/README.md",
      enableHint: "Settings → Modules → Show Squari (localStorage asi.default.showSquari)",
      folder: "modules/Companion Agent",
    },
    {
      id: "basic-chats",
      name: "Basic chats",
      version: null,
      status: "live",
      detail:
        "Local intents / lightweight chat without a full LLM: greetings, time/date, roster, rename, help, arithmetic, and other catalog intents (config/intents.catalog.json). Escalates to AMS/LLM only when rules gate escalate_llm. Fail-closed when generate backends are down.",
      docsPath: "docs/INTENT-LAYER.md",
      enableHint: "Core · Settings → Modules (status) · chat routes use maybeIntentReply before generate",
      folder: "src/server/src/intent",
    },
    {
      id: "knowledge-graph",
      name: "Knowledge graph (local)",
      version: null,
      status: "partial",
      detail:
        "Local JSON graph of agents, skills, tasks, lessons — GET /api/kg, GET /api/kg/query?q=. Not Neo4j. Peek on Agents page. Extras in data/knowledge-graph.json.",
      docsPath: "docs/MODULES.md",
      enableHint: "Core slice · Agents → Knowledge graph peek · GET /api/kg",
      folder: "src/server/src/knowledge.graph.ts",
    },
  ];

  return {
    pluginModel:
      "Optional packs are npm workspaces under modules/. Core mounts them explicitly — there is no plugin marketplace or auto-discovery of arbitrary folders yet.",
    howToAdd,
    modules,
  };
}

export function mountModulesCatalogRoutes(app: Express): void {
  app.get("/api/modules", async (_req, res) => {
    try {
      res.json(await buildModulesCatalog());
    } catch (err) {
      const message = err instanceof Error ? err.message : "modules catalog failed";
      res.status(500).json({ error: message, modules: [], howToAdd: [], pluginModel: "" });
    }
  });
}
