# API contract (Phase 0 — paths frozen)

Base: `http://127.0.0.1:3445` (production) or Vite proxy `/` in dev.

## Core

| Method | Path | Response (shape) |
|--------|------|------------------|
| GET | `/health` | `{ ok, service, port, router?: { port: 7821, stub: boolean, artifactsReady: boolean, status: "live" \| "off", startHint?: string } }` — `stub`/`status: "off"` when nothing answers on `:7821`; `artifactsReady` is disk-only (never means live). When live, chat tries `POST …/v1/chat/completions` first via `llm-routing.ts`. Start: `npm run start:router` |
| GET | `/registry` | `{ services: ServiceEntry[] }` |

## Onboarding

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/onboarding` | — | `{ complete: boolean, path?: "chat" \| "manual" \| null }` |
| POST | `/api/onboarding` | `{ path?: "chat" \| "manual" }` | `{ ok, complete, path? }` |

## Chief

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/chief/thread` | — | `{ messages, primary, secondary }` |
| DELETE | `/api/chief/thread` | — | `{ ok, messages: [] }` — clears Chief messages (fail-closed on error) |
| POST | `/api/chief/chat` | `{ text, modelId? }` | `{ messages: ChatMessage[] }` — **in-app intent layer** first ([`docs/INTENT-LAYER.md`](../../docs/INTENT-LAYER.md)); then AMS router `:7821`, then `routeGenerate` stack. Local hits use `meta.source: "in-app"`; router hits `meta.source: "ams"`. Optional `meta.clientActions` (JSON) for UI nav/panic. **`503`** when generate fails (fail-closed) |
| POST | `/api/chief/thread/append` | `{ entries: ThreadAppendEntry[] }` | `{ messages: ChatMessage[] }` — durable append for in-app handled turns (no LLM). Each entry: `{ role, text, intentId?, source? }` |

`ChatMessage.role`: `user` \| `chief` \| `system` \| `handoff`

`ChatMessage.meta` (optional): `primary`, `secondary`, `reason`, `agentId`, `upstreamModel`, `via`, token/latency metrics, **`intentId`**, **`source`** (`in-app` \| `ams` \| `llm`), **`decisionTrace`** (fan-out slots + confidence). See [`docs/CHAT-HISTORY.md`](../../docs/CHAT-HISTORY.md) and [`docs/INTENT-LAYER.md`](../../docs/INTENT-LAYER.md).

## Agents

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/agents` | `{ agents, lastScanAt, sources }` — from `config/agents.registry.json`, optionally merged with `config/ams-scan.agents.json`. **Chief is always present** (injected if missing from disk). Agents may include optional `reportsTo` (null/omit = flat peer). |
| POST | `/api/agents` | `{ count?, role?, name?, brief?, skills?, reportsTo?, primaryModelId?, secondaryModelId?, skipAutoModel?, seedWelcome?, agents?: { name?, role?, roleTag?, brief?, skills?, reportsTo?, primaryModelId?, secondaryModelId? }[] }` → **201** `{ created, agents }` — appends to `agents.registry.json` (same writer as Chief create-agent intents). **Fully local** (templates + role/brief heuristics) — never calls an LLM. **Default hire is flat** — omit `reportsTo` (do not invent a tree). Auto-names when omitted. Auto-skills from role/brief when `skills` omitted; model auto from Browse `selectedModelPool` unless `primaryModelId` set. Seeds **one** random local hire welcome from a 10–20 line pool into the agent thread (`seedWelcome` default true). Name may be `Name (role)`. |
| PATCH | `/api/agents/:id` | `{ reportsTo: string \| null }` → `{ agent, agents }` — set or clear manager (`null`/`""` = flat). Chief forbidden. |

## User prefs (Work vs Personal)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/prefs` | — | `{ prefs: { activeProfile, profiles: { work, personal } } }` — each slice: `favoriteAgentIds`, `homeMode`, `displayContext` (app-state, not Postgres) |
| PUT | `/api/prefs` | `{ activeProfile?, favoriteAgentIds?, homeMode?, displayContext?, profiles? }` | `{ prefs }` — shorthand fields patch the active profile slice; when **active homeMode** (or profile) changes, also runs council mode switch (see `POST /api/group/council-mode`) |

