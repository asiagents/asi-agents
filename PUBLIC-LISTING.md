# Public listing pack — ASI Agents v0.1 Research Preview

Copy-paste kit for a **public** GitHub homepage, Release, and optional Hugging Face model cards.

**Brand:** ASI Agents only · no legacy product names · **No** internal disk paths · **Research preview** disclaimer everywhere.

---

## 1. Make the GitHub repo Public (visibility)

### UI

1. Open the repo on GitHub → **Settings** → **General**.
2. Scroll to **Danger Zone** → **Change repository visibility** → **Change to public**.
3. Confirm. Anyone can now clone; keep secrets out of git (already true for this clean tree).

### CLI (if the repo is still private)

```powershell
gh repo edit <you>/asi-agents --visibility public --accept-visibility-change-consequences
```

### About box (right sidebar) — for discovery

| Field | Paste this |
|-------|------------|
| **Description** | Local-first multi-agent desk — Chief, companions, Virtual Desk on your machine. Research preview · Snapdragon X ready. |
| **Website** | *(optional)* your product page, or leave blank until you have one |
| **Topics** | `asi-agents` `local-first` `desktop-ai` `snapdragon` `windows-arm64` `onnx` `research-preview` `multi-agent` |

Topics are comma-separated chips in the UI; add them under the gear next to **About**.

**Do not** put weight download URLs only in Topics — put HF links in the README (already present) and Release notes.

---

## 2. Copy-paste: homepage blurb + Release

### Short homepage blurb (README hero is already written; optional About one-liner)

```
ASI Agents — your local-first multi-agent desk. Chief + companions + Virtual Desk. Research preview (Snapdragon X ready). Clone the repo for source; grab the Release zip (~787 MB) for AMS weights bundled.
```

### Release title

```
ASI Agents v0.1 Research Preview (Snapdragon)
```

### Release body

Paste the full contents of [`GITHUB-RELEASE-NOTES.md`](./GITHUB-RELEASE-NOTES.md) into the Release description (or `--notes-file`). Punchy launch note — repo = clean source, Release = Snapdragon zip with AMS.

### Tag

```
v0.1.0-pre
```

### Attach (do not `git add`)

Prefer:

`ASI-Agents-v0.1-Pre-Release-Snapdragon.zip` (~787 MB)

(Full app + AMS + `modules/virtual-computer` / Desk. AMS Micro minimum; both Micro+Hybrid when already bundled.) That is the try-it-now asset; the git repo stays source-only.

---

## 3. Optional Hugging Face listing (AMS Micro / Hybrid)

Use when you publish weights publicly (or gated) on HF. Repo stays source-only; HF hosts blobs.

### Suggested repo ids

| Model | Suggested id | Role |
|-------|--------------|------|
| ASI AMS Micro 70M | `vvarghese/ams-micro-70m` | Fast / small ONNX |
| ASI AMS Hybrid 120M | `vvarghese/ams-hybrid-120m` | Higher-quality ONNX |

### Model card blurb (paste into each card’s README)

```markdown
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

- Drop into an ASI Agents checkout under `models/ams/` as:
  - `ams-micro-70m.onnx` **or**
  - `ams-hybrid-120m.onnx`
- Or download the GitHub **Release** Snapdragon zip (weights bundled).

## Not included

- The ASI Agents application source (see the public GitHub repo).
- Cloud API keys or runtime secrets.

## Disclaimer

**Research preview.** APIs, UI, and defaults may change. Not production software.
```

Replace `<Micro 70M | Hybrid 120M>` per card. Keep license consistent with the app (`LICENSE` in the GitHub tree).

### Visibility

- HF model repo → **Settings** → make **Public** (or gated if you require `HF_TOKEN`).
- Point GitHub README / Release notes at the same URLs (already referenced as `huggingface.co/vvarghese/ams-micro-70m` and `…/ams-hybrid-120m`).

---

## 4. Checklist — what is listed where

| What | GitHub **public repo** (git tree) | GitHub **Release** assets | Hugging Face |
|------|-----------------------------------|---------------------------|--------------|
| App source, README, LICENSE, scripts | Yes | Optional inside zip | No |
| `*.onnx` / `*.gguf` | **Never** | Yes (inside Snapdragon zip and/or as separate files) | Yes (model files) |
| Heavy Snapdragon zip (~700–800+ MB) | **Never** push | Yes — primary download for “try it now” | No |
| About Description / Topics | Yes (discovery) | N/A | Model card tags |
| Research-preview disclaimer | README | Release notes | Model card |
| Secrets / `.env` / internal paths | Never | Never | Never |

**Rule of thumb:** clone git to develop; download Release zip for a ready Snapdragon drop; use HF when you only need weights.

---

## 5. Pre-public checklist

- [ ] Repo visibility = **Public**
- [ ] About **Description** + **Topics** set (table above)
- [ ] `Get-ChildItem -Recurse -Include *.onnx,*.gguf,.env` empty in this folder
- [ ] No legacy brand names / internal disk paths in shipped markdown
- [ ] Release `v0.1.0-pre` published with title + `GITHUB-RELEASE-NOTES.md` body
- [ ] Release asset: valid Snapdragon zip (PK zip magic) **or** onnx pair
- [ ] Optional: HF Micro + Hybrid public/gated with model-card blurb
- [ ] README still says: **repo = clean source · Release / HF = weights**

---

## Quick commands

```powershell
# Confirm clean tree
cd <this-folder>
Get-ChildItem -Recurse -Include *.onnx,*.gguf,.env -File

# Public visibility
gh repo edit <you>/asi-agents --visibility public --accept-visibility-change-consequences

# Release with zip (path to a verified .zip)
gh release create v0.1.0-pre `
  --title "ASI Agents v0.1 Research Preview (Snapdragon)" `
  --notes-file ".\\GITHUB-RELEASE-NOTES.md" `
  "<path-to>\\ASI-Agents-v0.1-Pre-Release-Snapdragon.zip"
```

**ASI Agents** · research preview · local-first · no account to start
