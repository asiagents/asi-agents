/**
 * Local file-backed audit — reads app-state, agent registry, model pool/disk,
 * and provider key status. No SQL DB; no inventing remote inventory.
 * Patterns are simple counts from local threads / logs — not ML.
 */
import fs from "node:fs";
import type { Express } from "express";
import { probeDesk } from "@asi-agents/virtual-computer/probe";
import { loadAgents } from "./agents.js";
import { getChiefThread } from "./chief.js";
import { listAmsGguf, listCustomGguf, routerReady } from "./modelPaths.js";
import { servicesJsonPath, statePath } from "./paths.js";
import { PROVIDER_REGISTRY } from "./providers.registry.js";
import { getStandingPermissionRules } from "./standingPermissions.js";
import {
  getAgentThreadMessages,
  getSelectedModelId,
  getSelectedModelPool,
  listAgentModelAssignments,
  listProviderKeyStatus,
  listProviderSpendLog,
  listRoutingDecisions,
  listTasks,
  loadState,
} from "./store.js";
import type { ChatMessage, RoutingDecisionEvent } from "./types.js";
import { isChiefId } from "./withChief.js";

export type AuditSeverity = "info" | "warn" | "risk";

export type AuditArea =
  | "app-state"
  | "registry"
  | "agents"
  | "models"
  | "providers"
  | "research"
  | "desk"
  | "permissions";

export interface AuditFinding {
  id: string;
  severity: AuditSeverity;
  area: AuditArea;
  title: string;
  detail: string;
  /** Local path or field reference — never secrets. */
  evidence?: string;
}

export interface AuditAssumption {
  id: string;
  assumption: string;
  risk: string;
  basedOn: string[];
}

export interface AuditFailEvent {
  id: string;
  at: string;
  agentId: string;
  agentLabel: string;
  reason: string;
  text: string;
  kind: "chat_fail_closed";
}

export interface AuditPatternCount {
  key: string;
  label: string;
  count: number;
}

/** Simple local tallies — honest empty / sparse when history is thin. */
export interface AuditPatterns {
  sparse: boolean;
  note: string;
  failClosedCount: number;
  topFailReasons: AuditPatternCount[];
  frequentAgents: AuditPatternCount[];
  failByDay: { day: string; count: number }[];
  events: AuditFailEvent[];
}

export interface AuditReport {
  ok: true;
  scope: "local-files";
  ranAt: string;
  stateFile: string;
  findings: AuditFinding[];
  assumptions: AuditAssumption[];
  /** Recent fan-out routing decisions (also on chat message meta). */
  routingDecisions?: RoutingDecisionEvent[];
  /** Fail-closed + agent frequency patterns from live threads. */
  patterns?: AuditPatterns;
  summary: {
    findings: number;
    risks: number;
    warns: number;
    infos: number;
    assumptions: number;
    failClosed?: number;
  };
}

function pushFinding(out: AuditFinding[], f: AuditFinding): void {
  out.push(f);
}

function isFailClosedMessage(m: ChatMessage): boolean {
  const text = m.text ?? "";
  const reason = m.meta?.reason ?? "";
  return (
    /fail closed|fail-closed|generate_failed|generate unavailable|no generate backend/i.test(text) ||
    /fail_closed|generate_offline|intent_fail_closed|generate_failed/i.test(reason)
  );
}

