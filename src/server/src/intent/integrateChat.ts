import { chatMetaFromGenerate } from "../generate-meta.js";
import type { GenerateResult, RouteGenerateInput } from "../llm-routing.js";
import { routeGenerate } from "../llm-routing.js";
import type { ChatMessage } from "../types.js";
import {
  mergeCostTraceIntoMeta,
  type TurnStageCost,
} from "../turnCostTrace.js";
import { generateAfterIntentEscalation } from "./chatGenerate.js";
import { maybeIntentReply } from "./maybeIntentReply.js";

function msgId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Prefix recent user/assistant turns so short follow-ups keep topic context. */
export function promptWithRecentThread(
  currentText: string,
  prior: ChatMessage[],
  maxTurns = 6
): string {
  const usable = prior.filter(
    (m) =>
      (m.role === "user" || m.role === "agent" || m.role === "chief") &&
      Boolean(m.text?.trim())
  );
  const slice = usable.slice(-maxTurns);
  if (!slice.length) return currentText;
  const lines = slice.map((m) => {
    const who = m.role === "user" ? "User" : "Assistant";
    const body = m.text.trim().slice(0, 800);
    return `${who}: ${body}`;
  });
  return `Recent thread:\n${lines.join("\n")}\n\nUser: ${currentText}`;
}

export async function tryIntentBeforeGenerate(
  text: string,
  assistantRole: ChatMessage["role"],
  threadKey: string,
  primary: string,
  secondary: string | null
): Promise<
  | { handled: true; messages: ChatMessage[]; intentStage: TurnStageCost }
  | {
      handled: false;
      escalate: boolean;
      intentStage: TurnStageCost;
      classifierStage?: TurnStageCost;
      decisionTrace?: NonNullable<ChatMessage["meta"]>["decisionTrace"];
    }
> {
  const intent = await maybeIntentReply(text, assistantRole, {
    threadKey,
    primaryModelId: primary,
    secondaryModelId: secondary,
  });
  if (intent.handled) {
    return { handled: true, messages: intent.messages, intentStage: intent.intentStage };
  }
  return {
    handled: false,
    escalate: intent.escalate,
    intentStage: intent.intentStage,
    classifierStage: intent.classifierStage,
    decisionTrace: intent.decisionTrace,
  };
}

export async function runGenerateWithIntentEscalation(
  input: RouteGenerateInput,
  primary: string,
  secondary: string | null,
  afterIntentEscalation: boolean,
  extraMeta?: {
    agentId?: string;
    priorStages?: TurnStageCost[];
    decisionTrace?: NonNullable<ChatMessage["meta"]>["decisionTrace"];
  }
): Promise<{ result: GenerateResult; reply: string; meta: ChatMessage["meta"] }> {
  const priorStages = extraMeta?.priorStages ?? [];
  const agentExtra = { agentId: extraMeta?.agentId, priorStages };
  const traceExtra = extraMeta?.decisionTrace
    ? { decisionTrace: extraMeta.decisionTrace }
    : {};

  if (afterIntentEscalation) {
    const { result, failClosedText } = await generateAfterIntentEscalation(input, primary);
    if (failClosedText && (result.via === "offline" || !result.text)) {
      const meta = mergeCostTraceIntoMeta(
        {
          primary,
          secondary: secondary ?? undefined,
          source: "in-app",
          reason: result.reason ?? "intent_fail_closed",
          ...(extraMeta?.agentId ? { agentId: extraMeta.agentId } : {}),
          ...traceExtra,
        },
        [
          ...priorStages,
          {
            stage: "ams",
            latencyMs: result.usage?.latencyMs ?? 0,
            estimatedCostUsd: 0,
            via: result.via,
          },
        ]
      ) as ChatMessage["meta"];
      return {
        result,
        reply: failClosedText,
        meta,
      };
    }
    if (result.via !== "offline" && result.text) {
      return {
        result,
        reply: result.text,
        meta: {
          ...chatMetaFromGenerate(primary, secondary, result, agentExtra),
          source: "ams",
          ...traceExtra,
        },
      };
    }
  }

  const result = await routeGenerate(input);
  return {
    result,
    reply: result.text ?? "",
    meta: {
      ...chatMetaFromGenerate(primary, secondary, result, agentExtra),
      ...traceExtra,
    },
  };
}

export function userChatMessage(
  text: string,
  decisionTrace?: NonNullable<ChatMessage["meta"]>["decisionTrace"]
): ChatMessage {
  return {
    id: msgId(),
    role: "user",
    text,
    at: new Date().toISOString(),
    meta: {
      source: "llm",
      ...(decisionTrace ? { decisionTrace } : {}),
    },
  };
}

export function assistantChatMessage(
  role: ChatMessage["role"],
  text: string,
  meta: ChatMessage["meta"]
): ChatMessage {
  return {
    id: msgId(),
    role,
    text,
    at: new Date().toISOString(),
    meta,
  };
}
