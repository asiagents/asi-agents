import type { Express } from "express";
import nodemailer from "nodemailer";
import { getInboxEmailStatus, resolveImapConfig, type ResolvedImapConfig } from "./inbox-mail.js";
import type { MailConnectionKind } from "./types.js";

const GMAIL_OAUTH_SETUP =
  "Gmail OAuth is not implemented. Use an app password with IMAP/SMTP: set ASI_IMAP_* env vars or store mailConnection with authMethod password.";

const SMTP_ENV = {
  host: "ASI_SMTP_HOST",
  port: "ASI_SMTP_PORT",
  secure: "ASI_SMTP_SECURE",
} as const;

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

function deriveSmtpHost(imapHost: string, kind: MailConnectionKind): string {
  const fromEnv = envTrim(SMTP_ENV.host);
  if (fromEnv) return fromEnv;
  if (kind === "gmail") return "smtp.gmail.com";
  if (/^imap\./i.test(imapHost)) return imapHost.replace(/^imap\./i, "smtp.");
  if (/imap/i.test(imapHost)) return imapHost.replace(/imap/i, "smtp");
  return imapHost;
}

function resolveSmtpSettings(cfg: ResolvedImapConfig): { host: string; port: number; secure: boolean } {
  const host = deriveSmtpHost(cfg.host, cfg.kind);
  const secure = parseSecure(envTrim(SMTP_ENV.secure), cfg.secure);
  const defaultPort = cfg.kind === "gmail" ? (secure ? 465 : 587) : secure ? 465 : 587;
  const port = parsePort(envTrim(SMTP_ENV.port), defaultPort);
  return { host, port, secure };
}

export interface SendInboxEmailInput {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}

export async function sendInboxEmail(input: SendInboxEmailInput): Promise<{ messageId: string }> {
  const cfg = resolveImapConfig();
  if (!cfg) {
    const err = new Error("Mail is not configured on the server.") as Error & { status?: number; code?: string };
    err.status = 503;
    err.code = "not_configured";
    throw err;
  }
  if (cfg.authMethod === "oauth") {
    const err = new Error(GMAIL_OAUTH_SETUP) as Error & { status?: number; code?: string };
    err.status = 501;
    err.code = "not_implemented";
    throw err;
  }

  const to = input.to.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!to || !to.includes("@")) {
    const err = new Error("Valid recipient address (to) is required.") as Error & { status?: number; code?: string };
    err.status = 400;
    err.code = "invalid_to";
    throw err;
  }
  if (!subject) {
    const err = new Error("Subject is required.") as Error & { status?: number; code?: string };
    err.status = 400;
    err.code = "invalid_subject";
    throw err;
  }
  if (!body) {
    const err = new Error("Message body is required.") as Error & { status?: number; code?: string };
    err.status = 400;
    err.code = "invalid_body";
    throw err;
  }

  const smtp = resolveSmtpSettings(cfg);
  const fromAddress = cfg.address.includes("@") ? cfg.address : cfg.user;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: cfg.user, pass: cfg.password },
  });

  const info = await transporter.sendMail({
    from: fromAddress.includes("@") ? fromAddress : `"${cfg.label}" <${fromAddress}>`,
    to,
    subject,
    text: body,
    inReplyTo: input.inReplyTo?.trim() || undefined,
    references: input.references?.trim() || undefined,
  });

  const messageId = typeof info.messageId === "string" ? info.messageId : "";
  return { messageId };
}

export function mountInboxSendRoutes(app: Express): void {
  app.post("/api/inbox/email/send", async (req, res) => {
    const status = getInboxEmailStatus();
    if (!status.configured) {
      return res.status(503).json({
        error: "not_configured",
        message: status.setup ?? "Mail is not configured on the server.",
      });
    }
    if (status.authMethod === "oauth") {
      return res.status(501).json({ error: "not_implemented", message: GMAIL_OAUTH_SETUP, setup: GMAIL_OAUTH_SETUP });
    }

    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "invalid_body", message: "JSON body required" });
    }

    try {
      const result = await sendInboxEmail({
        to: typeof body.to === "string" ? body.to : "",
        subject: typeof body.subject === "string" ? body.subject : "",
        body: typeof body.text === "string" ? body.text : typeof body.body === "string" ? body.body : "",
        inReplyTo: typeof body.inReplyTo === "string" ? body.inReplyTo : undefined,
        references: typeof body.references === "string" ? body.references : undefined,
      });
      res.json({ ok: true, messageId: result.messageId || null });
    } catch (e) {
      const err = e as Error & { status?: number; code?: string };
      const code = err.code ?? "send_failed";
      const statusCode = err.status ?? 502;
      res.status(statusCode).json({
        error: code,
        message: err.message || "SMTP send failed",
      });
    }
  });
}
