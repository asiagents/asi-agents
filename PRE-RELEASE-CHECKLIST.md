# ASI Agents v0.1 Pre Release — checklist

**Brand:** ASI Agents only.  
**Docs shipped:** `README.md` · `LICENSE` · this file.

| Item | Status |
|------|--------|
| Sanitized tree (no `node_modules`, `dist`, `.env`, games, planning docs) | ✅ |
| `start-asi.cmd` one-click | ✅ |
| Getting Started inside `README.md` | ✅ |
| Port **3445** | ✅ |
| Virtual Computer + Companion OOB (Desk optional) | ✅ |
| **AMS ONNX bundled** (`ams-micro-70m.onnx` + `ams-hybrid-120m.onnx` under `models/ams/`) | ✅ |
| LICENSE | ✅ |
| Secret / brand scan | ✅ |

```powershell
# Double-click start-asi.cmd
npm.cmd run setup
npm.cmd run build
npm.cmd run start
# → http://127.0.0.1:3445
# Optional: npm run verify:ams
```
