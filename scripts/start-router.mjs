/**
 * Start the loopback SLM router on :7821 when models/router artifacts exist.
 * Does not claim ready if the process cannot start — exits non-zero when missing.
 *
 * Usage: npm run start:router
 * Completions still need Ollama and/or LLAMA_CPP_HOST / OPENAI_BASE_URL.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routerDir = path.join(root, "models", "router");
const indexMjs = path.join(routerDir, "index.mjs");
const pkgJson = path.join(routerDir, "package.json");

function hasArtifacts() {
  return fs.existsSync(pkgJson) || fs.existsSync(indexMjs);
}

if (!hasArtifacts()) {
  console.error(
    "Router artifacts missing under models/router/ (need package.json and/or index.mjs)."
  );
  console.error("See models/router/README.md — refusing to fake a live router.");
  process.exit(1);
}

if (!fs.existsSync(indexMjs)) {
  console.error(
    "models/router/package.json present but index.mjs missing — drop a real engine binary or keep the reference proxy."
  );
  process.exit(1);
}

const host = process.env.ASI_ROUTER_HOST ?? "127.0.0.1";
const port = process.env.ASI_ROUTER_PORT ?? "7821";
console.log(`Starting reference SLM router → http://${host}:${port}`);
console.log("(Completions need Ollama and/or LLAMA_CPP_HOST / OPENAI_BASE_URL.)");

const child = spawn(process.execPath, [indexMjs], {
  cwd: routerDir,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Router exited on signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