## Agents (threads)

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/agents/:id/thread` | `{ messages, primary, secondary }` — persisted registry agent thread (`agentThreads` / `agentThreadPrimary` in app-state) |
| DELETE | `/api/agents/:id/thread` | `{ ok, messages: [] }` — clears agent messages |
| POST | `/api/agents/:id/chat` | `{ text, modelId? }` → `{ messages: ChatMessage[] }` — `routeGenerate` in `llm-routing.ts`; offline canned reply when generate fails (registry agents). User + assistant rows include `meta.source: "llm"` |
| POST | `/api/agents/:id/thread/append` | `{ entries: ThreadAppendEntry[] }` → `{ messages }` — in-app handled turns on the agent thread |

Client: `api.agentThread(agentId)`, `api.agentChat(agentId, text, modelId?)`, `api.agentThreadAppend(agentId, entries)`.

## Board & council

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/board` | — | `{ boardIds, defaultBoardIds, councilIds, stances, topic }` — id lists include `chief` first; `stances`: `Record<agentId, { stance: "for" \| "info" \| "against", note }>` |
| PUT | `/api/board` | `{ boardIds?: string[], stances?: Record<...>, topic? }` | same shape — at least one field required; `boardIds` rejects empty array; Chief normalized on roster |
| POST | `/api/board/ask` | `{ topic? }` | Ask agents for stances via routeGenerate |
| POST | `/api/board/ticket` | `{ agentId? }` | `{ task }` — one-click Tasks ticket from topic + stances (default Chief); **400** if no topic |

