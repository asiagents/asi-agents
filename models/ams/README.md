# AMS models (product catalog)

On-disk home for **AMS product model recipes** and optional weight drops.

**Ship UI shows two models only:** ASI AMS Micro 70M + ASI AMS Hybrid 120M.  
Agent Chat (~50–100M), Ultra gate (~1M), and **ASI AMS Floppy** (future ESP32 / &lt;1 MB) stay in `catalog.json` as `advanced: true` (Floppy also `future: true`) and appear only when `ASI_AMS_SHOW_ADVANCED=1`.

This is **not** the AMS skills catalog (`config/ams-skills.catalog.json`). Skills stay under Pro / `GET /api/agents/:id/ams`.

## Layout

| Path | Purpose |
|------|---------|
| `catalog.json` | Ship recipes (Micro / Hybrid) + advanced (hidden by default) |
| `*.gguf` (optional) | Real GGUF weights — listed as `ams-gguf:…` after Scan |
| `*.onnx` (optional) | Real ONNX weights — listed as `ams-onnx:…` with **ONNX on disk** badge (never claimed as GGUF) |
| `.hf-cache/` | Temporary HF download cache (gitignored) |
| `README.md` | This install guide |

Large `.gguf` / `.onnx` files under this folder are **gitignored**. Fetch once locally (see below).

## Honesty rules

- Catalog rows are **recipes** until a matching `.gguf` or `.onnx` exists here (or matching GGUF under `models/custom/`).
- The app does **not** invent installed AMS weights or fake Ollama tags.
- Matching **ONNX** clears recipe status and enables **Select**, with badge **ONNX on disk** — never labeled GGUF.
- Product Micro file is **`ams-micro-70m.onnx`** (~68.15M params → brand **70M**). Legacy training/HF basename `ams-micro-50m-ctx1024.onnx` still matches via `onnxWeightHints` if present — it does **not** install Hybrid.
- AMS Micro is the **router / classifier** on `:7821`, not a full chat LLM — see [`docs/MODEL-BACKENDS-NOTE.md`](../../docs/MODEL-BACKENDS-NOTE.md).
- Reference router (`models/router`) is **Ollama / llama.cpp only** today — local ONNX is installed for Select/pool + a future ONNX hop; it does not load ONNX at generate time yet.
- Probe APIs: `GET /api/models/ams` and Downloads enrichment report `status: "recipe" | "installed"` + `weightFormat: "gguf" | "onnx"` only from real files.
- **No GGUF built yet** — GGUF recipe names (e.g. `ams-micro-70m-q4_k_m.gguf`) stay uninstalled until a real file exists. Do not invent quant files.

## Size & hardware (Q4-class GGUF estimates)

| Id | Role | Disk | RAM at load | Hardware | Ship UI |
|----|------|------|-------------|----------|---------|
| `ams-micro-70m` | Default router / intent | ~40–90 MB GGUF or ~260 MB ONNX | ~0.5–1 GB | CPU / Pi / 8 GB laptop | **Yes** |
| `ams-hybrid-120m` | Optional larger router | ~80–160 MB GGUF or ~440 MB ONNX | ~1–2 GB | Prefer 8+ GB RAM; CPU OK | **Yes** |
| `agent-chat-50-100m` | Short on-device replies | ~40–120 MB (Q4 GGUF) | ~0.5–1.5 GB | CPU / laptop | Advanced only |
| `ultra-gate-1m` | Edge toy (not ship brain) | ~1–5 MB | Negligible | Any device | Advanced only |
| `ams-floppy-esp32` | Future MCU Floppy gate (± micro-talk) | **&lt;1 MB hard cap** (no file yet) | MCU flash / optional PSRAM | ESP32-class — design only | Advanced / **future** only |

Exact sizes depend on quant / published artifact. These are planning hints, not measured ship artifacts.

## One-time local install (preferred)

Hugging Face repos (gated — accept access + set `HF_TOKEN` or `hf auth login`):

| Model | Repo | Suggested / published filename |
|-------|------|--------------------------------|
| Micro 70M | https://huggingface.co/vvarghese/ams-micro-70m | GGUF: `ams-micro-70m-q4_k_m.gguf` · ONNX (product): **`ams-micro-70m.onnx`** |
| Hybrid 120M | https://huggingface.co/vvarghese/ams-hybrid-120m | GGUF: `ams-hybrid-120m-q4_k_m.gguf` · ONNX: **`ams-hybrid-120m.onnx`** |

**Note:** Ship pair uses **FP32 ONNX** today: Micro `ams-micro-70m.onnx` + Hybrid `ams-hybrid-120m.onnx`. Install / verify mark both **installed** with `weightFormat: "onnx"`. Prefer GGUF when both formats exist. Never map Micro ONNX onto Hybrid. Training lineage for Hybrid was “q3x route” — that is **not** a quant format.

```powershell
# From repo root
$env:HF_TOKEN = "hf_…"   # if gated
npm run install:ams
npm run verify:ams
```

Or in the product: **Settings → Models → Downloads → Download** (calls `POST /api/models/ams/download`).

Manual place:

```powershell
Copy-Item .\ams-micro-70m.onnx .\models\ams\
Copy-Item .\ams-hybrid-120m.onnx .\models\ams\
# or GGUF when available:
# Copy-Item .\ams-micro-70m-q4_k_m.gguf .\models\ams\
node scripts/verify-ams-gguf.mjs
```

After a successful match, Browse lists `ams-gguf:…` or `ams-onnx:…` as installed, and the recipe row clears.

## Weight-hint matching

Scan matches a recipe when any weight basename contains a `weightHints` token (GGUF) or `onnxWeightHints` token (ONNX) from `catalog.json` (or the recipe id). Unmatched files under `models/ams/` still appear as scanned drop-ins, but do not clear the wrong recipe row.

## UI

Settings → Models → **Browse**:

- **On this device** — real GGUF / Ollama / llama.cpp / API lists (includes installed AMS weights) + **Select** for router pool
- **AMS models** — ship recipes still missing + installed AMS rows (Download + Select)
- **Recommended downloads** — public HF / Ollama recipes

Settings → Models → **Downloads** — AMS ship pair with Download button, copyable `npm run install:ams` commands.

**Select** on ONNX-installed rows: adds to pool / desk default with **ONNX on disk** badge. Does not claim the reference `:7821` router can run ONNX yet.

## Advanced recipes

```bash
ASI_AMS_SHOW_ADVANCED=1
```

Shows Agent Chat + Ultra gate + **ASI AMS Floppy** (future ESP32 / &lt;1 MB) in catalog / Downloads / verify (`--all`). Floppy is **recipe / future only** — never mark installed without a real weight file. Design brief lives in the training repo: `Agentic Micro Slm/Model/FLOPPY_ESP32_BRIEF.md`.

## Related

- [`../README.md`](../README.md) — full `models/` tree
- [`../custom/`](../custom/) — generic GGUF drop-in
- [`../router/`](../router/) — loopback `:7821` engine
- [`../../config/model-downloads.json`](../../config/model-downloads.json) — download recipes
- [`../../scripts/install-ams-models.mjs`](../../scripts/install-ams-models.mjs) — ship install
- [`../../scripts/verify-ams-gguf.mjs`](../../scripts/verify-ams-gguf.mjs) — CLI verify / place
