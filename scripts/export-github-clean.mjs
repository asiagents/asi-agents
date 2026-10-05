#!/usr/bin/env node
/**
 * Build a GitHub-safe sibling of the Corp Pre Release package.
 *
 * GitHub repo  = clean source (no multi-hundred-MB ONNX)
 * Release zip  = full Snapdragon package WITH AMS + virtual-computer (Desk)
 *                (AMS Micro, or both Micro+Hybrid when already bundled)
 *                (e.g. ASI-Agents-v0.1-Pre-Release-Snapdragon.zip)
 *
 * Usage: node scripts/export-github-clean.mjs
 *        npm run export:github-clean
 *
 * Output:
 *   <package path>/ASI Agents v0.1 Pre Release-github-clean/
 *   (+ GITHUB-UPLOAD.md inside that folder)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { patchShipTree } from "./export-ship-filters.mjs";
import {
  scrubLegacyBrand,
  scrubAiVendors,
  hasLegacyBrand,
  hasForbiddenAiVendor,
  hasNeverBrandNote,
} from "./export-privacy-scrub.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORP_ROOT = path.join("D:", "ASI Agent Corp");
const SOURCE_STAGE = path.join(ROOT, "releases", "staging", "ASI-Agents-v0.1-Pre-Release");
const DEST_NAME = "ASI Agents v0.1 Pre Release-github-clean";
const DEST = path.join(CORP_ROOT, DEST_NAME);
const SNAPDRAGON_ZIP = "ASI-Agents-v0.1-Pre-Release-Snapdragon.zip";
const CLEAN_ZIP_NAME = "ASI-Agents-v0.1-github-clean.zip";
const CLEAN_ZIP = path.join(CORP_ROOT, CLEAN_ZIP_NAME);

const TEXT_SANITIZE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".txt",
  ".css",
  ".html",
  ".htm",
  ".svg",
  ".yml",
  ".yaml",
  ".toml",
  ".cmd",
  ".ps1",
  ".bat",
  ".sh",
  ".env",
  ".example",
  ".gitignore",
  ".gitattributes",
  ".dockerignore",
]);

const EXCLUDE_DIR = new Set([
  "node_modules",
  "dist",
  ".git",
  ".cursor",
  "_scratch",
  "agent-transcripts",
  "coverage",
  ".turbo",
  ".hf-cache",
  "games",
  "arcade",
  "archive",
  "mockups",
]);

const EXCLUDE_FILE = new Set([
  ".env",
  "app-state.json",
  "services.json",
  "PRE-RELEASE-MANIFEST.json",
  "qa-chief-10.ps1",
  "seed-test-mode-group.ts",
  "CURSOR_COMPANION_BRIEF.md",
  "CURSOR-BRIEF.md",
  "CHARACTER_LOCK.md",
]);

const EXCLUDE_WEIGHT = /\.(gguf|onnx)$/i;

function log(msg) {
  console.log(msg);
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

const WIN_SEP = String.fromCharCode(92);
const INTERNAL_REPO_ROOT = `D:${WIN_SEP}ASI Agents`;
const INTERNAL_CORP_ROOT = `D:${WIN_SEP}ASI Agent Corp`;

function sanitizeText(text) {
  let out = scrubLegacyBrand(text);
  out = scrubAiVendors(out);
  out = out.replace(/HOST/gi, "HOST");
  out = out.replace(/C:\\\\Users\\\\Computer[^\s`'\")\]]*/gi, "<user home>");
  out = out.replace(/<user home>`'\")\]]*/gi, "<user home>");
  out = out.replace(new RegExp(`${INTERNAL_REPO_ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"), "<repo>");
  out = out.replace(
    new RegExp(`${INTERNAL_CORP_ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\s\`'\")\\]]*`, "gi"),
    "<package path>",
  );
  return out;
}

function shouldSkip(relPosix) {
  const parts = relPosix.split("/");
  for (const part of parts) {
    if (EXCLUDE_DIR.has(part)) return true;
    if (EXCLUDE_FILE.has(part)) return true;
  }
  const base = parts[parts.length - 1] ?? "";
  if (EXCLUDE_WEIGHT.test(base)) return true;
  if (base === ".env" || (/^\.env\./i.test(base) && !/\.env\.example$/i.test(base))) return true;
  if (/CURSOR/i.test(base) && /\.md$/i.test(base)) return true;
  return false;
}

function copyTree(srcDir, destDir, relBase, stats) {
  let entries;
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
    if (shouldSkip(rel)) {
      stats.skipped += 1;
      continue;
    }
    const s = path.join(srcDir, ent.name);
    const d = path.join(destDir, ent.name);
    if (ent.isDirectory()) {
      copyTree(s, d, rel, stats);
    } else if (ent.isFile()) {
      mkdirp(path.dirname(d));
      const ext = path.extname(ent.name).toLowerCase();
      if (TEXT_SANITIZE_EXT.has(ext) || ent.name.endsWith(".env.example")) {
        const raw = fs.readFileSync(s, "utf8");
        const cleaned = sanitizeText(raw);
        fs.writeFileSync(d, cleaned, "utf8");
        stats.bytes += Buffer.byteLength(cleaned, "utf8");
      } else {
        fs.writeFileSync(d, fs.readFileSync(s));
        stats.bytes += fs.statSync(s).size;
      }
      stats.files += 1;
    }
  }
}

/** Overlay live scrubbed source so github-clean picks up latest app code without full corp re-export. */
function overlayLiveSources(stats) {
  const overlays = [
    ["src", "src"],
    ["config", "config"],
    ["modules", "modules"],
  ];
  for (const [fromRel, toRel] of overlays) {
    const from = path.join(ROOT, fromRel);
    const to = path.join(DEST, toRel);
    if (!fs.existsSync(from)) continue;
    log("overlay live: " + fromRel);
    copyTree(from, to, toRel, stats);
  }
}