## Pro sets

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/pro/sets` | — | `{ sets: { id, name, agentIds }[], activeSetId }` — built-ins from `config/pro-sets.registry.json` plus `custom`; **Chief in every set’s `agentIds`** |
| GET | `/api/pro/sets/:setId/members` | — | `{ setId, agentIds }` |
| PUT | `/api/pro/custom` | `{ agentIds: string[] }` | `{ agentIds }` — Chief re-injected; specialist ids only in body |
| PATCH | `/api/pro/active` | `{ setId }` | `{ ok, activeSetId }` |
| GET | `/api/pro/agents/:proId/thread` | — | `{ messages, primary, secondary }` — persisted Pro specialist thread (`proThreads` / `proThreadPrimary`); specialist ids from `config/pro-agents.registry.json` + pro set rosters |
| DELETE | `/api/pro/agents/:proId/thread` | — | `{ ok, messages: [] }` — clears Pro thread |
| POST | `/api/pro/agents/:proId/chat` | `{ text, modelId? }` | `{ messages: ChatMessage[] }` — `routeGenerate` in `llm-routing.ts`; optional `handoff` on cloud fallback. User + assistant rows include `meta.source: "llm"`. **`503`** `{ error, code: "generate_failed", tried? }` when no backend answers (fail-closed, same as Chief) |
| POST | `/api/pro/agents/:proId/thread/append` | `{ entries: ThreadAppendEntry[] }` | `{ messages }` — in-app handled turns on the Pro thread |
| PATCH | `/api/agents/:id/skills` | `{ skill, action?: "attach" \| "detach" }` | `{ agentId, skills }` — imported skills in app-state; merged on `GET /api/agents`; Chief rejected |
| GET | `/api/agents/:id/ams` | — | `{ agentId, catalogLabel, catalogTotal, enabledSkillIds, registrySkillIds, skills: { id, name, group, description?, source: "catalog" \| "registry", enabled }[], singleSkillRunEnabled }` — picks in `agentAmsSkills` merged with registry skills; catalog rows from `config/ams-skills.catalog.json` |
| PUT | `/api/agents/:id/ams` | `{ enabledSkillIds: string[] }` | same as GET — ids not in catalog are dropped; Chief rejected |
| POST | `/api/agents/:id/ams/run` | `{ skillId, text, modelId? }` | Single `routeGenerate` with agent context + skill `systemPrompt` from catalog → `{ agentId, skillId, text, via, modelId, note, messages? }`; appends user + agent rows with `meta.source: "ams"` and `intentId` = `skillId`. **`501`** when gated off (`ASI_AMS_SKILL_RUN=0`, or production without `=1`); **`400`** unknown/disabled skill; **`503`** when no LLM answers. Enabled by default when `NODE_ENV !== "production"` and env unset. |

Env: `ASI_BOARDS_DEFAULTS`, `ASI_PRO_SETS_REGISTRY`, `ASI_PRO_AGENTS_REGISTRY`, `ASI_AMS_SKILL_RUN` (`1` = force on; `0` = force off; unset = on in non-production).

Client: `api.proThread(proId)`, `api.proChat(proId, text, modelId?)`, `api.proThreadAppend(proId, entries)`, `api.chiefThreadAppend(entries)`.

## Models

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/models` | `{ models, meta?: { routerReady, routerLive?, routerStub?, probes: { ollama, llamacpp, customGguf, ams?: { catalogTotal, catalogShown, installedGguf }, api } } }` — `routerReady` = artifacts under `models/router/`; `routerLive` only when `:7821/health` OK. Each card has `kind`: `scanned` (on disk / Ollama / llama.cpp), `catalog` (AMS recipes from `models/ams/catalog.json` + other reference), or `api` (live provider model list when key configured). `probes` explains empty scans (service down, env unset, no keys). AMS catalog rows are not marked scanned until a matching `.gguf` exists under `models/ams/` or `models/custom/`. |
| GET | `/api/models/ams` | `{ label, installRoot, amsDir, catalogTotal, recipeCount, installedCount, installedGgufFiles, recipes[] }` — per-recipe `status: "recipe" \| "installed"` from real `.gguf` matches only; includes size/hardware hints + installSteps |
| POST | `/api/models/ams/place` | `{ sourcePath, recipeId?, fileName? }` → copy local `.gguf` into `models/ams/`; `{ ok, destPath, fileName, recipeId?, statusAfter, snapshot }` or **`400`** |
| GET | `/api/providers` | `{ providers: { id, displayName, signupUrl, docsUrl, supportsFreeTier }[], enabled: Record<id, boolean> }` — public metadata + persisted enable map (`local` / `relay` / registry ids), no secrets |
| GET | `/api/providers/enabled` | `{ enabled: Record<id, boolean> }` — same map from app-state |
| PUT | `/api/providers/enabled` | `{ id, enabled }` → `{ enabled }` — persists toggle; `local` stays locked on |
| GET | `/api/providers/keys` | `{ keys: Record<providerId, { configured: boolean, last4? }> }` — values never returned |
| PUT | `/api/providers/keys` | `{ providerId, apiKey }` → `{ providerId, configured, last4? }` — stored in `app-state.json`; empty `apiKey` clears |
| GET | `/api/providers/:id/models` | `{ models: { id, name? }[], error? }` — OpenAI-compat list when key configured; fail-closed when missing |
| GET | `/api/models/catalog` | `{ source: "openrouter" \| "curated", label, fetchedAt, total, limit, models: { id, name, provider, capabilities[], contextLength?, pricingHint?, modality?, notes? }[], error? }` — OpenRouter live (≤500, 1h server cache) when `openrouter` key set; else `config/models.capabilities.catalog.json`. Query: `q`, `capabilities` (comma-separated), `browse` (`free`, `local`, `api` comma-separated), `offset`, `limit` (≤100). `total` reflects filters before pagination. |
| GET | `/api/skills/catalog` | `{ source: "config", label, fetchedAt, total, limit, skills: { id, name, group, description?, systemPrompt? }[] }` from `config/ams-skills.catalog.json`. Query: `q`, `group`, `offset`, `limit` (≤500). |
| GET | `/api/models/downloads` | `{ label, items: ModelDownloadItem[], ams?: { catalogTotal, recipeCount, installedCount, installedGgufFiles, amsDir } }` from `config/model-downloads.json` (Ollama/GGUF/pip recipes — copy commands only). AMS items include live `status` / size hints after disk probe. |
| GET | `/api/tools/recommended` | `{ label, tools[] }` from `config/recommended-tools.json` (Ollama, llama.cpp, HF CLI, Docling, …). |
| GET | `/api/models/selection` | `{ selectedModelId: string \| null, selectedModelIds: string[] }` — desk default + Browse Models assignment pool |
| PATCH | `/api/models/selection` | `{ selectedModelId?, selectedModelIds? }` → same shape |
| GET | `/api/models/cascade` | `{ enabled: boolean, order: string[] }` — ordered failover from the assignment pool (not Micro→Hybrid staging) |
| PATCH | `/api/models/cascade` | `{ enabled?, order? }` → same shape; `order` is intersected with `selectedModelIds` |
| PATCH | `/api/agents/:id/models` | `{ primaryModelId?, secondaryModelId?, routePref? }` → persisted in `app-state` (`agentModelAssignments`, `agentRouting`; not registry file). `routePref`: `local` \| `cloud` \| registered `providerId:upstreamModel` |
| GET | `/api/agents/routing` | `{ routing: Record<agentId, routePref> }` — app-state overrides only |
| PUT | `/api/agents/routing` | `{ routing }` → replace map (invalid tokens skipped) |
| GET | `/api/agents/:id/thread` | `{ messages, primary, secondary, routePref, routeSource }` — registry agents (not Chief) |
| POST | `/api/agents/:id/chat` | `{ text, modelId? }` → `{ messages }` — `resolveAgentRoute` + `routeGenerate` |
| GET | `/api/pro/agents/:proId/thread` | same shape as agent thread — Pro specialists |
| POST | `/api/pro/agents/:proId/chat` | `{ text, modelId? }` → `{ messages }` or **503** fail-closed |
| GET | `/api/hardware` | `{ cpuThreads, cpuPercent, ramGb, ramUsedGb, ramUsedPct, vramGb, vramUsedGb, vramUsedPct, gpuPercent, notes[] }` — null usage/VRAM fields when probe missing (fail-closed); VRAM via nvidia-smi when present |
| GET | `/api/network` | `{ online, connType, productName, linkSpeedMbps, localIp, publicIp, isp, gateway, dns, city, region, country, checkedAt, sources, notes }` — OS + optional public IP/ISP; null = unavailable |
| GET | `/api/network/speed` | `{ downloadMbps, provider: "fast.com", checkedAt, notes }` — server-side fast.com sample; `downloadMbps` null on failure |
| GET | `/api/audit` | `{ ok, scope: "local-files", ranAt, stateFile, findings[], assumptions[], routingDecisions?, patterns?, summary }` — file-backed audit of app-state / agents / models / Desk probe / permissions / research stub + simple fail-closed patterns from local threads. No SQL DB; secrets never returned; no ML |
| POST | `/api/audit/run` | same as GET — explicit run for Settings → Audits |
| GET | `/api/audit/spend` | `{ events, note }` — provider generate spend ring buffer |
| GET | `/api/audit/routing` | `{ events, note }` — fan-out routing decision ring buffer |

