import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import {
  getCalendarPrefs,
  getGoogleCalendarAuth,
  getMicrosoftGraphAuth,
  setCalendarPrefs,
  setGoogleCalendarAuth,
  setMicrosoftGraphAuth,
} from "./store.js";
import type { CalendarConnector, CalendarEventItem } from "./types.js";
import { oauthClientConfigured, resolveOAuthClient } from "./oauthClients.js";

const CONNECTORS = new Set<CalendarConnector>(["google", "microsoft", "apple", "caldav"]);

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly openid email";
/** Graph calendar + mail.readonly — user consents when connecting Microsoft. */
const MICROSOFT_SCOPES = [
  "openid",
  "email",
  "profile",
  "offline_access",
  "Calendars.Read",
  "Mail.Read",
].join(" ");
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const oauthStates = new Map<string, number>();

function isConnector(v: unknown): v is CalendarConnector {
  return typeof v === "string" && CONNECTORS.has(v as CalendarConnector);
}

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

function googleOAuthConfigured(): boolean {
  return oauthClientConfigured("google_calendar");
}

function microsoftOAuthConfigured(): boolean {
  return oauthClientConfigured("microsoft");
}

function googleRedirectUri(): string {
  return resolveOAuthClient("google_calendar").redirectUri;
}

function microsoftRedirectUri(): string {
  return resolveOAuthClient("microsoft").redirectUri;
}

function createOAuthState(): string {
  const state = crypto.randomUUID();
  oauthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  return state;
}

function consumeOAuthState(state: string): boolean {
  const exp = oauthStates.get(state);
  oauthStates.delete(state);
  return exp != null && Date.now() < exp;
}

async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const creds = resolveOAuthClient("google_calendar").creds;
  if (!creds) throw new Error("Google Calendar OAuth is not configured");
  const body = new URLSearchParams({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>;
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const creds = resolveOAuthClient("google_calendar").creds;
  if (!creds) throw new Error("Google Calendar OAuth is not configured");
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in?: number }>;
}

async function fetchGoogleEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { email?: string };
  return typeof data.email === "string" ? data.email.trim() : undefined;
}

/** Returns a valid access token or null when refresh is impossible. */
export async function resolveGoogleAccessToken(): Promise<string | null> {
  const auth = getGoogleCalendarAuth();
  if (!auth?.accessToken) return null;
  const skewMs = 60_000;
  if (auth.expiryMs && auth.expiryMs > Date.now() + skewMs) {
    return auth.accessToken;
  }
  if (!auth.refreshToken || !googleOAuthConfigured()) {
    return auth.expiryMs && auth.expiryMs > Date.now() ? auth.accessToken : null;
  }
  try {
    const refreshed = await refreshGoogleAccessToken(auth.refreshToken);
    const expiryMs =
      typeof refreshed.expires_in === "number" ? Date.now() + refreshed.expires_in * 1000 : undefined;
    setGoogleCalendarAuth({
      ...auth,
      accessToken: refreshed.access_token,
      expiryMs,
    });
    return refreshed.access_token;
  } catch {
    return auth.expiryMs && auth.expiryMs > Date.now() ? auth.accessToken : null;
  }
}

async function fetchGoogleCalendarEvents(accessToken: string): Promise<CalendarEventItem[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", start.toISOString());
  url.searchParams.set("timeMax", end.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "40");
  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Calendar API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    items?: {
      id?: string;
      summary?: string;
      location?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }[];
  };
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((ev, i) => {
    const startRaw = ev.start?.dateTime ?? ev.start?.date ?? "";
    const endRaw = ev.end?.dateTime ?? ev.end?.date;
    const startDate = startRaw ? new Date(startRaw) : null;
    const time =
      startDate && !Number.isNaN(startDate.getTime())
        ? startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : startRaw || "";
    return {
      id: ev.id ?? `gcal-${i}`,
      time,
      end: endRaw,
      title: ev.summary?.trim() || "(no title)",
      place: ev.location?.trim() || undefined,
    };
  });
}

async function exchangeMicrosoftCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}> {
  const creds = resolveOAuthClient("microsoft").creds;
  if (!creds) throw new Error("Microsoft OAuth is not configured");
  const body = new URLSearchParams({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: microsoftRedirectUri(),
    grant_type: "authorization_code",
    scope: MICROSOFT_SCOPES,
  });
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Microsoft token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}

