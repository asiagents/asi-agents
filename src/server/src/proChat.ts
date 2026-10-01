import { ChiefGenerateError } from "./chief.js";
import { chatMetaFromGenerate } from "./generate-meta.js";
import {
  chiefGenerateFailureDetail,
  resolveAgentRoute,
  routeGenerate,
  type GenerateResult,
} from "./llm-routing.js";
import {
  assistantChatMessage,
  promptWithRecentThread,
  runGenerateWithIntentEscalation,
  tryIntentBeforeGenerate,
  userChatMessage,
} from "./intent/integrateChat.js";
import { findProAgent, type ProAgentRow } from "./proAgents.js";
import { buildAgentSystemPrompt } from "./agentSystemPrompt.js";
import {
  getAgentModelAssignment,
  getProThreadMessages,
  getProThreadPrimary,
  pushProThreadMessages,
  setProThreadPrimary,
} from "./store.js";
import type { ChatMessage } from "./types.js";
import { isChiefId } from "./withChief.js";

function id(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function proChatAuthorId(proId: string): string {
  return `pro-${proId.trim()}`;
}

function systemPromptFor(agent: ProAgentRow): string {
  return buildAgentSystemPrompt({
    agentId: agent.id,
    kind: "pro",
    name: agent.name,
    role: agent.role,
    skills: agent.skills,
  });
}

/**
 * Pro persona generate. Routing prefs live in app-state `agentRouting` keyed by pro agent id.
 */
export async function generateProChatReply(
  proAgentId: string,
  text: string,
  systemPrompt: string,
  modelId?: string | null
): Promise<GenerateResult> {
  const id = proAgentId.trim();
  const route = resolveAgentRoute(id);
  const primary = modelId?.trim() || route.primaryModelId;
  return routeGenerate({
    prompt: text,
    modelId: primary,
    secondaryModelId: route.secondaryModelId,
    systemPrompt,
    routePreference: route.preference,
    providerTarget: route.providerTarget,
    agentId: id,
  });
}

export function getProChatThread(proId: string): {
  messages: ChatMessage[];
  primary: string | null;
  secondary: string | null;
  routePref: string;
  routeSource: "override" | "registry" | "default";
} | null {
  const agent = findProAgent(proId);
  if (!agent || isChiefId(proId)) return null;
  const route = resolveAgentRoute(proId);
  const ov = getAgentModelAssignment(proId);
  const storedPrimary = getProThreadPrimary(proId);
  const primary = storedPrimary ?? ov.primary ?? agent.modelId;
  const secondary = ov.secondary ?? null;
  return {
    messages: getProThreadMessages(proId),
    primary,
    secondary,
    routePref: route.routePref,
    routeSource: route.source,
  };
}

export async function postProChat(
  proId: string,
  text: string,
  modelId?: string | null
): Promise<ChatMessage[]> {
  const agent = findProAgent(proId);
  if (!agent || isChiefId(proId)) throw new Error("unknown pro agent");

  const route = resolveAgentRoute(proId);
  const ov = getAgentModelAssignment(proId);
  const primary = modelId?.trim() || route.primaryModelId || agent.modelId || "agentchat";
  const secondary = route.secondaryModelId ?? ov.secondary ?? null;
  const authorId = proChatAuthorId(proId);

  if (modelId?.trim()) {
    setProThreadPrimary(proId, modelId.trim());
  }

  const pre = await tryIntentBeforeGenerate(
    text,
    "agent",
    `pro:${proId}`,
    primary,
    secondary
  );
  if (pre.handled) {
    pushProThreadMessages(proId, pre.messages);
    return pre.messages;
  }

  const userMsg = userChatMessage(text, pre.decisionTrace);
  const prior = getProThreadMessages(proId);
  const prompt = promptWithRecentThread(text, prior);

  const { result, reply, meta } = await runGenerateWithIntentEscalation(
    {
      prompt,
      modelId: primary,
      secondaryModelId: secondary,
      systemPrompt: systemPromptFor(agent),
      routePreference: route.preference,
      providerTarget: route.providerTarget,
      agentId: authorId,
    },
    primary,
    secondary,
    pre.escalate,
    { agentId: authorId, priorStages: [pre.intentStage, ...(pre.classifierStage ? [pre.classifierStage] : [])], decisionTrace: pre.decisionTrace }
  );

  if (result.via === "offline" || !reply) {
    const { message, tried } = chiefGenerateFailureDetail(primary, result.reason);
    throw new ChiefGenerateError(message, tried);
  }

  const out: ChatMessage[] = [userMsg];
  const toSave: ChatMessage[] = [userMsg];

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
        agentId: authorId,
      },
    };
    toSave.push(handoff);
    out.push(handoff);
  }

  const agentMsg = assistantChatMessage("agent", reply, meta);
  toSave.push(agentMsg);
  out.push(agentMsg);

  pushProThreadMessages(proId, toSave);
  return out;
}
