/**
 * Optional Google Drive — separate from Gmail. Explicit drive.readonly scope only.
 */
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { getGoogleDriveAuth, setGoogleDriveAuth } from "./store.js";
import { oauthClientConfigured, resolveOAuthClient } from "./oauthClients.js";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly openid email";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const oauthStates = new Map<string, number>();

function serverPort(): number {
  return Number(process.env.ASI_SERVER_PORT ?? process.env.ASI_ENGINE_PORT ?? 3445);
}

function uiOrigin(): string {
  const fromEnv = (process.env.ASI_UI_ORIGIN ?? "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:5173";
  }
  return `http://127.0.0.1:${serverPort()}`;
}

function redirectUri(): string {
  return resolveOAuthClient("google_drive").redirectUri;
}

function createState(): string {
  const state = crypto.randomUUID();
  oauthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  return state;
}

function consumeState(state: string): boolean {
  const exp = oauthStates.get(state);
  oauthStates.delete(state);
  return exp != null && Date.now() < exp;
}

export function getDriveStatus() {
  const client = resolveOAuthClient("google_drive");
  const auth = getGoogleDriveAuth();
  const connected = Boolean(auth?.accessToken && auth.refreshToken);
  return {
    oauthConfigured: oauthClientConfigured("google_drive"),
    oauthSource: client.source,
    last4: client.creds ? client.creds.clientSecret.slice(-4) : undefined,
    redirectUri: client.redirectUri,
    connected,
    accountLabel: auth?.email ?? null,
    scopes: ["drive.readonly"],
    message: !client.creds
      ? "Save Google Drive client id/secret (or reuse Gmail OAuth client with Drive API enabled), then Connect. Gmail Connect never requests Drive scopes."
      : connected
        ? `Google Drive connected${auth?.email ? ` (${auth.email})` : ""} — browse files below.`
        : "OAuth app configured. Connect Google Drive to grant drive.readonly only.",
  };
}

async function exchangeCode(code: string) {
  const creds = resolveOAuthClient("google_drive").creds;
  if (!creds) throw new Error("Drive OAuth not configured");
  const body = new URLSearchParams({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Drive token exchange failed: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>;
}

async function refreshToken(refresh: string) {
  const creds = resolveOAuthClient("google_drive").creds;
  if (!creds) throw new Error("Drive OAuth not configured");
  const body = new URLSearchParams({
    refresh_token: refresh,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Drive refresh failed");
  return res.json() as Promise<{ access_token: string; expires_in?: number }>;
}

async function fetchEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { email?: string };
  return data.email?.trim();
}

async function resolveAccessToken(): Promise<string | null> {
  const auth = getGoogleDriveAuth();
  if (!auth?.accessToken) return null;
  if (auth.expiryMs && auth.expiryMs > Date.now() + 60_000) return auth.accessToken;
  if (!auth.refreshToken) return auth.expiryMs && auth.expiryMs > Date.now() ? auth.accessToken : null;
  try {
    const refreshed = await refreshToken(auth.refreshToken);
    const expiryMs =
      typeof refreshed.expires_in === "number" ? Date.now() + refreshed.expires_in * 1000 : undefined;
    setGoogleDriveAuth({ ...auth, accessToken: refreshed.access_token, expiryMs });
    return refreshed.access_token;
  } catch {
    return null;
  }
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  folder: boolean;
}

async function listDriveFiles(folderId?: string): Promise<DriveFileItem[]> {
  const token = await resolveAccessToken();
  if (!token) throw new Error("not_connected");
  const q = folderId
    ? `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`
    : "'root' in parents and trashed = false";
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,size,webViewLink)");
  url.searchParams.set("orderBy", "folder,name");
  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Drive list failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    files?: {
      id?: string;
      name?: string;
      mimeType?: string;
      modifiedTime?: string;
      size?: string;
      webViewLink?: string;
    }[];
  };
  return (data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "(unnamed)",
    mimeType: f.mimeType ?? "application/octet-stream",
    modifiedTime: f.modifiedTime,
    size: f.size,
    webViewLink: f.webViewLink,
    folder: f.mimeType === "application/vnd.google-apps.folder",
  }));
}

export function mountGoogleDriveRoutes(app: Express): void {
  app.get("/api/drive/status", (_req, res) => {
    res.json(getDriveStatus());
  });

  app.get("/api/drive/oauth/google/start", (_req, res) => {
    const creds = resolveOAuthClient("google_drive").creds;
    if (!creds) {
      return res.status(503).json({
        error: "Google Drive OAuth is not configured.",
        hint: "Save client id/secret under Settings → Connections → Integrations, or set ASI_GOOGLE_DRIVE_CLIENT_ID / SECRET (falls back to ASI_GMAIL_*).",
        redirectUri: redirectUri(),
      });
    }
    const state = createState();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", DRIVE_SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    res.redirect(url.toString());
  });

  app.get("/api/drive/oauth/google/callback", async (req: Request, res: Response) => {
    const base = `${uiOrigin()}/settings/connections`;
    const toSettings = (oauth: string) => `${base}?drive_oauth=${encodeURIComponent(oauth)}#integrations`;
    if (typeof req.query.error === "string") {
      return res.redirect(toSettings("denied"));
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state || !consumeState(state)) {
      return res.redirect(toSettings("invalid_state"));
    }
    try {
      const tokens = await exchangeCode(code);
      if (!tokens.refresh_token) {
        return res.redirect(toSettings("no_refresh"));
      }
      const email = await fetchEmail(tokens.access_token);
      setGoogleDriveAuth({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryMs:
          typeof tokens.expires_in === "number" ? Date.now() + tokens.expires_in * 1000 : undefined,
        email,
      });
      res.redirect(toSettings("connected"));
    } catch {
      res.redirect(toSettings("exchange_failed"));
    }
  });

  app.post("/api/drive/oauth/google/disconnect", (_req, res) => {
    setGoogleDriveAuth(null);
    res.json({ ok: true, status: getDriveStatus() });
  });

  app.get("/api/drive/files", async (req, res) => {
    const status = getDriveStatus();
    if (!status.connected) {
      return res.json({ connected: false, files: [], message: status.message });
    }
    const folderId = typeof req.query.folderId === "string" ? req.query.folderId.trim() : undefined;
    try {
      const files = await listDriveFiles(folderId || undefined);
      res.json({ connected: true, files, folderId: folderId || "root" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "list_failed";
      res.status(502).json({ connected: true, files: [], error: msg });
    }
  });
}