async function refreshMicrosoftAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
}> {
  const creds = resolveOAuthClient("microsoft").creds;
  if (!creds) throw new Error("Microsoft OAuth is not configured");
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
    scope: MICROSOFT_SCOPES,
  });
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Microsoft token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in?: number; refresh_token?: string }>;
}

async function fetchMicrosoftEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
  const email = (data.mail ?? data.userPrincipalName ?? "").trim();
  return email || undefined;
}

export async function resolveMicrosoftAccessToken(): Promise<string | null> {
  const auth = getMicrosoftGraphAuth();
  if (!auth?.accessToken) return null;
  const skewMs = 60_000;
  if (auth.expiryMs && auth.expiryMs > Date.now() + skewMs) {
    return auth.accessToken;
  }
  if (!auth.refreshToken || !microsoftOAuthConfigured()) {
    return auth.expiryMs && auth.expiryMs > Date.now() ? auth.accessToken : null;
  }
  try {
    const refreshed = await refreshMicrosoftAccessToken(auth.refreshToken);
    const expiryMs =
      typeof refreshed.expires_in === "number" ? Date.now() + refreshed.expires_in * 1000 : undefined;
    setMicrosoftGraphAuth({
      ...auth,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? auth.refreshToken,
      expiryMs,
    });
    return refreshed.access_token;
  } catch {
    return auth.expiryMs && auth.expiryMs > Date.now() ? auth.accessToken : null;
  }
}

async function fetchMicrosoftCalendarEvents(accessToken: string): Promise<CalendarEventItem[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  url.searchParams.set("startDateTime", start.toISOString());
  url.searchParams.set("endDateTime", end.toISOString());
  url.searchParams.set("$orderby", "start/dateTime");
  url.searchParams.set("$top", "40");
  url.searchParams.set("$select", "id,subject,location,start,end");
  const res = await fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Microsoft Graph calendar ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    value?: {
      id?: string;
      subject?: string;
      location?: { displayName?: string };
      start?: { dateTime?: string };
      end?: { dateTime?: string };
    }[];
  };
  const items = Array.isArray(data.value) ? data.value : [];
  return items.map((ev, i) => {
    const startRaw = ev.start?.dateTime ?? "";
    const startDate = startRaw ? new Date(startRaw.endsWith("Z") ? startRaw : `${startRaw}Z`) : null;
    const time =
      startDate && !Number.isNaN(startDate.getTime())
        ? startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : startRaw || "";
    return {
      id: ev.id ?? `ms-${i}`,
      time,
      end: ev.end?.dateTime,
      title: ev.subject?.trim() || "(no title)",
      place: ev.location?.displayName?.trim() || undefined,
    };
  });
}

