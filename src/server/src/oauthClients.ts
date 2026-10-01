/**
 * OAuth app client id/secret storage for Gmail, Calendar, Drive, Microsoft.
 * Env vars win when set; otherwise app-state. Never logs secrets; GET returns last4 only.
 */
import type { Express, Request, Response } from "express";
import { loadState, saveState } from "./store.js";

export type OAuthClientSlot =
  | "gmail"
  | "google_calendar"
  | "google_drive"
  | "microsoft";

export interface OAuthClientCreds {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export interface OAuthClientPublicStatus {
  slot: OAuthClientSlot;
  configured: boolean;
  source: "env" | "state" | null;
  clientIdHint?: string;
  last4?: string;
  redirectUri: string;
  envKeys: string[];
}

const SLOT_ENV: Record<
  OAuthClientSlot,
  { clientId: string[]; clientSecret: string[]; redirectUri: string[]; defaultRedirect: (port: number) => string }
> = {
  gmail: {
    clientId: ["ASI_GMAIL_CLIENT_ID"],
    clientSecret: ["ASI_GMAIL_CLIENT_SECRET"],
    redirectUri: ["ASI_GMAIL_REDIRECT_URI"],
    defaultRedirect: (port) => `http://localhost:${port}/api/inbox/email/oauth/callback`,
  },
  google_calendar: {
    clientId: ["ASI_GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_ID"],
    clientSecret: ["ASI_GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_CALENDAR_CLIENT_SECRET"],
    redirectUri: ["ASI_GOOGLE_CALENDAR_REDIRECT_URI"],
    defaultRedirect: (port) => `http://127.0.0.1:${port}/api/calendar/oauth/google/callback`,
  },
  google_drive: {
    clientId: ["ASI_GOOGLE_DRIVE_CLIENT_ID", "ASI_GMAIL_CLIENT_ID"],
    clientSecret: ["ASI_GOOGLE_DRIVE_CLIENT_SECRET", "ASI_GMAIL_CLIENT_SECRET"],
    redirectUri: ["ASI_GOOGLE_DRIVE_REDIRECT_URI"],
    defaultRedirect: (port) => `http://127.0.0.1:${port}/api/drive/oauth/google/callback`,
  },
  microsoft: {
    clientId: [
      "ASI_MICROSOFT_CLIENT_ID",
      "ASI_MICROSOFT_CALENDAR_CLIENT_ID",
      "MICROSOFT_CALENDAR_CLIENT_ID",
    ],
    clientSecret: [
      "ASI_MICROSOFT_CLIENT_SECRET",
      "ASI_MICROSOFT_CALENDAR_CLIENT_SECRET",
      "MICROSOFT_CALENDAR_CLIENT_SECRET",
    ],
    redirectUri: ["ASI_MICROSOFT_REDIRECT_URI", "ASI_MICROSOFT_CALENDAR_REDIRECT_URI"],
    defaultRedirect: (port) => `http://127.0.0.1:${port}/api/calendar/oauth/microsoft/callback`,
  },
};

function serverPort(): number {
  return Number(process.env.ASI_SERVER_PORT ?? process.env.ASI_ENGINE_PORT ?? 3445);
}

function envFirst(keys: string[]): string | null {
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

function maskLast4(secret: string | undefined): string | undefined {
  if (!secret?.trim()) return undefined;
  const s = secret.trim();
  if (s.length < 4) return "****";
  return s.slice(-4);
}

function clientIdHint(id: string | undefined): string | undefined {
  if (!id?.trim()) return undefined;
  const s = id.trim();
  if (s.length <= 8) return `${s.slice(0, 2)}…`;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function storedMap(): Partial<Record<OAuthClientSlot, OAuthClientCreds>> {
  const raw = loadState().oauthClients;
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<OAuthClientSlot, OAuthClientCreds>> = {};
  for (const slot of Object.keys(SLOT_ENV) as OAuthClientSlot[]) {
    const row = (raw as Record<string, unknown>)[slot];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const clientId = typeof r.clientId === "string" ? r.clientId.trim() : "";
    const clientSecret = typeof r.clientSecret === "string" ? r.clientSecret.trim() : "";
    if (!clientId || !clientSecret) continue;
    out[slot] = {
      clientId,
      clientSecret,
      redirectUri: typeof r.redirectUri === "string" && r.redirectUri.trim() ? r.redirectUri.trim() : undefined,
    };
  }
  return out;
}

/** Resolved credentials — env overrides app-state. */
export function resolveOAuthClient(slot: OAuthClientSlot): {
  creds: OAuthClientCreds | null;
  source: "env" | "state" | null;
  redirectUri: string;
} {
  const meta = SLOT_ENV[slot];
  const envId = envFirst(meta.clientId);
  const envSecret = envFirst(meta.clientSecret);
  const envRedirect = envFirst(meta.redirectUri);
  const defaultRedirect = meta.defaultRedirect(serverPort());

  if (envId && envSecret) {
    return {
      creds: { clientId: envId, clientSecret: envSecret, redirectUri: envRedirect ?? undefined },
      source: "env",
      redirectUri: envRedirect ?? defaultRedirect,
    };
  }

  const stored = storedMap()[slot];
  if (stored) {
    return {
      creds: stored,
      source: "state",
      redirectUri: envRedirect ?? stored.redirectUri ?? defaultRedirect,
    };
  }

  return { creds: null, source: null, redirectUri: envRedirect ?? defaultRedirect };
}

export function oauthClientConfigured(slot: OAuthClientSlot): boolean {
  return Boolean(resolveOAuthClient(slot).creds);
}

export function getOAuthClientPublicStatus(slot: OAuthClientSlot): OAuthClientPublicStatus {
  const { creds, source, redirectUri } = resolveOAuthClient(slot);
  const meta = SLOT_ENV[slot];
  return {
    slot,
    configured: Boolean(creds),
    source,
    clientIdHint: clientIdHint(creds?.clientId),
    last4: maskLast4(creds?.clientSecret),
    redirectUri,
    envKeys: [...meta.clientId, ...meta.clientSecret],
  };
}

export function listOAuthClientStatuses(): Record<OAuthClientSlot, OAuthClientPublicStatus> {
  return {
    gmail: getOAuthClientPublicStatus("gmail"),
    google_calendar: getOAuthClientPublicStatus("google_calendar"),
    google_drive: getOAuthClientPublicStatus("google_drive"),
    microsoft: getOAuthClientPublicStatus("microsoft"),
  };
}

export function putOAuthClient(
  slot: OAuthClientSlot,
  body: { clientId?: string; clientSecret?: string; redirectUri?: string | null } | null
): OAuthClientPublicStatus {
  if (!(slot in SLOT_ENV)) throw new Error("unknown_slot");
  const state = loadState();
  const map = { ...(state.oauthClients ?? {}) } as Record<string, OAuthClientCreds>;

  if (body == null || (body.clientId === "" && body.clientSecret === "")) {
    delete map[slot];
    state.oauthClients = map;
    saveState(state);
    return getOAuthClientPublicStatus(slot);
  }

  const prev = map[slot];
  const clientId = typeof body.clientId === "string" && body.clientId.trim() ? body.clientId.trim() : prev?.clientId;
  let clientSecret =
    typeof body.clientSecret === "string" && body.clientSecret.trim() ? body.clientSecret.trim() : prev?.clientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("clientId and clientSecret required");
  }

  const next: OAuthClientCreds = { clientId, clientSecret };
  if (body.redirectUri === null || body.redirectUri === "") {
    /* clear override */
  } else if (typeof body.redirectUri === "string" && body.redirectUri.trim()) {
    next.redirectUri = body.redirectUri.trim();
  } else if (prev?.redirectUri) {
    next.redirectUri = prev.redirectUri;
  }

  map[slot] = next;
  state.oauthClients = map;
  saveState(state);
  return getOAuthClientPublicStatus(slot);
}

const SLOTS = new Set<string>(["gmail", "google_calendar", "google_drive", "microsoft"]);

export function mountOAuthClientRoutes(app: Express): void {
  app.get("/api/connections/oauth-clients", (_req, res) => {
    res.json({ clients: listOAuthClientStatuses() });
  });

  app.get("/api/connections/oauth-clients/:slot", (req, res) => {
    const slot = String(req.params.slot ?? "");
    if (!SLOTS.has(slot)) return res.status(404).json({ error: "unknown_slot" });
    res.json(getOAuthClientPublicStatus(slot as OAuthClientSlot));
  });

  app.put("/api/connections/oauth-clients/:slot", (req: Request, res: Response) => {
    const slot = String(req.params.slot ?? "");
    if (!SLOTS.has(slot)) return res.status(404).json({ error: "unknown_slot" });
    try {
      const body = req.body as {
        clientId?: string;
        clientSecret?: string;
        redirectUri?: string | null;
        clear?: boolean;
      } | null;
      if (body?.clear === true || body == null || Object.keys(body ?? {}).length === 0) {
        return res.json(putOAuthClient(slot as OAuthClientSlot, null));
      }
      const status = putOAuthClient(slot as OAuthClientSlot, body);
      res.json(status);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "save_failed";
      res.status(400).json({ error: "invalid_credentials", message: msg });
    }
  });
}