Client: `api.audit()`, `api.runAudit()`, `api.auditSpend()`, `api.auditRouting()`. Learn actions use existing `POST /api/lessons` and `POST /api/tasks`.

## Permissions

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/permissions` | `{ items: PermissionItem[] }` — `PermissionItem`: `{ id, title, description, kind: "shell" \| "spend" \| "skill" \| "other", status: "pending" \| "approved" \| "denied" \| "always" }` |
| POST | `/api/permissions/:id/:action` | `action`: `approve` \| `deny` \| `always` → `{ ok }` |
| GET | `/api/permissions/standing` | `{ rules: StandingPermissionRule[] }` — catalog with persisted policies; invalid/missing policies fail closed to **Ask** except catalog defaults |
| PUT | `/api/permissions/standing` | `{ rules: { id, policy }[] }` — merge policy overrides by catalog id → `{ rules: StandingPermissionRule[] }` |

`PermissionPolicy`: `ask` \| `always` \| `never`. `StandingPermissionRule`: `{ id, category: "spend" \| "shell" \| "skill", label, detail, policy }`.

Client: `api.permissions()`, `api.permAction(id, action)`, `api.standingPermissions()`, `api.putStandingPermissions(rules)`.

## Channels

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/channels/drafts` | — | `{ drafts: ChannelDraft[] }` |
| POST | `/api/channels/drafts` | `{ channel, title, meta?, to?, body? }` | `{ draft }` — `channel`: `gmail` \| `github` \| `telegram` |
| PATCH | `/api/channels/drafts/:id` | partial `{ title, meta, to, body, channel }` | `{ draft }` — 404 if missing or already sent |
| POST | `/api/channels/drafts/:id/send` | — | `{ ok, message }` — 404 when draft missing |

