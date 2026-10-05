<div align="center">

# ASI Agents

### Local-first desktop AI · Chief + agents on your machine

**Research preview** · **v0.1** · Port **3445** · Snapdragon X ready

</div>

---

Welcome! **ASI Agents** is a local-first app for running work like an executive office — a **Chief of staff** and agents that stay private by default. Local models when you want them, cloud only when you opt in. **No account required to start.**

This repository is the **clean source** tree (safe for `git push`). Multi-hundred-MB AMS ONNX weights are **not** in git — get them from a **GitHub Release** asset or Hugging Face.

> **GitHub repo = clean source** · **Release zip = AMS + Virtual Desk (full Snapdragon package)**

Prefer the **Release** zip when you want Desk + AMS without a Hugging Face hunt. This repo stays lean for clone/develop.

## First run

**One click (Windows / Snapdragon):** double-click **`start-asi.cmd`**, then open http://127.0.0.1:3445

**Or three commands** (Node **20+**; prefer **ARM64** on Snapdragon X):

```powershell
npm.cmd run setup
npm.cmd run build
npm.cmd run start
```

### Download AMS weights (required for AMS Select on this clean tree)

Ship pair when present: `ams-micro-70m.onnx` + `ams-hybrid-120m.onnx` → `models/ams/`  
**Minimum for a lean drop:** Micro alone. Release zip includes Micro, or both when already bundled.

```powershell
# Option A — from GitHub Release asset (Snapdragon zip = AMS + modules/virtual-computer)
#   Download the Release zip, unzip, copy models\ams\*.onnx here
#   OR attach/download ams-micro-70m.onnx (+ hybrid if published) directly

# Option B — Hugging Face (gated; set HF_TOKEN if needed)
npm.cmd run install:ams

# Verify (fail-closed if missing)
.\scripts\pull-models.cmd
# or: npm.cmd run verify:ams
```

Details: [`models/ams/PLACE-WEIGHTS-HERE.md`](models/ams/PLACE-WEIGHTS-HERE.md) · HF: [ams-micro-70m](https://huggingface.co/vvarghese/ams-micro-70m) · [ams-hybrid-120m](https://huggingface.co/vvarghese/ams-hybrid-120m)

Without a chat backend (Ollama, llama.cpp, or cloud keys), Chief returns **503** — expected and fail-closed.

## Modules out of the box

| Module | First-run |
|--------|-----------|
| **Virtual Computer** | Installed in source and **bundled in the Release zip**. Desk on `:3456` optional (`ASI_DESK_REPO`). Fail-closed offline. |
| **Companion** | **ON** on localhost when unset. |

Games / Arcade are not included. Postgres stays off unless you enable it.

## Updates (patches)

No silent auto-updater. See [`docs/UPDATES.md`](docs/UPDATES.md):

- Branches: `main` (stable preview) · `updates` / version tags (patches)
- Script: `.\scripts\update-asi.cmd`
- In-app: Settings → Modules → **Check for updates** (opens GitHub Releases)

## Docs in this tree

| File | Role |
|------|------|
| [`README.md`](README.md) | Purpose + first-run (this file) |
| [`LICENSE`](LICENSE) | MIT |
| [`GITHUB-RELEASE-NOTES.md`](GITHUB-RELEASE-NOTES.md) | Paste into GitHub Release description |
| [`GITHUB-UPLOAD.md`](GITHUB-UPLOAD.md) | Exact create-repo / push / Release steps |
| [`PUBLIC-LISTING.md`](PUBLIC-LISTING.md) | Public visibility · About/topics · HF · listing checklist |
| [`docs/UPDATES.md`](docs/UPDATES.md) | Branch + script + in-app update path |
| [`PRE-RELEASE-CHECKLIST.md`](PRE-RELEASE-CHECKLIST.md) | Minimal ship checklist |

## License

[`LICENSE`](LICENSE) — MIT

---

<div align="center">

**ASI Agents** · research preview · local-first · no account to start

</div>
