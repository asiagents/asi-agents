import type { Express, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { ImapFlow } from "imapflow";
import { getMailConnection, setMailConnection } from "./store.js";
import type { MailConnection, MailConnectionKind } from "./types.js";
import { oauthClientConfigured, resolveOAuthClient } from "./oauthClients.js";

/** Documented server env (see `src/shared/api-contract.md`). */
const ENV = {
  host: "ASI_IMAP_HOST",
  port: "ASI_IMAP_PORT",
  user: "ASI_IMAP_USER",
  pass: "ASI_IMAP_PASS",
  secure: "ASI_IMAP_SECURE",
  mailbox: "ASI_IMAP_MAILBOX",
  kind: "ASI_IMAP_KIND",
} as const;

/** IMAP XOAUTH2 needs the mail.google.com scope (not Drive). Drive is a separate Connect. */
const GMAIL_IMAP_SCOPE = "https://mail.google.com/";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export interface InboxEmailMessage {
  id: string;
  from: string;
  address: string;
  subject: string;
  time: string;
  unread: boolean;
  body: string;
  suggest: string;
}

export interface ResolvedImapConfig {
  kind: MailConnectionKind;
  label: string;
  address: string;
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  mailbox: string;
  source: "env" | "state";
  authMethod: "password" | "oauth";
}

const IMAP_ENV_SETUP =
  "Set ASI_IMAP_HOST, ASI_IMAP_USER, and ASI_IMAP_PASS on the server, or save an IMAP/Gmail app-password connection via Settings → Connections (PUT /api/inbox/email/connection).";

const GMAIL_OAUTH_ENV_SETUP =
  "Gmail OAuth needs client id + secret: set ASI_GMAIL_CLIENT_ID / ASI_GMAIL_CLIENT_SECRET on the server, or save them under Settings → Connections → Email → Configure Gmail OAuth (Secret saved + last4). Redirect must match your Google Cloud OAuth client (default http://localhost:3445/api/inbox/email/oauth/callback). Or use a Gmail app password with IMAP. POP3 is coming later — use IMAP today.";

const GMAIL_OAUTH_SIGNIN_SETUP =
  "Gmail OAuth is configured on the server but this account is not signed in. Use Settings → Connections → Email → Sign in with Google, or open /api/inbox/email/oauth/start.";

type PendingOAuth = { address: string; label?: string; expires: number };
const pendingOAuth = new Map<string, PendingOAuth>();

function envTrim(key: string): string | null {
  const v = process.env[key];
  return v != null && String(v).trim() ? String(v).trim() : null;
}

function parsePort(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseSecure(raw: string | null, fallback: boolean): boolean {
  if (raw == null || raw === "") return fallback;
  const s = raw.toLowerCase();
  if (s === "0" || s === "false" || s === "no") return false;
  return true;
}

function defaultHost(kind: MailConnectionKind): string {
  return kind === "gmail" ? "imap.gmail.com" : "";
}

function defaultGmailRedirectUri(req?: Request): string {
  const resolved = resolveOAuthClient("gmail");
  if (resolved.creds || resolved.redirectUri) {
    if (resolved.redirectUri) return resolved.redirectUri;
  }
  const host = req?.get("host")?.trim();
  if (host) return `http://${host}/api/inbox/email/oauth/callback`;
  return "http://localhost:3445/api/inbox/email/oauth/callback";
}

export function gmailOAuthEnvReady(): boolean {
  return oauthClientConfigured("gmail");
}

function gmailOAuthCreds(): { clientId: string; clientSecret: string } | null {
  return resolveOAuthClient("gmail").creds;
}

function prunePendingOAuth(): void {
  const now = Date.now();
  for (const [k, v] of pendingOAuth) {
    if (v.expires <= now) pendingOAuth.delete(k);
  }
}

function resolveFromEnv(): ResolvedImapConfig | null {
  const host = envTrim(ENV.host);
  const user = envTrim(ENV.user);
  const password = envTrim(ENV.pass);
  if (!host || !user || !password) return null;
  const kindRaw = envTrim(ENV.kind);
  const kind: MailConnectionKind = kindRaw === "gmail" ? "gmail" : "imap";
  const address = user.includes("@") ? user : user;
  return {
    kind,
    label: kind === "gmail" ? "Gmail (env)" : "IMAP (env)",
    address,
    host,
    port: parsePort(envTrim(ENV.port), 993),
    user,
    password,
    secure: parseSecure(envTrim(ENV.secure), true),
    mailbox: envTrim(ENV.mailbox) ?? "INBOX",
    source: "env",
    authMethod: "password",
  };
}

function resolvePasswordFromState(conn: MailConnection): ResolvedImapConfig | null {
  const password = conn.password?.trim() ?? "";
  const host = conn.host?.trim() || defaultHost(conn.kind);
  const user = conn.user?.trim() || conn.address.trim();
  if (!host || !user || !password) return null;
  return {
    kind: conn.kind,
    label: conn.label?.trim() || (conn.kind === "gmail" ? "Gmail" : "IMAP"),
    address: conn.address.trim(),
    host,
    port: conn.port ?? 993,
    user,
    password,
    secure: conn.secure !== false,
    mailbox: "INBOX",
    source: "state",
    authMethod: "password",
  };
}

function resolveOAuthFromState(conn: MailConnection): ResolvedImapConfig | null {
  if (conn.authMethod !== "oauth") return null;
  const refresh = conn.oauthRefreshToken?.trim();
  if (!refresh || !gmailOAuthEnvReady()) return null;
  const user = conn.user?.trim() || conn.address.trim();
  if (!user) return null;
  return {
    kind: conn.kind,
    label: conn.label?.trim() || "Gmail",
    address: conn.address.trim(),
    host: conn.host?.trim() || defaultHost(conn.kind),
    port: conn.port ?? 993,
    user,
    password: "",
    secure: conn.secure !== false,
    mailbox: "INBOX",
    source: "state",
    authMethod: "oauth",
  };
}

function resolveFromState(): ResolvedImapConfig | null {
  const conn = getMailConnection();
  if (!conn) return null;
  if (conn.authMethod === "oauth") return resolveOAuthFromState(conn);
  return resolvePasswordFromState(conn);
}

export function resolveImapConfig(): ResolvedImapConfig | null {
  return resolveFromEnv() ?? resolveFromState();
}

async function exchangeOAuthCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const creds = gmailOAuthCreds();
  if (!creds) throw new Error("Gmail OAuth is not configured on the server");
  const body = new URLSearchParams({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof data.error_description === "string" ? data.error_description : typeof data.error === "string" ? data.error : "token_exchange_failed";
    throw new Error(msg);
  }
  const access = typeof data.access_token === "string" ? data.access_token : "";
  if (!access) throw new Error("token_exchange_missing_access");
  return {
    access_token: access,
    refresh_token: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    expires_in: typeof data.expires_in === "number" ? data.expires_in : undefined,
  };
}

async function refreshOAuthAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in?: number }> {
  const creds = gmailOAuthCreds();
  if (!creds) throw new Error("Gmail OAuth is not configured on the server");
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof data.error_description === "string" ? data.error_description : "refresh_failed";
    throw new Error(msg);
  }
  const access = typeof data.access_token === "string" ? data.access_token : "";
  if (!access) throw new Error("refresh_missing_access");
  return {
    access_token: access,
    expires_in: typeof data.expires_in === "number" ? data.expires_in : undefined,
  };
}

