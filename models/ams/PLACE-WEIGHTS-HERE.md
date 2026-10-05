# Place AMS weights here

This **GitHub-clean** tree ships **recipes + docs only**. Weight blobs (`.onnx` / `.gguf`) are **not** in git.

## Expected ship pair

| File | Role |
|------|------|
| `ams-micro-70m.onnx` | ASI AMS Micro 70M (~260 MB ONNX) |
| `ams-hybrid-120m.onnx` | ASI AMS Hybrid 120M (~440 MB ONNX) |

## Where to get them

1. **GitHub Release** — download `ASI-Agents-v0.1-Pre-Release-Snapdragon.zip` (weights under `models/ams/`) **or** the separate onnx Release assets, then copy into this folder.
2. **Hugging Face** — `npm run install:ams` (repos: [ams-micro-70m](https://huggingface.co/vvarghese/ams-micro-70m), [ams-hybrid-120m](https://huggingface.co/vvarghese/ams-hybrid-120m); optional `HF_TOKEN`, never commit tokens).

Then:

```powershell
npm run verify:ams
# or
.\scripts\pull-models.cmd
```

Honest result: both **installed**, or clear **missing** — never faked.
