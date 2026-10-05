# Updates & patches (research preview)

ASI Agents does **not** ship a silent auto-updater. This document is the honest update path for skills, modules, and the app.

## Branch / tag strategy

| Ref | Role |
|-----|------|
| `main` | Stable research-preview line — what most cloners should track |
| `updates` | Optional patch channel (skills / modules / app fixes ahead of a tagged release) |
| Tags (`v0.1.0-pre`, `v0.1.1-pre`, …) | Immutable Release snapshots; prefer these when grabbing a zip |

**Recommendation:** keep `main` boring and shippable; land preview patches on `updates` (or a short-lived PR branch), then tag + publish a GitHub Release when ready.

## Two artifacts (same as Release notes)

| Artifact | What updates |
|----------|--------------|
| **github-clean repo** | Source, scripts, `modules/` folders (no ONNX in git) |
| **Release zip** | Full Snapdragon package: app + **AMS** (Micro, or both Micro+Hybrid when bundled) + **virtual-computer** (Desk) |

Weights stay off `git push`. New AMS blobs go on the next Release asset (and/or Hugging Face).

## Script: `scripts/update-asi.cmd`

From the package root (Windows):

```powershell
.\scripts\update-asi.cmd
```

What it does (interactive, fail-closed):

1. Detects a git checkout → offers `git pull` on `main` or `updates`
2. Opens GitHub **Releases** in the browser (release notes + zip assets)
3. Optional: `npm run setup` + `npm run build` after a pull
4. Reminds you that module patches can be dropped as a zip into `modules/` (merge carefully; restart API)

Override the Releases URL:

```powershell
set ASI_GITHUB_RELEASES_URL=https://github.com/<you>/asi-agents/releases
.\scripts\update-asi.cmd
```

## In-app: Settings → Modules → Check for updates

Opens the same GitHub Releases page. It does **not** download or install anything automatically — that is intentional for a research preview.

## Module / skill zip drops

1. Download a module or skill patch zip from a Release (when published).
2. Unzip into `modules/<name>/` (or merge into the existing folder).
3. Rebuild if the pack has a workspace package (`npm run build`), then restart `start-asi.cmd`.

Core recipes and flags: `modules/README.md`, `docs/MODULES.md`, `docs/FEATURE-FLAGS.md`.

## After updating

```powershell
npm.cmd run setup
npm.cmd run build
npm.cmd run start
# → http://127.0.0.1:3445
```

If AMS Select fails after a source-only pull, place weights from the latest Release zip into `models/ams/` (or `npm run install:ams`).
