/**
 * Optional Postgres control-plane driver (stub MVP).
 * Core keeps FileStore; this module is only loaded when dual-write / future PostgresStore is enabled.
 * No fake DB — dualWriteMirror logs until a real driver is wired.
 */

export const MODULE_ID = "postgres-store" as const;

export type DualWriteMirrorFn = (op: string, detail?: unknown) => void;

/** Files-primary dual-write sink. Logs only — does not invent SQL success. */
export const dualWriteMirror: DualWriteMirrorFn = (op, detail) => {
  const suffix = detail != null ? ` ${JSON.stringify(detail)}` : "";
  console.info(`[postgres-store] dual-write (stub, no DB write): ${op}${suffix}`);
};

/**
 * Future PostgresStore constructor. MVP returns null — callers must keep FileStore.
 * Never pretends a live pool exists without ASI_DATABASE_URL + a real driver.
 */
export function createPostgresStore(_connectionString: string): null {
  console.info(
    "[postgres-store] PostgresStore driver not shipped yet — FileStore remains active. See docs/OPTIONAL-POSTGRES-MODULE.md."
  );
  return null;
}

export function moduleStatus(): {
  id: typeof MODULE_ID;
  shipped: "partial";
  driver: false;
  dualWrite: true;
  note: string;
} {
  return {
    id: MODULE_ID,
    shipped: "partial",
    driver: false,
    dualWrite: true,
    note: "Stub module: dual-write mirror logs only. Tables + PostgresStore come later.",
  };
}
