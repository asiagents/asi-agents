/** Shared desk-list normalization — never invent rows when offline. */

export type DeskRow = {
  deskId?: string;
  agentId?: string;
  status?: string;
  mode?: string;
  runtime?: string;
  health?: string;
  powerMode?: string;
  note?: string;
  novncUrl?: string | null;
  [key: string]: unknown;
};

export type DeskSummary = {
  desks: DeskRow[];
  deskCount: number;
  runningCount: number;
  hibernatedCount: number;
  stoppedCount: number;
  headlessCount: number;
  visibleCount: number;
};

/** Coerce daemon /api/v1/desks payloads into a plain array (never invent). */
export function normalizeDesks(desks: unknown): DeskRow[] {
  if (Array.isArray(desks)) {
    return desks.filter((d): d is DeskRow => d != null && typeof d === "object");
  }
  if (desks && typeof desks === "object") {
    const o = desks as { desks?: unknown; value?: unknown; items?: unknown };
    if (Array.isArray(o.desks)) return normalizeDesks(o.desks);
    if (Array.isArray(o.value)) return normalizeDesks(o.value);
    if (Array.isArray(o.items)) return normalizeDesks(o.items);
  }
  return [];
}

export function deskHasVnc(d: DeskRow): boolean {
  const mode = String(d.mode ?? "").toLowerCase();
  if (mode === "headless") return false;
  if (d.novncUrl) return true;
  return mode === "visible" || mode === "novnc" || mode === "vnc" || mode === "gui";
}

export function summarizeDesks(desks: unknown): DeskSummary {
  const list = normalizeDesks(desks);
  let runningCount = 0;
  let hibernatedCount = 0;
  let stoppedCount = 0;
  let headlessCount = 0;
  let visibleCount = 0;
  for (const d of list) {
    const status = String(d.status ?? "").toLowerCase();
    const mode = String(d.mode ?? "").toLowerCase();
    const runtime = String(d.runtime ?? "").toLowerCase();
    if (status === "running" || status === "active" || status === "ready") runningCount += 1;
    else if (status === "hibernated" || status === "hibernating" || status === "sleeping") hibernatedCount += 1;
    else if (status === "stopped" || status === "destroyed" || status === "offline") stoppedCount += 1;
    // Local Playwright + explicit headless = no VNC stream
    if (mode === "headless" || (runtime === "local" && !deskHasVnc(d))) headlessCount += 1;
    if (deskHasVnc(d)) visibleCount += 1;
  }
  return {
    desks: list,
    deskCount: list.length,
    runningCount,
    hibernatedCount,
    stoppedCount,
    headlessCount,
    visibleCount,
  };
}

/** Short product status line for ASI Agents Desk surfaces. */
export function deskStatusLine(
  summary: Pick<
    DeskSummary,
    "deskCount" | "runningCount" | "hibernatedCount" | "stoppedCount" | "headlessCount" | "visibleCount"
  >,
): string {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  if (n(summary.deskCount) === 0) return "No desks yet";
  return [
    `${n(summary.runningCount)} running`,
    `${n(summary.hibernatedCount)} hibernated`,
    `${n(summary.stoppedCount)} stopped`,
    `${n(summary.headlessCount)} headless`,
  ].join(" · ");
}