async function fetchGoogleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, { headers: { authorization: `Bearer ${accessToken}` } });
  const data = (await res.json()) as { email?: string };
  if (!res.ok || !data.email?.trim()) throw new Error("Could not read Google account email");
  return data.email.trim();
}

async function ensureGmailAccessToken(conn: MailConnection): Promise<string> {
  const refresh = conn.oauthRefreshToken?.trim();
  if (!refresh) throw new Error(GMAIL_OAUTH_SIGNIN_SETUP);
  const now = Date.now();
  const cached = conn.oauthAccessToken?.trim();
  const expiresAt = conn.oauthExpiresAt ?? 0;
  if (cached && expiresAt > now + 60_000) return cached;
  const refreshed = await refreshOAuthAccessToken(refresh);
  const nextExpires = now + (refreshed.expires_in ?? 3600) * 1000;
  setMailConnection({
    ...conn,
    oauthAccessToken: refreshed.access_token,
    oauthExpiresAt: nextExpires,
  });
  return refreshed.access_token;
}

export function getInboxEmailStatus() {
  const envPartial =
    envTrim(ENV.host) || envTrim(ENV.user) || envTrim(ENV.pass)
      ? {
          hasHost: Boolean(envTrim(ENV.host)),
          hasUser: Boolean(envTrim(ENV.user)),
          hasPass: Boolean(envTrim(ENV.pass)),
        }
      : null;
  const stored = getMailConnection();
  const gmailOAuthReady = gmailOAuthEnvReady();
  const gmailOAuth = resolveOAuthClient("gmail");
  const oauthMeta = {
    gmailOAuthReady,
    gmailOAuthSource: gmailOAuth.source,
    gmailOAuthLast4: gmailOAuth.creds ? gmailOAuth.creds.clientSecret.slice(-4) : undefined,
    gmailRedirectUri: gmailOAuth.redirectUri,
    pop3Supported: false as const,
    pop3Note: "Coming later — use IMAP or Gmail today.",
    setup: undefined as string | undefined,
  };
  if (stored?.authMethod === "oauth") {
    const hasRefresh = Boolean(stored.oauthRefreshToken?.trim());
    if (hasRefresh && gmailOAuthReady && !resolveFromEnv()) {
      return {
        configured: true,
        mode: stored.kind,
        source: "state" as const,
        authMethod: "oauth" as const,
        label: stored.label ?? null,
        address: stored.address ?? null,
        envPartial,
        ...oauthMeta,
      };
    }
    return {
      configured: false,
      mode: stored.kind,
      source: "state" as const,
      authMethod: "oauth" as const,
      label: stored.label ?? null,
      address: stored.address ?? null,
      envPartial,
      ...oauthMeta,
      setup: gmailOAuthReady ? GMAIL_OAUTH_SIGNIN_SETUP : GMAIL_OAUTH_ENV_SETUP,
    };
  }
  const resolved = resolveImapConfig();
  if (!resolved) {
    return {
      configured: false,
      mode: "none" as const,
      source: null,
      authMethod: null,
      label: stored?.label ?? null,
      address: stored?.address ?? null,
      envPartial,
      ...oauthMeta,
      setup: IMAP_ENV_SETUP,
    };
  }
  return {
    configured: true,
    mode: resolved.kind,
    source: resolved.source,
    authMethod: resolved.authMethod,
    label: resolved.label,
    address: resolved.address,
    host: resolved.host,
    port: resolved.port,
    secure: resolved.secure,
    envPartial,
    ...oauthMeta,
  };
}