function brandAndSecretScan(dir) {
  const brandHits = [];
  const secretHits = [];
  const danger =
    /(?:sk-[a-zA-Z0-9]{20,}|OPENAI_API_KEY\s*=\s*['\"]?sk-|ANTHROPIC_API_KEY\s*=\s*['\"]?\S{20,}|hf_[a-zA-Z0-9]{20,}|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY)/;
  function walk(d, rel) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      const abs = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (EXCLUDE_DIR.has(ent.name)) continue;
        walk(abs, r);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (!TEXT_SANITIZE_EXT.has(ext) && !ent.name.endsWith(".env.example")) continue;
        const text = fs.readFileSync(abs, "utf8");
        if (hasLegacyBrand(text)) brandHits.push(`${r} (legacy brand)`);
        if (hasForbiddenAiVendor(text)) brandHits.push(`${r} (forbidden AI vendor)`);
        if (hasNeverBrandNote(text)) brandHits.push(`${r} (never-brand note)`);
        if (danger.test(text)) secretHits.push(r);
      }
    }
  }
  walk(dir, "");
  return { brandHits, secretHits };
}

function writeZip() {
  if (fs.existsSync(CLEAN_ZIP)) fs.unlinkSync(CLEAN_ZIP);
  // Stage zip from parent so the archive root is the folder name
  const r = spawnSync(
    "tar",
    ["-a", "-cf", CLEAN_ZIP, DEST_NAME],
    { cwd: CORP_ROOT, encoding: "utf8", shell: true },
  );
  if (r.status !== 0) {
    // Fallback: PowerShell Compress-Archive
    const ps = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${DEST.replace(/'/g, "''")}' -DestinationPath '${CLEAN_ZIP.replace(/'/g, "''")}' -Force`,
      ],
      { encoding: "utf8" },
    );
    if (ps.status !== 0) {
      console.error(r.stderr || r.stdout || "");
      console.error(ps.stderr || ps.stdout || "");
      throw new Error("Failed to create " + CLEAN_ZIP_NAME);
    }
  }
  const fd = fs.openSync(CLEAN_ZIP, "r");
  const buf = Buffer.alloc(4);
  try {
    fs.readSync(fd, buf, 0, 4, 0);
  } finally {
    fs.closeSync(fd);
  }
  const ok =
    (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) ||
    (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x05 && buf[3] === 0x06);
  if (!ok) {
    throw new Error(`not a zip (magic ${buf.toString("hex")}): ${CLEAN_ZIP}`);
  }
}

function writeText(rel, body) {
  const abs = path.join(DEST, rel);
  mkdirp(path.dirname(abs));
  const ext = path.extname(rel).toLowerCase();
  const out =
    ext === ".cmd" || ext === ".ps1" || ext === ".bat"
      ? body.replace(/\r?\n/g, "\r\n")
      : body;
  fs.writeFileSync(abs, out, "utf8");
}

