import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  builtinChiefAgent,
  CHIEF_DEFAULT_SKILLS,
  ensureChiefInMap,
  sortAgentsChiefFirst,
} from "./chiefBuiltin.js";
import { filterKnownAmsSkillIds } from "./skills.catalog.js";
import { normalizeStaffRoleLabel } from "./agentDisplay.js";
import {
  getAgentAmsSkillIds,
  getAgentModelAssignment,
  getAgentDisplayName,
  getAgentRoleLabel,
  getImportedSkills,
  getSelectedModelPool,
  patchAgentModelAssignment,
  putAgentAmsSkillIds,
  pushAgentThreadMessages,
} from "./store.js";
import {
  inferHireSkills,
  parseNameRole,
  pickHireModelFromPool,
} from "./hireHeuristics.js";
import { pickHireWelcomeMessage } from "./intent/hireWelcomeMessages.js";
import type { ChatMessage } from "./types.js";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "../../..");

export type AgentSource = "registry" | "ams-scan";

export interface RegistryAgent {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "waiting" | "offline" | "unknown";
  modelId: string | null;
  secondaryModelId?: string | null;
  skills: string[];
  source: AgentSource;
  updatedAt: string | null;
  /** Optional UI fields for Default theme avatars (local public basename or path). */
  avatar?: string | null;
  roleTag?: string | null;
  initials?: string | null;
  isChief?: boolean;
  currentTask?: string | null;
  /** Optional default generate route (`local` | `cloud` | `provider:model`). Registry file only; UI overrides in app-state. */
  routePref?: string | null;
  /**
   * Optional manager agent id for org chart.
   * `null` / omitted = flat peer (default on hire). Do not auto-nest new agents.
   */
  reportsTo?: string | null;
  /** Company training memory (from app-state `agentTraining`; not in registry file). */
  learnings?: string[];
}

export interface AgentsRegistryFile {
  agents: RegistryAgent[];
  lastScanAt: string | null;
}

export interface AgentsApiResponse {
  agents: RegistryAgent[];
  lastScanAt: string | null;
  sources: { registry: string; amsScan: string | null; amsScanPresent: boolean };
}

function registryPath(): string {
  const fromEnv = process.env.ASI_AGENTS_REGISTRY?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(repoRoot, "config", "agents.registry.json");
}

function amsScanPath(): string {
  const fromEnv = process.env.ASI_AMS_SCAN_AGENTS?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(repoRoot, "config", "ams-scan.agents.json");
}

function emptyRegistry(): AgentsRegistryFile {
  return { agents: [], lastScanAt: null };
}

