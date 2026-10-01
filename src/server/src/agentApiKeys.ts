import { randomBytes } from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";
import { loadAgents } from "./agents.js";
import {
  agentApiKeyHasScope,
  clearAgentApiKey,
  getAgentApiKeyRecord,
  listAgentApiKeyMeta,
  normalizeApiKeyScopes,
  setAgentApiKey,
} from "./store.js";
import type { AgentApiKeyScope } from "./types.js";
import { isChiefId } from "./withChief.js";

function extractBearer(req: Request): string | null {
  const auth = req.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)/i.exec(auth);
  if (m) return m[1];
  const header = req.get("x-asi-agent-key") ?? req.get("x-agent-api-key");
  return header?.trim() || null;
}

function isLoopback(req: Request): boolean {
  const raw = (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
  return raw === "127.0.0.1" || raw === "::1" || raw === "localhost";
}

function findKeyByToken(token: string) {
  const keys = listAgentApiKeyMeta();
  for (const agentId of Object.keys(keys)) {
    const rec = getAgentApiKeyRecord(agentId);
    if (rec && rec.token === token) return { agentId, rec };
  }
  return null;
}

/**
 * Minimal auth for POST /api/agents/:id/chat.
 * - No key configured → allow (local UI).
 * - Key configured + matching Bearer / X-ASI-Agent-Key + chat scope → allow.
 * - Key configured + wrong header → 401.
 * - Key configured + no header + loopback → allow (Vite/UI).
 * - Key configured + no header + non-loopback → 401.
 */
export function requireAgentApiKeyIfSet(req: Request, res: Response, next: NextFunction): void {
  const agentId = String(req.params.id ?? "").trim();
  if (!agentId || isChiefId(agentId)) return next();
  const rec = getAgentApiKeyRecord(agentId);
  if (!rec) return next();
  const presented = extractBearer(req);
  if (presented) {
    if (presented === rec.token) {
      if (!agentApiKeyHasScope(rec, "chat")) {
        res.status(403).json({ error: "api key missing chat scope" });
        return;
      }
      return next();
    }
    res.status(401).json({ error: "invalid agent api key" });
    return;
  }
  if (isLoopback(req)) return next();
  res.status(401).json({
    error: "agent api key required",
    hint: "Authorization: Bearer <token> or X-ASI-Agent-Key: <token>",
  });
}

/**
 * Optional gate for GET /api/tasks* when a Bearer agent key is presented.
 * Loopback / no key → allow (UI). Remote with key missing tasks:read → 403.
 */
export function requireTasksReadScopeIfKeyPresented(req: Request, res: Response, next: NextFunction): void {
  const presented = extractBearer(req);
  if (!presented) return next();
  const hit = findKeyByToken(presented);
  if (!hit) {
    res.status(401).json({ error: "invalid agent api key" });
    return;
  }
  if (!agentApiKeyHasScope(hit.rec, "tasks:read")) {
    res.status(403).json({ error: "api key missing tasks:read scope" });
    return;
  }
  return next();
}

function agentExists(agentId: string): boolean {
  return loadAgents().agents.some((a) => a.id === agentId);
}

function parseScopesBody(body: unknown): AgentApiKeyScope[] | undefined {
  if (!body || typeof body !== "object") return undefined;
  const scopes = (body as { scopes?: unknown }).scopes;
  if (scopes == null) return undefined;
  return normalizeApiKeyScopes(scopes);
}

export function mountAgentApiKeyRoutes(app: Express): void {
  app.get("/api/agents/api-keys", (_req, res) => {
    res.json({ keys: listAgentApiKeyMeta() });
  });

  app.get("/api/agents/:id/api-key", (req, res) => {
    const agentId = String(req.params.id ?? "").trim();
    if (!agentId) return res.status(400).json({ error: "agent id required" });
    if (isChiefId(agentId)) return res.status(400).json({ error: "Chief has no agent API key" });
    if (!agentExists(agentId)) return res.status(404).json({ error: "unknown agent" });
    const rec = getAgentApiKeyRecord(agentId);
    if (!rec) return res.json({ configured: false });
    res.json({
      configured: true,
      last4: rec.last4,
      createdAt: rec.createdAt,
      scopes: normalizeApiKeyScopes(rec.scopes),
    });
  });

  app.post("/api/agents/:id/api-key", (req, res) => {
    const agentId = String(req.params.id ?? "").trim();
    if (!agentId) return res.status(400).json({ error: "agent id required" });
    if (isChiefId(agentId)) return res.status(400).json({ error: "Chief has no agent API key" });
    if (!agentExists(agentId)) return res.status(404).json({ error: "unknown agent" });
    const scopes = parseScopesBody(req.body);
    const token = `asi_${agentId.slice(0, 12)}_${randomBytes(18).toString("base64url")}`;
    const rec = setAgentApiKey(agentId, token, scopes);
    res.status(201).json({
      configured: true,
      token,
      last4: rec.last4,
      createdAt: rec.createdAt,
      scopes: normalizeApiKeyScopes(rec.scopes),
      hint: "Store this token now — it is not shown again. Scopes: chat (POST chat), tasks:read (GET tasks).",
    });
  });

  app.delete("/api/agents/:id/api-key", (req, res) => {
    const agentId = String(req.params.id ?? "").trim();
    if (!agentId) return res.status(400).json({ error: "agent id required" });
    const ok = clearAgentApiKey(agentId);
    if (!ok) return res.status(404).json({ error: "no key configured" });
    res.json({ ok: true, configured: false });
  });
}