function parseFromAddress(from: string): { name: string; address: string } {
  const m = from.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  if (m) {
    const name = (m[1] ?? "").trim();
    const address = m[2].trim();
    return { name: name || (address.split("@")[0] ?? address), address };
  }
  return { name: from.trim(), address: from.trim() };
}

function formatMessageTime(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export async function fetchInboxEmailMessages(limit = 40): Promise<InboxEmailMessage[]> {
  const cfg = resolveImapConfig();
  if (!cfg) return [];

  let accessToken: string | null = null;
  if (cfg.authMethod === "oauth") {
    const conn = getMailConnection();
    if (!conn) return [];
    accessToken = await ensureGmailAccessToken(conn);
  }

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: accessToken
      ? { user: cfg.user, accessToken }
      : { user: cfg.user, pass: cfg.password },
    logger: false,
  });

  const cap = Math.min(Math.max(limit, 1), 100);
  const out: InboxEmailMessage[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock(cfg.mailbox);
    try {
      const total = client.mailbox && typeof client.mailbox === "object" ? client.mailbox.exists : 0;
      if (!total) return [];
      const start = Math.max(1, total - cap + 1);
      for await (const msg of client.fetch(`${start}:*`, {
        uid: true,
        envelope: true,
        flags: true,
        source: true,
      })) {
        const env = msg.envelope;
        const fromRaw = env?.from?.[0];
        const fromLine = fromRaw
          ? fromRaw.name
            ? `${fromRaw.name} <${fromRaw.address}>`
            : String(fromRaw.address ?? "")
          : "(unknown)";
        const parsed = parseFromAddress(fromLine);
        let body = "";
        if (msg.source) {
          const raw = msg.source.toString("utf8");
          const split = raw.split(/\r?\n\r?\n/);
          body = split.length > 1 ? split.slice(1).join("\n\n").trim() : raw.trim();
          if (body.length > 8000) body = `${body.slice(0, 8000)}…`;
        }
        const unread = !msg.flags?.has("\\Seen");
        out.push({
          id: String(msg.uid ?? `${env?.messageId ?? out.length}`),
          from: parsed.name,
          address: parsed.address,
          subject: env?.subject?.trim() || "(no subject)",
          time: formatMessageTime(env?.date),
          unread,
          body: body || "(empty body)",
          suggest: "",
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  out.sort((a, b) => Number(b.id) - Number(a.id) || b.time.localeCompare(a.time));
  return out.slice(0, cap);
}

function normalizeConnectionBody(body: unknown): MailConnection | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.authMethod === "oauth") return null;
  const kind = b.kind === "gmail" ? "gmail" : b.kind === "imap" ? "imap" : null;
  const address = typeof b.address === "string" ? b.address.trim() : "";
  if (!kind || !address) return null;
  const conn: MailConnection = {
    kind,
    address,
    authMethod: "password",
    label: typeof b.label === "string" ? b.label.trim() : undefined,
    host: typeof b.host === "string" ? b.host.trim() : undefined,
    port: typeof b.port === "number" ? b.port : undefined,
    user: typeof b.user === "string" ? b.user.trim() : undefined,
    secure: typeof b.secure === "boolean" ? b.secure : undefined,
  };
  if (kind === "gmail" && !conn.host) conn.host = defaultHost("gmail");
  if (!conn.user) conn.user = address;
  if (typeof b.password === "string" && b.password.trim()) conn.password = b.password.trim();
  else {
    const prev = getMailConnection();
    if (prev?.address === address && prev.password) conn.password = prev.password;
  }
  return conn;
}

function validatePasswordConnection(conn: MailConnection): string | null {
  if (!conn.password?.trim()) return "password required for new connection";
  const host = conn.host?.trim() || defaultHost(conn.kind);
  if (!host) return "host required for IMAP";
  return null;
}

function oauthStartHandler(req: Request, res: Response): void {
  const creds = gmailOAuthCreds();
  if (!creds) {
    res.status(501).json({ error: "not_implemented", setup: GMAIL_OAUTH_ENV_SETUP });
    return;
  }
  const addressHint = typeof req.query.address === "string" ? req.query.address.trim() : "";
  const label = typeof req.query.label === "string" ? req.query.label.trim() : undefined;
  prunePendingOAuth();
  const state = randomBytes(24).toString("hex");
  pendingOAuth.set(state, { address: addressHint, label, expires: Date.now() + 15 * 60_000 });
  const redirectUri = defaultGmailRedirectUri(req);
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_IMAP_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  if (addressHint) params.set("login_hint", addressHint);
  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

async function oauthCallbackHandler(req: Request, res: Response): Promise<void> {
  const err = typeof req.query.error === "string" ? req.query.error : null;
  if (err) {
    res.status(400).send(`Google sign-in failed: ${err}`);
    return;
  }
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state) {
    res.status(400).send("Missing OAuth code or state");
    return;
  }
  prunePendingOAuth();
  const pending = pendingOAuth.get(state);
  pendingOAuth.delete(state);
  if (!pending || pending.expires <= Date.now()) {
    res.status(400).send("OAuth session expired — start again from Settings → Connections.");
    return;
  }
  try {
    const redirectUri = defaultGmailRedirectUri(req);
    const tokens = await exchangeOAuthCode(code, redirectUri);
    const email = await fetchGoogleAccountEmail(tokens.access_token);
    if (pending.address && pending.address.toLowerCase() !== email.toLowerCase()) {
      res.status(400).send(`Signed in as ${email}, but you requested ${pending.address}. Try again with the correct account.`);
      return;
    }
    const now = Date.now();
    const conn: MailConnection = {
      kind: "gmail",
      address: email,
      user: email,
      host: defaultHost("gmail"),
      port: 993,
      secure: true,
      authMethod: "oauth",
      label: pending.label || "Gmail",
      oauthRefreshToken: tokens.refresh_token,
      oauthAccessToken: tokens.access_token,
      oauthExpiresAt: now + (tokens.expires_in ?? 3600) * 1000,
    };
    if (!conn.oauthRefreshToken) {
      res.status(502).send("Google did not return a refresh token. Revoke app access and sign in again with consent.");
      return;
    }
    setMailConnection(conn);
    res.redirect("/settings/connections?email=connected#email");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OAuth failed";
    res.status(502).send(msg);
  }
}

export function mountInboxMailRoutes(app: Express): void {
  app.get("/api/inbox/email/status", (_req, res) => {
    res.json(getInboxEmailStatus());
  });

  app.get("/api/inbox/email/oauth/start", oauthStartHandler);
  app.get("/api/inbox/email/oauth/callback", (req, res) => {
    void oauthCallbackHandler(req, res);
  });

  app.post("/api/inbox/email/test", async (_req, res) => {
    const cfg = resolveImapConfig();
    if (!cfg) {
      return res.status(503).json({
        ok: false,
        error: "not_configured",
        message: getInboxEmailStatus().setup ?? IMAP_ENV_SETUP,
      });
    }
    try {
      let accessToken: string | null = null;
      if (cfg.authMethod === "oauth") {
        const conn = getMailConnection();
        if (!conn) throw new Error("OAuth connection missing");
        accessToken = await ensureGmailAccessToken(conn);
      }
      const client = new ImapFlow({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: accessToken
          ? { user: cfg.user, accessToken }
          : { user: cfg.user, pass: cfg.password },
        logger: false,
      });
      await client.connect();
      const lock = await client.getMailboxLock(cfg.mailbox);
      let exists = 0;
      try {
        exists = client.mailbox && typeof client.mailbox === "object" ? client.mailbox.exists : 0;
      } finally {
        lock.release();
      }
      try {
        await client.logout();
      } catch {
        /* ignore */
      }
      res.json({
        ok: true,
        host: cfg.host,
        port: cfg.port,
        mailbox: cfg.mailbox,
        messageCount: exists,
        authMethod: cfg.authMethod,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "IMAP test failed";
      res.status(502).json({ ok: false, error: "imap_test_failed", message: msg });
    }
  });

  app.get("/api/inbox/email/messages", async (_req, res) => {
    const status = getInboxEmailStatus();
    if (!status.configured) {
      return res.json({
        configured: false,
        messages: [] as InboxEmailMessage[],
        hint: status.setup,
      });
    }
    try {
      const messages = await fetchInboxEmailMessages();
      res.json({ configured: true, messages });
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 501) {
        return res.status(501).json({ error: "not_implemented", message: err.message, setup: GMAIL_OAUTH_ENV_SETUP });
      }
      res.status(502).json({
        error: "imap_fetch_failed",
        message: err.message || "IMAP fetch failed",
        messages: [] as InboxEmailMessage[],
      });
    }
  });

  app.put("/api/inbox/email/connection", (req, res) => {
    if (req.body == null || req.body === null || (typeof req.body === "object" && Object.keys(req.body).length === 0)) {
      setMailConnection(null);
      return res.json(getInboxEmailStatus());
    }
    const b = req.body as Record<string, unknown>;
    if (b.authMethod === "oauth") {
      return res.status(400).json({ error: "use_oauth_flow", message: "Use GET /api/inbox/email/oauth/start for Gmail OAuth" });
    }
    const conn = normalizeConnectionBody(req.body);
    if (!conn) return res.status(400).json({ error: "kind and address required (kind: imap|gmail)" });
    const validation = validatePasswordConnection(conn);
    if (validation) return res.status(400).json({ error: "invalid_connection", message: validation });
    setMailConnection(conn);
    res.json(getInboxEmailStatus());
  });
}
