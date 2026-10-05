#!/usr/bin/env node
/** @deprecated Use scripts/verify-ams.mjs or `npm run verify:ams`. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [path.join(here, "verify-ams.mjs"), ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
