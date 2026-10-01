const DESK_URL = (process.env.ASI_DESK_URL ?? "http://127.0.0.1:3456").replace(/\/$/, "");

export type DeskResearchResult = {
  ok: boolean;
  text?: string;
  error?: string;
  citations?: { title: string; url: string; source?: string }[];
  source?: string;
  query?: string;
  agentId?: string;
};

export type DeskLiveWebPage = {
  url: string;
  title?: string;
  text: string;
};

export type DeskLiveWebResult = {
  ok: boolean;
  deskLive: boolean;
  /** True only when at least one real page body was fetched (never invent). */
  webSearchAvailable: boolean;
  pages: DeskLiveWebPage[];
  /** Compact evidence block for gather prompts. */
  evidenceText?: string;
  error?: string;
  sessionId?: string;
};

async function deskLive(): Promise<boolean> {
  try {
    const r = await fetch(`${DESK_URL}/api/v1/desks`, { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function isDeskDaemonLive(): Promise<boolean> {
  return deskLive();
}

export async function deskResearchMovie(query: string, agentId: string): Promise<DeskResearchResult> {
  if (!(await deskLive())) {
    return { ok: false, error: "Desk offline — start python daemon/desk_daemon.py on :3456." };
  }
  const r = await fetch(`${DESK_URL}/api/v1/research/movie`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, agentId }),
    signal: AbortSignal.timeout(120_000),
  });
  return (await r.json()) as DeskResearchResult;
}

export async function deskResearchSong(query: string, agentId: string): Promise<DeskResearchResult> {
  if (!(await deskLive())) {
    return { ok: false, error: "Desk offline — start python daemon/desk_daemon.py on :3456." };
  }
  const r = await fetch(`${DESK_URL}/api/v1/research/song`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, agentId }),
    signal: AbortSignal.timeout(120_000),
  });
  return (await r.json()) as DeskResearchResult;
}

export async function deskBrowserPanic(): Promise<void> {
  if (!(await deskLive())) return;
  await fetch(`${DESK_URL}/api/v1/browser/panic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

type ToolOut = {
  ok?: boolean;
  error?: string;
  url?: string;
  title?: string;
  text?: string;
  needsConfirm?: boolean;
  tabs?: { index: number; url: string; title: string }[];
  refs?: { ref?: string; role?: string; name?: string }[];
};

async function browserTool(
  sessionId: string,
  tool: string,
  args: Record<string, unknown> = {},
  timeoutMs = 60_000
): Promise<ToolOut> {
  const r = await fetch(`${DESK_URL}/api/v1/browser/sessions/${encodeURIComponent(sessionId)}/tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, args }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return (await r.json()) as ToolOut;
}

