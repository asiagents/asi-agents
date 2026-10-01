import type { ChatMessage } from "./types.js";
import type { GenerateResult } from "./llm-routing.js";
import {
  mergeCostTraceIntoMeta,
  stagesFromGenerateResult,
  type TurnStageCost,
} from "./turnCostTrace.js";

export function chatMetaFromGenerate(
  primary: string,
  secondary: string | null,
  result: GenerateResult,
  extra?: { agentId?: string; reason?: string; priorStages?: TurnStageCost[] }
): ChatMessage["meta"] {
  const meta: ChatMessage["meta"] = { primary };
  if (secondary) meta.secondary = secondary;
  if (result.via === "cloud" && result.providerId && result.upstreamModel) {
    meta.secondary = `${result.providerId}:${result.upstreamModel}`;
    meta.upstreamModel = result.upstreamModel;
  }
  if (extra?.agentId) meta.agentId = extra.agentId;
  if (extra?.reason) meta.reason = extra.reason;
  else if (result.via === "cloud") {
    meta.reason = `cloud:${result.providerId ?? "unknown"}`;
  } else if (result.reason) {
    meta.reason = result.reason;
  }
  meta.via = result.via;
  meta.source = "llm";
  if (result.usage) {
    meta.latencyMs = result.usage.latencyMs;
    if (result.usage.promptTokens != null) meta.promptTokens = result.usage.promptTokens;
    if (result.usage.completionTokens != null) meta.completionTokens = result.usage.completionTokens;
    if (result.usage.tokensPerSecond != null) meta.tokensPerSecond = result.usage.tokensPerSecond;
  }

  const stages: TurnStageCost[] = [
    ...(extra?.priorStages ?? []),
    ...stagesFromGenerateResult(result),
  ];
  return mergeCostTraceIntoMeta(meta as Record<string, unknown>, stages) as ChatMessage["meta"];
}

export function handoffMeta(
  primary: string,
  secondary: string | null,
  reason: string,
  agentId?: string
): ChatMessage["meta"] {
  return {
    primary,
    secondary: secondary ?? undefined,
    reason,
    agentId,
  };
}
