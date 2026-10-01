/**
 * Optional Postgres module prefs. Default OFF — FileStore remains primary.
 * Env wins for headless: ASI_USE_POSTGRES=1, ASI_DATABASE_URL, ASI_POSTGRES_DUAL_WRITE=1.
 */
import {
  loadState,
  normalizePostgresModulePrefs,
  saveState,
} from "./store.js";
import type { PostgresModulePrefs } from "./types.js";

function envUsePostgres(): boolean | null {
  const v = process.env.ASI_USE_POSTGRES?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return null;
}

function envDualWrite(): boolean | null {
  const v = process.env.ASI_POSTGRES_DUAL_WRITE?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return null;
}

function envDatabaseUrl(): string | undefined {
  const v = process.env.ASI_DATABASE_URL?.trim();
  return v || undefined;
}

function storedPrefs(): PostgresModulePrefs {
  return normalizePostgresModulePrefs(loadState().postgresPrefs);
}

/** Effective flags: env overrides app-state. */
export function getPostgresModulePrefs(): PostgresModulePrefs {
  const stored = storedPrefs();
  const envFlag = envUsePostgres();
  const envDual = envDualWrite();
  const envUrl = envDatabaseUrl();
  return {
    usePostgres: envFlag ?? stored.usePostgres,
    dualWrite: envDual ?? stored.dualWrite,
    connectionString: envUrl ?? stored.connectionString,
  };
}

export function setPostgresModulePrefs(patch: {
  usePostgres?: boolean;
  dualWrite?: boolean;
  connectionString?: string | null;
}): PostgresModulePrefs {
  const state = loadState();
  const prev = normalizePostgresModulePrefs(state.postgresPrefs);
  const next: PostgresModulePrefs = {
    usePostgres: patch.usePostgres !== undefined ? patch.usePostgres === true : prev.usePostgres,
    dualWrite: patch.dualWrite !== undefined ? patch.dualWrite === true : prev.dualWrite,
    connectionString: prev.connectionString,
  };
  if ("connectionString" in patch) {
    const raw = patch.connectionString;
    next.connectionString =
      typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  }
  state.postgresPrefs = next;
  saveState(state);
  return getPostgresModulePrefs();
}

function maskLast4(secret: string | undefined): string | undefined {
  if (!secret) return undefined;
  const s = secret.trim();
  if (s.length < 4) return "****";
  return s.slice(-4);
}

export type PostgresModuleStatus = {
  usePostgres: boolean;
  dualWrite: boolean;
  /** True only when a connection string is present (env or saved). No fake DB. */
  connected: boolean;
  configured: boolean;
  last4?: string;
  /** Honest setup hint when flag is on but no URL. */
  setupRequired: boolean;
  activeStore: "file" | "postgres";
  envOverrides: {
    usePostgres: boolean;
    dualWrite: boolean;
    databaseUrl: boolean;
  };
  note: string;
};

export function getPostgresModuleStatus(): PostgresModuleStatus {
  const prefs = getPostgresModulePrefs();
  const configured = Boolean(prefs.connectionString?.trim());
  const connected = configured; // MVP: presence of URL only — no fake probe success
  const setupRequired = prefs.usePostgres && !configured;
  const envFlag = envUsePostgres() != null;
  const envDual = envDualWrite() != null;
  const envUrl = Boolean(envDatabaseUrl());

  let note =
    "Default storage is app-state.json (FileStore). Postgres is an optional module — see docs/OPTIONAL-POSTGRES-MODULE.md.";
  if (setupRequired) {
    note =
      "Use Postgres is on, but no connection string is set. Paste ASI_DATABASE_URL below or set the env var — FileStore stays active until then.";
  } else if (prefs.usePostgres && connected) {
    note =
      "Connection string saved. MVP still reads/writes files; dual-write can mirror to the postgres module path when enabled. Full PostgresStore driver is not forced yet.";
  } else if (prefs.dualWrite) {
    note =
      "Dual-write flag on: files remain primary; mirror ops log to the postgres module sink (no fake DB).";
  }

  return {
    usePostgres: prefs.usePostgres,
    dualWrite: prefs.dualWrite,
    connected,
    configured,
    last4: maskLast4(prefs.connectionString),
    setupRequired,
    activeStore: "file",
    envOverrides: {
      usePostgres: envFlag,
      dualWrite: envDual,
      databaseUrl: envUrl,
    },
    note,
  };
}

export function isPostgresConnected(): boolean {
  const s = getPostgresModuleStatus();
  return s.usePostgres && s.connected;
}

export function dualWriteEnabled(): boolean {
  return getPostgresModulePrefs().dualWrite === true;
}

/**
 * Dual-write sink — files stay primary. When the module is present, forward a
 * log/copy hint; never invent row success without a driver.
 */
export function postgresDualWriteSink(op: string, detail?: unknown): void {
  // Optional `@asi-agents/postgres-store` pack may be absent — log only, never invent SQL success.
  console.info(
    `[postgres-store] dual-write stub: ${op}`,
    detail != null ? JSON.stringify(detail) : ""
  );
}
