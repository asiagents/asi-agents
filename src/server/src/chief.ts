import type { ChatMessage } from "./types.js";
import { chatMetaFromGenerate, handoffMeta } from "./generate-meta.js";
import { chiefGenerateFailureDetail, routeGenerate, type GenerateResult } from "./llm-routing.js";
import { generateAfterIntentEscalation } from "./intent/chatGenerate.js";
import { maybeIntentReply } from "./intent/index.js";
import { buildAgentSystemPrompt } from "./agentSystemPrompt.js";
import { loadState, pushChiefThreadMessages, saveState } from "./store.js";
import { mergeCostTraceIntoMeta, type TurnStageCost } from "./turnCostTrace.js";

function chiefSystemPrompt(): string {
  return buildAgentSystemPrompt({ agentId: "chief", kind: "chief" });
}

export class ChiefGenerateError extends Error {
  readonly code = "generate_failed";
  readonly tried: string[];

  constructor(message: string, tried: string[]) {
    super(message);
    this.name = "ChiefGenerateError";
    this.tried = tried;
  }
}

function id(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function generateChiefReply(
  text: string,
  primary: string,
  secondary: string | null,
  afterIntentEscalation: boolean,
  priorStages: TurnStageCost[] = []
): Promise<{ reply: string; result: GenerateResult; meta: ChatMessage["meta"] }> {
  const input = {
    prompt: text,
    modelId: primary,
    secondaryModelId: secondary,
    systemPrompt: chiefSystemPrompt(),
    agentId: "chief",
  };
  const agentExtra = { agentId: "chief", priorStages };

  if (afterIntentEscalation) {
    const { result, failClosedText } = await generateAfterIntentEscalation(input, primary);
    if (failClosedText && (result.via === "offline" || !result.text)) {
      return {
        reply: failClosedText,
        result,
        meta: mergeCostTraceIntoMeta(
          { primary, source: "in-app", reason: result.reason ?? "intent_fail_closed" },
          [
            ...priorStages,
            {
              stage: "ams",
              latencyMs: result.usage?.latencyMs ?? 0,
              estimatedCostUsd: 0,
              via: result.via,
            },
          ]
        ) as ChatMessage["meta"],
      };
    }
    if (result.via !== "offline" && result.text) {
      return {
        reply: result.text,
        result,
        meta: { ...chatMetaFromGenerate(primary, secondary, result, agentExtra), source: "ams" },
      };
    }
  }

  const result = await routeGenerate(input);

  if (result.via !== "offline" && result.text) {
    return {
      reply: result.text,
      result,
      meta: chatMetaFromGenerate(primary, secondary, result, agentExtra),
    };
  }

  const { message, tried } = chiefGenerateFailureDetail(primary, result.reason);
  throw new ChiefGenerateError(message, tried);
}

export function getChiefThread() {
  const s = loadState();
  return { messages: s.chiefThread, primary: s.chiefPrimary, secondary: s.chiefSecondary };
}

export async function postChiefChat(
  text: string,
  modelId?: string | null
): Promise<ChatMessage[]> {
  const state = loadState();

  if (modelId && modelId.trim()) {
    state.chiefPrimary = modelId.trim();
  }

  const primary = modelId?.trim() || state.chiefPrimary;
  const secondary = state.chiefSecondary?.trim() || null;

  const intent = await maybeIntentReply(text, "chief", {
    threadKey: "chief",
    primaryModelId: primary,
    secondaryModelId: secondary,
  });

  if (intent.handled) {
    pushChiefThreadMessages(intent.messages);
    return intent.messages;
  }

  const userMsg: ChatMessage = {
    id: id(),
    role: "user",
    text,
    at: new Date().toISOString(),
    meta: {
      source: "llm",
      ...(intent.decisionTrace ? { decisionTrace: intent.decisionTrace } : {}),
    },
  };

  const { reply, result, meta } = await generateChiefReply(
    text,
    primary,
    secondary,
    intent.escalate,
    [
      intent.intentStage,
      ...(intent.classifierStage ? [intent.classifierStage] : []),
    ]
  );

  const out: ChatMessage[] = [userMsg];
  state.chiefThread.push(userMsg);

  if (result.via === "cloud" && result.text && result.reason === "local_unavailable") {
    const handoff: ChatMessage = {
      id: id(),
      role: "handoff",
      text: `Local generate unavailable — routed via ${result.providerId ?? "cloud"} (${result.upstreamModel ?? "model"}).`,
      at: new Date().toISOString(),
      meta: handoffMeta(primary, secondary, "cloud_fallback"),
    };
    state.chiefThread.push(handoff);
    out.push(handoff);
  }

  const chiefMsg: ChatMessage = {
    id: id(),
    role: "chief",
    text: reply,
    at: new Date().toISOString(),
    meta: {
      ...meta,
      ...(intent.decisionTrace ? { decisionTrace: intent.decisionTrace } : {}),
    },
  };
  state.chiefThread.push(chiefMsg);
  out.push(chiefMsg);
  saveState(state);
  return out;
}
