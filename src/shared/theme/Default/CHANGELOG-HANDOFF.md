# Default theme — handoff changelog

## Changed (fix batch 1–13)

1. **Screenshots** — Removed placeholder JPEG references; `EmptyVisual` + `themeAssets` gate real captures only.
2. **Models on onboarding** — Models step skipped after first completion (`localStorage` `modelsOnboardingDone`).
3. **Custom build** — Catalog agent picker + skills on new agents; catalog add in onboarding for Custom set.
4. **Pro set vs agents list** — Pro mode thread sidebar lists `activeAgents` under the exact set name header.
5. **Dummy data** — Council starts closed; snapshot seeds empty; scout sidebar only when actually offline.
6. **Professor / specialist detail** — Pro home detail shows model + **Chat**; core agent profiles show model + **Open chat**.
7. **Status under chat** — Pro threads pass `setName` (exact set, e.g. Education) in chat header.
8. **Headers** — Pro home/sidebar use `categoryName` without redundant “set” suffix where misleading.
9. **Coder / desk** — `DeskLiveView` (iframe `:3456` + not-running state) on Desk page and Coder profile.
10. **Group ≠ Chat** — `GroupSidebar` replaces full chat thread list on `/group`; thread sidebar **Add an agent** / **Add a group**.
11. **Desk snapshots** — No pre-seeded fake snapshots; terminal frames remain synthetic until real captures exist.
12. **General settings** — Pro agent set summary with **Edit set & skills** → `/settings/pro`.
13. **Models page** — Recommended list + model detail **Assign** / **Add to recommended** (`localStorage`).

Also: rebranded package metadata and README (neutral product naming; design-tool branding removed).

## Remains open

- **Real screenshot assets** — Add files to `public/` and register basenames in `src/utils/themeAssets.ts`.
- **Pro chat model changes in-thread** — Model assign is via Settings → Pro agents or Models → Assign (not Agent panel for pro ids).
- **Wire into `src/app`** — Out of scope for this pass.
- **Backend / desk service** — Theme does not start `localhost:3456`; integration is manual.
- **Demo narrative data** — Chief/capstone sample threads remain for UX walkthrough; replace with live API when available.

## 2026-10-01 — group + chat add/remove

- Named groups: `GET/POST /api/groups`, members add/remove, `/group/:groupId` UI.
- Chat roster: `GET/PUT/POST/DELETE /api/chat/roster` — sidebar Add/Remove agents.
- Seed script: `scripts/seed-test-mode-group.ts` creates **test mode**, mixed free local/OpenRouter assignments, Tesla naming prompt. `POST …/generate` remains **501**.

## 2026-09-30 — no-demo lock (executor note)
- Demo narrative seeds cleared earlier where present; **live ship UI is `src/app`** (Default via `@theme`).
- Desk roster SoT: `config/agents.registry.json` via `GET /api/agents` (not invented demo rows).
- Do not re-merge Default wire; do not empty the registry for "demo-kill".
