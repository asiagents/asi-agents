# Browser tool schemas (Desk :3456 → ASI `/api/browser/*`)

| Tool | Args | Notes |
|------|------|--------|
| `open` | `{ url }` | Allowlist + pirate block; fail-closed |
| `snapshot` | — | Returns `refs[]` with `ref`, `role`, `name` |
| `click` | `{ ref }` | From last snapshot |
| `type` | `{ ref, text }` | Fill input |
| `press` | `{ key }` | Keyboard (e.g. Enter) |
| `scroll` | `{ dy }` | Mouse wheel delta |
| `wait` | `{ ms }` | Max 30s |
| `tabs` | `{ action: list\|new\|switch, index? }` | Per-agent tab strip |
| `read` | `{ maxChars? }` | Visible body text |
| `screenshot` | `{ fullPage? }` | PNG base64 |
| `download` | `{ confirmed: true }` | MVP returns not implemented unless confirmed |
| `form.fill` | `{ fields: [{ref,value}], confirmSensitive? }` | Password fields → `needsConfirm` until approved |

Research NL (not tools): `POST /api/v1/research/movie|song` with `{ query, agentId }` — citations only on allowlisted hosts.

Allowlist: `config/browser-allowlist.yaml`.
