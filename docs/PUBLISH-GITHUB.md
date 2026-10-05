# Publish to GitHub (v0.1 research preview)

Operator runbook for a **public** GitHub repo + **pre-release** with a fat Snapdragon zip. The dev tree at `<repo>` is intentionally **not** always a git repo — use the export pipeline so secrets, weights, and games wiring stay out of what you push.

**Related:** [`PUBLISH.md`](./PUBLISH.md) (hygiene). After `npm run export:github-clean`, open **`GITHUB-UPLOAD.md`** and **`PUBLIC-LISTING.md`** in the generated `…-github-clean` folder under your Corp export path (default `<package path>`).

---

## 1. Pre-flight

Run from the **living** workspace (`<repo>` or your clone):

```powershell
cd "<repo>"

# Secrets / tokens (should find nothing real)
rg -i "sk-[a-z0-9]{20,}|BEGIN (RSA |OPENSSH )?PRIVATE|api_key\s*=" --glob "!node_modules" --glob "!releases"

# Build on current tree (games included here — export strips games for GitHub)
npm run setup
npm run build
npm run verify:ams   # only if ONNX present locally
```

**Never commit or zip:** `.env`, `app-state.json`, `services.json`, `%LOCALAPPDATA%\ASI Agents\`, `agent-transcripts/`, `_scratch/`, `*.pem`, IDE metadata folders.

**Weights policy:** `*.onnx` / `*.gguf` stay **out of git** (see root `.gitignore`). Ship weights on the **GitHub Release** asset (and/or Hugging Face), not in the repository.

**License check:** github-clean export currently ships **MIT** (`LICENSE` in export). Outreach/README drafts may say **Apache-2.0** — pick one license, update `LICENSE` + README badge, then re-export before push.

---

## 2. Export fresh trees

Order matters: corp staging first, then github-clean overlay.

```powershell
cd "<repo>"
npm run export:corp-prerelease    # staging + <package path> (~787 MB, AMS + Desk)
npm run export:github-clean       # github-clean folder + ASI-Agents-v0.1-github-clean.zip
```

Outputs (default Corp paths):

| Artifact | Role |
|----------|------|
| `<package path> Agents v0.1 Pre Release-github-clean\` | **Push this folder** (source only, `patchShipTree` applied, no games dep) |
| `<package path>` | **Attach to Release** (AMS ONNX + virtual-computer) |
| `<package path>` | Operator copy with absolute paths |

Verify github-clean has **zero** weight blobs:

```powershell
cd "<package path> Agents v0.1 Pre Release-github-clean"
Get-ChildItem -Recurse -Include *.onnx,*.gguf -File   # must print nothing
```

Smoke-test **from the github-clean folder** (not the dirty dev tree):

```powershell
npm.cmd run setup
npm.cmd run build
# optional: copy models\ams\*.onnx from the Snapdragon zip, then npm run verify:ams
```

---

## 3. Repo choice

| Situation | Recommendation |
|-----------|----------------|
| You control **`asiagents/asi-agents`** on GitHub | **Update that repo** — outreach already points there; avoid a duplicate public fork unless intentional. |
| No access / empty remote | Create **`asi-agents`** under the org or user that will own releases; do **not** push from account `MLDCode` unless that is the product owner. |
| This machine | `<repo>` has **no `.git`** — always `git init` (or clone empty remote) **inside github-clean**, not the raw dev folder. |

Re-authenticate GitHub CLI before any push:

```powershell
gh auth login -h github.com
gh auth status
```

---

## 4. Push clean source

```powershell
cd "<package path> Agents v0.1 Pre Release-github-clean"

git init
git add .
git status   # confirm: no .env, no node_modules, no *.onnx

git commit -m "ASI Agents v0.1 research preview (source only; AMS via Release)"

# Existing repo (replace URL):
git remote add origin https://github.com/asiagents/asi-agents.git
git branch -M main
git push -u origin main
# If history already exists on remote: pull/rebase or force-push ONLY with explicit owner approval — never force main casually.

# Or new repo via gh:
# gh repo create asiagents/asi-agents --public --source=. --remote=origin --push
```

Optional patch channel: `git checkout -b updates` → `git push -u origin updates`.

Make public + discovery (copy from `PUBLIC-LISTING.md` in the same folder): description, topics (`multi-agent`, `local-llm`, `onnx`, `llm-router`, `personal-assistant`, …), social preview image from `docs/assets/team-icon.gif`.

---

## 5. GitHub Release (pre-release)

```powershell
$zip = "<package path>"

gh release create v0.1.0-pre `
  --prerelease `
  --title "ASI Agents v0.1 Research Preview (Snapdragon)" `
  --notes-file ".\GITHUB-RELEASE-NOTES.md" `
  "$zip"
```

UI equivalent: **Releases → Draft new release** → tag `v0.1.0-pre` → paste `GITHUB-RELEASE-NOTES.md` → upload the Snapdragon zip.

**Do not** attach `app-state.json`, live `.env`, or multi-GB chat GGUFs unless you have a deliberate redistribution story.

---

## 5b. README upgrade (launch week)

The living `README.md` in the dev tree is shorter than the router-first draft in `proposed-README.md`. For launch, consider replacing the github-clean `README.md` (or merging: hero, AMS diagram, screenshot table, Docker + `verify:ams`) **before** the commit in §4, then re-run `export:github-clean` if you edited only the dev tree.

---

## 6. After publish

- Fresh clone test: `git clone` → `npm run setup` → `npm run build` → `start-asi.cmd` or `npm run start`.
- Open **Discussions** or a tracking issue for Test Pack Batch 1 (setup + AMS).
- Next engineering slice: GitHub Actions (`build` + typecheck + `strip-reasoning.test.ts`), `start-asi.sh`, AMS benchmark harness.

---

*Refresh exports after any ship fix: `patchShipTree`, `start-asi.cmd`, `ASI_SERVER_HOST` in Docker, screenshots under `docs/screenshots/`.*