export function getCalendarStatus() {
  const prefs = getCalendarPrefs();
  const oauthReady = googleOAuthConfigured();
  const msConfigured = microsoftOAuthConfigured();
  const googleAuth = getGoogleCalendarAuth();
  const msAuth = getMicrosoftGraphAuth();
  const googleConnected = Boolean(googleAuth?.accessToken);
  const microsoftConnected = Boolean(msAuth?.accessToken);
  const configured = prefs.enabled && prefs.connector != null;
  const live =
    (prefs.connector === "google" && googleConnected && oauthReady) ||
    (prefs.connector === "microsoft" && microsoftConnected && msConfigured);

  let message =
    "Calendar connector is off. Enable Google or Microsoft under Settings → Connections.";
  if (prefs.enabled && !prefs.connector) {
    message = "Choose a calendar provider to finish setup.";
  } else if (prefs.connector === "google") {
    if (!oauthReady) {
      message =
        "Save Google Calendar client id/secret under Connections (or set ASI_GOOGLE_CALENDAR_CLIENT_ID / SECRET), then Connect Google.";
    } else if (!googleConnected) {
      message = "Google Calendar is not connected. Use Connect Google in Settings → Connections → Calendar.";
    } else if (live) {
      const label = prefs.accountLabel ? ` (${prefs.accountLabel})` : "";
      message = `Google Calendar connected${label} — showing today's events.`;
    } else {
      message = "Google tokens expired or invalid. Disconnect and connect again.";
    }
  } else if (prefs.connector === "microsoft") {
    if (!msConfigured) {
      message =
        "Save Microsoft client id/secret under Connections (or ASI_MICROSOFT_CLIENT_ID / SECRET), then Connect Microsoft.";
    } else if (!microsoftConnected) {
      message = "Microsoft is not connected. Use Connect Microsoft — Graph calendar + Mail.Read consent.";
    } else if (live) {
      const label = prefs.accountLabel ? ` (${prefs.accountLabel})` : "";
      message = `Microsoft Graph connected${label} — showing today's calendar events.`;
    } else {
      message = "Microsoft tokens expired or invalid. Disconnect and connect again.";
    }
  } else if (configured) {
    message = `${prefs.connector} calendar sync is not available yet. No demo events.`;
  }

  const googleClient = resolveOAuthClient("google_calendar");
  const msClient = resolveOAuthClient("microsoft");

  return {
    configured,
    enabled: prefs.enabled,
    connector: prefs.connector,
    accountLabel: prefs.accountLabel ?? null,
    live,
    syncReady: live,
    oauthConfigured: oauthReady,
    googleConnected,
    microsoftConnected,
    microsoftOAuthConfigured: msConfigured,
    /** Code path exists — Connect works when client secrets are set. */
    microsoftShipped: true,
    googleOAuthSource: googleClient.source,
    googleOAuthLast4: googleClient.creds ? googleClient.creds.clientSecret.slice(-4) : undefined,
    googleRedirectUri: googleClient.redirectUri,
    microsoftOAuthSource: msClient.source,
    microsoftOAuthLast4: msClient.creds ? msClient.creds.clientSecret.slice(-4) : undefined,
    microsoftRedirectUri: msClient.redirectUri,
    message,
  };
}

/** Fail-closed: no fabricated events. */
export async function listCalendarEvents(): Promise<{ events: CalendarEventItem[]; error?: string }> {
  const status = getCalendarStatus();
  if (!status.configured || !status.live) {
    return { events: [] };
  }
  if (status.connector === "google") {
    const token = await resolveGoogleAccessToken();
    if (!token) {
      return { events: [], error: "Google access token unavailable. Reconnect in Settings." };
    }
    try {
      const events = await fetchGoogleCalendarEvents(token);
      return { events };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to load Google Calendar events.";
      return { events: [], error };
    }
  }
  if (status.connector === "microsoft") {
    const token = await resolveMicrosoftAccessToken();
    if (!token) {
      return { events: [], error: "Microsoft access token unavailable. Reconnect in Settings." };
    }
    try {
      const events = await fetchMicrosoftCalendarEvents(token);
      return { events };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to load Microsoft Calendar events.";
      return { events: [], error };
    }
  }
  return { events: [] };
}

