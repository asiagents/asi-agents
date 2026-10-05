# ASI Agents — GitHub-clean checklist

**Brand:** ASI Agents only.  
**Docs:** `README.md` · `LICENSE` · `GITHUB-RELEASE-NOTES.md` · `GITHUB-UPLOAD.md` · `PUBLIC-LISTING.md` · `docs/UPDATES.md` · this file.

| Item | Status |
|------|--------|
| No `*.onnx` / `*.gguf` in tree | ✅ |
| `.gitignore` covers `.env`, `node_modules`, `dist`, weights, `app-state` | ✅ |
| Optional `.gitattributes` (LFS stubs) | ✅ |
| Games / Arcade omitted | ✅ |
| `start-asi.cmd` + `scripts/pull-models.cmd` + `scripts/update-asi.cmd` | ✅ |
| Port **3445** | ✅ |
| LICENSE (MIT) | ✅ |
| Release story: AMS + virtual-computer in Snapdragon zip | ✅ |

```powershell
npm.cmd run setup
npm.cmd run build
npm.cmd run install:ams   # or drop Release onnx into models\ams\
.\scripts\pull-models.cmd
npm.cmd run start
# → http://127.0.0.1:3445
```