async function closeSession(sessionId: string): Promise<void> {
  await fetch(`${DESK_URL}/api/v1/browser/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

function encodeQuery(q: string): string {
  return encodeURIComponent(q.trim().slice(0, 200));
}

/** Shorten long research questions into a Wikipedia-friendly search string. */
function searchQueryFromResearch(query: string): string {
  const q = query.replace(/\s+/g, " ").trim();
  // Prefer quoted / proper-name heavy head before colon or em-dash
  const head = q.split(/[:—–]/)[0]?.trim() ?? q;
  // Drop leading verbs that inflate Special:Search noise
  const cleaned = head
    .replace(/^(analyse|analyze|research|investigate|look\s*up|find|review)\s+/i, "")
    .replace(/\bhttps?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 10);
  return (words.join(" ") || q).slice(0, 120);
}

const WIKI_SKIP_LINK =
  /^(Jump to|Main menu|Donate|Create account|Log in|Help|Search|Talk|Edit|View history|Contents|About|Tools|Appearance|Hide|First page|Previous page|Next page|Wikipedia|Article|Read)/i;

function isChromePage(title: string | undefined, text: string): boolean {
  const t = (title ?? "").trim();
  if (/^Jump to content/i.test(t)) return true;
  if (/confirm this search was made by a human|Enable JavaScript/i.test(text)) return true;
  // Bare nav shell with almost no body
  if (text.length < 200 && /Jump to content/i.test(text)) return true;
  return false;
}

/** Pull Wikipedia article URLs from search page text and/or snapshot link names. */
function extractWikipediaArticleUrls(
  pageText: string,
  refs: { role?: string; name?: string }[] | undefined,
  limit = 3
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const pushSlug = (slugRaw: string) => {
    const slug = slugRaw.trim().replace(/\s+/g, "_");
    if (!slug || /:/.test(slug)) return;
    if (/^(Special|Help|Wikipedia|Talk|User|File|Template|Category|Portal|Draft)_/i.test(slug)) return;
    if (/^(Create_a_draft|Request_that_a_redirect|Search|Main_Page|Privacy_policy)/i.test(slug)) return;
    const clean = `https://en.wikipedia.org/wiki/${slug
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`;
    if (seen.has(clean)) return;
    seen.add(clean);
    urls.push(clean);
  };

  const re = /(?:https?:\/\/en\.wikipedia\.org)?\/wiki\/([A-Za-z0-9_%:().\-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pageText)) !== null && urls.length < limit) {
    pushSlug(decodeURIComponent(m[1]!.replace(/_/g, " ")).replace(/\s+/g, "_"));
  }

  if (refs) {
    for (const ref of refs) {
      if (urls.length >= limit) break;
      if ((ref.role ?? "").toLowerCase() !== "a") continue;
      const name = (ref.name ?? "").trim();
      if (!name || WIKI_SKIP_LINK.test(name) || name.length < 3) continue;
      pushSlug(name);
    }
  }

  return urls.slice(0, limit);
}

/** Detect https URLs or bare domains in the query (e.g. muse.ai, amazon.in). */
function extractDirectUrls(query: string, limit = 2): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const full = /https?:\/\/[^\s<>"')\]]+/gi;
  let m: RegExpExecArray | null;
  while ((m = full.exec(query)) !== null && out.length < limit) {
    const url = m[0]!.replace(/[.,;:]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  if (out.length >= limit) return out;
  const bare = /\b([a-z0-9][a-z0-9-]{0,61}\.)+(?:ai|com|org|net|io|co|in|uk|gov)(?:\/[^\s]*)?/gi;
  while ((m = bare.exec(query)) !== null && out.length < limit) {
    const hostPath = m[0]!.replace(/[.,;:]+$/, "");
    if (/wikipedia\.org/i.test(hostPath)) continue;
    const url = `https://${hostPath}`;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function formatEvidence(pages: DeskLiveWebPage[]): string {
  return pages
    .map((p, i) => {
      const head = `### Live page ${i + 1}\nURL: ${p.url}` + (p.title ? `\nTitle: ${p.title}` : "");
      return `${head}\nExcerpt:\n${clip(p.text, 3500)}`;
    })
    .join("\n\n");
}

/**
 * Live web gather via Virtual Desk browser tools (Playwright on :3456).
 * Fail-closed: never invent pages/citations. Returns webSearchAvailable only when real text was read.
 */
export async function deskLiveWebGather(opts: {
  query: string;
  agentId?: string;
  /** Max article pages to open after search (besides the search results page). */
  maxPages?: number;
}): Promise<DeskLiveWebResult> {
  const query = opts.query.trim();
  if (!query) {
    return {
      ok: false,
      deskLive: false,
      webSearchAvailable: false,
      pages: [],
      error: "Empty research query — no live web fetch.",
    };
  }

  if (!(await deskLive())) {
    return {
      ok: false,
      deskLive: false,
      webSearchAvailable: false,
      pages: [],
      error: "Desk offline on :3456 — live web skipped.",
    };
  }

  let sessionId: string | undefined;
  const pages: DeskLiveWebPage[] = [];
  const maxPages = Math.min(4, Math.max(1, opts.maxPages ?? 2));

  try {
    const create = await fetch(`${DESK_URL}/api/v1/browser/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: opts.agentId?.trim() || "research",
        threadId: `research-liveweb-${Date.now()}`,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const created = (await create.json()) as { ok?: boolean; sessionId?: string; error?: string };
    if (!created.sessionId) {
      return {
        ok: false,
        deskLive: true,
        webSearchAvailable: false,
        pages: [],
        error: created.error ?? "Could not create Desk browser session for live web.",
      };
    }
    sessionId = created.sessionId;

    async function fetchPage(url: string, minChars = 80): Promise<void> {
      if (pages.length >= maxPages + 2) return;
      const artOpen = await browserTool(sessionId!, "open", { url });
      if (!artOpen.ok) return;
      const artRead = await browserTool(sessionId!, "read", { maxChars: 5000 });
      if (!artRead.ok || typeof artRead.text !== "string" || artRead.text.trim().length < minChars) return;
      const body = artRead.text.trim();
      if (isChromePage(artRead.title ?? artOpen.title, body)) return;
      pages.push({
        url: artOpen.url ?? url,
        title: artRead.title ?? artOpen.title,
        text: body,
      });
    }

    // Prefer any explicit site/domain named in the question (e.g. muse.ai).
    for (const direct of extractDirectUrls(query, 2)) {
      await fetchPage(direct, 60);
    }

    const searchUrl = `https://en.wikipedia.org/w/index.php?search=${encodeQuery(searchQueryFromResearch(query))}&title=Special:Search&fulltext=1`;
    const opened = await browserTool(sessionId, "open", { url: searchUrl });
    if (!opened.ok && pages.length === 0) {
      return {
        ok: false,
        deskLive: true,
        webSearchAvailable: false,
        pages: [],
        sessionId,
        error: opened.error ?? "Desk browser could not open search page.",
      };
    }

    if (opened.ok) {
    const searchRead = await browserTool(sessionId, "read", { maxChars: 6000 });
    if (searchRead.ok && typeof searchRead.text === "string" && searchRead.text.trim().length > 40) {
      pages.push({
        url: opened.url ?? searchUrl,
        title: searchRead.title ?? opened.title,
        text: searchRead.text.trim(),
      });
    }

    const snap = await browserTool(sessionId, "snapshot", {});
    const articleUrls = extractWikipediaArticleUrls(
      `${opened.url ?? ""}\n${searchRead.text ?? ""}`,
      snap.refs,
      maxPages
    );

      for (const url of articleUrls) {
        await fetchPage(url, 80);
      }
    }

    if (pages.length === 0) {
      return {
        ok: false,
        deskLive: true,
        webSearchAvailable: false,
        pages: [],
        sessionId,
        error: "Desk browser opened but returned no usable page text (fail closed — no invented results).",
      };
    }

    return {
      ok: true,
      deskLive: true,
      webSearchAvailable: true,
      pages,
      evidenceText: formatEvidence(pages),
      sessionId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      deskLive: true,
      webSearchAvailable: false,
      pages,
      sessionId,
      error: `Live web fetch failed: ${message}`,
    };
  } finally {
    if (sessionId) await closeSession(sessionId);
  }
}
