#!/usr/bin/env node
/**
 * One-time local install of ship AMS routers (Micro 70M + Hybrid 120M).
 *
 * Downloads available weights from Hugging Face into models/ams/:
 *   1. Prefer `.gguf` when published
 *   2. Else place matching `.onnx` (HF currently publishes ONNX for Micro)
 *
 * Matching ONNX / GGUF marks status installed. Never fakes installs.
 * Product ONNX basenames: ams-micro-70m.onnx + ams-hybrid-120m.onnx (HF may still list training names; install renames to product).
 *
 * Usage:
 *   node scripts/install-ams-models.mjs
 *   node scripts/install-ams-models.mjs --id ams-micro-70m
 *   node scripts/install-ams-models.mjs --json
 *
 * Auth (gated HF repos):
 *   set HF_TOKEN or HUGGING_FACE_HUB_TOKEN, or run `hf auth login`
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const amsDir = path.join(repoRoot, "models", "ams");
const catalogPath = path.join(amsDir, "catalog.json");
const cacheDir = path.join(repoRoot, "models", "ams", ".hf-cache");

/** Ship-default AMS routers (advanced recipes stay hidden unless ASI_AMS_SHOW_ADVANCED=1). */
const SHIP_DEFAULTS = [
  {
    id: "ams-micro-70m",
    hfRepo: "vvarghese/ams-micro-70m",
    suggestedFileName: "ams-micro-70m-q4_k_m.gguf",
    suggestedOnnxFileName: "ams-micro-70m.onnx",
    hfPage: "https://huggingface.co/vvarghese/ams-micro-70m",
  },
  {
    id: "ams-hybrid-120m",
    hfRepo: "vvarghese/ams-hybrid-120m",
    suggestedFileName: "ams-hybrid-120m-q4_k_m.gguf",
    suggestedOnnxFileName: "ams-hybrid-120m.onnx",
    hfPage: "https://huggingface.co/vvarghese/ams-hybrid-120m",
  },
];

function parseArgs(argv) {
  const out = { id: null, json: false, help: false, all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--id") out.id = argv[++i] ?? null;
    else if (a === "--json") out.json = true;
    else if (a === "--all") out.all = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function hfToken() {
  return (
    process.env.HF_TOKEN?.trim() ||
    process.env.HUGGING_FACE_HUB_TOKEN?.trim() ||
    process.env.HUGGINGFACE_HUB_TOKEN?.trim() ||
    ""
  );
}

function loadCatalogItems() {
  const raw = fs.readFileSync(catalogPath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.items) ? parsed.items : [];
}

function listByExt(dir, ext) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(ext))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function hintsFor(item, { onnx = false } = {}) {
  const base = [item.id, ...(item.weightHints ?? [])].map((h) => String(h).toLowerCase()).filter(Boolean);
  if (!onnx) return base;
  const extra = (item.onnxWeightHints ?? []).map((h) => String(h).toLowerCase()).filter(Boolean);
  return Array.from(new Set([...base, ...extra]));
}

function findMatch(item, amsGgufs, amsOnnxs) {
  const ggufHints = hintsFor(item, { onnx: false });
  for (const full of amsGgufs) {
    const name = path.basename(full).toLowerCase();
    if (ggufHints.some((h) => name.includes(h))) {
      return { file: path.basename(full), dir: "ams", format: "gguf" };
    }
  }
  const onnxHints = hintsFor(item, { onnx: true });
  for (const full of amsOnnxs) {
    const name = path.basename(full).toLowerCase();
    if (onnxHints.some((h) => name.includes(h))) {
      return { file: path.basename(full), dir: "ams", format: "onnx" };
    }
  }
  return null;
}

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "user-agent": "asi-agents-install-ams", ...headers } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        requestJson(res.headers.location, headers).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
  });
}

function downloadToFile(url, dest, headers = {}) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "user-agent": "asi-agents-install-ams", ...headers } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadToFile(res.headers.location, dest, headers).then(resolve, reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          reject(new Error(`HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString("utf8").slice(0, 240)}`));
        });
        return;
      }
      const tmp = `${dest}.partial`;
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on("finish", () => {
        out.close(() => {
          fs.renameSync(tmp, dest);
          resolve(dest);
        });
      });
      out.on("error", reject);
    });
    req.on("error", reject);
  });
}

async function listRepoFiles(repo, token) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const url = `https://huggingface.co/api/models/${repo}/tree/main`;
  const tree = await requestJson(url, headers);
  if (!Array.isArray(tree)) return [];
  return tree.filter((e) => e && e.type === "file" && typeof e.path === "string").map((e) => e.path);
}

