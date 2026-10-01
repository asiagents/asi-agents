/**
 * Company About Us briefing — paste text or fetch a URL (server-side, size-limited, fail-closed).
 * Stored in app-state as `companyBriefing`. No fake scrape success.
 */
import { loadState, saveState } from "./store.js";
import type { BriefingFreshness, CompanyBriefing } from "./types.js";

/** Fresh < 7d, aging < 30d, stale ≥ 30d. */
export function briefingFreshness(briefing: CompanyBriefing | null | undefined): BriefingFreshness {
  if (!briefing?.fetchedAt) {
    return { level: "missing", ageDays: null, label: "No briefing" };
  }
  const ms = Date.parse(briefing.fetchedAt);
  if (!Number.isFinite(ms)) {
    return { level: "stale", ageDays: null, label: "Unknown age" };
  }
  const ageDays = Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
  if (ageDays < 7) {
    return {
      level: "fresh",
      ageDays,
      label: ageDays === 0 ? "Fresh · today" : `Fresh · ${ageDays}d ago`,
    };
  }
  if (ageDays < 30) {
    return { level: "aging", ageDays, label: `Aging · ${ageDays}d ago` };
  }
  return { level: "stale", ageDays, label: `Stale · ${ageDays}d ago` };
}

export const MAX_BRIEFING_CHARS = 24_000;
export const MAX_HTML_BYTES = 512_000;
export const FETCH_TIMEOUT_MS = 12_000;

const SELF_LEARNING_NOTE =
  "Self-learning: keep applying this company briefing in chat and council. Prefer company facts from the briefing over guesses; ask when something is missing.";

export function selfLearningNote(): string {
  return SELF_LEARNING_NOTE;
}

function normalizeBriefingText(raw: string): string {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_BRIEFING_CHARS);
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article|header|footer)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return undefined;
  const title = htmlToPlainText(m[1]).trim().slice(0, 200);
  return title || undefined;
}

export function normalizeCompanyBriefing(raw: unknown): CompanyBriefing | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<CompanyBriefing>;
  const text = normalizeBriefingText(typeof o.text === "string" ? o.text : "");
  if (!text) return null;
  const source = o.source === "url" || o.source === "paste" ? o.source : "paste";
  const sourceUrl =
    typeof o.sourceUrl === "string" && /^https?:\/\//i.test(o.sourceUrl.trim())
      ? o.sourceUrl.trim().slice(0, 2000)
      : undefined;
  const title =
    typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 200) : undefined;
  const fetchedAt =
    typeof o.fetchedAt === "string" && o.fetchedAt.trim()
      ? o.fetchedAt.trim()
      : new Date().toISOString();
  return {
    text,
    source,
    sourceUrl,
    title,
    fetchedAt,
    charCount: text.length,
  };
}

export function getCompanyBriefing(): CompanyBriefing | null {
  return normalizeCompanyBriefing(loadState().companyBriefing);
}

export function setCompanyBriefingFromPaste(text: string): CompanyBriefing | { error: string } {
  const cleaned = normalizeBriefingText(text);
  if (!cleaned) return { error: "Paste some company About Us text first." };
  if (cleaned.length < 40) {
    return { error: "Briefing too short — paste a fuller About Us section (at least ~40 characters)." };
  }
  const briefing: CompanyBriefing = {
    text: cleaned,
    source: "paste",
    fetchedAt: new Date().toISOString(),
    charCount: cleaned.length,
  };
  const state = loadState();
  state.companyBriefing = briefing;
  saveState(state);
  return briefing;
}

export function clearCompanyBriefing(): void {
  const state = loadState();
  delete state.companyBriefing;
  saveState(state);
}

export type FetchBriefingResult =
  | { ok: true; briefing: CompanyBriefing }
  | { ok: false; error: string; status?: number };

function validateFetchUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { ok: false, error: "URL required." };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "Invalid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http(s) URLs are allowed." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "URLs with credentials are not allowed." };
  }
  return { ok: true, url };
}

async function readBodyLimited(res: Response, maxBytes: number): Promise<
  { ok: true; buf: Buffer } | { ok: false; error: string }
> {
  const lenHeader = res.headers.get("content-length");
  if (lenHeader) {
    const n = Number(lenHeader);
    if (Number.isFinite(n) && n > maxBytes) {
      return { ok: false, error: `Page too large (${n} bytes; limit ${maxBytes}).` };
    }
  }
  if (!res.body) {
    const text = await res.text();
    const buf = Buffer.from(text, "utf8");
    if (buf.byteLength > maxBytes) {
      return { ok: false, error: `Page too large (limit ${maxBytes} bytes).` };
    }
    return { ok: true, buf };
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.byteLength) {
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return { ok: false, error: `Page too large (limit ${maxBytes} bytes).` };
      }
      chunks.push(value);
    }
  }
  return { ok: true, buf: Buffer.concat(chunks.map((c) => Buffer.from(c))) };
}

/** Fetch About Us page text. Fail-closed — never invents content on error. */
export async function fetchCompanyBriefingFromUrl(rawUrl: string): Promise<FetchBriefingResult> {
  const checked = validateFetchUrl(rawUrl);
  if (!checked.ok) return { ok: false, error: checked.error, status: 400 };

  let res: Response;
  try {
    res = await fetch(checked.url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
        "user-agent": "ASI-Agents-CompanyBriefing/1.0",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fetch failed";
    return { ok: false, error: `Could not fetch URL: ${msg}`, status: 502 };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `Fetch failed with HTTP ${res.status}.`,
      status: 502,
    };
  }

  const ctype = (res.headers.get("content-type") || "").toLowerCase();
  if (
    ctype &&
    !ctype.includes("text/html") &&
    !ctype.includes("application/xhtml") &&
    !ctype.includes("text/plain") &&
    !ctype.includes("xml")
  ) {
    return {
      ok: false,
      error: `Unsupported content type (${ctype.split(";")[0] || "unknown"}). Need HTML or plain text.`,
      status: 400,
    };
  }

  const body = await readBodyLimited(res, MAX_HTML_BYTES);
  if (!body.ok) return { ok: false, error: body.error, status: 413 };

  const raw = body.buf.toString("utf8");
  if (!raw.trim()) {
    return { ok: false, error: "Page returned empty body.", status: 502 };
  }

  const title = ctype.includes("text/plain") ? undefined : extractTitle(raw);
  const text = normalizeBriefingText(
    ctype.includes("text/plain") ? raw : htmlToPlainText(raw)
  );
  if (!text || text.length < 40) {
    return {
      ok: false,
      error: "Could not extract enough readable text from that page (fail-closed).",
      status: 422,
    };
  }

  const briefing: CompanyBriefing = {
    text,
    source: "url",
    sourceUrl: checked.url.toString().slice(0, 2000),
    title,
    fetchedAt: new Date().toISOString(),
    charCount: text.length,
  };
  const state = loadState();
  state.companyBriefing = briefing;
  saveState(state);
  return { ok: true, briefing };
}
