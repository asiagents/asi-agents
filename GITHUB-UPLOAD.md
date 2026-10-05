# Upload ASI Agents to GitHub (clean source + Release AMS+Desk)

**Rule:** git tree stays lean. AMS ONNX (~700+ MB) go on a **Release** asset (and/or Hugging Face) — never `git add` `*.onnx`.

This folder is the **clean source** tree. The full Snapdragon zip with **AMS + virtual-computer (Desk)** is a separate Release asset.

---

## A. Create the repo and push clean source

```powershell
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
```

Optional patch channel after first push:

```powershell
git checkout -b updates
git push -u origin updates
git checkout main
```

`.gitignore` already excludes `.env`, `node_modules`, `dist`, `*.onnx`, `*.gguf`, `app-state.json`.

Optional later: uncomment lines in `.gitattributes` and use Git LFS instead of Release assets.

---

## B. Attach the full Snapdragon zip on a GitHub Release

**Push vs attach**

| Put in git (push) | Attach on Release (do not push) |
|-------------------|----------------------------------|
| Source under this folder | `ASI-Agents-v0.1-Pre-Release-Snapdragon.zip` (~787 MB) with AMS ONNX + `modules/virtual-computer` |
| README, LICENSE, scripts, modules (no weights) | *Or* separate `ams-micro-70m.onnx` (+ hybrid if published) |
| `GITHUB-RELEASE-NOTES.md` (paste into description) | Alternate: `asi-agents-research-preview-snapdragon.zip` (~843 MB) |

Release zip must include **AMS** (Micro minimum; both if already bundled) **and** the **virtual-computer** module so cloners get Desk+AMS without HF.

```powershell
# Point $zip at the Snapdragon zip that includes models/ams/*.onnx + modules/virtual-computer
$zip = "<path-to>\\ASI-Agents-v0.1-Pre-Release-Snapdragon.zip"

gh release create v0.1.0-pre `
  --title "ASI Agents v0.1 Research Preview (Snapdragon)" `
  --notes-file ".\\GITHUB-RELEASE-NOTES.md" `
  "$zip"
```

Or GitHub UI: **Releases → Draft a new release →** paste `GITHUB-RELEASE-NOTES.md` → upload the zip (and/or the two `.onnx` files).

---

## C. First-run for cloners (no zip)

```powershell
git clone https://github.com/<you>/asi-agents.git
cd asi-agents
npm.cmd run setup
npm.cmd run build
# weights:
npm.cmd run install:ams
# or copy onnx from the Release asset into models\\ams\\
.\\scripts\\pull-models.cmd
npm.cmd run start
# → http://127.0.0.1:3445
```

Updates later: `.\scripts\update-asi.cmd` or Settings → Modules → Check for updates. See `docs/UPDATES.md`.

---

## Checklist before public

- [ ] `Get-ChildItem -Recurse -Include *.onnx,*.gguf,.env` empty in this folder
- [ ] No games module / Arcade / secrets in the tree
- [ ] Release asset attached (full Snapdragon zip with AMS + virtual-computer **or** onnx pair + note that Desk is in the repo)
- [ ] README still says: repo = clean source · Release = AMS + Desk
- [ ] See `PUBLIC-LISTING.md` for Public visibility · About/topics · HF cards