function readJsonFile(p: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function normalizeAgent(raw: Record<string, unknown>, source: AgentSource): RegistryAgent | null {
  const id = String(raw.id ?? "").trim();
  if (!id) return null;
  const statusRaw = String(raw.status ?? "unknown");
  const status = (["active", "idle", "waiting", "offline", "unknown"].includes(statusRaw)
    ? statusRaw
    : "unknown") as RegistryAgent["status"];
  const skills = Array.isArray(raw.skills)
    ? raw.skills.map((s) => String(s)).filter(Boolean)
    : [];
  const avatar = raw.avatar == null || raw.avatar === "" ? null : String(raw.avatar);
  const roleTag = raw.roleTag == null || raw.roleTag === "" ? null : String(raw.roleTag);
  const initials = raw.initials == null || raw.initials === "" ? null : String(raw.initials);
  const currentTask = raw.currentTask == null || raw.currentTask === "" ? null : String(raw.currentTask);
  const routeRaw = raw.routePref == null || raw.routePref === "" ? null : String(raw.routePref).trim();
  const routePref =
    routeRaw === "local" || routeRaw === "cloud" || (routeRaw && routeRaw.includes(":"))
      ? routeRaw
      : null;
  // Flat by default: empty / missing reportsTo → null (no auto-nest on hire).
  const reportsRaw =
    raw.reportsTo == null || raw.reportsTo === "" ? null : String(raw.reportsTo).trim();
  const reportsTo =
    reportsRaw && reportsRaw !== id && !(raw.isChief === true || id === "chief")
      ? reportsRaw
      : null;
  return {
    id,
    name: String(raw.name ?? id),
    role: String(raw.role ?? ""),
    status,
    modelId: raw.modelId == null || raw.modelId === "" ? null : String(raw.modelId),
    secondaryModelId:
      raw.secondaryModelId == null || raw.secondaryModelId === ""
        ? null
        : String(raw.secondaryModelId),
    skills,
    source: (raw.source as AgentSource) || source,
    updatedAt: raw.updatedAt == null ? null : String(raw.updatedAt),
    avatar,
    roleTag,
    initials,
    isChief: raw.isChief === true || id === "chief",
    currentTask,
    routePref,
    reportsTo,
  };
}

function readRegistry(): AgentsRegistryFile {
  const raw = readJsonFile(registryPath());
  if (!raw || typeof raw !== "object") return emptyRegistry();
  const obj = raw as { agents?: unknown[]; lastScanAt?: string | null };
  const agents = Array.isArray(obj.agents)
    ? obj.agents
        .map((a) => (a && typeof a === "object" ? normalizeAgent(a as Record<string, unknown>, "registry") : null))
        .filter((a): a is RegistryAgent => !!a)
    : [];
  return {
    agents,
    lastScanAt: obj.lastScanAt ?? null,
  };
}

function readAmsScan(): RegistryAgent[] {
  const p = amsScanPath();
  if (!fs.existsSync(p)) return [];
  const raw = readJsonFile(p);
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as { agents?: unknown[]; lastScanAt?: string | null };
  if (!Array.isArray(obj.agents)) return [];
  return obj.agents
    .map((a) => (a && typeof a === "object" ? normalizeAgent(a as Record<string, unknown>, "ams-scan") : null))
    .filter((a): a is RegistryAgent => !!a);
}

/** Merge on-disk registry with optional AMS scan file. Registry wins on id collision. */
export function loadAgents(): AgentsApiResponse {
  ensureChiefDefaultSkillsPersisted();
  const registry = readRegistry();
  const scanAgents = readAmsScan();
  const byId = new Map<string, RegistryAgent>();
  for (const a of scanAgents) byId.set(a.id, a);
  for (const a of registry.agents) byId.set(a.id, a);
  ensureChiefInMap(byId);
  const amsPath = amsScanPath();
  const amsPresent = fs.existsSync(amsPath);
  let lastScanAt = registry.lastScanAt;
  if (!lastScanAt && amsPresent) {
    const scanRaw = readJsonFile(amsPath) as { lastScanAt?: string | null } | null;
    lastScanAt = scanRaw?.lastScanAt ?? null;
  }
  const merged = sortAgentsChiefFirst(Array.from(byId.values())).map((a) => {
    const ov = getAgentModelAssignment(a.id);
    const displayName = getAgentDisplayName(a.id);
    const roleLabel = getAgentRoleLabel(a.id);
    const imported = getImportedSkills(a.id);
    const skills = imported.length
      ? Array.from(new Set([...a.skills, ...imported]))
      : a.skills;
    const isChief = a.isChief === true || a.id === "chief";
    return {
      ...a,
      name: displayName ?? a.name,
      // Chief keeps title "Chief of staff"; roleTag is chief|secretary|buddy for UI.
      role: isChief ? a.role || "Chief of staff" : a.role,
      roleTag: isChief
        ? normalizeStaffRoleLabel(roleLabel ?? a.roleTag ?? "chief")
        : a.roleTag,
      modelId: ov.primary ?? a.modelId,
      secondaryModelId: ov.secondary ?? a.secondaryModelId ?? null,
      skills,
    };
  });
  return {
    agents: merged,
    lastScanAt,
    sources: {
      registry: registryPath(),
      amsScan: amsPresent ? amsPath : null,
      amsScanPresent: amsPresent,
    },
  };
}

export type CreateAgentInput = {
  name?: string;
  role?: string;
  roleTag?: string;
  skills?: string[];
  /** Free-text brief — what the agent will do (local skill/model heuristics). */
  brief?: string;
  /**
   * Optional manager. Omit / null / "" = flat peer (default).
   * Never invent a tree on hire — only persist when the caller sets it.
   */
  reportsTo?: string | null;
  /** Explicit primary from Browse pool (manual). Omit = auto from pool heuristics. */
  primaryModelId?: string | null;
  secondaryModelId?: string | null;
};

export type CreateAgentsResult = {
  created: RegistryAgent[];
  agents: RegistryAgent[];
};

const COUNCIL_TEMPLATES: { name: string; role: string; roleTag: string; skills: string[] }[] = [
  { name: "Mira", role: "Debate analyst", roleTag: "Council", skills: ["citations", "ticket-summarize"] },
  { name: "Kai", role: "Council synthesizer", roleTag: "Council", skills: ["proposal-draft", "ticket-summarize"] },
  { name: "Nora", role: "Risk critic", roleTag: "Council", skills: ["renewal-risk", "contract-review"] },
  { name: "Theo", role: "Fact researcher", roleTag: "Council", skills: ["citations", "literature"] },
];

const ROLE_CATALOG: Record<
  string,
  { role: string; roleTag: string; skills: string[]; names: string[] }
> = {
  travel: {
    role: "Travel planner",
    roleTag: "Travel",
    skills: ["travel"],
    names: ["Nova", "Aria", "Journey", "Atlas"],
  },
  finance: {
    role: "Finance assistant",
    roleTag: "Finance",
    skills: ["budgeting", "spend-gates"],
    names: ["Fin", "Ledger", "Penny", "Astra"],
  },
  coding: {
    role: "Coding assistant",
    roleTag: "Build",
    skills: ["code-review", "shell-sandbox"],
    names: ["Byte", "Patch", "Codec", "Lint"],
  },
  code: {
    role: "Coding assistant",
    roleTag: "Build",
    skills: ["code-review", "shell-sandbox"],
    names: ["Byte", "Patch", "Codec", "Lint"],
  },
  research: {
    role: "Research analyst",
    roleTag: "Find",
    skills: ["citations", "literature"],
    names: ["Sage", "Quill", "Index", "Scout"],
  },
  design: {
    role: "Design assistant",
    roleTag: "Create",
    skills: ["ui-mockups", "slides"],
    names: ["Pixel", "Sketch", "Hue", "Frame"],
  },
  writer: {
    role: "Writing assistant",
    roleTag: "Write",
    skills: ["story", "brand-voice"],
    names: ["Quill", "Verse", "Ink", "Page"],
  },
  writing: {
    role: "Writing assistant",
    roleTag: "Write",
    skills: ["story", "brand-voice"],
    names: ["Quill", "Verse", "Ink", "Page"],
  },
};

function slugify(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "agent";
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "AG";
}

function writeRegistry(file: AgentsRegistryFile): void {
  const p = registryPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(file, null, 2), "utf8");
}

