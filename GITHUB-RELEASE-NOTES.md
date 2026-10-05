# ASI Agents v0.1 — Research Preview

**Your local-first multi-agent desk.** A Chief of staff, companions, and a Virtual Desk — running on *your* machine. Private by default. Local models when you want them. Cloud only when you opt in. **No account required to start.**

This is a **research preview**: early, honest, and built for people who want to poke around on real hardware (Snapdragon X / Galaxy Book4 especially). Not a finished product — an invitation to experiment.

---

## Grab the right download

| You want… | Get this… |
|-----------|-----------|
| **Clone / develop** | GitHub **repo** (github-clean source). Lean tree — **no ONNX** in git. |
| **Try it now** | GitHub **Release** asset: **`ASI-Agents-v0.1-Pre-Release-Snapdragon.zip`** — full Snapdragon drop with **AMS + Virtual Desk** so you do **not** need a Hugging Face hunt to start. |

**Repo push = code.** **Release zip = AMS + Desk ready-to-run package.** Don’t mix them up.

---

## What’s in the Release zip

Cloners who grab the **Release** asset get **Desk + AMS** without hunting Hugging Face:

| Included | Detail |
|----------|--------|
| **AMS** | At least **ASI AMS Micro 70M** (efficient default). This build ships **both** Micro + Hybrid when already bundled (`ams-micro-70m.onnx` + `ams-hybrid-120m.onnx` under `models/ams/`). |
| **Virtual Computer** | `modules/virtual-computer` — Desk / Virtual Desktop included in the zip. |
| **App** | UI + API on port **3445** · Companion (Squari) on localhost · Snapdragon / Windows ARM64–friendly first run |

**github-clean** git push stays lean (source + recipes only). Hugging Face remains optional for weight-only downloads or regenerating AMS later — not required if you unzip the Release.

Arcade / games are out. Postgres stays off unless you turn it on. Keep it light; keep it local.

---

## Fire it up (Windows / Snapdragon)

1. Install **Node.js 20+** (prefer **ARM64** on Snapdragon X).
2. Unzip the **Release** zip somewhere writable (AMS + Desk already inside).
3. Double-click **`start-asi.cmd`**, *or* from the package root:

```powershell
npm.cmd run setup
npm.cmd run build
npm.cmd run start
```

4. Open **http://127.0.0.1:3445** and say hello to Chief.

Cloning the **repo** instead? Same three commands after you place AMS weights in `models/ams/` (copy from the Release zip, or Hugging Face). Optional: `.\scripts\pull-models.cmd` to verify. Without a chat backend yet, Chief returns **503** — fail-closed by design, not a mystery.

---

## Staying current (patches)

Research preview — **no silent auto-updater**. Practical paths for skills / modules / app:

| Path | What to do |
|------|------------|
| **Git branches** | `main` = stable preview · `updates` (or version tags like `v0.1.1-pre`) = patch channel |
| **Script** | `.\scripts\update-asi.cmd` — pull latest (`main` / `updates`), optional rebuild, or open Release notes / drop a module zip into `modules/` |
| **In-app** | Settings → Modules → **Check for updates** — opens GitHub Releases (honest stub; does not auto-install) |

Details: [`docs/UPDATES.md`](UPDATES.md).

---

## Research preview — straight talk

APIs, UI, and defaults will move. Treat this as an early lab build, not production software. Report issues kindly. Secrets never ship in the zip or the repo.

Welcome aboard. Open `:3445` and see what a local multi-agent desk feels like.

---

**ASI Agents** · local-first · transparent handoffs · research preview · no account to start