function tryHfCliDownload(repo, destDir, includeGlobs) {
  const bin = process.platform === "win32" ? "hf.cmd" : "hf";
  const args = ["download", repo, "--local-dir", destDir];
  for (const g of includeGlobs) {
    args.push("--include", g);
  }
  const env = { ...process.env };
  const token = hfToken();
  if (token) env.HF_TOKEN = token;
  const r = spawnSync(bin, args, { encoding: "utf8", env, shell: process.platform === "win32" });
  if (r.error && r.error.code === "ENOENT") {
    return { ok: false, error: "hf CLI not found (optional — HTTPS fallback used)" };
  }
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "").trim().slice(0, 400);
    return { ok: false, error: err || `hf download exit ${r.status}` };
  }
  return { ok: true };
}

function collectLocalByExt(dir, ext) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.toLowerCase().endsWith(ext)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function pickRemote(files, ship, preferredBasename) {
  const preferred = preferredBasename?.toLowerCase();
  if (preferred) {
    const exact = files.find((p) => path.basename(p).toLowerCase() === preferred);
    if (exact) return exact;
  }
  const idCompact = ship.id.replace(/-/g, "");
  return (
    files.find((p) => path.basename(p).toLowerCase().includes(ship.id.toLowerCase())) ||
    files.find((p) => path.basename(p).toLowerCase().replace(/-/g, "").includes(idCompact)) ||
    files[0]
  );
}

async function fetchRemoteFile(ship, remote, destName, token, includeGlobs) {
  const authHeaders = token ? { authorization: `Bearer ${token}` } : {};
  const repoCache = path.join(cacheDir, ship.id);
  fs.mkdirSync(repoCache, { recursive: true });

  const cli = tryHfCliDownload(ship.hfRepo, repoCache, includeGlobs);
  const ext = destName.toLowerCase().endsWith(".onnx") ? ".onnx" : ".gguf";
  let local = collectLocalByExt(repoCache, ext).find(
    (f) => path.basename(f).toLowerCase() === path.basename(remote).toLowerCase()
  ) || collectLocalByExt(repoCache, ext)[0];

  if (!local) {
    const url = `https://huggingface.co/${ship.hfRepo}/resolve/main/${remote}`;
    const tmp = path.join(repoCache, path.basename(remote));
    await downloadToFile(url, tmp, authHeaders);
    local = tmp;
  }

  const destPath = path.join(amsDir, destName);
  fs.copyFileSync(local, destPath);
  return {
    destName,
    note: `placed ${destName} from ${ship.hfRepo}/${remote}${cli.ok ? " (hf cli)" : ""}`,
    cliError: cli.ok ? undefined : cli.error,
  };
}

