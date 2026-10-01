/** Ask each board agent to take a stance on a decision topic via routeGenerate. */

import { loadAgents, type RegistryAgent } from "./agents.js";
import {
  normalizeBoardStances,
  type BoardAgentStance,
  type BoardStanceKind,
  type BoardStancesMap,
} from "./board.js";
import {
  chiefGenerateFailureDetail,
  offlineAgentReply,
  resolveAgentRoute,
  routeGenerate,
} from "./llm-routing.js";
import { buildAgentSystemPrompt } from "./agentSystemPrompt.js";
import { getBoardState, loadState, updateBoard } from "./store.js";
import { isChiefId } from "./withChief.js";

export type BoardAskMemberResult = {
  agentId: string;
  name: string;
  ok: boolean;
  modelId: string;
  via?: string;
  stance?: BoardStanceKind;
  note?: string;
  error?: string;
};

export type BoardAskResult = {
  boardIds: string[];
  defaultBoardIds: string[];
  councilIds: string[];
  stances: BoardStancesMap;
  topic: string;
  results: BoardAskMemberResult[];
  label: string;
};

const TOPIC_MAX = 2000;
const NOTE_MAX = 500;

function findAgent(agentId: string): RegistryAgent | null {
  return loadAgents().agents.find((a) => a.id === agentId) ?? null;
}

function resolveMemberModel(agentId: string, agent: RegistryAgent | null): {
  primary: string;
  secondary: string | null;
  preference: ReturnType<typeof resolveAgentRoute>["preference"];
  providerTarget: ReturnType<typeof resolveAgentRoute>["providerTarget"];
} {
  if (isChiefId(agentId)) {
    const state = loadState();
    const route = resolveAgentRoute(agentId);
    const primary =
      route.primaryModelId?.trim() ||
      state.chiefPrimary?.trim() ||
      agent?.modelId?.trim() ||
      "agentchat";
    const secondary =
      route.secondaryModelId ?? state.chiefSecondary ?? agent?.secondaryModelId ?? null;
    return {
      primary,
      secondary,
      preference: route.preference,
      providerTarget: route.providerTarget,
    };
  }
  const route = resolveAgentRoute(agentId);
  const primary = route.primaryModelId?.trim() || agent?.modelId?.trim() || "agentchat";
  return {
    primary,
    secondary: route.secondaryModelId,
    preference: route.preference,
    providerTarget: route.providerTarget,
  };
}

function systemPromptForStance(agent: RegistryAgent): string {
  return buildAgentSystemPrompt({
    agentId: agent.id,
    kind: "board-stance",
    name: agent.name,
    role: agent.role,
    roleTag: agent.roleTag,
    skills: agent.skills,
  });
}

function stanceUserPrompt(agent: RegistryAgent, topic: string): string {
  return (
    `Decision / question:\n${topic}\n\n` +
    `As ${agent.name}, take a stance. Output only STANCE and REASON lines.`
  );
}

/** Parse STANCE/REASON lines; fall back to keyword heuristics. */
export function parseStanceReply(raw: string): BoardAgentStance | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const stanceLine =
    text.match(/^\s*STANCE\s*:\s*(for|info|against)\b/im)?.[1]?.toLowerCase() ??
    text.match(/\bSTANCE\s*[=:]\s*(for|info|against)\b/i)?.[1]?.toLowerCase() ??
    null;

  let stance: BoardStanceKind | null =
    stanceLine === "for" || stanceLine === "info" || stanceLine === "against"
      ? stanceLine
      : null;

  if (!stance) {
    const lower = text.toLowerCase();
    if (/\b(against|oppose|opposed|no)\b/.test(lower)) stance = "against";
    else if (/\b(needs?\s*info|more\s*info|unclear|uncertain)\b/.test(lower)) stance = "info";
    else if (/\b(for|support|favor|yes)\b/.test(lower)) stance = "for";
  }
  if (!stance) return null;

  const reasonMatch =
    text.match(/^\s*REASON\s*:\s*(.+)$/im)?.[1] ??
    text.match(/\bREASON\s*[=:]\s*(.+)$/im)?.[1] ??
    null;
  let note = (reasonMatch ?? text).replace(/\s+/g, " ").trim();
  note = note.replace(/^(STANCE\s*:\s*(for|info|against)\s*)/i, "").trim();
  if (note.length > NOTE_MAX) note = note.slice(0, NOTE_MAX).trim();
  if (!note) note = stance === "info" ? "Needs more information." : `Takes ${stance}.`;

  return { stance, note };
}

export function normalizeBoardTopic(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).trim().slice(0, TOPIC_MAX);
}

/**
 * Ask every agent on the board to take a stance on `topic` (or stored topic).
 * Persists topic + merged stances. Fail-closed per agent — never invents silent success.
 */
export async function runBoardAsk(opts?: { topic?: string | null }): Promise<BoardAskResult> {
  const board = getBoardState();
  const topic = normalizeBoardTopic(opts?.topic ?? board.topic);
  if (!topic) {
    return {
      ...board,
      topic: board.topic,
      results: [],
      label: "Decision / question required",
    };
  }

  // Persist topic up front so a partial ask still leaves the question on the board.
  updateBoard({ topic });

  const results: BoardAskMemberResult[] = [];
  const nextStances: BoardStancesMap = { ...board.stances };

  for (const agentId of board.boardIds) {
    const agent = findAgent(agentId);
    const name = agent?.name ?? agentId;
    const { primary, secondary, preference, providerTarget } = resolveMemberModel(agentId, agent);

    if (!agent) {
      const err = `Unknown board agent "${agentId}" — skipped.`;
      results.push({ agentId, name, ok: false, modelId: primary, error: err });
      continue;
    }

    try {
      const result = await routeGenerate({
        prompt: stanceUserPrompt(agent, topic),
        modelId: primary,
        secondaryModelId: secondary,
        systemPrompt: systemPromptForStance(agent),
        routePreference: preference,
        providerTarget,
      });

      if (result.via !== "offline" && result.text?.trim()) {
        const parsed = parseStanceReply(result.text);
        if (parsed) {
          nextStances[agentId] = parsed;
          results.push({
            agentId,
            name,
            ok: true,
            modelId: primary,
            via: result.via,
            stance: parsed.stance,
            note: parsed.note,
          });
        } else {
          const err = "Could not parse stance from model reply.";
          results.push({
            agentId,
            name,
            ok: false,
            modelId: primary,
            via: result.via,
            error: err,
          });
        }
      } else {
        const { message } = chiefGenerateFailureDetail(primary, result.reason, { bumpStreak: false });
        const failText = await offlineAgentReply(name, primary, result.reason);
        results.push({
          agentId,
          name,
          ok: false,
          modelId: primary,
          via: result.via,
          error: `${failText} (${message})`,
        });
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      results.push({
        agentId,
        name,
        ok: false,
        modelId: primary,
        error: detail,
      });
    }
  }

  const snapshot = updateBoard({
    topic,
    stances: normalizeBoardStances(nextStances),
  });

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  const label =
    failCount === 0
      ? `Agents took sides (${okCount})`
      : `Agents took sides (${okCount} ok, ${failCount} failed closed)`;

  return {
    ...snapshot,
    results,
    label,
  };
}
