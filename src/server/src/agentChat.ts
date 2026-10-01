import { loadAgents, type RegistryAgent } from "./agents.js";
import { handoffMeta } from "./generate-meta.js";
import { offlineAgentReply, resolveAgentRoute } from "./llm-routing.js";
import {
  assistantChatMessage,
  promptWithRecentThread,
  runGenerateWithIntentEscalation,
  tryIntentBeforeGenerate,
  userChatMessage,
} from "./intent/integrateChat.js";
import { systemPromptForRegistryAgent } from "./agentSystemPrompt.js";
import {
  getAgentModelAssignment,
  getAgentThreadMessages,
  pushAgentThreadMessages,
  setAgentThreadPrimary,
} from "./store.js";
import type { ChatMessage } from "./types.js";
import { isChiefId } from "./withChief.js";

function id(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findAgent(agentId: string): RegistryAgent | null {
  const row = loadAgents().agents.find((a) => a.id === agentId);
  return row ?? null;
}

function systemPromptFor(agent: RegistryAgent): string {
  return systemPromptForRegistryAgent(agent, "specialist");
}

export function getAgentChatThread(agentId: string): {
  messages: ChatMessage[];
  primary: string | null;
  secondary: string | null;
  routePref: string;
  routeSource: "override" | "registry" | "default";
} | null {
  const agent = findAgent(agentId);
  if (!agent || isChiefId(agentId)) return null;
  const route = resolveAgentRoute(agentId);
  const ov = getAgentModelAssignment(agentId);
  const primary = ov.primary ?? agent.modelId;
  const secondary = ov.secondary ?? agent.secondaryModelId ?? null;
  return {
    messages: getAgentThreadMessages(agentId),
    primary,
    secondary,
    routePref: route.routePref,
    routeSource: route.source,
  };
}

export async function postAgentChat(
  agentId: string,
  text: string,
  modelId?: string | null
): Promise<ChatMessage[] | null> {
  const agent = findAgent(agentId);
  if (!agent || isChiefId(agentId)) return null;

  const ov = getAgentModelAssignment(agentId);
  const route = resolveAgentRoute(agentId);
  const primary = modelId?.trim() || route.primaryModelId || agent.modelId || "agentchat";
  const secondary = route.secondaryModelId ?? ov.secondary ?? agent.secondaryModelId ?? null;

  if (modelId?.trim()) {
    setAgentThreadPrimary(agentId, modelId.trim());
  }

  const pre = await tryIntentBeforeGenerate(
    text,
    "agent",
    `agent:${agentId}`,
    primary,
    secondary
  );
  if (pre.handled) {
    pushAgentThreadMessages(agentId, pre.messages);
    return pre.messages;
  }

  const userMsg = userChatMessage(text, pre.decisionTrace);
  const prior = getAgentThreadMessages(agentId);
  const prompt = promptWithRecentThread(text, prior);

  const { result, reply, meta } = await runGenerateWithIntentEscalation(
    {
      prompt,
      modelId: primary,
      secondaryModelId: secondary,
      systemPrompt: systemPromptFor(agent),
      routePreference: route.preference,
      providerTarget: route.providerTarget,
      agentId,
    },
    primary,
    secondary,
    pre.escalate,
    { agentId, priorStages: [pre.intentStage, ...(pre.classifierStage ? [pre.classifierStage] : [])], decisionTrace: pre.decisionTrace }
  );

  const out: ChatMessage[] = [userMsg];
  const toSave: ChatMessage[] = [userMsg];

  if (result.via !== "offline" && reply) {
    if (result.via === "cloud") {
      const handoffText =
        result.reason === "cloud_preferred"
          ? `Cloud route preference — answered via ${result.providerId ?? "cloud"} (${result.upstreamModel ?? "model"}).`
          : result.reason === "provider_preferred"
            ? `Provider route — answered via ${result.providerId ?? "cloud"} (${result.upstreamModel ?? "model"}).`
            : `Local generate unavailable — routed via ${result.providerId ?? "cloud"} (${result.upstreamModel ?? "model"}).`;
      const handoff: ChatMessage = {
        id: id(),
        role: "handoff",
        text: handoffText,
        at: new Date().toISOString(),
        meta: {
          primary,
          secondary: secondary ?? undefined,
          reason: result.reason ?? "cloud_fallback",
          agentId,
        },
      };
      toSave.push(handoff);
      out.push(handoff);
    }
    const agentMsg = assistantChatMessage("agent", reply, meta);
    toSave.push(agentMsg);
    out.push(agentMsg);
  } else {
    const handoff: ChatMessage = {
      id: id(),
      role: "handoff",
      text: "Primary generate path unavailable — no cloud or local backend answered.",
      at: new Date().toISOString(),
      meta: handoffMeta(primary, secondary, result.reason ?? "generate_offline", agentId),
    };
    const agentMsg: ChatMessage = {
      id: id(),
      role: "agent",
      text: await offlineAgentReply(agent.name, primary, result.reason),
      at: new Date().toISOString(),
      meta: { secondary: secondary ?? undefined, agentId },
    };
    toSave.push(handoff, agentMsg);
    out.push(handoff, agentMsg);
  }

  pushAgentThreadMessages(agentId, toSave);
  return out;
}