async function installOne(ship, catalogItem, token) {
  const result = {
    id: ship.id,
    name: catalogItem?.name ?? ship.id,
    hfRepo: ship.hfRepo,
    hfPage: ship.hfPage,
    suggestedFileName: catalogItem?.suggestedFileName || ship.suggestedFileName,
    suggestedOnnxFileName: catalogItem?.suggestedOnnxFileName || ship.suggestedOnnxFileName,
    status: "recipe",
    matchedFile: undefined,
    weightFormat: undefined,
    downloaded: false,
    error: undefined,
    note: undefined,
  };

  fs.mkdirSync(amsDir, { recursive: true });
  const amsGgufs = listByExt(amsDir, ".gguf");
  const amsOnnxs = listByExt(amsDir, ".onnx");
  const existing = catalogItem ? findMatch(catalogItem, amsGgufs, amsOnnxs) : null;
  if (existing) {
    result.status = "installed";
    result.matchedFile = existing.file;
    result.weightFormat = existing.format;
    result.note =
      existing.format === "onnx"
        ? `already on disk (ONNX — not GGUF; reference router still Ollama/llama.cpp)`
        : "already on disk (GGUF)";
    return result;
  }

  let files = [];
  try {
    files = await listRepoFiles(ship.hfRepo, token);
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    result.note =
      "HF tree list failed (gated repo needs HF_TOKEN + access approval, or network error). Open the model page, accept access, set HF_TOKEN, re-run.";
    return result;
  }

  const ggufs = files.filter((p) => p.toLowerCase().endsWith(".gguf"));
  const onnx = files.filter((p) => p.toLowerCase().endsWith(".onnx"));

  if (ggufs.length === 0 && onnx.length === 0) {
    result.note =
      "HF repo has no .gguf or .onnx weights listed yet. Status stays recipe until weights are published or you place one manually.";
    result.error = "no_weights_on_hf";
    return result;
  }

  try {
    if (ggufs.length > 0) {
      const destName = catalogItem?.suggestedFileName || ship.suggestedFileName;
      const remote = pickRemote(ggufs, ship, destName);
      const placed = await fetchRemoteFile(ship, remote, destName, token, ["*.gguf", path.basename(remote)]);
      result.downloaded = true;
      result.status = "installed";
      result.matchedFile = placed.destName;
      result.weightFormat = "gguf";
      result.note = placed.note;
      return result;
    }

    // ONNX path — place under product suggestedOnnxFileName; remote may still use training basename
    const preferredOnnx =
      catalogItem?.suggestedOnnxFileName || ship.suggestedOnnxFileName || path.basename(onnx[0]);
    const legacyHints = (catalogItem?.onnxWeightHints ?? [])
      .map((h) => String(h).toLowerCase())
      .filter(Boolean);
    const remoteExact =
      onnx.find((p) => path.basename(p).toLowerCase() === preferredOnnx.toLowerCase()) ||
      onnx.find((p) => legacyHints.some((h) => path.basename(p).toLowerCase().includes(h))) ||
      pickRemote(onnx, ship, preferredOnnx);
    const remote = path.basename(remoteExact);
    const destName = preferredOnnx;
    const placed = await fetchRemoteFile(ship, remote, destName, token, ["*.onnx", remote]);
    result.downloaded = true;
    result.status = "installed";
    result.matchedFile = placed.destName;
    result.weightFormat = "onnx";
    result.note = `${placed.note} · ONNX on disk (not GGUF). Select enabled; :7821 reference router does not load ONNX yet.`;
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.error = msg;
    const listed = [...ggufs, ...onnx].map((p) => path.basename(p)).join(", ");
    const needsAuth = /401|403|restricted|gated|authentication/i.test(msg);
    result.note = needsAuth
      ? `HF lists weights (${listed}) but download needs HF_TOKEN + repo access. Set HF_TOKEN or HUGGING_FACE_HUB_TOKEN, accept access on ${ship.hfPage}, re-run.`
      : `Download failed for ${listed || "weights"}. Gated repos need HF_TOKEN + access. Large LFS files may need the \`hf\` CLI.`;
    return result;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Install ship AMS weights (GGUF preferred, else ONNX) into models/ams/

  node scripts/install-ams-models.mjs
  node scripts/install-ams-models.mjs --id ams-micro-70m
  node scripts/install-ams-models.mjs --json

Requires HF access for gated repos (HF_TOKEN or hf auth login).
Matching .gguf or .onnx marks installed — never claims GGUF when only ONNX is present.
`);
    process.exit(0);
  }

  if (!fs.existsSync(catalogPath)) {
    console.error(`Missing catalog: ${catalogPath}`);
    process.exit(1);
  }

  const items = loadCatalogItems();
  const byId = new Map(items.map((i) => [i.id, i]));
  const targets = args.id
    ? SHIP_DEFAULTS.filter((s) => s.id === args.id)
    : SHIP_DEFAULTS;

  if (targets.length === 0) {
    console.error(`Unknown ship id: ${args.id}`);
    process.exit(1);
  }

  const token = hfToken();
  const results = [];
  for (const ship of targets) {
    const row = await installOne(ship, byId.get(ship.id), token);
    results.push(row);
  }

  const amsGgufs = listByExt(amsDir, ".gguf");
  const amsOnnxs = listByExt(amsDir, ".onnx");
  const visible = args.all
    ? items
    : items.filter((i) => i.advanced !== true);
  const probe = visible.map((item) => {
    const match = findMatch(item, amsGgufs, amsOnnxs);
    return {
      id: item.id,
      name: item.name,
      status: match ? "installed" : "recipe",
      matchedFile: match?.file,
      weightFormat: match?.format,
    };
  });

  const installedCount = probe.filter((p) => p.status === "installed").length;
  const recipeCount = probe.length - installedCount;

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          amsDir,
          tokenPresent: Boolean(token),
          results,
          probe,
          installedCount,
          recipeCount,
          installedGgufFiles: amsGgufs.length,
          installedOnnxFiles: amsOnnxs.length,
        },
        null,
        2
      )
    );
  } else {
    console.log(`AMS ship install → ${amsDir}`);
    console.log(`HF token: ${token ? "present" : "missing (gated repos will 401)"}`);
    console.log("");
    for (const r of results) {
      console.log(`[${r.status.padEnd(9)}] ${r.id}`);
      if (r.matchedFile) {
        console.log(`  matched: ${r.matchedFile}${r.weightFormat ? ` (${r.weightFormat})` : ""}`);
      }
      if (r.note) console.log(`  ${r.note}`);
      if (r.error) console.log(`  error: ${r.error}`);
      console.log(`  page: ${r.hfPage}`);
      console.log("");
    }
    console.log(
      `Summary: ${installedCount} installed · ${recipeCount} recipe(s) · ${amsGgufs.length} .gguf · ${amsOnnxs.length} .onnx in models/ams`
    );
    console.log("Verify: node scripts/verify-ams-gguf.mjs");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
