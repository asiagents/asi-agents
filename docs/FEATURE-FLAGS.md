# Feature flags & ship-safe defaults

**Research / Pre Release:** lean core (Chief, chat, agents, tasks, file store). Optional packs stay off unless you enable them.

Env vars win for headless installs. UI prefs live in `app-state.json` (never commit).

## Defaults matrix

| Feature | Ship-safe | Notes |
|---------|-----------|-------|
| **Core API + UI** (`:3445`) | **ON** | `npm run start` / `start-asi.cmd` |
| **File store** | **ON** | Default; no Postgres required |
| **Postgres control plane** | **OFF** | `ASI_USE_POSTGRES=0` (default) |
| **Virtual Desk / browser daemon** | **OFF** | Module ships; daemon optional. `ASI_DESK_AUTOSTART=0` on tiny hosts |
| **Arcade / games** | **Not shipped** | Omitted from this preview package |
| **Office campus UI** | **OFF** (hidden nav) | Route may exist; not a ship target |
| **AMS skill-run** | **OFF in production** | `ASI_AMS_SKILL_RUN=0` |
| **AMS advanced catalog** | **OFF** | Ship shows Micro 70M + Hybrid 120M; `ASI_AMS_SHOW_ADVANCED=1` for more |
| **SLM router** (`:7821`) | **OFF** unless needed | `npm run start:router` |
| **Squari Companion** | **OFF** (prod) | Settings → Modules → Show Squari |
| **Cloud provider keys** | Optional | Settings → Connections |

## Cheap-cloud env

```bash
NODE_ENV=production
ASI_AMS_SKILL_RUN=0
ASI_USE_POSTGRES=0
ASI_POSTGRES_DUAL_WRITE=0
```

Leave Desk daemon, Office, and dual Postgres unstarted. Prefer one small cloud key over hosting GGUFs on a tiny VPS.

## Related

- [`DEPLOY-SNAPDRAGON-X.md`](./DEPLOY-SNAPDRAGON-X.md)
- [`RESEARCH-PREVIEW.md`](./RESEARCH-PREVIEW.md)
