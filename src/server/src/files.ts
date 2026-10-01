/**
 * Local-first file manager — browse uploads / user files under the ASI data dir.
 * No fake cloud. Path traversal blocked.
 */
import fs from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import { dataDir } from "./paths.js";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ROOTS = ["files", "uploads"] as const;
type RootId = (typeof ROOTS)[number];

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  mtime: string;
}

function ensureRoots(): void {
  for (const r of ROOTS) {
    fs.mkdirSync(path.join(dataDir(), r), { recursive: true });
  }
}

function isRoot(v: string): v is RootId {
  return (ROOTS as readonly string[]).includes(v);
}

/** Resolve a relative path under a sandbox root; null if escape attempted. */
function resolveSafe(root: RootId, relPath: string): string | null {
  ensureRoots();
  const rootAbs = path.resolve(path.join(dataDir(), root));
  const cleaned = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned.includes("..") || cleaned.includes("\0")) return null;
  const abs = path.resolve(path.join(rootAbs, cleaned));
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) return null;
  return abs;
}

function toRel(root: RootId, abs: string): string {
  const rootAbs = path.resolve(path.join(dataDir(), root));
  const rel = path.relative(rootAbs, abs).replace(/\\/g, "/");
  return rel === "" ? "" : rel;
}

function listDir(root: RootId, relPath: string): FileEntry[] | { error: string } {
  const abs = resolveSafe(root, relPath);
  if (!abs) return { error: "invalid_path" };
  if (!fs.existsSync(abs)) return { error: "not_found" };
  const st = fs.statSync(abs);
  if (!st.isDirectory()) return { error: "not_a_directory" };
  const names = fs.readdirSync(abs);
  const out: FileEntry[] = [];
  for (const name of names) {
    if (name === "." || name === "..") continue;
    const childAbs = path.join(abs, name);
    let childSt: fs.Stats;
    try {
      childSt = fs.statSync(childAbs);
    } catch {
      continue;
    }
    out.push({
      name,
      path: toRel(root, childAbs),
      type: childSt.isDirectory() ? "dir" : "file",
      size: childSt.isFile() ? childSt.size : 0,
      mtime: childSt.mtime.toISOString(),
    });
  }
  out.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export function mountFileManagerRoutes(app: Express): void {
  ensureRoots();

  app.get("/api/files/status", (_req, res) => {
    ensureRoots();
    res.json({
      roots: ROOTS.map((id) => ({
        id,
        label: id === "files" ? "My files" : "Uploads & artifacts",
        path: path.join(dataDir(), id),
      })),
      dataDir: dataDir(),
      maxUploadBytes: MAX_UPLOAD_BYTES,
      note: "Local-only under the ASI data directory. No cloud sync.",
    });
  });

  app.get("/api/files/list", (req, res) => {
    const rootRaw = typeof req.query.root === "string" ? req.query.root.trim() : "files";
    const rel = typeof req.query.path === "string" ? req.query.path.trim() : "";
    if (!isRoot(rootRaw)) return res.status(400).json({ error: "invalid_root" });
    const listed = listDir(rootRaw, rel);
    if (!Array.isArray(listed)) {
      return res.status(listed.error === "not_found" ? 404 : 400).json(listed);
    }
    res.json({ root: rootRaw, path: rel, entries: listed });
  });

  app.get("/api/files/download", (req, res) => {
    const rootRaw = typeof req.query.root === "string" ? req.query.root.trim() : "files";
    const rel = typeof req.query.path === "string" ? req.query.path.trim() : "";
    if (!isRoot(rootRaw) || !rel) return res.status(400).json({ error: "root and path required" });
    const abs = resolveSafe(rootRaw, rel);
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      return res.status(404).json({ error: "not_found" });
    }
    res.download(abs, path.basename(abs));
  });

  app.post("/api/files/mkdir", (req, res) => {
    const rootRaw = String(req.body?.root ?? "files").trim();
    const rel = String(req.body?.path ?? "").trim();
    const name = String(req.body?.name ?? "").trim();
    if (!isRoot(rootRaw) || !name || name.includes("/") || name.includes("\\") || name.includes("..")) {
      return res.status(400).json({ error: "invalid_name" });
    }
    const parent = resolveSafe(rootRaw, rel);
    if (!parent) return res.status(400).json({ error: "invalid_path" });
    const dest = resolveSafe(rootRaw, path.posix.join(rel.replace(/\\/g, "/"), name));
    if (!dest) return res.status(400).json({ error: "invalid_path" });
    fs.mkdirSync(dest, { recursive: true });
    res.status(201).json({ ok: true, path: toRel(rootRaw, dest) });
  });

  app.post("/api/files/upload", (req: Request, res: Response) => {
    const rootRaw = String(req.body?.root ?? "files").trim();
    const rel = String(req.body?.path ?? "").trim();
    const name = String(req.body?.name ?? "").trim();
    const dataBase64 = String(req.body?.dataBase64 ?? "");
    if (!isRoot(rootRaw) || !name || name.includes("..") || name.includes("/") || name.includes("\\")) {
      return res.status(400).json({ error: "invalid_name" });
    }
    if (!dataBase64) return res.status(400).json({ error: "dataBase64 required" });
    let buf: Buffer;
    try {
      buf = Buffer.from(dataBase64, "base64");
    } catch {
      return res.status(400).json({ error: "invalid_base64" });
    }
    if (buf.byteLength > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: "too_large", maxBytes: MAX_UPLOAD_BYTES });
    }
    const parent = resolveSafe(rootRaw, rel);
    if (!parent) return res.status(400).json({ error: "invalid_path" });
    fs.mkdirSync(parent, { recursive: true });
    const dest = resolveSafe(rootRaw, path.posix.join(rel.replace(/\\/g, "/"), name));
    if (!dest) return res.status(400).json({ error: "invalid_path" });
    fs.writeFileSync(dest, buf);
    res.status(201).json({
      ok: true,
      path: toRel(rootRaw, dest),
      size: buf.byteLength,
    });
  });

  app.delete("/api/files", (req, res) => {
    const rootRaw = String(req.body?.root ?? req.query.root ?? "files").trim();
    const rel = String(req.body?.path ?? req.query.path ?? "").trim();
    if (!isRoot(rootRaw) || !rel) return res.status(400).json({ error: "root and path required" });
    const abs = resolveSafe(rootRaw, rel);
    if (!abs || !fs.existsSync(abs)) return res.status(404).json({ error: "not_found" });
    const rootAbs = path.resolve(path.join(dataDir(), rootRaw));
    if (abs === rootAbs) return res.status(400).json({ error: "cannot_delete_root" });
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      fs.rmSync(abs, { recursive: true, force: true });
    } else {
      fs.unlinkSync(abs);
    }
    res.json({ ok: true });
  });
}