Client: `api.channelDrafts()`, `api.createChannelDraft()`, `api.patchChannelDraft()`, `api.sendDraft(id)`.

## Inbox email (IMAP)

Env (server): `ASI_IMAP_HOST`, `ASI_IMAP_USER`, `ASI_IMAP_PASS` (required for env mode); optional `ASI_IMAP_PORT` (default `993`), `ASI_IMAP_SECURE` (`true`|`false`, default true), `ASI_IMAP_MAILBOX` (default `INBOX`), `ASI_IMAP_KIND` (`imap`|`gmail`). Env overrides `app-state.json` `mailConnection`.

Gmail OAuth (optional): `ASI_GMAIL_CLIENT_ID`, `ASI_GMAIL_CLIENT_SECRET`, `ASI_GMAIL_REDIRECT_URI` **or** save the same under `PUT /api/connections/oauth-clients/gmail` (Connections → Configure — Secret saved + last4). Default redirect `http://localhost:3445/api/inbox/email/oauth/callback`. Tokens in `mailConnection` — never returned on status. Drive is a separate Connect (`/api/drive/*`, `drive.readonly`). POP3 not shipped.

Send (SMTP): same app-password credentials as IMAP when configured. Optional env: `ASI_SMTP_HOST`, `ASI_SMTP_PORT`, `ASI_SMTP_SECURE` (defaults: Gmail → `smtp.gmail.com`; `imap.*` host → `smtp.*`). Fail-closed when unconfigured; Gmail OAuth send may still be `501` until SMTP OAuth is wired.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/inbox/email/status` | — | `{ configured, mode, …, gmailOAuthReady?, gmailOAuthLast4?, pop3Supported: false, … }` — no secrets |
| POST | `/api/inbox/email/test` | — | `{ ok, host, port, mailbox, messageCount }` or `502`/`503` |
| GET | `/api/inbox/email/messages` | — | `{ configured, messages, hint? }` |
| GET | `/api/inbox/email/oauth/start` | query `address?`, `label?` | `302` to Google when OAuth configured; else `501` |
| GET | `/api/inbox/email/oauth/callback` | Google `code`, `state` | `302` to Connections on success |
| PUT | `/api/inbox/email/connection` | IMAP/Gmail password body or `{}` to clear | status |
| PUT | `/api/connections/oauth-clients/:slot` | `{ clientId, clientSecret, redirectUri? }` | `{ configured, last4, … }` — slots: `gmail` \| `google_calendar` \| `google_drive` \| `microsoft` |
| GET/POST | `/api/drive/*` | — | Drive status, OAuth, list files (`drive.readonly`) |
| GET/POST/DELETE | `/api/files/*` | — | Local file manager under data dir (`files` + `uploads`) |

`InboxEmailMessage`: `{ id, from, address, subject, time, unread, body, suggest }` — `suggest` empty until routing exists.

Client: `api.inboxEmailStatus()`, `api.inboxEmailMessages()`, `api.putInboxEmailConnection(body)`, `api.inboxEmailOAuthStartUrl({ address?, label? })`, `api.sendInboxEmail(body)`.

## Tasks / Research pipeline

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/tasks` | — | `{ tasks: AgentTask[] }` |
| POST | `/api/tasks` | `{ title, agentId, status?, due?, researchId?, step?, note? }` | `{ task }` (201) |
| PATCH | `/api/tasks/:id` | partial task fields | `{ task }` |
| DELETE | `/api/tasks/:id` | — | `{ ok: true }` |
| GET | `/api/tasks/:id/comments` | — | `{ comments: TaskComment[] }` |
| POST | `/api/tasks/:id/comments` | `{ text, author? }` | `{ comment, task }` (201) — ticket thread, persisted on task |
| POST | `/api/tasks/research` | `{ question, agentId?, type?, depth?, selection?, format?, participate?, liveWeb?, maxVirtualAgents?, multiAgent?, preferFree? }` | Creates scope/gather/draft/review/report tasks, then runs **gather → draft → report** via `routeGenerate` (Research agent). Optional **`liveWeb`** uses Virtual Desk browser (`/api/v1/browser/*` on :3456) for real page fetch/search; fail-closed to model knowledge + honest disclaimer when Desk offline or empty. Posts brief + report (or fail notice) to that agent's chat thread. `{ researchId, tasks, brief, stub: false, pipelineOk, webSearchAvailable, liveWebRequested?, disclaimer, report?, steps?, error?, message }` (201). **`pipelineOk: false`** = fail-closed (no invented report; blocked task notes). Never invents search results. |

Client: `api.tasks()`, `api.createTask()`, `api.createResearchTasks()`, `api.patchTask()`, `api.deleteTask()`, `api.taskComments()`, `api.addTaskComment()`.

## Cron / company ops / agent API keys (MVP)

| Method | Path | Notes |
|--------|------|-------|
| GET/POST/PATCH/DELETE | `/api/cron` | Interval task creator (not crontab); Settings → Company ops |
| GET/POST/PATCH/DELETE | `/api/adapters` | Allowlisted subprocess/HTTP adapter registry (app-state). Create disabled by default. |
| POST | `/api/adapters/:id/invoke` | `{ input? }` — run only the allowlisted target. **`501`** when AMS skill-run gate off (`ASI_AMS_SKILL_RUN`); **`403`** if adapter disabled; subprocess via `execFile` (no shell); HTTP POST to registered URL only. Not reachable from chat as free-form shell. |
| GET | `/api/skills/graph` | Simple AMS skill graph: catalog skill nodes, group hubs, agent-pick edges. `{ shipped, studio: false, nodes, edges }` — not Paperclip Studio. |
| GET/POST/DELETE | `/api/agents/:id/api-key` | Per-agent Bearer for POST chat; loopback UI exempt |
| GET | `/api/skill-templates` · POST `…/:id/apply` | Name-pack agent presets — Skill Studio graph is separate (`/api/skills/graph`) |
| GET | `/api/company-ops` | Honest shipped vs not-shipped cards (adapters + skill graph marked shipped) |
| GET | `/api/train/status` | Fine-tune **not shipped**; points at company briefing training |

CLI: `npm run asi -- health|agents|train`.

Client: `api.adapters()`, `api.createAdapter()`, `api.patchAdapter()`, `api.deleteAdapter()`, `api.invokeAdapter()`, `api.skillsGraph()`.

## Group council

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/groups` | — | `{ groups: GroupChatSummary[], activeGroupId }` — named group list |
| POST | `/api/groups` | `{ name, memberIds?, activate? }` | `{ group, groups, activeGroupId }` — create named group (201) |
| GET | `/api/groups/:id` | — | same shape as session snapshot (`id`, `name`, `topic?`, `memberIds`, …) |
| PATCH | `/api/groups/:id` | `{ name?, topic?, announceTopic?, session?, activate?, moderatorId? }` | session snapshot; `announceTopic: true` appends a system line “Topic set to …” |
| DELETE | `/api/groups/:id` | — | `{ ok, groups, activeGroupId }` — fails if last group |
| PUT | `/api/groups/:id/members` | `{ memberIds }` | session snapshot — Chief always kept |
| POST | `/api/groups/:id/members` | `{ agentId }` | session snapshot — add one |
| DELETE | `/api/groups/:id/members/:agentId` | — | session snapshot — cannot remove Chief |
| GET | `/api/groups/:id/messages` | — | `{ messages: GroupMessage[] }` |
| DELETE | `/api/groups/:id/messages` | — | `{ ok, messages: [] }` — clear thread; keep members / topic |
| POST | `/api/groups/:id/decide` | `{ action, text? }` | `{ label, proposalDecision? }` |
| POST | `/api/groups/:id/generate` | `{ text? }` | `{ messages, results[], label }` — optional `text` posts a user line first; each voting member replies via `routeGenerate` (fail-closed per member) |
| POST | `/api/groups/:id/activate` | — | sets active group for legacy `/api/group/*` |
| GET | `/api/group` | — | active group session snapshot (`id`, `name`, `memberIds`, …) |
| GET | `/api/group/session` | — | same as GET `/api/group` |
| PATCH | `/api/group/session` | `{ session: "open" \| "closed" }` | same shape — opening resets `proposalDecision` to `open` |
| POST | `/api/group/council-mode` | `{ mode: "super" \| "multi" \| "pro", previousMode? }` | `{ switched, mode, group }` — mode-scoped council: Multi/Pro seats saved separately (Chief shared); entering Multi/Pro resets topic/votes/moderator, keeps messages for read-back. `previousMode` required for a correct first switch before `councilMode` is stamped. |
| GET | `/api/group/messages` | — | active group messages |
| POST | `/api/group/decide` | `{ action: "approve" \| "ask" \| "reject" \| "reopen" \| "message", text? }` | `{ label, proposalDecision? }` |
| POST | `/api/group/generate` | `{ text? }` | same as `/api/groups/:id/generate` on the **active** group |
| PUT/POST/DELETE | `/api/group/members`… | same as `/api/groups/:id/members` on the **active** group | session snapshot |

`GroupChatSummary`: `{ id, name, memberIds, session, messageCount, proposalDecision }`.

### Chat roster (1:1 sidebar)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/chat/roster` | — | `{ agentIds, filtered }` — `filtered: false` means show all registry agents |
| PUT | `/api/chat/roster` | `{ agentIds }` | `{ agentIds, filtered: true }` |
| POST | `/api/chat/roster/members` | `{ agentId }` | add one (materializes full roster if previously unfiltered) |
| DELETE | `/api/chat/roster/members/:agentId` | — | remove one (Chief cannot be removed) |

Client: `api.listGroups()`, `api.createGroup()`, `api.addGroupMember()`, `api.removeGroupMember()`, `api.chatRoster()`, `api.addChatRosterMember()`, `api.removeChatRosterMember()`, plus legacy `api.groupCouncil()`, `api.groupSession()`, `api.patchGroupSession(session)`, `api.groupMessages()`, `api.groupDecide(action)`.

## Company / Training

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/company/briefing` | — | `{ briefing: CompanyBriefing \| null }` — app-state `companyBriefing` |
| PUT | `/api/company/briefing` | `{ text }` | `{ briefing }` — paste About Us text (fail-closed if too short) |
| POST | `/api/company/briefing/fetch` | `{ url }` | `{ briefing }` — server-side fetch, HTML→text, size-limited; **4xx/5xx** on failure (no fake scrape success) |
| DELETE | `/api/company/briefing` | — | `{ ok, briefing: null }` |
| GET | `/api/agents/training` | — | `{ briefing, freshness, trainedCount, lastTrainedAt, agents[], groupFinalLessons[], pinnedLessonCount }` — `freshness`: `{ level: fresh\|aging\|stale\|missing, ageDays, label }` |
| POST | `/api/agents/training/send-all` | — | `{ ok, trainedCount, agentIds, trainedAt, …, diff }` — `diff` reports newly vs re-trained agents + briefing char change; also appends a Lesson; chat/council inject training + **pinned** then recent Lessons. **400** if no briefing |

`GET /api/agents` includes `learnings[]` from `agentTraining` when present.

Client: `api.companyBriefing()`, `api.putCompanyBriefing(text)`, `api.fetchCompanyBriefing(url)`, `api.clearCompanyBriefing()`, `api.agentsTraining()`, `api.sendAllAgentsToTraining()`.

## Lessons

Learning-process store (not generic files). App-state `lessons[]`: `{ id, title, body, source, agentIds, createdAt, pinned? }` with **auto-tag** `source` = `research` \| `training` \| `group_final` \| `manual` (UI label for `group_final`: Final). Auto-created when a research report completes, after “Send all to training”, and on successful group Final. **Pinned** Lessons always inject into trained-agent system context (before recent unpinned).

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/lessons` | — | `{ lessons: Lesson[] }` (pinned first, then newest) |
| POST | `/api/lessons` | `{ title, body, source?, agentIds?, pinned? }` | `{ lesson }` — **201**; **400** if title/body missing |
| PATCH | `/api/lessons/:id` | `{ pinned?, title?, body? }` | `{ lesson, lessons }` — pin/unpin for training inject |
| DELETE | `/api/lessons/:id` | — | `{ ok, lessons }` — **404** if missing |

UI: **`/lessons`** (search + source filter + pin) and Settings → Company / Training (freshness badge, training diff, Group Finals list). Client: `api.lessons()`, `api.createLesson(…)`, `api.patchLesson(id, …)`, `api.deleteLesson(id)`.

## Board ticket

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/board/ticket` | `{ agentId? }` | `{ task }` — one-click Tasks ticket from current board topic + stances (default assignee Chief); **400** if no topic |

Client: `api.createBoardTicket()`.

## Calendar (Google live · Microsoft stub)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/calendar/status` | — | `{ configured, enabled, connector, accountLabel, live, syncReady, oauthConfigured?, googleConnected?, microsoftOAuthConfigured?, microsoftShipped?, message }` — `live` only for Google with valid tokens |
| GET | `/api/calendar/events` | — | `{ events: CalendarEventItem[], configured, live, message? }` — **today only**, primary calendar; **`events: []`** when off, not connected, Microsoft stub, or API error (no demo data) |
| GET | `/api/calendar/prefs` | — | `{ prefs: { enabled, connector, accountLabel? } }` (no tokens) |
| PUT | `/api/calendar/prefs` | `{ enabled?, connector?, accountLabel? }` | `{ prefs, status }` — `connector`: `google` \| `microsoft` \| `apple` \| `caldav` \| null |
| GET | `/api/calendar/oauth/google/start` | — | Redirect to Google consent (503 JSON if server OAuth env missing) |
| GET | `/api/calendar/oauth/google/callback` | — | OAuth redirect handler → UI `/settings/connections?calendar_oauth=…#calendar` |
| POST | `/api/calendar/oauth/google/disconnect` | — | `{ ok, status }` — clears stored tokens |
| GET | `/api/calendar/oauth/microsoft/start` | — | **501** JSON stub with Azure setup hint — never redirects / never invents events |

Env (server): `ASI_GOOGLE_CALENDAR_CLIENT_ID`, `ASI_GOOGLE_CALENDAR_CLIENT_SECRET`; optional `ASI_GOOGLE_CALENDAR_REDIRECT_URI`, `ASI_UI_ORIGIN`. Microsoft stub env (detected only): `ASI_MICROSOFT_CALENDAR_CLIENT_ID`, `ASI_MICROSOFT_CALENDAR_CLIENT_SECRET`, optional `ASI_MICROSOFT_CALENDAR_REDIRECT_URI`.

Client: `api.calendarStatus()`, `api.calendarEvents()`, `api.calendarPrefs()`, `api.putCalendarPrefs(patch)`, `api.calendarGoogleConnect()`, `api.calendarGoogleDisconnect()`.

## Virtual computer

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/desk/status` | `{ live, url, desks?, consoleUrl, launchHint, externalRepoPath, autostartEnabled }` |
| POST | `/api/desk/start` | Spawn Desk daemon when `ASI_DESK_AUTOSTART` on; poll until live or fail-closed |
| GET | `/api/modules` | Installed optional packs + status (Settings → Modules) |
| GET | `/api/browser/status` | Alias of desk status (BrowserPane / `@asi-api`) |
| GET | `/api/browser/health` | Desk health probe alias |
| POST | `/api/browser/panic`, `/api/browser/sessions`, `/api/browser/sessions/:id/tools` | Browser session aliases (virtual-computer routes) |

## Control stubs

| Method | Path |
|--------|------|
| POST | `/ctl/models/unload` |
| POST | `/ctl/ollama/restart` |
| POST | `/ctl/router/restart` |
| POST | `/ctl/desk/restart` |
| POST | `/ctl/app/restart` |
| POST | `/ctl/calls/kill-online` |
| POST | `/ctl/calls/kill-all` |

Hardware client: `api.hardware()` → `HardwareSnapshot`.

Providers client: `api.providers()`, `api.providerKeys()`, `api.putProviderKey(providerId, apiKey)`, `api.providerModels(id)`.

Models scan (Settings): `api.scanModels()` → `ModelsApiResponse` (`ok: false` + empty `models` when unreachable); `api.models()` uses the same response shape. Catalog: `api.modelsCatalog({ q, capabilities, browse, offset, limit })`.

Types: mirror `src/server/src/types.ts` and exported interfaces in `src/app/src/api.ts`.
