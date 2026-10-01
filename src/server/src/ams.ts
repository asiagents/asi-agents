import type { Express } from "express";
import { loadAgents, patchAgentRegistrySkills } from "./agents.js";
import { chatMetaFromGenerate } from "./generate-meta.js";
import { routeGenerate } from "./llm-routing.js";
import {
  filterKnownAmsSkillIds,
  getAmsSkillById,
  readAllSkills,
  systemPromptForAmsSkill,
  type AmsSkillEntry,
} from "./skills.catalog.js";
import { getAgentAmsSkillIds, getAgentModelAssignment, pushAgentThreadMessages, putAgentAmsSkillIds } from "./store.js";
import type { ChatMessage } from "./types.js";
import { messageFromAppendEntry } from "./threadAppend.js";
import { buildAgentSystemPrompt } from "./agentSystemPrompt.js";
import { isChiefId } from "./withChief.js";

export type AgentAmsSkillRow = AmsSkillEntry & {
  source: "catalog" | "registry";
  enabled: boolean;
};

export type AgentAmsSnapshot = {
  agentId: string;
  catalogLabel: string;
  catalogTotal: number;
  enabledSkillIds: string[];
  registrySkillIds: string[];
  skills: AgentAmsSkillRow[];
  /** `true` when `POST …/ams/run` can invoke a single `routeGenerate` (not multi-agent orchestration). */
  singleSkillRunEnabled: boolean;
};

/**
 * Single-skill preview gate (not multi-agent orchestration).
 * - `ASI_AMS_SKILL_RUN=1` → on
 * - `ASI_AMS_SKILL_RUN=0` → off (fail closed)
 * - unset → on in non-production (dev default), off in production
 */
export function isSingleSkillRunEnabled(): boolean {
  const flag = (process.env.ASI_AMS_SKILL_RUN ?? "").trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  if (flag === "1" || flag === "true" || flag === "on") return true;
  return process.env.NODE_ENV !== "production";
}

function agentKnown(agentId: string): boolean {
  return loadAgents().agents.some((a) => a.id === agentId);
}

function registrySkillIdsFor(agentId: string): string[] {
  const row = loadAgents().agents.find((a) => a.id === agentId);
  return row?.skills ?? [];
}

export function buildAgentAmsSnapshot(agentId: string): AgentAmsSnapshot | null {
  const id = agentId.trim();
  if (!id || !agentKnown(id)) return null;
  const { label, skills: catalog } = readAllSkills();
  const enabledSkillIds = getAgentAmsSkillIds(id);
  const registrySkillIds = registrySkillIdsFor(id);
  const enabledSet = new Set(enabledSkillIds);
  const registrySet = new Set(registrySkillIds);
  const orderedIds = [...new Set([...enabledSkillIds, ...registrySkillIds])];
  const skills: AgentAmsSkillRow[] = orderedIds.map((skillId) => {
    const entry = getAmsSkillById(skillId);
    const fromRegistry = registrySet.has(skillId);
    const fromCatalog = enabledSet.has(skillId);
    if (entry) {
      return {
        ...entry,
        source: fromCatalog ? "catalog" : "registry",
        enabled: fromCatalog || fromRegistry,
      };
    }
    return {
      id: skillId,
      name: skillId,
      group: "Registry",
      source: "registry",
      enabled: fromRegistry,
    };
  });
  return {
    agentId: id,
    catalogLabel: label,
    catalogTotal: catalog.length,
    enabledSkillIds,
    registrySkillIds,
    skills,
    singleSkillRunEnabled: isSingleSkillRunEnabled(),
  };
}

function skillAllowedOnAgent(agentId: string, skillId: string): boolean {
  const snap = buildAgentAmsSnapshot(agentId);
  if (!snap) return false;
  return snap.skills.some((s) => s.id === skillId && s.enabled);
}

