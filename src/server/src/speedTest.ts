/**
 * Internet download speed via Netflix fast.com (server-side; avoids browser CORS).
 *
 * Measurement:
 * 1. Load https://fast.com/ (and its app-*.js if needed) to obtain an API token
 *    (HTML inline token, JS DEFAULT_PARAMS.token, or known fast.com default).
 * 2. GET api.fast.com/netflix/speedtest/v2?https=true&token=...&urlCount=3 for CDN targets.
 * 3. Download from one target for up to ~5s; Mbps = round(bytes*8/seconds/1e6).
 *
 * Fail-closed: downloadMbps is null when any step fails -- never invent a number.
 * Client (useInternetSpeed) caches at most 1 test / 3h in localStorage.
 */
export interface SpeedProbe {
  downloadMbps: number | null;
  provider: "fast.com";
  checkedAt: string;
  notes: string[];
}

const FAST_HOME = "https://fast.com/";
const FAST_API = "https://api.fast.com/netflix/speedtest/v2";
/** Baked into fast.com app JS DEFAULT_PARAMS when page HTML has no inline token. */
const FAST_DEFAULT_TOKEN = "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm";

function extractToken(htmlOrJs: string): string | null {
  const patterns = [
    /token["']\s*:\s*["']([^"']+)["']/,
    /token:"([A-Za-z0-9+/=]+)"/,
    /DEFAULT_PARAMS=\{[^}]*token:"([A-Za-z0-9+/=]+)"/,
  ];
  for (const re of patterns) {
    const m = htmlOrJs.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractAppScriptUrl(html: string): string | null {
  const m = html.match(/src=["'](\/?app-[^"']+\.js)["']/);
  if (!m?.[1]) return null;
  return m[1].startsWith("http") ? m[1] : `https://fast.com${m[1].startsWith("/") ? "" : "/"}${m[1]}`;
}

async function resolveFastToken(notes: string[]): Promise<string | null> {
  const home = await fetch(FAST_HOME, {
    signal: AbortSignal.timeout(8000),
    headers: { "user-agent": "ASI-Agents/1.0 (+network-speed)" },
  });
  if (!home.ok) {
    notes.push(`fast.com home HTTP ${home.status}`);
    return null;
  }
  const html = await home.text();
  const fromHtml = extractToken(html);
  if (fromHtml) return fromHtml;

  const scriptUrl = extractAppScriptUrl(html);
  if (scriptUrl) {
    try {
      const jsRes = await fetch(scriptUrl, {
        signal: AbortSignal.timeout(12000),
        headers: { "user-agent": "ASI-Agents/1.0 (+network-speed)" },
      });
      if (jsRes.ok) {
        const fromJs = extractToken(await jsRes.text());
        if (fromJs) return fromJs;
        notes.push("fast.com app JS had no token; using DEFAULT_PARAMS fallback");
      } else {
        notes.push(`fast.com app JS HTTP ${jsRes.status}; using DEFAULT_PARAMS fallback`);
      }
    } catch {
      notes.push("fast.com app JS fetch failed; using DEFAULT_PARAMS fallback");
    }
  } else {
    notes.push("fast.com token not in HTML and no app-*.js; using DEFAULT_PARAMS fallback");
  }
  return FAST_DEFAULT_TOKEN;
}

async function measureDownloadMbps(url: string, maxMs = 5000): Promise<number | null> {
  const started = Date.now();
  let bytes = 0;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(maxMs + 2000),
      headers: { accept: "*/*" },
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    while (Date.now() - started < maxMs) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    const seconds = (Date.now() - started) / 1000;
    if (seconds <= 0 || bytes === 0) return null;
    return Math.round((bytes * 8) / seconds / 1_000_000);
  } catch {
    return null;
  }
}

/** Real throughput sample from fast.com CDN; null = unavailable (fail-closed). */
export async function probeInternetSpeed(): Promise<SpeedProbe> {
  const notes: string[] = [];
  const checkedAt = new Date().toISOString();

  try {
    const token = await resolveFastToken(notes);
    if (!token) {
      return { downloadMbps: null, provider: "fast.com", checkedAt, notes };
    }

    const apiUrl = `${FAST_API}?https=true&token=${encodeURIComponent(token)}&urlCount=3`;
    const specRes = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
    if (!specRes.ok) {
      notes.push(`fast.com speedtest API HTTP ${specRes.status}`);
      return { downloadMbps: null, provider: "fast.com", checkedAt, notes };
    }
    const spec = (await specRes.json()) as { targets?: { url?: string }[] };
    const targetUrl = spec.targets?.find((t) => t.url)?.url;
    if (!targetUrl) {
      notes.push("fast.com returned no download targets");
      return { downloadMbps: null, provider: "fast.com", checkedAt, notes };
    }

    const downloadMbps = await measureDownloadMbps(targetUrl);
    if (downloadMbps == null) notes.push("Download sample failed or empty");
    return { downloadMbps, provider: "fast.com", checkedAt, notes };
  } catch (e) {
    notes.push(e instanceof Error ? e.message : "fast.com speed test failed");
    return { downloadMbps: null, provider: "fast.com", checkedAt, notes };
  }
}