function writeGithubOverlays() {
  writeText(
    ".gitignore",
    `node_modules/
**/node_modules/
dist/
**/dist/
releases/
*.log
.env
.env.*
!.env.example
!**/.env.example
.DS_Store
app-state.json
services.json
_scratch/
agent-transcripts/
.cursor/
*.pem
coverage/
.turbo/

# Never commit model weights (ship via GitHub Release / Hugging Face)
*.onnx
*.gguf
models/ams/*.onnx
models/ams/*.gguf
models/ams/.hf-cache/
models/custom/*.gguf
models/custom/*.onnx
!models/ams/catalog.json
!models/ams/README.md
!models/ams/PLACE-WEIGHTS-HERE.md
!models/ams/.gitkeep
`,
  );

  writeText(
    ".gitattributes",
    `# Optional Git LFS — enable later with: git lfs install && git lfs track "*.onnx"
# Uncomment if you choose LFS instead of Release assets:
# *.onnx filter=lfs diff=lfs merge=lfs -text
# *.gguf filter=lfs diff=lfs merge=lfs -text
`,
  );

  writeText(
    "README.md",
    `<div align="center">

# ASI Agents

### Local-first desktop AI · Chief + agents on your machine

**Research preview** · **v0.1** · Port **3445** · Snapdragon X ready

</div>

---

Welcome! **ASI Agents** is a local-first app for running work like an executive office — a **Chief of staff** and agents that stay private by default. Local models when you want them, cloud only when you opt in. **No account required to start.**

This repository is the **clean source** tree (safe for \`git push\`). Multi-hundred-MB AMS ONNX weights are **not** in git — get them from a **GitHub Release** asset or Hugging Face.

> **GitHub repo = clean source** · **Release zip = AMS + Virtual Desk (full Snapdragon package)**

Prefer the **Release** zip when you want Desk + AMS without a Hugging Face hunt. This repo stays lean for clone/develop.

## First run

**One click (Windows / Snapdragon):** double-click **\`start-asi.cmd\`**, then open http://127.0.0.1:3445

**Or three commands** (Node **20+**; prefer **ARM64** on Snapdragon X):

\`\`\`powershell
npm.cmd run setup
npm.cmd run build
npm.cmd run start
\`\`\`

### Download AMS weights (required for AMS Select on this clean tree)

Ship pair when present: \`ams-micro-70m.onnx\` + \`ams-hybrid-120m.onnx\` → \`models/ams/\`  
**Minimum for a lean drop:** Micro alone. Release zip includes Micro, or both when already bundled.

\`\`\`powershell
# Option A — from GitHub Release asset (Snapdragon zip = AMS + modules/virtual-computer)
#   Download the Release zip, unzip, copy models\\ams\\*.onnx here
#   OR attach/download ams-micro-70m.onnx (+ hybrid if published) directly

# Option B — Hugging Face (gated; set HF_TOKEN if needed)
npm.cmd run install:ams

# Verify (fail-closed if missing)
.\\scripts\\pull-models.cmd
# or: npm.cmd run verify:ams
\`\`\`

Details: [\`models/ams/PLACE-WEIGHTS-HERE.md\`](models/ams/PLACE-WEIGHTS-HERE.md) · HF: [ams-micro-70m](https://huggingface.co/vvarghese/ams-micro-70m) · [ams-hybrid-120m](https://huggingface.co/vvarghese/ams-hybrid-120m)

Without a chat backend (Ollama, llama.cpp, or cloud keys), Chief returns **503** — expected and fail-closed.

## Modules out of the box

| Module | First-run |
|--------|-----------|
| **Virtual Computer** | Installed in source and **bundled in the Release zip**. Desk on \`:3456\` optional (\`ASI_DESK_REPO\`). Fail-closed offline. |
| **Companion** | **ON** on localhost when unset. |

Games / Arcade are not included. Postgres stays off unless you enable it.

## Updates (patches)

No silent auto-updater. See [\`docs/UPDATES.md\`](docs/UPDATES.md):

- Branches: \`main\` (stable preview) · \`updates\` / version tags (patches)
- Script: \`.\\scripts\\update-asi.cmd\`
- In-app: Settings → Modules → **Check for updates** (opens GitHub Releases)

## Docs in this tree

| File | Role |
|------|------|
| [\`README.md\`](README.md) | Purpose + first-run (this file) |
| [\`LICENSE\`](LICENSE) | MIT |
| [\`GITHUB-RELEASE-NOTES.md\`](GITHUB-RELEASE-NOTES.md) | Paste into GitHub Release description |
| [\`GITHUB-UPLOAD.md\`](GITHUB-UPLOAD.md) | Exact create-repo / push / Release steps |
| [\`PUBLIC-LISTING.md\`](PUBLIC-LISTING.md) | Public visibility · About/topics · HF · listing checklist |
| [\`docs/UPDATES.md\`](docs/UPDATES.md) | Branch + script + in-app update path |
| [\`PRE-RELEASE-CHECKLIST.md\`](PRE-RELEASE-CHECKLIST.md) | Minimal ship checklist |

## License

[\`LICENSE\`](LICENSE) — MIT

---

<div align="center">

**ASI Agents** · research preview · local-first · no account to start

</div>
`,
  );

  // Prefer the living Corp notes so export stays punchy; fall back to embedded draft.
  const corpNotes = path.join(CORP_ROOT, "GITHUB-RELEASE-NOTES.md");
  let releaseNotesBody;
  try {
    releaseNotesBody = fs.readFileSync(corpNotes, "utf8");
  } catch {
    releaseNotesBody = `# ASI Agents v0.1 — Research Preview

**Your local-first multi-agent desk.** A Chief of staff, companions, and a Virtual Desk — running on *your* machine. Private by default. Local models when you want them. Cloud only when you opt in. **No account required to start.**

This is a **research preview**: early, honest, and built for people who want to poke around on real hardware (Snapdragon X / Galaxy Book4 especially). Not a finished product — an invitation to experiment.

---

## Grab the right download

| You want… | Get this… |
|-----------|-----------|
| **Clone / develop** | GitHub **repo** (github-clean source). Lean tree — **no ONNX** in git. |
| **Try it now** | GitHub **Release** asset: **\`${SNAPDRAGON_ZIP}\`** — full Snapdragon drop with **AMS + Virtual Desk** so you do **not** need a Hugging Face hunt to start. |

**Repo push = code.** **Release zip = AMS + Desk ready-to-run package.** Don't mix them up.

---

## What's in the Release zip

Cloners who grab the **Release** asset get **Desk + AMS** without hunting Hugging Face:

| Included | Detail |
|----------|--------|
| **AMS** | At least **ASI AMS Micro 70M** (efficient default). This build ships **both** Micro + Hybrid when already bundled (\`ams-micro-70m.onnx\` + \`ams-hybrid-120m.onnx\` under \`models/ams/\`). |
| **Virtual Computer** | \`modules/virtual-computer\` — Desk / Virtual Desktop included in the zip. |
| **App** | UI + API on port **3445** · Companion (Squari) on localhost · Snapdragon / Windows ARM64–friendly first run |

**github-clean** git push stays lean (source + recipes only). Hugging Face remains optional for weight-only downloads or regenerating AMS later — not required if you unzip the Release.

Arcade / games are out. Postgres stays off unless you turn it on. Keep it light; keep it local.

---

## Fire it up (Windows / Snapdragon)

1. Install **Node.js 20+** (prefer **ARM64** on Snapdragon X).
2. Unzip the **Release** zip somewhere writable (AMS + Desk already inside).
3. Double-click **\`start-asi.cmd\`**, *or* from the package root:

\`\`\`powershell
npm.cmd run setup
npm.cmd run build
npm.cmd run start
\`\`\`

4. Open **http://127.0.0.1:3445** and say hello to Chief.

Cloning the **repo** instead? Same three commands after you place AMS weights in \`models/ams/\` (copy from the Release zip, or Hugging Face). Optional: \`.\\scripts\\pull-models.cmd\` to verify. Without a chat backend yet, Chief returns **503** — fail-closed by design, not a mystery.

---

## Staying current (patches)

Research preview — **no silent auto-updater**. Practical paths for skills / modules / app:

| Path | What to do |
|------|------------|
| **Git branches** | \`main\` = stable preview · \`updates\` (or version tags like \`v0.1.1-pre\`) = patch channel |
| **Script** | \`.\\scripts\\update-asi.cmd\` — pull latest (\`main\` / \`updates\`), optional rebuild, or open Release notes / drop a module zip into \`modules/\` |
| **In-app** | Settings → Modules → **Check for updates** — opens GitHub Releases (honest stub; does not auto-install) |

Details: [\`docs/UPDATES.md\`](docs/UPDATES.md).

---

## Research preview — straight talk

APIs, UI, and defaults will move. Treat this as an early lab build, not production software. Report issues kindly. Secrets never ship in the zip or the repo.

Welcome aboard. Open \`:3445\` and see what a local multi-agent desk feels like.

---

**ASI Agents** · local-first · transparent handoffs · research preview · no account to start
`;
  }
  writeText("GITHUB-RELEASE-NOTES.md", releaseNotesBody);

  writeText(
    "docs/UPDATES.md",
    `# Updates & patches (research preview)

ASI Agents does **not** ship a silent auto-updater. This document is the honest update path for skills, modules, and the app.

## Branch / tag strategy

| Ref | Role |
|-----|------|
| \`main\` | Stable research-preview line — what most cloners should track |
| \`updates\` | Optional patch channel (skills / modules / app fixes ahead of a tagged release) |
| Tags (\`v0.1.0-pre\`, \`v0.1.1-pre\`, …) | Immutable Release snapshots; prefer these when grabbing a zip |

**Recommendation:** keep \`main\` boring and shippable; land preview patches on \`updates\` (or a short-lived PR branch), then tag + publish a GitHub Release when ready.

## Two artifacts (same as Release notes)

| Artifact | What updates |
|----------|--------------|
| **github-clean repo** | Source, scripts, \`modules/\` folders (no ONNX in git) |
| **Release zip** | Full Snapdragon package: app + **AMS** (Micro, or both Micro+Hybrid when bundled) + **virtual-computer** (Desk) |

Weights stay off \`git push\`. New AMS blobs go on the next Release asset (and/or Hugging Face).

## Script: \`scripts/update-asi.cmd\`

From the package root (Windows):

\`\`\`powershell
.\\scripts\\update-asi.cmd
\`\`\`

What it does (interactive, fail-closed):

1. Detects a git checkout → offers \`git pull\` on \`main\` or \`updates\`
2. Opens GitHub **Releases** in the browser (release notes + zip assets)
3. Optional: \`npm run setup\` + \`npm run build\` after a pull
4. Reminds you that module patches can be dropped as a zip into \`modules/\` (merge carefully; restart API)

Override the Releases URL:

\`\`\`powershell
set ASI_GITHUB_RELEASES_URL=https://github.com/<you>/asi-agents/releases
.\\scripts\\update-asi.cmd
\`\`\`

## In-app: Settings → Modules → Check for updates

Opens the same GitHub Releases page. It does **not** download or install anything automatically — that is intentional for a research preview.

## Module / skill zip drops

1. Download a module or skill patch zip from a Release (when published).
2. Unzip into \`modules/<name>/\` (or merge into the existing folder).
3. Rebuild if the pack has a workspace package (\`npm run build\`), then restart \`start-asi.cmd\`.

Core recipes and flags: \`modules/README.md\`, \`docs/MODULES.md\`, \`docs/FEATURE-FLAGS.md\`.

## After updating

\`\`\`powershell
npm.cmd run setup
npm.cmd run build
npm.cmd run start
# → http://127.0.0.1:3445
\`\`\`

If AMS Select fails after a source-only pull, place weights from the latest Release zip into \`models/ams/\` (or \`npm run install:ams\`).
`,
  );

  writeText(
    "scripts/update-asi.cmd",
    `@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0.."

echo.
echo  ASI Agents — update (research preview)
echo  Honest helper — not a silent auto-updater.
echo.

if defined ASI_GITHUB_RELEASES_URL (
  set "RELEASES_URL=%ASI_GITHUB_RELEASES_URL%"
) else (
  set "RELEASES_URL=https://github.com/vvarghese/asi-agents/releases"
)

echo  [1] Open GitHub Releases (notes + zip assets)
echo  [2] git pull main   (stable preview)
echo  [3] git pull updates (patch channel)
echo  [4] Rebuild after pull  (setup + build)
echo  [5] Print module-zip tip
echo  [0] Exit
echo.
set /p CHOICE=Choice [0-5]: 

if "%CHOICE%"=="1" goto OPEN_RELEASES
if "%CHOICE%"=="2" goto PULL_MAIN
if "%CHOICE%"=="3" goto PULL_UPDATES
if "%CHOICE%"=="4" goto REBUILD
if "%CHOICE%"=="5" goto MODULE_TIP
if "%CHOICE%"=="0" goto END
echo Unknown choice.
goto END

:OPEN_RELEASES
echo.
echo Opening %RELEASES_URL%
echo Override with: set ASI_GITHUB_RELEASES_URL=https://github.com/^<you^>/asi-agents/releases
start "" "%RELEASES_URL%"
goto END

:PULL_MAIN
if not exist ".git" (
  echo [!] Not a git checkout — download a new Release zip, or clone the github-clean repo.
  echo     See docs\\UPDATES.md
  goto END
)
echo.
echo git fetch origin
git fetch origin
if errorlevel 1 (
  echo [!] git fetch failed — check remotes / network.
  exit /b 1
)
echo git pull origin main
git pull origin main
if errorlevel 1 (
  echo [!] git pull main failed.
  exit /b 1
)
echo.
echo Done. Optional: run choice [4] rebuild, or npm.cmd run start
goto END

:PULL_UPDATES
if not exist ".git" (
  echo [!] Not a git checkout — download a new Release zip, or clone the github-clean repo.
  echo     See docs\\UPDATES.md
  goto END
)
echo.
echo git fetch origin
git fetch origin
if errorlevel 1 (
  echo [!] git fetch failed — check remotes / network.
  exit /b 1
)
echo git pull origin updates
git pull origin updates
if errorlevel 1 (
  echo [!] git pull updates failed — branch may not exist yet. Use main or a Release tag.
  exit /b 1
)
echo.
echo Done. Optional: run choice [4] rebuild, or npm.cmd run start
goto END

:REBUILD
echo.
echo npm.cmd run setup
call npm.cmd run setup
if errorlevel 1 (
  echo [!] setup failed.
  exit /b 1
)
echo npm.cmd run build
call npm.cmd run build
if errorlevel 1 (
  echo [!] build failed.
  exit /b 1
)
echo.
echo Rebuild OK. Start with start-asi.cmd or: npm.cmd run start
goto END

:MODULE_TIP
echo.
echo Module / skill patches:
echo   1. Download a module zip from GitHub Releases when published
echo   2. Unzip into modules\\^<name^>\\  ^(merge carefully^)
echo   3. npm.cmd run build   then restart start-asi.cmd
echo.
echo AMS weights are NOT in git — copy from the Release zip into models\\ams\\
echo or: npm.cmd run install:ams
echo.
echo Full notes: docs\\UPDATES.md
goto END

:END
echo.
endlocal
exit /b 0
`,
  );

  writeText(
    "GITHUB-UPLOAD.md",
    `# Upload ASI Agents to GitHub (clean source + Release AMS+Desk)

**Rule:** git tree stays lean. AMS ONNX (~700+ MB) go on a **Release** asset (and/or Hugging Face) — never \`git add\` \`*.onnx\`.

This folder is the **clean source** tree. The full Snapdragon zip with **AMS + virtual-computer (Desk)** is a separate Release asset.

---

## A. Create the repo and push clean source

\`\`\`powershell
cd <this-folder>   # ASI Agents v0.1 Pre Release-github-clean

# Confirm no weights in the tree
Get-ChildItem -Recurse -Include *.onnx,*.gguf -File
# (should print nothing)

git init
git add .
git status   # should NOT list *.onnx / *.gguf / .env / node_modules

git commit -m "ASI Agents v0.1 research preview (source only; AMS via Release)"

# Create empty repo on GitHub (no README), then:
gh repo create asi-agents --private --source=. --remote=origin --push
# Or: git remote add origin https://github.com/<you>/asi-agents.git
#     git branch -M main
#     git push -u origin main
\`\`\`

Optional patch channel after first push:

\`\`\`powershell
git checkout -b updates
git push -u origin updates
git checkout main
\`\`\`

\`.gitignore\` already excludes \`.env\`, \`node_modules\`, \`dist\`, \`*.onnx\`, \`*.gguf\`, \`app-state.json\`.

Optional later: uncomment lines in \`.gitattributes\` and use Git LFS instead of Release assets.

---

## B. Attach the full Snapdragon zip on a GitHub Release

**Push vs attach**

| Put in git (push) | Attach on Release (do not push) |
|-------------------|----------------------------------|
| Source under this folder | \`${SNAPDRAGON_ZIP}\` (~787 MB) with AMS ONNX + \`modules/virtual-computer\` |
| README, LICENSE, scripts, modules (no weights) | *Or* separate \`ams-micro-70m.onnx\` (+ hybrid if published) |
| \`GITHUB-RELEASE-NOTES.md\` (paste into description) | Alternate: \`asi-agents-research-preview-snapdragon.zip\` (~843 MB) |

Release zip must include **AMS** (Micro minimum; both if already bundled) **and** the **virtual-computer** module so cloners get Desk+AMS without HF.

\`\`\`powershell
# Point $zip at the Snapdragon zip that includes models/ams/*.onnx + modules/virtual-computer
$zip = "<path-to>\\\\${SNAPDRAGON_ZIP}"

gh release create v0.1.0-pre \`
  --title "ASI Agents v0.1 Research Preview (Snapdragon)" \`
  --notes-file ".\\\\GITHUB-RELEASE-NOTES.md" \`
  "$zip"
\`\`\`

Or GitHub UI: **Releases → Draft a new release →** paste \`GITHUB-RELEASE-NOTES.md\` → upload the zip (and/or the two \`.onnx\` files).

---

## C. First-run for cloners (no zip)

\`\`\`powershell
git clone https://github.com/<you>/asi-agents.git
cd asi-agents
npm.cmd run setup
npm.cmd run build
# weights:
npm.cmd run install:ams
# or copy onnx from the Release asset into models\\\\ams\\\\
.\\\\scripts\\\\pull-models.cmd
npm.cmd run start
# → http://127.0.0.1:3445
\`\`\`

Updates later: \`.\\scripts\\update-asi.cmd\` or Settings → Modules → Check for updates. See \`docs/UPDATES.md\`.

---

## Checklist before public

- [ ] \`Get-ChildItem -Recurse -Include *.onnx,*.gguf,.env\` empty in this folder
- [ ] No games module / Arcade / secrets in the tree
- [ ] Release asset attached (full Snapdragon zip with AMS + virtual-computer **or** onnx pair + note that Desk is in the repo)
- [ ] README still says: repo = clean source · Release = AMS + Desk
- [ ] See \`PUBLIC-LISTING.md\` for Public visibility · About/topics · HF cards
`,
  );

  writeText(
    "PUBLIC-LISTING.md",
    `# Public listing pack — ASI Agents v0.1 Research Preview

Copy-paste kit for a **public** GitHub homepage, Release, and optional Hugging Face model cards.

**Brand:** ASI Agents only · no legacy product names · **No** internal disk paths · **Research preview** disclaimer everywhere.

---

## 1. Make the GitHub repo Public (visibility)

### UI

1. Open the repo on GitHub → **Settings** → **General**.
2. Scroll to **Danger Zone** → **Change repository visibility** → **Change to public**.
3. Confirm. Anyone can now clone; keep secrets out of git (already true for this clean tree).

### CLI (if the repo is still private)

\`\`\`powershell
gh repo edit <you>/asi-agents --visibility public --accept-visibility-change-consequences
\`\`\`

### About box (right sidebar) — for discovery

| Field | Paste this |
|-------|------------|
| **Description** | Local-first multi-agent desk — Chief, companions, Virtual Desk on your machine. Research preview · Snapdragon X ready. |
| **Website** | *(optional)* your product page, or leave blank until you have one |
| **Topics** | \`asi-agents\` \`local-first\` \`desktop-ai\` \`snapdragon\` \`windows-arm64\` \`onnx\` \`research-preview\` \`multi-agent\` |

Topics are comma-separated chips in the UI; add them under the gear next to **About**.

**Do not** put weight download URLs only in Topics — put HF links in the README (already present) and Release notes.

---

## 2. Copy-paste: homepage blurb + Release

### Short homepage blurb (README hero is already written; optional About one-liner)

\`\`\`
ASI Agents — your local-first multi-agent desk. Chief + companions + Virtual Desk. Research preview (Snapdragon X ready). Clone the repo for source; grab the Release zip (~787 MB) for AMS weights bundled.
\`\`\`

### Release title

\`\`\`
ASI Agents v0.1 Research Preview (Snapdragon)
\`\`\`

### Release body

Paste the full contents of [\`GITHUB-RELEASE-NOTES.md\`](./GITHUB-RELEASE-NOTES.md) into the Release description (or \`--notes-file\`). Punchy launch note — repo = clean source, Release = Snapdragon zip with AMS.

### Tag

\`\`\`
v0.1.0-pre
\`\`\`

### Attach (do not \`git add\`)

Prefer:

\`${SNAPDRAGON_ZIP}\` (~787 MB)

(Full app + AMS + \`modules/virtual-computer\` / Desk. AMS Micro minimum; both Micro+Hybrid when already bundled.) That is the try-it-now asset; the git repo stays source-only.

---

## 3. Optional Hugging Face listing (AMS Micro / Hybrid)

Use when you publish weights publicly (or gated) on HF. Repo stays source-only; HF hosts blobs.

### Suggested repo ids

| Model | Suggested id | Role |
|-------|--------------|------|
| ASI AMS Micro 70M | \`vvarghese/ams-micro-70m\` | Fast / small ONNX |
| ASI AMS Hybrid 120M | \`vvarghese/ams-hybrid-120m\` | Higher-quality ONNX |

### Model card blurb (paste into each card’s README)

\`\`\`markdown
---
license: mit
library_name: onnx
tags:
  - asi-agents
  - onnx
  - research-preview
  - snapdragon
pipeline_tag: other
---

# ASI AMS <Micro 70M | Hybrid 120M>

ONNX weights for **ASI Agents** (local-first desktop AI research preview).

## Intended use

- Drop into an ASI Agents checkout under \`models/ams/\` as:
  - \`ams-micro-70m.onnx\` **or**
  - \`ams-hybrid-120m.onnx\`
- Or download the GitHub **Release** Snapdragon zip (weights bundled).

## Not included

- The ASI Agents application source (see the public GitHub repo).
- Cloud API keys or runtime secrets.

## Disclaimer

**Research preview.** APIs, UI, and defaults may change. Not production software.
\`\`\`

Replace \`<Micro 70M | Hybrid 120M>\` per card. Keep license consistent with the app (\`LICENSE\` in the GitHub tree).

### Visibility

- HF model repo → **Settings** → make **Public** (or gated if you require \`HF_TOKEN\`).
- Point GitHub README / Release notes at the same URLs (already referenced as \`huggingface.co/vvarghese/ams-micro-70m\` and \`…/ams-hybrid-120m\`).

---

## 4. Checklist — what is listed where

| What | GitHub **public repo** (git tree) | GitHub **Release** assets | Hugging Face |
|------|-----------------------------------|---------------------------|--------------|
| App source, README, LICENSE, scripts | Yes | Optional inside zip | No |
| \`*.onnx\` / \`*.gguf\` | **Never** | Yes (inside Snapdragon zip and/or as separate files) | Yes (model files) |
| Heavy Snapdragon zip (~700–800+ MB) | **Never** push | Yes — primary download for “try it now” | No |
| About Description / Topics | Yes (discovery) | N/A | Model card tags |
| Research-preview disclaimer | README | Release notes | Model card |
| Secrets / \`.env\` / internal paths | Never | Never | Never |

**Rule of thumb:** clone git to develop; download Release zip for a ready Snapdragon drop; use HF when you only need weights.

---

## 5. Pre-public checklist

- [ ] Repo visibility = **Public**
- [ ] About **Description** + **Topics** set (table above)
- [ ] \`Get-ChildItem -Recurse -Include *.onnx,*.gguf,.env\` empty in this folder
- [ ] No legacy brand names / internal disk paths in shipped markdown
- [ ] Release \`v0.1.0-pre\` published with title + \`GITHUB-RELEASE-NOTES.md\` body
- [ ] Release asset: valid Snapdragon zip (PK zip magic) **or** onnx pair
- [ ] Optional: HF Micro + Hybrid public/gated with model-card blurb
- [ ] README still says: **repo = clean source · Release / HF = weights**

---

## Quick commands

\`\`\`powershell
# Confirm clean tree
cd <this-folder>
Get-ChildItem -Recurse -Include *.onnx,*.gguf,.env -File

# Public visibility
gh repo edit <you>/asi-agents --visibility public --accept-visibility-change-consequences

# Release with zip (path to a verified .zip)
gh release create v0.1.0-pre \`
  --title "ASI Agents v0.1 Research Preview (Snapdragon)" \`
  --notes-file ".\\\\GITHUB-RELEASE-NOTES.md" \`
  "<path-to>\\\\${SNAPDRAGON_ZIP}"
\`\`\`

**ASI Agents** · research preview · local-first · no account to start
`,
  );

  writeText(
    "PRE-RELEASE-CHECKLIST.md",
    `# ASI Agents — GitHub-clean checklist

**Brand:** ASI Agents only.  
**Docs:** \`README.md\` · \`LICENSE\` · \`GITHUB-RELEASE-NOTES.md\` · \`GITHUB-UPLOAD.md\` · \`PUBLIC-LISTING.md\` · \`docs/UPDATES.md\` · this file.

| Item | Status |
|------|--------|
| No \`*.onnx\` / \`*.gguf\` in tree | ✅ |
| \`.gitignore\` covers \`.env\`, \`node_modules\`, \`dist\`, weights, \`app-state\` | ✅ |
| Optional \`.gitattributes\` (LFS stubs) | ✅ |
| Games / Arcade omitted | ✅ |
| \`start-asi.cmd\` + \`scripts/pull-models.cmd\` + \`scripts/update-asi.cmd\` | ✅ |
| Port **3445** | ✅ |
| LICENSE (MIT) | ✅ |
| Release story: AMS + virtual-computer in Snapdragon zip | ✅ |

\`\`\`powershell
npm.cmd run setup
npm.cmd run build
npm.cmd run install:ams   # or drop Release onnx into models\\ams\\
.\\scripts\\pull-models.cmd
npm.cmd run start
# → http://127.0.0.1:3445
\`\`\`
`,
  );

  writeText(
    "models/ams/PLACE-WEIGHTS-HERE.md",
    `# Place AMS weights here

This **GitHub-clean** tree ships **recipes + docs only**. Weight blobs (\`.onnx\` / \`.gguf\`) are **not** in git.

## Expected ship pair

| File | Role |
|------|------|
| \`ams-micro-70m.onnx\` | ASI AMS Micro 70M (~260 MB ONNX) |
| \`ams-hybrid-120m.onnx\` | ASI AMS Hybrid 120M (~440 MB ONNX) |

## Where to get them

1. **GitHub Release** — download \`${SNAPDRAGON_ZIP}\` (weights under \`models/ams/\`) **or** the separate onnx Release assets, then copy into this folder.
2. **Hugging Face** — \`npm run install:ams\` (repos: [ams-micro-70m](https://huggingface.co/vvarghese/ams-micro-70m), [ams-hybrid-120m](https://huggingface.co/vvarghese/ams-hybrid-120m); optional \`HF_TOKEN\`, never commit tokens).

Then:

\`\`\`powershell
npm run verify:ams
# or
.\\scripts\\pull-models.cmd
\`\`\`

Honest result: both **installed**, or clear **missing** — never faked.
`,
  );

  writeText(
    "scripts/pull-models.cmd",
    `@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

echo.
echo  ASI Agents — pull models
echo.

where ollama >nul 2>&1
if errorlevel 1 (
  echo [Ollama] not on PATH — install from https://ollama.com/download
  echo          Skipping Ollama pulls. Chat needs Ollama, llama.cpp, or cloud keys.
) else (
  echo [Ollama] pulling recommended tags...
  ollama pull qwen2.5:3b
  if errorlevel 1 echo [!] qwen2.5:3b pull failed — try: ollama pull qwen2.5
  ollama pull llama3.2:3b
  if errorlevel 1 echo [!] llama3.2:3b optional pull failed — continuing
)

echo.
echo [AMS] checking models\\ams weights...
call npm.cmd run verify:ams
if errorlevel 1 (
  echo.
  echo [AMS] weights missing — GitHub-clean trees do not ship ONNX.
  echo       1. Download Release zip / onnx assets into models\\ams\\
  echo       2. Or: npm run install:ams  (Hugging Face)
  echo       See models\\ams\\PLACE-WEIGHTS-HERE.md
  exit /b 2
)

echo Models ready.
exit /b 0
`,
  );

  writeText(
    "scripts/pull-models.ps1",
    `# ASI Agents — pull Ollama tags + AMS place/download hook (fail-closed)
$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ""
Write-Host " ASI Agents — pull models" -ForegroundColor Cyan
Write-Host ""

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
  Write-Host "[Ollama] not on PATH — install from https://ollama.com/download" -ForegroundColor Yellow
  Write-Host "         Skipping Ollama pulls. Chat needs Ollama, llama.cpp, or cloud keys."
} else {
  Write-Host "[Ollama] pulling recommended tags..." -ForegroundColor Green
  & ollama pull qwen2.5:3b
  if ($LASTEXITCODE -ne 0) { Write-Host "[!] qwen2.5:3b pull failed — try: ollama pull qwen2.5" -ForegroundColor Yellow }
  & ollama pull llama3.2:3b
  if ($LASTEXITCODE -ne 0) { Write-Host "[!] llama3.2:3b optional pull failed — continuing" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "[AMS] checking models/ams weights..." -ForegroundColor Cyan
& npm.cmd run verify:ams
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "[AMS] weights missing — GitHub-clean trees do not ship ONNX." -ForegroundColor Yellow
  Write-Host "      1. Download Release zip / onnx assets into models/ams/"
  Write-Host "      2. Or: npm run install:ams  (Hugging Face)"
  Write-Host "      See models/ams/PLACE-WEIGHTS-HERE.md"
  exit 2
}

Write-Host ""
Write-Host "Models ready." -ForegroundColor Green
exit 0
`,
  );

  const publishGithub = path.join(ROOT, "docs", "PUBLISH-GITHUB.md");
  if (fs.existsSync(publishGithub)) {
    writeText(
      "docs/PUBLISH-GITHUB.md",
      sanitizeText(fs.readFileSync(publishGithub, "utf8")),
    );
  }
}