export function mountCalendarRoutes(app: Express): void {
  app.get("/api/calendar/status", (_req, res) => {
    res.json(getCalendarStatus());
  });

  app.get("/api/calendar/events", async (_req, res) => {
    const status = getCalendarStatus();
    const { events, error } = await listCalendarEvents();
    res.json({
      events,
      configured: status.configured,
      live: status.live,
      message: error ?? (events.length === 0 && status.live ? "No events today." : status.message),
    });
  });

  app.get("/api/calendar/prefs", (_req, res) => {
    res.json({ prefs: getCalendarPrefs() });
  });

  app.put("/api/calendar/prefs", (req, res) => {
    const patch: Partial<ReturnType<typeof getCalendarPrefs>> = {};
    if (req.body?.enabled != null) patch.enabled = Boolean(req.body.enabled);
    if (req.body?.connector !== undefined) {
      const c = req.body.connector;
      if (c === null || c === "") patch.connector = null;
      else if (!isConnector(c)) return res.status(400).json({ error: "invalid connector" });
      else patch.connector = c;
    }
    if (req.body?.accountLabel != null) {
      const label = String(req.body.accountLabel).trim();
      patch.accountLabel = label || undefined;
    }
    const prefs = setCalendarPrefs(patch);
    res.json({ prefs, status: getCalendarStatus() });
  });

  app.get("/api/calendar/oauth/google/start", (_req, res) => {
    const creds = resolveOAuthClient("google_calendar").creds;
    if (!creds) {
      return res.status(503).json({
        error: "Google OAuth is not configured on the server.",
        hint: "Save client id/secret under Settings → Connections, or set ASI_GOOGLE_CALENDAR_CLIENT_ID and ASI_GOOGLE_CALENDAR_CLIENT_SECRET.",
      });
    }
    const state = createOAuthState();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("redirect_uri", googleRedirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    res.redirect(url.toString());
  });

  app.get("/api/calendar/oauth/google/callback", async (req: Request, res: Response) => {
    const settingsBase = `${uiOrigin()}/settings/connections`;
    const toSettings = (oauth: string) =>
      `${settingsBase}?calendar_oauth=${encodeURIComponent(oauth)}#calendar`;
    const err = typeof req.query.error === "string" ? req.query.error : null;
    if (err) {
      return res.redirect(toSettings("denied"));
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state || !consumeOAuthState(state)) {
      return res.redirect(toSettings("invalid_state"));
    }
    if (!googleOAuthConfigured()) {
      return res.redirect(toSettings("not_configured"));
    }
    try {
      const tokens = await exchangeGoogleCode(code);
      const expiryMs =
        typeof tokens.expires_in === "number" ? Date.now() + tokens.expires_in * 1000 : undefined;
      const email = await fetchGoogleEmail(tokens.access_token);
      setGoogleCalendarAuth({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryMs,
        email,
      });
      setCalendarPrefs({
        enabled: true,
        connector: "google",
        accountLabel: email ?? undefined,
      });
      res.redirect(toSettings("connected"));
    } catch {
      res.redirect(toSettings("exchange_failed"));
    }
  });

  app.post("/api/calendar/oauth/google/disconnect", (_req, res) => {
    setGoogleCalendarAuth(null);
    if (getCalendarPrefs().connector === "google") {
      setCalendarPrefs({ enabled: false, connector: null, accountLabel: undefined });
    }
    res.json({ ok: true, status: getCalendarStatus() });
  });

  app.get("/api/calendar/oauth/microsoft/start", (_req, res) => {
    const creds = resolveOAuthClient("microsoft").creds;
    if (!creds) {
      return res.status(503).json({
        error: "Microsoft OAuth is not configured.",
        shipped: true,
        hint:
          "Register an Azure AD app with Calendars.Read + Mail.Read, save client id/secret under Connections, redirect " +
          microsoftRedirectUri(),
        redirectUri: microsoftRedirectUri(),
        oauthEnvConfigured: false,
      });
    }
    const state = createOAuthState();
    const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", microsoftRedirectUri());
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", MICROSOFT_SCOPES);
    url.searchParams.set("state", state);
    res.redirect(url.toString());
  });

  app.get("/api/calendar/oauth/microsoft/callback", async (req: Request, res: Response) => {
    const settingsBase = `${uiOrigin()}/settings/connections`;
    const toSettings = (oauth: string) =>
      `${settingsBase}?calendar_oauth=${encodeURIComponent(oauth)}#calendar`;
    const err = typeof req.query.error === "string" ? req.query.error : null;
    if (err) {
      return res.redirect(toSettings("denied"));
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state || !consumeOAuthState(state)) {
      return res.redirect(toSettings("invalid_state"));
    }
    if (!microsoftOAuthConfigured()) {
      return res.redirect(toSettings("not_configured"));
    }
    try {
      const tokens = await exchangeMicrosoftCode(code);
      const expiryMs =
        typeof tokens.expires_in === "number" ? Date.now() + tokens.expires_in * 1000 : undefined;
      const email = await fetchMicrosoftEmail(tokens.access_token);
      setMicrosoftGraphAuth({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryMs,
        email,
        scope: tokens.scope,
      });
      setCalendarPrefs({
        enabled: true,
        connector: "microsoft",
        accountLabel: email ?? undefined,
      });
      res.redirect(toSettings("ms_connected"));
    } catch {
      res.redirect(toSettings("exchange_failed"));
    }
  });

  app.post("/api/calendar/oauth/microsoft/disconnect", (_req, res) => {
    setMicrosoftGraphAuth(null);
    if (getCalendarPrefs().connector === "microsoft") {
      setCalendarPrefs({ enabled: false, connector: null, accountLabel: undefined });
    }
    res.json({ ok: true, status: getCalendarStatus() });
  });
}