/**
 * Seed Chief default AMS/registry skills when empty (one-time write).
 * Fixes empty skills on /agents/chief and AMS panel.
 */
function ensureChiefDefaultSkillsPersisted(): void {
  const defaults = filterKnownAmsSkillIds([...CHIEF_DEFAULT_SKILLS]);
  if (!defaults.length) return;

  const registry = readRegistry();
  let idx = registry.agents.findIndex((a) => a.id === "chief");
  if (idx < 0) {
    registry.agents.unshift(builtinChiefAgent());
    idx = 0;
  }
  const chief = registry.agents[idx]!;
  const emptyRegistry = !Array.isArray(chief.skills) || chief.skills.length === 0;
  if (emptyRegistry) {
    registry.agents[idx] = {
      ...chief,
      isChief: true,
      skills: defaults,
      updatedAt: new Date().toISOString(),
    };
    registry.lastScanAt = registry.agents[idx]!.updatedAt;
    writeRegistry(registry);
  }

  const ams = getAgentAmsSkillIds("chief");
  if (!ams.length) {
    putAgentAmsSkillIds("chief", defaults);
  }
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = slugify(base);
  if (!taken.has(id)) return id;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${id}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${id}-${Date.now().toString(36)}`;
}

function resolveRoleSpec(roleRaw?: string): {
  role: string;
  roleTag: string;
  skills: string[];
  names: string[];
} {
  const key = (roleRaw ?? "").trim().toLowerCase();
  if (key && ROLE_CATALOG[key]) return ROLE_CATALOG[key];
  // Partial catalog key match (e.g. "coding assistant")
  if (key) {
    for (const [k, spec] of Object.entries(ROLE_CATALOG)) {
      if (key.includes(k) || key.startsWith(k)) return spec;
    }
    const label = key.replace(/-/g, " ");
    const titled = label.replace(/\b\w/g, (c) => c.toUpperCase());
    const inferred = inferHireSkills({ role: key, limit: 4 });
    return {
      role: `${titled} specialist`,
      roleTag: titled.slice(0, 12) || "Agent",
      skills: inferred.length ? inferred : [],
      names: [titled.split(/\s+/)[0] || titled, `${titled} Bot`, `Agent ${titled}`],
    };
  }
  return {
    role: "Group chat participant",
    roleTag: "Council",
    skills: filterKnownAmsSkillIds(["citations", "ticket-summarize"]),
    names: COUNCIL_TEMPLATES.map((t) => t.name),
  };
}

function resolveSkillsForHire(opts: {
  explicit?: string[];
  role?: string;
  brief?: string;
  templateSkills?: string[];
}): string[] {
  if (opts.explicit !== undefined) {
    return filterKnownAmsSkillIds(opts.explicit.map(String));
  }
  const inferred = inferHireSkills({ role: opts.role, brief: opts.brief, limit: 4 });
  if (inferred.length) return inferred;
  return filterKnownAmsSkillIds(opts.templateSkills ?? []);
}

function seedHireWelcomeThread(agent: RegistryAgent, brief?: string | null): void {
  const text = pickHireWelcomeMessage({
    name: agent.name,
    specialty: brief?.trim() || agent.role || agent.roleTag || undefined,
  });
  const now = Date.now();
  const message: ChatMessage = {
    id: `hire-${agent.id}-${now}`,
    role: "agent",
    text,
    at: new Date(now).toISOString(),
    meta: {
      agentId: agent.id,
      source: "in-app",
      intentId: "hire.welcome",
    },
  };
  pushAgentThreadMessages(agent.id, [message]);
}

function assignHireModel(
  agentId: string,
  opts: {
    role?: string;
    brief?: string;
    skills: string[];
    primaryModelId?: string | null;
    secondaryModelId?: string | null;
    /** When true, skip pool auto-pick (caller wants registry default only). */
    skipAutoModel?: boolean;
  }
): void {
  const manualPrimary = opts.primaryModelId != null ? String(opts.primaryModelId).trim() : "";
  if (manualPrimary) {
    const secondary =
      opts.secondaryModelId != null && String(opts.secondaryModelId).trim()
        ? String(opts.secondaryModelId).trim()
        : null;
    patchAgentModelAssignment(agentId, {
      primaryModelId: manualPrimary,
      secondaryModelId: secondary,
    });
    return;
  }
  if (opts.skipAutoModel) return;
  const picked = pickHireModelFromPool({
    role: opts.role,
    brief: opts.brief,
    skills: opts.skills,
    poolIds: getSelectedModelPool(),
  });
  if (!picked) return;
  patchAgentModelAssignment(agentId, {
    primaryModelId: picked.primary,
    secondaryModelId: picked.secondary ?? null,
  });
}

/**
 * Persist new agents into `config/agents.registry.json` (and return full roster).
 * Fully local — templates + heuristics only; never calls an LLM.
 * Auto-generates names/roles when omitted — suitable for group-chat / "any name" creates.
 * When `skills` is provided (including `[]`), only catalog-known AMS ids are stored;
 * when omitted, skills are inferred from role/brief. Model auto-picks from Browse pool
 * unless `primaryModelId` is set. Seeds one random local hire welcome into the thread.
 */
/** Resolve optional reportsTo for hire — only when explicitly set; else flat (null). */
function resolveHireReportsTo(
  raw: string | null | undefined,
  selfId: string,
  knownIds: Set<string>
): string | null {
  const parent = raw == null ? "" : String(raw).trim();
  if (!parent || parent === selfId) return null;
  if (!knownIds.has(parent)) return null;
  return parent;
}

export function createAgents(opts: {
  count?: number;
  role?: string;
  name?: string;
  brief?: string;
  /** When set (incl. empty), overrides role-template / inferred skills with catalog-validated ids. */
  skills?: string[];
  /** Optional manager for top-level hire. Omit = flat peers (default). */
  reportsTo?: string | null;
  primaryModelId?: string | null;
  secondaryModelId?: string | null;
  /** Default true — seed local hire welcomes. */
  seedWelcome?: boolean;
  /** When true, do not auto-pick from Browse pool (still applies explicit primaryModelId). */
  skipAutoModel?: boolean;
  agents?: CreateAgentInput[];
}): CreateAgentsResult {
  const registry = readRegistry();
  const taken = new Set(registry.agents.map((a) => a.id));
  for (const a of loadAgents().agents) taken.add(a.id);
  const knownForReports = new Set(taken);

  const usedNames = new Set(registry.agents.map((a) => a.name.toLowerCase()));
  const created: RegistryAgent[] = [];
  const now = new Date().toISOString();
  const topBrief = opts.brief?.trim() || undefined;
  const topSkills =
    opts.skills !== undefined ? filterKnownAmsSkillIds(opts.skills.map(String)) : undefined;
  // Top-level hire reportsTo only when caller sets it — never invent nesting.
  const topReportsTo = opts.reportsTo;
  const seedWelcome = opts.seedWelcome !== false;
  const parsedTopName = opts.name?.trim() ? parseNameRole(opts.name.trim()) : null;
  const topName = parsedTopName?.name;
  const topRoleFromName = parsedTopName?.role;
  const topRole = (opts.role?.trim() || topRoleFromName || "").trim() || undefined;

  const explicit = Array.isArray(opts.agents) ? opts.agents.filter(Boolean) : [];
  if (explicit.length > 0) {
    for (const row of explicit) {
      const parsed = row.name?.trim() ? parseNameRole(row.name.trim()) : null;
      const rowRole = (row.role?.trim() || parsed?.role || "").trim() || undefined;
      const spec = resolveRoleSpec(rowRole);
      const name = (parsed?.name || row.name?.trim() || pickName(spec.names, usedNames)).slice(0, 64);
      usedNames.add(name.toLowerCase());
      const id = uniqueId(name, taken);
      taken.add(id);
      const brief = row.brief?.trim() || topBrief;
      const rowSkills = resolveSkillsForHire({
        explicit:
          row.skills !== undefined
            ? row.skills.map(String)
            : topSkills !== undefined
              ? topSkills
              : undefined,
        role: rowRole || spec.role,
        brief,
        templateSkills: spec.skills,
      });
      // Per-row reportsTo wins when set; else top-level; else flat (null).
      const reportsTo = resolveHireReportsTo(
        row.reportsTo !== undefined ? row.reportsTo : topReportsTo,
        id,
        knownForReports
      );
      const agent: RegistryAgent = {
        id,
        name,
        role: (rowRole || spec.role).slice(0, 120),
        roleTag: (row.roleTag?.trim() || spec.roleTag).slice(0, 24),
        status: "idle",
        modelId: "agentchat",
        skills: rowSkills,
        source: "registry",
        updatedAt: now,
        initials: initialsFrom(name),
        currentTask: brief?.slice(0, 80) || "Ready for group chat",
        reportsTo,
      };
      created.push(agent);
      registry.agents.push(agent);
      knownForReports.add(id);
      assignHireModel(id, {
        role: agent.role,
        brief,
        skills: rowSkills,
        primaryModelId: row.primaryModelId !== undefined ? row.primaryModelId : opts.primaryModelId,
        secondaryModelId:
          row.secondaryModelId !== undefined ? row.secondaryModelId : opts.secondaryModelId,
        skipAutoModel: opts.skipAutoModel,
      });
      if (seedWelcome) seedHireWelcomeThread(agent, brief);
    }
  } else {
    const count = Math.min(Math.max(Math.floor(opts.count ?? 1), 1), 12);
    const roleKey = (topRole ?? "").trim().toLowerCase();
    for (let i = 0; i < count; i++) {
      let name: string;
      let role: string;
      let roleTag: string;
      let skills: string[];
      if (!roleKey && count > 1 && topSkills === undefined && !topBrief) {
        const tmpl = COUNCIL_TEMPLATES[i % COUNCIL_TEMPLATES.length];
        const suffix = i >= COUNCIL_TEMPLATES.length ? ` ${Math.floor(i / COUNCIL_TEMPLATES.length) + 1}` : "";
        name = topName && i === 0 ? topName : `${tmpl.name}${suffix}`;
        if (usedNames.has(name.toLowerCase())) name = pickName([name, `${tmpl.name}-${i + 1}`], usedNames);
        role = tmpl.role;
        roleTag = tmpl.roleTag;
        skills = resolveSkillsForHire({
          explicit: undefined,
          role: tmpl.role,
          brief: topBrief,
          templateSkills: tmpl.skills,
        });
      } else {
        const spec = resolveRoleSpec(roleKey || undefined);
        name =
          topName && i === 0
            ? topName.slice(0, 64)
            : pickName(spec.names, usedNames);
        role = topRole ? topRole.slice(0, 120) : spec.role;
        roleTag = spec.roleTag;
        skills = resolveSkillsForHire({
          explicit: topSkills,
          role: roleKey || role,
          brief: topBrief,
          templateSkills: spec.skills,
        });
      }
      usedNames.add(name.toLowerCase());
      const id = uniqueId(name, taken);
      taken.add(id);
      // Batch hire stays flat unless reportsTo was explicitly provided on the request.
      const reportsTo = resolveHireReportsTo(topReportsTo, id, knownForReports);
      const agent: RegistryAgent = {
        id,
        name,
        role,
        roleTag,
        status: "idle",
        modelId: "agentchat",
        skills,
        source: "registry",
        updatedAt: now,
        initials: initialsFrom(name),
        currentTask: topBrief?.slice(0, 80) || "Ready for group chat",
        reportsTo,
      };
      created.push(agent);
      registry.agents.push(agent);
      knownForReports.add(id);
      assignHireModel(id, {
        role,
        brief: topBrief,
        skills,
        primaryModelId: opts.primaryModelId,
        secondaryModelId: opts.secondaryModelId,
        skipAutoModel: opts.skipAutoModel,
      });
      if (seedWelcome) seedHireWelcomeThread(agent, topBrief);
    }
  }

  registry.lastScanAt = now;
  writeRegistry(registry);

  // Mirror catalog picks into AMS app-state (GET/PUT /api/agents/:id/ams).
  for (const agent of created) {
    const catalogIds = filterKnownAmsSkillIds(agent.skills);
    if (catalogIds.length) putAgentAmsSkillIds(agent.id, catalogIds);
    // Reflect assigned primary on registry modelId when present (display only).
    const ov = getAgentModelAssignment(agent.id);
    if (ov.primary) {
      const row = registry.agents.find((a) => a.id === agent.id);
      if (row) row.modelId = ov.primary;
      agent.modelId = ov.primary;
      if (ov.secondary) {
        if (row) row.secondaryModelId = ov.secondary;
        agent.secondaryModelId = ov.secondary;
      }
    }
  }
  writeRegistry(registry);

  return { created, agents: loadAgents().agents };
}

function pickName(pool: string[], used: Set<string>): string {
  for (const n of pool) {
    if (!used.has(n.toLowerCase())) return n;
  }
  for (let i = 2; i < 100; i++) {
    for (const n of pool) {
      const candidate = `${n} ${i}`;
      if (!used.has(candidate.toLowerCase())) return candidate;
    }
  }
  return `Agent ${Date.now().toString(36).slice(-4)}`;
}

/**
 * Set or clear `reportsTo` on a registry agent (org chart).
 * Chief cannot report to anyone. Passing null/"" clears to flat peer.
 * Returns the updated agent or an error string.
 */
export function patchAgentReportsTo(
  agentId: string,
  reportsTo: string | null
): { agent: RegistryAgent } | { error: string } {
  const id = agentId.trim();
  if (!id) return { error: "agent id required" };
  if (id === "chief") return { error: "Chief cannot report to anyone" };
  const registry = readRegistry();
  const idx = registry.agents.findIndex((a) => a.id === id);
  if (idx < 0) return { error: "unknown agent" };
  const agent = registry.agents[idx]!;
  const parentRaw = reportsTo == null ? "" : String(reportsTo).trim();
  let next: string | null = null;
  if (parentRaw) {
    if (parentRaw === id) return { error: "cannot report to self" };
    const roster = loadAgents().agents;
    const byId = new Map(roster.map((a) => [a.id, a]));
    if (!byId.has(parentRaw)) return { error: "unknown manager" };
    // Prevent cycles: walk up from parent.
    let cur: string | null = parentRaw;
    const seen = new Set<string>([id]);
    while (cur) {
      if (seen.has(cur)) return { error: "would create a cycle" };
      seen.add(cur);
      cur = byId.get(cur)?.reportsTo?.trim() || null;
    }
    next = parentRaw;
  }
  const updated: RegistryAgent = {
    ...agent,
    reportsTo: next,
    updatedAt: new Date().toISOString(),
  };
  registry.agents[idx] = updated;
  registry.lastScanAt = updated.updatedAt;
  writeRegistry(registry);
  return { agent: loadAgents().agents.find((a) => a.id === id) ?? updated };
}

/** Replace registry skill ids for an agent (Chief allowed). Catalog-validated ids expected. */
export function patchAgentRegistrySkills(
  agentId: string,
  skills: string[]
): RegistryAgent | null {
  const id = agentId.trim();
  if (!id) return null;
  const known = filterKnownAmsSkillIds(skills.map(String));
  const registry = readRegistry();
  let idx = registry.agents.findIndex((a) => a.id === id);
  if (idx < 0 && id === "chief") {
    registry.agents.unshift(builtinChiefAgent());
    idx = 0;
  }
  if (idx < 0) return null;
  const agent = registry.agents[idx]!;
  registry.agents[idx] = {
    ...agent,
    skills: known,
    updatedAt: new Date().toISOString(),
  };
  registry.lastScanAt = registry.agents[idx]!.updatedAt;
  writeRegistry(registry);
  return loadAgents().agents.find((a) => a.id === id) ?? registry.agents[idx]!;
}

/** Remove a non-Chief registry agent. Returns the removed agent or null. */
export function removeRegistryAgent(agentId: string): RegistryAgent | null {
  const id = agentId.trim();
  if (!id || id === "chief") return null;
  const registry = readRegistry();
  const idx = registry.agents.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const [removed] = registry.agents.splice(idx, 1);
  if (!removed) return null;
  registry.lastScanAt = new Date().toISOString();
  writeRegistry(registry);
  return removed;
}

/** Re-insert a soft-deleted registry agent snapshot. Fails if id already exists. */
export function addRegistryAgent(agent: RegistryAgent): boolean {
  const id = agent?.id?.trim();
  if (!id || id === "chief") return false;
  const registry = readRegistry();
  if (registry.agents.some((a) => a.id === id)) return false;
  registry.agents.push({
    ...agent,
    id,
    source: "registry",
    updatedAt: new Date().toISOString(),
  });
  registry.lastScanAt = new Date().toISOString();
  writeRegistry(registry);
  return true;
}
const KNOWN_AVATARS = [
  "e2b650a4-4c63-42fc-b52f-60d2a4fb8025.jpg",
  "49af1521-77d1-40aa-b6fa-a459c12e742b.jpg",
  "b104522c-28b3-4dd2-9e09-1631b970a2e0.jpg",
  "38c8914b-4cb9-4602-a890-37c8bc4a3db6.jpg",
];

/** Collect avatar basenames already used in the roster (plus known theme set). */
function rosterAvatarPool(): string[] {
  const fromRoster = loadAgents()
    .agents.map((a) => a.avatar)
    .filter((a): a is string => typeof a === "string" && !!a.trim());
  return Array.from(new Set([...KNOWN_AVATARS, ...fromRoster]));
}

/**
 * Assign a different avatar from the existing agent avatar set.
 * Writes config/agents.registry.json (or injects Chief then patches).
 */
export function patchAgentAvatar(
  agentId: string,
  avatar?: string | null
): { agent: RegistryAgent; avatar: string } | { error: string } {
  const id = agentId.trim();
  if (!id) return { error: "agent id required" };
  const registry = readRegistry();
  let idx = registry.agents.findIndex((a) => a.id === id);
  if (idx < 0 && id === "chief") {
    registry.agents.unshift(builtinChiefAgent());
    idx = 0;
  }
  if (idx < 0) return { error: "unknown agent" };
  const agent = registry.agents[idx]!;
  const pool = rosterAvatarPool();
  const current = agent.avatar ?? "";
  let next = avatar?.trim() || "";
  if (!next) {
    const candidates = pool.filter((a) => a !== current);
    const pickFrom = candidates.length ? candidates : pool;
    next = pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? KNOWN_AVATARS[0]!;
  }
  if (!pool.includes(next) && !KNOWN_AVATARS.includes(next)) {
    next = KNOWN_AVATARS[0]!;
  }
  const updated: RegistryAgent = {
    ...agent,
    avatar: next,
    updatedAt: new Date().toISOString(),
  };
  registry.agents[idx] = updated;
  registry.lastScanAt = updated.updatedAt;
  writeRegistry(registry);
  return {
    agent: loadAgents().agents.find((a) => a.id === id) ?? updated,
    avatar: next,
  };
}