export function mountAmsRoutes(app: Express): void {
  app.get("/api/agents/:id/ams", (req, res) => {
    const agentId = String(req.params.id ?? "").trim();
    if (!agentId) return res.status(400).json({ error: "agent id required" });
    const snap = buildAgentAmsSnapshot(agentId);
    if (!snap) return res.status(404).json({ error: "unknown agent" });
    res.json(snap);
  });

  app.put("/api/agents/:id/ams", (req, res) => {
    const agentId = String(req.params.id ?? "").trim();
    if (!agentId) return res.status(400).json({ error: "agent id required" });
    if (!agentKnown(agentId)) return res.status(404).json({ error: "unknown agent" });
    const raw = req.body?.enabledSkillIds ?? req.body?.skillIds;
    if (!Array.isArray(raw)) return res.status(400).json({ error: "enabledSkillIds array required" });
    const enabledSkillIds = filterKnownAmsSkillIds(raw.map((s) => String(s)));
    const saved = putAgentAmsSkillIds(agentId, enabledSkillIds);
    if (saved === null) return res.status(400).json({ error: "invalid agent id" });
    // Keep registry skill chips in sync with AMS picks (Chief + specialists).
    patchAgentRegistrySkills(agentId, enabledSkillIds);
    const snap = buildAgentAmsSnapshot(agentId);
    res.json(snap);
  });

  app.post("/api/agents/:id/ams/run", async (req, res) => {
    const agentId = String(req.params.id ?? "").trim();
    if (!agentId) return res.status(400).json({ error: "agent id required" });
    if (!agentKnown(agentId)) return res.status(404).json({ error: "unknown agent" });

    if (!isSingleSkillRunEnabled()) {
      return res.status(501).json({
        error:
          "AMS single-skill run is disabled. Set ASI_AMS_SKILL_RUN=1 (or unset in non-production). Multi-agent orchestration is not shipped.",
        code: "orchestration_not_shipped",
      });
    }

    const skillId = String(req.body?.skillId ?? "").trim();
    const text = String(req.body?.text ?? "").trim();
    if (!skillId) return res.status(400).json({ error: "skillId required" });
    if (!text) return res.status(400).json({ error: "text required" });
    if (!skillAllowedOnAgent(agentId, skillId)) {
      return res.status(400).json({ error: "skill not enabled on this agent" });
    }
    const entry = getAmsSkillById(skillId);
    if (!entry) return res.status(400).json({ error: "unknown catalog skill" });

    const agent = loadAgents().agents.find((a) => a.id === agentId)!;
    const ov = getAgentModelAssignment(agentId);
    const primary = (req.body?.modelId != null ? String(req.body.modelId) : null)?.trim() || ov.primary || agent.modelId || "agentchat";
    const secondary = ov.secondary ?? agent.secondaryModelId ?? null;
    const agentLine = buildAgentSystemPrompt({
      agentId,
      kind: isChiefId(agentId) ? "chief" : "specialist",
      name: agent.name,
      role: agent.role,
      roleTag: agent.roleTag,
      skills: agent.skills,
    });
    const systemPrompt = `${agentLine}\n\n${systemPromptForAmsSkill(entry)}`;

    const result = await routeGenerate({
      prompt: text,
      modelId: primary,
      secondaryModelId: secondary,
      systemPrompt,
    });

    if (!result.text) {
      return res.status(503).json({
        error: "No LLM backend answered for this skill run.",
        code: "generate_failed",
        via: result.via,
        reason: result.reason,
      });
    }

    const generateMeta = chatMetaFromGenerate(primary, secondary, result, { agentId });
    const userMsg = messageFromAppendEntry(
      { role: "user", text, intentId: skillId, source: "ams" },
      { agentId }
    );
    const agentMsg = messageFromAppendEntry(
      { role: "agent", text: result.text, intentId: skillId, source: "ams" },
      { ...generateMeta, agentId, intentId: skillId, source: "ams" }
    );
    const saved: ChatMessage[] = [userMsg, agentMsg].filter((m): m is ChatMessage => m != null);
    if (saved.length) pushAgentThreadMessages(agentId, saved);

    res.json({
      agentId,
      skillId,
      text: result.text,
      via: result.via,
      modelId: primary,
      note: "Single-skill llm-routing preview — not AMS orchestration.",
      messages: saved,
    });
  });
}