function wipeWeights(dir) {
  if (!fs.existsSync(dir)) return [];
  const wiped = [];
  for (const f of fs.readdirSync(dir)) {
    if (EXCLUDE_WEIGHT.test(f)) {
      fs.unlinkSync(path.join(dir, f));
      wiped.push(f);
    }
  }
  return wiped;
}

function countFiles(dir) {
  let n = 0;
  let bytes = 0;
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, ent.name);
      if (ent.isDirectory()) walk(abs);
      else if (ent.isFile()) {
        n += 1;
        bytes += fs.statSync(abs).size;
      }
    }
  }
  walk(dir);
  return { n, bytes };
}

function main() {
  log("==> ASI Agents GitHub-clean export");
  if (!fs.existsSync(SOURCE_STAGE)) {
    console.error("Missing stage source:", SOURCE_STAGE);
    console.error("Run: npm run export:corp-prerelease   (builds staging first)");
    process.exit(1);
  }

  mkdirp(CORP_ROOT);
  if (fs.existsSync(DEST)) {
    log("clearing previous: " + DEST);
    rmrf(DEST);
  }
  mkdirp(DEST);

  const stats = { files: 0, bytes: 0, skipped: 0 };
  log("copy from stage (weights excluded)...");
  copyTree(SOURCE_STAGE, DEST, "", stats);

  log("overlay live src/config/modules (scrubbed)...");
  overlayLiveSources(stats);

  log("patch ship tree (strip games wiring)...");
  patchShipTree(DEST);

  log("GitHub overlays...");
  writeGithubOverlays();

  const wiped = wipeWeights(path.join(DEST, "models", "ams"));
  for (const f of wiped) log("wiped weight: " + f);

  // Ensure no onnx anywhere
  const leak = [];
  function scan(d, rel) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      const abs = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (EXCLUDE_DIR.has(ent.name)) continue;
        scan(abs, r);
      } else if (EXCLUDE_WEIGHT.test(ent.name)) {
        leak.push(r);
      }
    }
  }
  scan(DEST, "");
  if (leak.length) {
    console.error("REFUSING — weight blobs still present:");
    for (const f of leak) console.error("  " + f);
    process.exit(2);
  }

  log("brand + secret scan...");
  const { brandHits, secretHits } = brandAndSecretScan(DEST);
  if (secretHits.length) {
    console.error("REFUSING — secret-like tokens:");
    for (const f of secretHits) console.error("  " + f);
    process.exit(3);
  }
  if (brandHits.length) {
    console.error("REFUSING — forbidden brand / AI vendor refs:");
    for (const f of brandHits) console.error("  " + f);
    process.exit(4);
  }

  log("zip: " + CLEAN_ZIP_NAME);
  writeZip();

  const totals = countFiles(DEST);
  const publicManifest = {
    product: "ASI Agents",
    kind: "github-clean",
    version: "0.1.0-pre",
    brand: "ASI Agents only",
    snapdragonReleaseZip: SNAPDRAGON_ZIP,
    githubCleanZip: CLEAN_ZIP_NAME,
    files: totals.n,
    approxUncompressedBytes: totals.bytes,
    amsWeights: "omitted — Release asset / HF / PLACE-WEIGHTS-HERE.md",
    amsOnnxFiles: [],
    port: 3445,
    note: "GitHub repo / github-clean zip = clean source (no secrets, ASI Agents branding only). Snapdragon Release zip = binary + AMS weights + Desk.",
    createdAt: new Date().toISOString(),
  };
  const localManifest = {
    ...publicManifest,
    packageFolder: DEST_NAME,
    dest: DEST,
    zip: CLEAN_ZIP,
    sourceStage: SOURCE_STAGE,
  };
  // Public tree: no machine paths. Operator copy keeps dest for local use only.
  fs.writeFileSync(
    path.join(DEST, "GITHUB-CLEAN-MANIFEST.json"),
    JSON.stringify(publicManifest, null, 2) + "\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(CORP_ROOT, "ASI-Agents-v0.1-github-clean-manifest.json"),
    JSON.stringify(localManifest, null, 2) + "\n",
    "utf8",
  );

  // Operator-only upload sheet with absolute paths (not inside the push tree)
  fs.writeFileSync(
    path.join(CORP_ROOT, "ASI-Agents-GITHUB-UPLOAD.md"),
    `# Operator notes — GitHub upload (local paths)

**Upload this zip (clean source, no secrets / ASI Agents branding only):**  
\`${CLEAN_ZIP.replace(/\\/g, "\\\\")}\`

**Or push this folder:**  
\`${DEST.replace(/\\/g, "\\\\")}\`

**Attach on Release (full Snapdragon + weights — binary package, not the “clean code” tree):**  
\`${path.join(CORP_ROOT, SNAPDRAGON_ZIP).replace(/\\/g, "\\\\")}\` (~787 MB)

**Rule:** \`github-clean\` = no-secrets code tree for git/upload. Snapdragon Release zip = AMS ONNX + Virtual Desk + runnable package (re-run \`npm run export:corp-prerelease\` when you need that zip refreshed with the latest scrubbed source).

In-repo steps (sanitized): \`${path.join(DEST, "GITHUB-UPLOAD.md").replace(/\\/g, "\\\\")}\`

\`\`\`powershell
cd "${DEST}"
Get-ChildItem -Recurse -Include *.onnx,*.gguf -File   # must be empty
git init
git add .
git commit -m "ASI Agents v0.1 research preview (source only; AMS via Release)"
gh repo create asi-agents --private --source=. --remote=origin --push

gh release create v0.1.0-pre \`
  --title "ASI Agents v0.1 Research Preview (Snapdragon)" \`
  --notes-file ".\\\\GITHUB-RELEASE-NOTES.md" \`
  "${path.join(CORP_ROOT, SNAPDRAGON_ZIP)}"
\`\`\`

Refresh: \`cd "<repo>"; npm run export:github-clean\`
`,
    "utf8",
  );

  log("");
  log("OK  github-clean folder: " + DEST);
  log("OK  github-clean zip:    " + CLEAN_ZIP);
  log(
    "    " +
      (totals.bytes / (1024 * 1024)).toFixed(1) +
      " MB · " +
      totals.n +
      " files · AMS weights NOT included · AI-vendor product names = 0",
  );
  log("    Push folder or upload zip. Attach " + SNAPDRAGON_ZIP + " on Release (binary+weights).");
  log("    Steps: " + path.join(DEST, "GITHUB-UPLOAD.md"));
}

main();
