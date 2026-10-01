#!/usr/bin/env node
/**
 * Thin setup: check Node, npm install workspaces, optional Ollama probe.
 * Usage: npm run setup
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MIN_NODE_MAJOR = 20;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function section(title) {
  console.log(`\n==> ${title}`);
}

function fail(msg) {
  console.error(`\nsetup failed: ${msg}`);
  process.exit(1);
}

section("Node version");
const major = Number(process.versions.node.split(".")[0]);
console.log(`node ${process.version} (${process.platform}/${process.arch})`);
if (!Number.isFinite(major) || major < MIN_NODE_MAJOR) {
  fail(`Node >= ${MIN_NODE_MAJOR} required (found ${process.version})`);
}

section("npm install (workspaces)");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const install = spawnSync(npmCmd, ["install"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});
if (install.status !== 0) {
  fail(`npm install exited ${install.status}`);
}

section("Ollama (optional)");
const ollamaHost = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(/\/$/, "");
try {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 2500);
  const res = await fetch(`${ollamaHost}/api/tags`, { signal: ac.signal });
  clearTimeout(t);
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    const n = Array.isArray(data.models) ? data.models.length : 0;
    console.log(`reachable at ${ollamaHost} (${n} model tag(s))`);
  } else {
    console.log(`HTTP ${res.status} from ${ollamaHost} — chat needs Ollama, llama.cpp, or Connections keys`);
  }
} catch {
  console.log(`not reachable at ${ollamaHost} — install Ollama or set cloud keys later (Chief fails closed without a backend)`);
}

section("Next steps");
console.log(`  cd "${root}"`);
console.log("  npm run build");
console.log("  npm run start    # http://127.0.0.1:3445");
console.log("  Docs: docs/DEPLOY.md · docs/FEATURE-FLAGS.md · docs/KEEP-ALIVE.md");
console.log("\nsetup ok");