function failReasonOf(m: ChatMessage): string {
  const reason = (m.meta?.reason ?? "").trim();
  if (reason) return reason;
  const text = (m.text ?? "").trim();
  if (!text) return "Fail-closed (no detail)";
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

function dayKey(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function collectFailClosedEvents(
  nameOf: (id: string) => string
): AuditFailEvent[] {
  const events: AuditFailEvent[] = [];
  const ingest = (messages: ChatMessage[] | undefined, agentId: string) => {
    if (!messages?.length) return;
    for (const m of messages) {
      if (!isFailClosedMessage(m)) continue;
      events.push({
        id: m.id,
        at: m.at,
        agentId,
        agentLabel: nameOf(agentId),
        reason: failReasonOf(m),
        text: (m.text ?? "").trim() || "Fail-closed reply",
        kind: "chat_fail_closed",
      });
    }
  };

  ingest(getChiefThread().messages, "chief");
  const state = loadState();
  const threadMap = state.agentThreads ?? {};
  for (const agentId of Object.keys(threadMap)) {
    ingest(getAgentThreadMessages(agentId), agentId);
  }
  // Also scan known roster agents with empty map keys skipped above
  for (const a of loadAgents().agents) {
    if (isChiefId(a.id) || threadMap[a.id]) continue;
    ingest(getAgentThreadMessages(a.id), a.id);
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return events.slice(0, 80);
}

function buildPatterns(events: AuditFailEvent[]): AuditPatterns {
  const reasonMap = new Map<string, number>();
  const agentMap = new Map<string, { label: string; count: number }>();
  const days = lastNDays(7);
  const dayMap = new Map(days.map((d) => [d, 0]));

  for (const e of events) {
    const rk = e.reason.trim() || "Fail-closed (no detail)";
    reasonMap.set(rk, (reasonMap.get(rk) ?? 0) + 1);
    const prev = agentMap.get(e.agentId);
    if (prev) prev.count += 1;
    else agentMap.set(e.agentId, { label: e.agentLabel, count: 1 });
    const dk = dayKey(e.at);
    if (dk && dayMap.has(dk)) dayMap.set(dk, (dayMap.get(dk) ?? 0) + 1);
  }

  const topFailReasons = [...reasonMap.entries()]
    .map(([key, count]) => ({
      key,
      label: key.length > 72 ? `${key.slice(0, 69)}…` : key,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const frequentAgents = [...agentMap.entries()]
    .map(([key, v]) => ({ key, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const failByDay = days.map((day) => ({ day, count: dayMap.get(day) ?? 0 }));
  const sparse = events.length < 3;

  return {
    sparse,
    note: sparse
      ? "Too few fail-closed events to call a pattern — keep using the desk; this fills in locally."
      : "Counts from local chat threads only (no remote analytics).",
    failClosedCount: events.length,
    topFailReasons,
    frequentAgents,
    failByDay,
    events: events.slice(0, 40),
  };
}

function researchStubFindings(findings: AuditFinding[]): void {
  const tasks = listTasks();
  const researchTasks = tasks.filter((t) => t.researchId && String(t.researchId).trim());
  const openPipeline = researchTasks.filter(
    (t) =>
      t.status !== "completed" &&
      (t.step === "gather" || t.step === "draft" || t.step === "review" || t.step === "report")
  );

  pushFinding(findings, {
    id: "research.live_web_desk",
    severity: "info",
    area: "research",
    title: "Research live web via Virtual Desk (optional)",
    detail:
      "POST /api/tasks/research runs gather → draft → report via routeGenerate and posts the report to Research chat. Deep / predictive types fan out to capped virtual agents from selectedModelPool (prefer Free OpenRouter + Ollama). Optional liveWeb uses Virtual Desk browser tools on :3456 for real page fetch; when Desk is offline or returns nothing usable, findings use model knowledge with an honest disclaimer — never invent search results. Predictive mode is scenario rehearsal, not calibrated forecasting.",
    evidence: "researchPipeline.ts / deskBrowser.ts / researchVirtualAgents.ts",
  });

  if (researchTasks.length > 0) {
    const blocked = researchTasks.filter((t) => t.status === "blocked");
    pushFinding(findings, {
      id: "research.open_pipelines",
      severity: blocked.length > 0 ? "warn" : openPipeline.length > 0 ? "warn" : "info",
      area: "research",
      title:
        blocked.length > 0
          ? `${blocked.length} blocked research step(s) (generate fail-closed)`
          : openPipeline.length > 0
            ? `${openPipeline.length} open research step(s) across ${new Set(researchTasks.map((t) => t.researchId)).size} pipeline(s)`
            : `${researchTasks.length} research-linked task(s), all marked done`,
      detail:
        blocked.length > 0
          ? "A pipeline step failed generate — no report was invented. Fix LLM backends and re-run a new brief."
          : openPipeline.length > 0
            ? "Open steps may be in-flight, waiting on participation, or left from an older stub run."
            : "Research-linked tasks exist in app-state; reports post to the Research agent thread when pipelineOk.",
      evidence: "app-state.json → tasks",
    });
  }
}

export async function runLocalAudit(): Promise<AuditReport> {
  const findings: AuditFinding[] = [];
  const stateFile = statePath("app-state.json");
  const stateExists = fs.existsSync(stateFile);
  const state = loadState();

  pushFinding(findings, {
    id: "app-state.file",
    severity: stateExists ? "info" : "warn",
    area: "app-state",
    title: stateExists ? "app-state.json present" : "app-state.json missing — using defaults",
    detail: stateExists
      ? "Audit reads the local file-backed store only (no database)."
      : "Server will create state on first write; current values are in-memory defaults.",
    evidence: stateFile,
  });

  if (!state.onboardingComplete) {
    pushFinding(findings, {
      id: "app-state.onboarding",
      severity: "info",
      area: "app-state",
      title: "Onboarding not marked complete",
      detail: "First-launch path may still apply until POST /api/onboarding succeeds.",
      evidence: "app-state.json → onboardingComplete",
    });
  }

  // Providers / keys
  const keyStatus = listProviderKeyStatus();
  const configuredProviders = PROVIDER_REGISTRY.filter((p) => keyStatus[p.id]?.configured).map((p) => p.id);
  if (configuredProviders.length === 0) {
    pushFinding(findings, {
      id: "providers.no_keys",
      severity: "risk",
      area: "providers",
      title: "No cloud provider API keys configured",
      detail: `Checked ${PROVIDER_REGISTRY.length} providers in app-state.providerApiKeys. Cloud / Online generate will fail closed until a key is set under Settings → Connections.`,
      evidence: "app-state.json → providerApiKeys",
    });
  } else {
    pushFinding(findings, {
      id: "providers.keys_present",
      severity: "info",
      area: "providers",
      title: `${configuredProviders.length} provider key(s) configured`,
      detail: `Configured: ${configuredProviders.join(", ")}. Key material is never returned by this audit.`,
      evidence: "app-state.json → providerApiKeys (presence only)",
    });
  }

  // Model pool / desk selection
  const pool = getSelectedModelPool();
  const selected = getSelectedModelId();
  if (pool.length === 0) {
    pushFinding(findings, {
      id: "models.empty_pool",
      severity: "risk",
      area: "models",
      title: "Model assignment pool is empty",
      detail:
        "selectedModelPool has no ids. Agent Assignments checkboxes have nothing to choose from until Browse Models marks a pool.",
      evidence: "app-state.json → selectedModelPool",
    });
  } else {
    pushFinding(findings, {
      id: "models.pool",
      severity: "info",
      area: "models",
      title: `Model pool has ${pool.length} id(s)`,
      detail: pool.slice(0, 8).join(", ") + (pool.length > 8 ? "…" : ""),
      evidence: "app-state.json → selectedModelPool",
    });
  }

  if (!selected) {
    pushFinding(findings, {
      id: "models.no_primary_selection",
      severity: "warn",
      area: "models",
      title: "No desk primary model selected",
      detail: "selectedModel is empty — chats fall back to routing defaults (local then cloud when keys exist).",
      evidence: "app-state.json → selectedModel",
    });
  }

  const customGguf = listCustomGguf();
  const amsGguf = listAmsGguf();
  const diskGguf = customGguf.length + amsGguf.length;
  if (diskGguf === 0) {
    pushFinding(findings, {
      id: "models.no_gguf",
      severity: "warn",
      area: "models",
      title: "No local .gguf files on disk",
      detail: "models/custom and models/ams have zero scanned GGUF files. Local llama.cpp / AMS installs are empty until downloads land.",
      evidence: "models/custom/*.gguf, models/ams/*.gguf",
    });
  } else {
    pushFinding(findings, {
      id: "models.gguf",
      severity: "info",
      area: "models",
      title: `${diskGguf} local .gguf file(s)`,
      detail: `custom=${customGguf.length}, ams=${amsGguf.length}. Router artifacts ready: ${routerReady() ? "yes" : "no"}.`,
      evidence: "models/",
    });
  }

  // Agents registry
  const agentsPayload = loadAgents();
  const agents = agentsPayload.agents;
  const nameOf = (id: string) =>
    id === "chief" || isChiefId(id)
      ? "Chief"
      : agents.find((a) => a.id === id)?.name ?? id;
  const nonChief = agents.filter((a) => !isChiefId(a.id));
  pushFinding(findings, {
    id: "agents.roster",
    severity: agents.length > 0 ? "info" : "risk",
    area: "agents",
    title: agents.length > 0 ? `${agents.length} agent(s) in merged roster` : "Agent roster empty",
    detail: `Chief always injected. Non-Chief: ${nonChief.length}. Registry: ${agentsPayload.sources.registry}${
      agentsPayload.sources.amsScanPresent ? `; AMS scan: ${agentsPayload.sources.amsScan}` : ""
    }.`,
    evidence: agentsPayload.sources.registry,
  });

  const hasChief = agents.some((a) => isChiefId(a.id));
  if (!hasChief) {
    pushFinding(findings, {
      id: "agents.missing_chief",
      severity: "risk",
      area: "agents",
      title: "Chief missing from roster",
      detail: "Unexpected — loadAgents should inject Chief. Check registry merge.",
      evidence: agentsPayload.sources.registry,
    });
  }

  const assignments = listAgentModelAssignments();
  const assignedCount = Object.keys(assignments).length;
  pushFinding(findings, {
    id: "agents.model_assignments",
    severity: assignedCount === 0 && pool.length === 0 ? "warn" : "info",
    area: "agents",
    title:
      assignedCount === 0
        ? "No per-agent model overrides in app-state"
        : `${assignedCount} agent(s) with model overrides`,
    detail: "Overrides live in app-state (agentModelAssignments), not in the registry file.",
    evidence: "app-state.json → agentModelAssignments",
  });

  // Services registry file (no live probes — honest local scope)
  const servicesFile = servicesJsonPath();
  let servicesFileCount = 0;
  try {
    const raw = JSON.parse(fs.readFileSync(servicesFile, "utf8")) as { services?: unknown[] };
    servicesFileCount = Array.isArray(raw.services) ? raw.services.length : 0;
    pushFinding(findings, {
      id: "registry.services_file",
      severity: "info",
      area: "registry",
      title: `services.json has ${servicesFileCount} custom service entr${servicesFileCount === 1 ? "y" : "ies"}`,
      detail: "Well-known loopback services are merged at GET /registry; this audit does not probe live health.",
      evidence: servicesFile,
    });
  } catch {
    pushFinding(findings, {
      id: "registry.services_file",
      severity: "info",
      area: "registry",
      title: "No services.json yet",
      detail: "Custom registry entries absent; GET /registry still returns well-known local services.",
      evidence: servicesFile,
    });
  }

  const boardIds = Array.isArray(state.boardIds) ? state.boardIds : [];
  if (boardIds.length <= 1) {
    pushFinding(findings, {
      id: "app-state.board_thin",
      severity: "info",
      area: "app-state",
      title: "Board roster is Chief-only or empty",
      detail: `boardIds length=${boardIds.length}. Multi board / group council will feel empty until agents are added.`,
      evidence: "app-state.json → boardIds",
    });
  }

  researchStubFindings(findings);

  // Desk daemon (short probe — honest off when unreachable)
  try {
    const desk = await probeDesk();
    pushFinding(findings, {
      id: desk.live ? "desk.live" : "desk.offline",
      severity: desk.live ? "info" : "warn",
      area: "desk",
      title: desk.live ? "Virtual Desk daemon reachable" : "Virtual Desk daemon offline",
      detail: desk.live
        ? "Daemon answered on the Desk URL (ASI proxies /api/desk/*)."
        : desk.error ??
          "Desk daemon offline — open /desk to autostart or run python daemon/desk_daemon.py on :3456.",
      evidence: "probeDesk → 127.0.0.1:3456",
    });
  } catch (e) {
    pushFinding(findings, {
      id: "desk.probe_failed",
      severity: "warn",
      area: "desk",
      title: "Desk probe failed",
      detail: e instanceof Error ? e.message : "Could not probe Desk daemon.",
      evidence: "probeDesk",
    });
  }

  // Permissions / standing rules
  const pendingPerms = (state.permissions ?? []).filter((p) => p.status === "pending");
  const standing = getStandingPermissionRules();
  const neverStanding = standing.filter((r) => r.policy === "never");
  if (pendingPerms.length > 0) {
    pushFinding(findings, {
      id: "permissions.pending",
      severity: "warn",
      area: "permissions",
      title: `${pendingPerms.length} pending permission gate(s)`,
      detail: `Awaiting approve/deny: ${pendingPerms
        .slice(0, 4)
        .map((p) => p.title)
        .join(", ")}${pendingPerms.length > 4 ? "…" : ""}. Review under Settings → Permissions.`,
      evidence: "app-state.json → permissions",
    });
  } else {
    pushFinding(findings, {
      id: "permissions.queue_clear",
      severity: "info",
      area: "permissions",
      title: "No pending permission gates",
      detail: `${(state.permissions ?? []).length} gate row(s) in app-state; none pending.`,
      evidence: "app-state.json → permissions",
    });
  }
  if (neverStanding.length > 0) {
    pushFinding(findings, {
      id: "permissions.standing_never",
      severity: "info",
      area: "permissions",
      title: `${neverStanding.length} standing rule(s) set to never`,
      detail: neverStanding.map((r) => r.label).join(", "),
      evidence: "standing permission rules",
    });
  }

  // Assumptions from deficits
  const assumptions: AuditAssumption[] = [];
  const byId = new Set(findings.map((f) => f.id));

  if (byId.has("providers.no_keys")) {
    assumptions.push({
      id: "assume.no_cloud",
      assumption: "Cloud and Online lanes are unavailable until at least one provider key is stored.",
      risk: "Chief / agent / Pro chat that prefer cloud will 503 fail-closed; users may think the app is broken rather than unconfigured.",
      basedOn: ["providers.no_keys"],
    });
  }

  if (byId.has("models.empty_pool")) {
    assumptions.push({
      id: "assume.empty_pool",
      assumption: "Agent model assignment UI has an empty selectable pool.",
      risk: "Per-agent primary/secondary picks stay on registry defaults or blank; Browse Models checkboxes must populate selectedModelPool first.",
      basedOn: ["models.empty_pool"],
    });
  }

  if (byId.has("research.live_web_desk") || byId.has("research.no_web_search")) {
    const basedOn = byId.has("research.live_web_desk")
      ? ["research.live_web_desk"]
      : ["research.no_web_search"];
    if (byId.has("research.open_pipelines")) basedOn.push("research.open_pipelines");
    assumptions.push({
      id: "assume.research_model_knowledge",
      assumption:
        "Research live web is optional via Virtual Desk; when Desk is offline or liveWeb is off, gather/draft/report use model knowledge only — no invented fetch results.",
      risk: "Reports can look sourced while reflecting model memory when live web did not run; treat citations and URLs as unverified unless Desk-fetched excerpts are present in the thread.",
      basedOn,
    });
  }

  if (byId.has("models.no_gguf") && byId.has("providers.no_keys")) {
    assumptions.push({
      id: "assume.no_local_no_cloud",
      assumption: "Neither local GGUF files nor cloud keys are present.",
      risk: "Almost all generate paths fail closed until Ollama/llama.cpp is up with models, GGUF is installed, or a key is added.",
      basedOn: ["models.no_gguf", "providers.no_keys"],
    });
  }

  if (byId.has("desk.offline") || byId.has("desk.probe_failed")) {
    assumptions.push({
      id: "assume.desk_offline",
      assumption: "Virtual Desk sessions and browser tools are unavailable until the Desk daemon is up.",
      risk: "Desk-dependent skills fail closed; chat still works without Desk.",
      basedOn: byId.has("desk.offline") ? ["desk.offline"] : ["desk.probe_failed"],
    });
  }

  const failEvents = collectFailClosedEvents(nameOf);
  const patterns = buildPatterns(failEvents);

  const risks = findings.filter((f) => f.severity === "risk").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  const infos = findings.filter((f) => f.severity === "info").length;

  return {
    ok: true,
    scope: "local-files",
    ranAt: new Date().toISOString(),
    stateFile,
    findings,
    assumptions,
    routingDecisions: listRoutingDecisions(40),
    patterns,
    summary: {
      findings: findings.length,
      risks,
      warns,
      infos,
      assumptions: assumptions.length,
      failClosed: patterns.failClosedCount,
    },
  };
}

export function mountAuditRoutes(app: Express): void {
  app.get("/api/audit", async (_req, res) => {
    res.json(await runLocalAudit());
  });

  /** Same as GET — explicit “run” for the Settings button. */
  app.post("/api/audit/run", async (_req, res) => {
    res.json(await runLocalAudit());
  });

  /** Provider call / spend ring buffer from generate path. */
  app.get("/api/audit/spend", (req, res) => {
    const limit = req.query.limit != null ? Number(req.query.limit) : 50;
    res.json({
      events: listProviderSpendLog(Number.isFinite(limit) ? limit : 50),
      note: "Appended from routeGenerate when usage/token fields are available. Estimates are not billing.",
    });
  });

  /** Fan-out routing decision ring buffer (hey-jev-inspired slots). */
  app.get("/api/audit/routing", (req, res) => {
    const limit = req.query.limit != null ? Number(req.query.limit) : 40;
    res.json({
      events: listRoutingDecisions(Number.isFinite(limit) ? limit : 40),
      note: "Speculative fan-out slot decisions per chat turn. Also on message meta.decisionTrace.",
    });
  });
}
