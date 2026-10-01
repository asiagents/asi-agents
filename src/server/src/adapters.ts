import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Express } from "express";
import { isSingleSkillRunEnabled } from "./ams.js";
import {
  createAdapter,
  deleteAdapter,
  getAdapter,
  listAdapters,
  patchAdapter,
} from "./store.js";
import type { AdapterEntry, AdapterKind } from "./types.js";

const execFileAsync = promisify(execFile);

const INVOKE_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_CHARS = 32_000;
/** Reject shell metacharacters in the executable token (argv[0] only — never shell:true). */
const SHELL_META = /[&|;`$<>(){}!\n\r]/;

function publicAdapter(a: AdapterEntry): AdapterEntry {
  return { ...a, args: a.args ? [...a.args] : undefined };
}

function validateHttpUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function validateCommand(raw: string): string | null {
  const s = raw.trim();
  if (!s || s.length > 512) return null;
  if (SHELL_META.test(s)) return null;
  return s;
}

function validateArgs(raw: unknown): string[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item);
    if (s.length > 2048) return null;
    if (SHELL_META.test(s)) return null;
    out.push(s);
  }
  return out;
}

function parseKind(raw: unknown): AdapterKind | null {
  const k = String(raw ?? "").trim().toLowerCase();
  if (k === "subprocess" || k === "http") return k;
  return null;
}

function validateCreateBody(body: unknown):
  | { ok: true; name: string; kind: AdapterKind; command?: string; args?: string[]; url?: string; enabled: boolean }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body required" };
  const o = body as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  if (!name) return { ok: false, error: "name required" };
  const kind = parseKind(o.kind);
  if (!kind) return { ok: false, error: "kind must be subprocess or http" };
  const enabled = o.enabled === true;
  if (kind === "subprocess") {
    const command = validateCommand(String(o.command ?? ""));
    if (!command) {
      return {
        ok: false,
        error: "subprocess requires a safe command (executable path/name; no shell metacharacters)",
      };
    }
    const args = validateArgs(o.args);
    if (args == null) return { ok: false, error: "args must be a string array without shell metacharacters" };
    return { ok: true, name, kind, command, args, enabled };
  }
  const url = validateHttpUrl(String(o.url ?? ""));
  if (!url) return { ok: false, error: "http adapter requires a valid http(s) URL" };
  return { ok: true, name, kind, url, enabled };
}

async function invokeSubprocess(
  entry: AdapterEntry,
  input: string
): Promise<{ ok: true; stdout: string; stderr: string; exitCode: number | null } | { ok: false; error: string }> {
  const command = entry.command?.trim();
  if (!command || !validateCommand(command)) {
    return { ok: false, error: "adapter command invalid" };
  }
  const args = [...(entry.args ?? [])];
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: INVOKE_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 256 * 1024,
      encoding: "utf8",
      // Never shell —argv only. stdin via env not used; pass input as final arg when non-empty.
      shell: false,
      env: {
        ...process.env,
        ASI_ADAPTER_INPUT: input.slice(0, 8_000),
      },
    });
    return {
      ok: true,
      stdout: String(stdout ?? "").slice(0, MAX_OUTPUT_CHARS),
      stderr: String(stderr ?? "").slice(0, MAX_OUTPUT_CHARS),
      exitCode: 0,
    };
  } catch (e) {
    const err = e as {
      code?: string | number;
      killed?: boolean;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    if (err.killed || err.code === "ETIMEDOUT") {
      return { ok: false, error: `subprocess timed out after ${INVOKE_TIMEOUT_MS}ms` };
    }
    const stdout = String(err.stdout ?? "").slice(0, MAX_OUTPUT_CHARS);
    const stderr = String(err.stderr ?? err.message ?? "subprocess failed").slice(0, MAX_OUTPUT_CHARS);
    const exitCode = typeof err.code === "number" ? err.code : null;
    // Non-zero exit still returns captured output (fail-closed on spawn errors only).
    if (stdout || stderr) {
      return { ok: true, stdout, stderr, exitCode };
    }
    return { ok: false, error: stderr || "subprocess failed" };
  }
}

async function invokeHttp(
  entry: AdapterEntry,
  input: string
): Promise<{ ok: true; status: number; body: string } | { ok: false; error: string }> {
  const url = entry.url ? validateHttpUrl(entry.url) : null;
  if (!url) return { ok: false, error: "adapter URL invalid" };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), INVOKE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/plain, */*" },
      body: JSON.stringify({ input: input.slice(0, 8_000), adapterId: entry.id, adapterName: entry.name }),
      signal: ac.signal,
    });
    const text = (await res.text()).slice(0, MAX_OUTPUT_CHARS);
    return { ok: true, status: res.status, body: text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "HTTP invoke failed";
    if (ac.signal.aborted) return { ok: false, error: `HTTP timed out after ${INVOKE_TIMEOUT_MS}ms` };
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Allowlisted adapter registry + sandboxed invoke (gated by AMS skill-run flag). */
export function mountAdapterRoutes(app: Express): void {
  app.get("/api/adapters", (_req, res) => {
    res.json({
      adapters: listAdapters().map(publicAdapter),
      shipped: true,
      invokeGatedBy: "ASI_AMS_SKILL_RUN",
      singleSkillRunEnabled: isSingleSkillRunEnabled(),
      note:
        "Allowlisted subprocess/HTTP adapters only. Invoke requires AMS skill-run gate. No arbitrary shell from chat.",
    });
  });

  app.post("/api/adapters", (req, res) => {
    const parsed = validateCreateBody(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const adapter = createAdapter({
      name: parsed.name,
      kind: parsed.kind,
      command: parsed.command,
      args: parsed.args,
      url: parsed.url,
      enabled: parsed.enabled,
    });
    res.status(201).json({ adapter: publicAdapter(adapter) });
  });

  app.patch("/api/adapters/:id", (req, res) => {
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "id required" });
    const existing = getAdapter(id);
    if (!existing) return res.status(404).json({ error: "not found" });

    const patch: Parameters<typeof patchAdapter>[1] = {};
    if (req.body?.name != null) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: "name must not be empty" });
      patch.name = name;
    }
    if (req.body?.enabled != null) patch.enabled = Boolean(req.body.enabled);

    const nextKind = req.body?.kind != null ? parseKind(req.body.kind) : existing.kind;
    if (req.body?.kind != null) {
      if (!nextKind) return res.status(400).json({ error: "kind must be subprocess or http" });
      patch.kind = nextKind;
    }

    const kind = nextKind ?? existing.kind;
    if (kind === "subprocess") {
      if (req.body?.command != null || req.body?.kind != null) {
        const command = validateCommand(String(req.body?.command ?? existing.command ?? ""));
        if (!command) {
          return res.status(400).json({
            error: "subprocess requires a safe command (no shell metacharacters)",
          });
        }
        patch.command = command;
        patch.clearUrl = true;
      }
      if (req.body?.args != null) {
        const args = validateArgs(req.body.args);
        if (args == null) return res.status(400).json({ error: "args must be a safe string array" });
        patch.args = args;
      }
    } else {
      if (req.body?.url != null || req.body?.kind != null) {
        const url = validateHttpUrl(String(req.body?.url ?? existing.url ?? ""));
        if (!url) return res.status(400).json({ error: "http adapter requires a valid http(s) URL" });
        patch.url = url;
        patch.clearCommand = true;
        patch.clearArgs = true;
      }
    }

    const adapter = patchAdapter(id, patch);
    if (!adapter) return res.status(404).json({ error: "not found" });
    res.json({ adapter: publicAdapter(adapter) });
  });

  app.delete("/api/adapters/:id", (req, res) => {
    const ok = deleteAdapter(req.params.id);
    if (!ok) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  });

  app.post("/api/adapters/:id/invoke", async (req, res) => {
    if (!isSingleSkillRunEnabled()) {
      return res.status(501).json({
        error:
          "Adapter invoke is disabled until AMS skill-run is enabled. Set ASI_AMS_SKILL_RUN=1 (or unset in non-production).",
        code: "ams_skill_run_disabled",
      });
    }

    const id = String(req.params.id ?? "").trim();
    const entry = getAdapter(id);
    if (!entry) return res.status(404).json({ error: "not found" });
    if (!entry.enabled) {
      return res.status(403).json({ error: "adapter disabled — enable in Settings before invoke", code: "adapter_disabled" });
    }

    // Fail-closed: invoke only the allowlisted target; ignore any client-supplied command/url.
    const input = String(req.body?.input ?? req.body?.text ?? "").trim();

    if (entry.kind === "subprocess") {
      const result = await invokeSubprocess(entry, input);
      if (!result.ok) return res.status(502).json({ error: result.error, code: "invoke_failed" });
      patchAdapter(id, { lastInvokedAt: new Date().toISOString() });
      return res.json({
        adapterId: id,
        kind: "subprocess",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        note: "Allowlisted argv execFile only — not chat shell.",
      });
    }

    const result = await invokeHttp(entry, input);
    if (!result.ok) return res.status(502).json({ error: result.error, code: "invoke_failed" });
    patchAdapter(id, { lastInvokedAt: new Date().toISOString() });
    res.json({
      adapterId: id,
      kind: "http",
      status: result.status,
      body: result.body,
      note: "POST to allowlisted URL only — not chat shell.",
    });
  });
}
