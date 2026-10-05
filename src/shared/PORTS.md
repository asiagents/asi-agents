# ASI Agents — locked ports (Phase 0)

| Service | Port | URL | Notes |
|---------|------|-----|--------|
| **API + built UI** | `3445` | `http://127.0.0.1:3445` | `@asi-agents/server`; env `ASI_SERVER_PORT` / legacy `ASI_ENGINE_PORT` |
| **Vite dev UI** | `5173` | `http://127.0.0.1:5173` | `@asi-agents/app`; proxies API to 3445 via `vite.config.ts` |
| **SLM router stub** | `7821` | `http://127.0.0.1:7821` | Placeholder in registry; `models/router/` may be empty |
| **Virtual desk daemon** | `3456` | `http://127.0.0.1:3456` | External repo; probe `GET /api/v1/desks` |
| **Ollama** (optional) | `11434` | `http://127.0.0.1:11434` | Chief primary when live |

## Health checks

- Server: `GET http://127.0.0.1:3445/health` → `{ ok, service, port }`
- Registry: `GET http://127.0.0.1:3445/registry` → service list with live/slow/off
- Desk module: `GET http://127.0.0.1:3445/api/desk/status` → probes `:3456/api/v1/desks`

## User data (Windows)

`%LOCALAPPDATA%/ASI Agents/` — `app-state.json`, `services.json`
