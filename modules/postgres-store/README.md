# `@asi-agents/postgres-store`

Optional control-plane DB module. **Default stays files** (`app-state.json` / FileStore).

MVP ships:

- Dual-write mirror stub (`dualWriteMirror`) — logs only, no fake SQL success
- `createPostgresStore` returns `null` until a real driver lands

See [docs/OPTIONAL-POSTGRES-MODULE.md](../../docs/OPTIONAL-POSTGRES-MODULE.md).
