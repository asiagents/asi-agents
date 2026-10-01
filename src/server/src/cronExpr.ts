/**
 * Minimal 5-field cron parser (minute hour dom month dow).
 * No external deps — supports *, lists, ranges, steps. Local wall clock.
 * DOM+DOW both restricted → either may match (Vixie/POSIX).
 */

export type CronFieldSet = Set<number>;

export interface ParsedCron {
  minutes: CronFieldSet;
  hours: CronFieldSet;
  doms: CronFieldSet;
  months: CronFieldSet;
  dows: CronFieldSet;
  domRestricted: boolean;
  dowRestricted: boolean;
}

const MS_PER_MINUTE = 60_000;

function expandField(field: string, min: number, max: number): CronFieldSet {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const stepMatch = /^([^/]+)\/(\d+)$/.exec(part.trim());
    const rangePart = stepMatch ? stepMatch[1] : part.trim();
    const step = stepMatch ? Number(stepMatch[2]) : 1;
    if (!Number.isFinite(step) || step < 1) throw new Error(`invalid cron step in "${field}"`);

    let start: number;
    let end: number;
    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-");
      start = Number(a);
      end = Number(b);
    } else {
      start = Number(rangePart);
      end = start;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < min || end > max || start > end) {
      throw new Error(`invalid cron field "${field}" (range ${min}-${max})`);
    }
    for (let v = start; v <= end; v += step) out.add(v);
  }
  if (out.size === 0) throw new Error(`empty cron field "${field}"`);
  return out;
}

/** Parse a 5-field cron expression. Throws on invalid input. */
export function parseCronExpression(expr: string): ParsedCron {
  const trimmed = String(expr ?? "").trim();
  if (!trimmed) throw new Error("cron expression required");
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(
      `cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week); got ${fields.length}`
    );
  }
  const [minF, hourF, domF, monthF, dowF] = fields;
  const minutes = expandField(minF, 0, 59);
  const hours = expandField(hourF, 0, 23);
  const doms = expandField(domF, 1, 31);
  const months = expandField(monthF, 1, 12);
  // Accept 0–7 with 7 ≡ Sunday
  const rawDows = expandField(dowF.replace(/\b7\b/g, "0"), 0, 7);
  const dows = new Set<number>();
  for (const d of rawDows) dows.add(d === 7 ? 0 : d);

  return {
    minutes,
    hours,
    doms,
    months,
    dows,
    domRestricted: domF !== "*",
    dowRestricted: dowF !== "*",
  };
}

export function isValidCronExpression(expr: string): boolean {
  try {
    parseCronExpression(expr);
    return true;
  } catch {
    return false;
  }
}

function dayMatches(parsed: ParsedCron, date: Date): boolean {
  const dom = date.getDate();
  const dow = date.getDay();
  if (parsed.domRestricted && parsed.dowRestricted) {
    return parsed.doms.has(dom) || parsed.dows.has(dow);
  }
  return parsed.doms.has(dom) && parsed.dows.has(dow);
}

/**
 * Next fire time strictly after `fromMs` (local time), or null if none within ~1 year.
 */
export function nextCronRunMs(expr: string | ParsedCron, fromMs: number = Date.now()): number | null {
  const parsed = typeof expr === "string" ? parseCronExpression(expr) : expr;
  const date = new Date(fromMs);
  date.setSeconds(0, 0);
  date.setMilliseconds(0);
  date.setTime(date.getTime() + MS_PER_MINUTE);

  const deadline = fromMs + 366 * 24 * 60 * MS_PER_MINUTE;
  let iterations = 0;
  const HARD = 366 * 24 * 60 + 5;

  while (date.getTime() <= deadline && iterations++ < HARD) {
    if (!parsed.months.has(date.getMonth() + 1)) {
      date.setMonth(date.getMonth() + 1, 1);
      date.setHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(parsed, date)) {
      date.setDate(date.getDate() + 1);
      date.setHours(0, 0, 0, 0);
      continue;
    }
    if (!parsed.hours.has(date.getHours())) {
      date.setHours(date.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (parsed.minutes.has(date.getMinutes())) {
      return date.getTime();
    }
    date.setTime(date.getTime() + MS_PER_MINUTE);
  }
  return null;
}

/** ISO next run, or null when expression never fires in window. */
export function nextCronRunIso(expr: string, fromMs: number = Date.now()): string | null {
  const ms = nextCronRunMs(expr, fromMs);
  return ms == null ? null : new Date(ms).toISOString();
}
