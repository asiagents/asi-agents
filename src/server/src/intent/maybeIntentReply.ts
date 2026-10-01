import type { ChatMessage, ChatMessageSource } from "../types.js";
import {
  mergeCostTraceIntoMeta,
  stageTimed,
  type TurnStageCost,
} from "../turnCostTrace.js";
import { resolveIntent, isIntentLayerEnabled } from "./resolve.js";
import type { ClientAction, DecisionTrace, IntentThreadContext } from "./types.js";

function msgId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type MaybeIntentResult =
  | { handled: true; messages: ChatMessage[]; intentStage: TurnStageCost }
  | {
      handled: false;
      escalate: true;
      reason: string;
      decisionTrace?: DecisionTrace;
      intentStage: TurnStageCost;
      classifierStage?: TurnStageCost;
    }
  | {
      handled: false;
      escalate: false;
      reason?: string;
      decisionTrace?: DecisionTrace;
      intentStage: TurnStageCost;
      classifierStage?: TurnStageCost;
    };

function intentMeta(
  intentId: string,
  confidence: number,
  stages: TurnStageCost[],
  clientActions?: ClientAction[],
  source: ChatMessageSource = "in-app",
  decisionTrace?: DecisionTrace
): ChatMessage["meta"] {
  const meta: NonNullable<ChatMessage["meta"]> = {
    source: source ?? "in-app",
    intentId,
    reason: intentId.startsWith("routing.") ? intentId : "local-intent",
    confidence,
  };
  if (clientActions?.length) {
    meta.clientActions = JSON.stringify(clientActions);
  }
  if (decisionTrace) {
    meta.decisionTrace = decisionTrace;
  }
  return mergeCostTraceIntoMeta(meta as Record<string, unknown>, stages) as ChatMessage["meta"];
}

export async function maybeIntentReply(
  userText: string,
  assistantRole: ChatMessage["role"],
  ctx: IntentThreadContext
): Promise<MaybeIntentResult> {
  const started = performance.now();

  if (!isIntentLayerEnabled()) {
    return {
      handled: false,
      escalate: false,
      reason: "disabled",
      intentStage: stageTimed("intent", started, { via: "disabled", estimatedCostUsd: 0 }),
    };
  }

  const outcome = await resolveIntent(userText, ctx);
  const rawIntent = stageTimed("intent", started, {
    via: outcome.kind === "escalate" ? "escalate" : "in-app",
    estimatedCostUsd: 0,
  });
  const classifierStage = outcome.classifierStage as TurnStageCost | undefined;
  // Don't double-count classifier wall time inside the intent stage.
  const intentStage: TurnStageCost = classifierStage
    ? {
        ...rawIntent,
        latencyMs: Math.max(0, rawIntent.latencyMs - (classifierStage.latencyMs ?? 0)),
      }
    : rawIntent;
  const decisionTrace =
    outcome.kind === "answered" ||
    outcome.kind === "pending_confirm" ||
    outcome.kind === "escalate"
      ? outcome.decisionTrace
      : undefined;

  if (outcome.kind === "escalate") {
    return {
      handled: false,
      escalate: true,
      reason: outcome.reason,
      decisionTrace,
      intentStage,
      classifierStage,
    };
  }

  const stages: TurnStageCost[] = [intentStage];
  if (classifierStage) stages.push(classifierStage);

  const userMsg: ChatMessage = {
    id: msgId(),
    role: "user",
    text: userText,
    at: new Date().toISOString(),
    meta: {
      source: "in-app",
      ...(decisionTrace ? { decisionTrace } : {}),
    },
  };

  const replyText = outcome.text;
  const intentId = outcome.intentId;
  const confidence = outcome.kind === "answered" ? outcome.confidence : 0.9;
  const clientActions = outcome.kind === "answered" ? outcome.clientActions : undefined;
  const source = outcome.kind === "answered" ? outcome.source : undefined;

  const assistantMsg: ChatMessage = {
    id: msgId(),
    role: assistantRole,
    text: replyText,
    at: new Date().toISOString(),
    meta: intentMeta(
      intentId,
      confidence,
      stages,
      clientActions,
      source ?? "in-app",
      decisionTrace
    ),
  };

  return { handled: true, messages: [userMsg, assistantMsg], intentStage };
}

export const INTENT_UNKNOWN_FAIL_CLOSED =
  "I don't understand that yet, and AMS Micro isn't available on :7821.";
