/**
 * Per-turn cost / latency traces for chat + group generate.
 * Honest zeros when ms / $ / tokens are unknown — never invent spend.
 */
import type { GenerateResult, GenerateUsage, GenerateVia } from "./llm-routing.js";

export type TurnStageId = "intent" | "ams" | "classifier" | "llm";

export interface TurnStageCost {
  stage: TurnStageId;
  /** Wall time for this stage; 0 when unknown. */
  latencyMs: number;
  /** Rough USD; 0 when unknown / local. */
  estimatedCostUsd: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  via?: string;
}

export interface TurnCostTrace {
  stages: TurnStageCost[];
  totalLatencyMs: number;
  totalEstimatedCostUsd: number;
  totalTokens: number;
}

/** Rough cloud USD (per 1M tokens). Local / unknown → 0. */
export function estimateStageCostUsd(
  via: string | undefined,
  providerId: string | undefined,
  promptTokens: number | undefined,
  completionTokens: number | undefined
): number {
  if (via !== "cloud" && !providerId) return 0;
  const inTok = promptTokens ?? 0;
  const outTok = completionTokens ?? 0;
  if (inTok + outTok <= 0) return 0;
  const inPerM = 0.5;
  const outPerM = 1.5;
  const usd = (inTok / 1_000_000) * inPerM + (outTok / 1_000_000) * outPerM;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export function stageFromUsage(
  stage: TurnStageId,
  usage: GenerateUsage | undefined,
  via?: string,
  providerId?: string
): TurnStageCost {
  const promptTokens = usage?.promptTokens;
  const completionTokens = usage?.completionTokens;
  const totalTokens =
    usage?.totalTokens ??
    (promptTokens != null && completionTokens != null
      ? promptTokens + completionTokens
      : undefined);
  const latencyMs = usage?.latencyMs != null ? Math.max(0, Math.round(usage.latencyMs)) : 0;
  return {
    stage,
    latencyMs,
    estimatedCostUsd: estimateStageCostUsd(via, providerId, promptTokens, completionTokens),
    promptTokens,
    completionTokens,
    totalTokens,
    via,
  };
}

export function stageTimed(
  stage: TurnStageId,
  started: number,
  opts?: {
    via?: string;
    providerId?: string;
    promptTokens?: number;
    completionTokens?: number;
    estimatedCostUsd?: number;
  }
): TurnStageCost {
  const latencyMs = Math.max(0, Math.round(performance.now() - started));
  const promptTokens = opts?.promptTokens;
  const completionTokens = opts?.completionTokens;
  const totalTokens =
    promptTokens != null && completionTokens != null
      ? promptTokens + completionTokens
      : undefined;
  const estimatedCostUsd =
    opts?.estimatedCostUsd != null
      ? opts.estimatedCostUsd
      : estimateStageCostUsd(opts?.via, opts?.providerId, promptTokens, completionTokens);
  return {
    stage,
    latencyMs,
    estimatedCostUsd,
    promptTokens,
    completionTokens,
    totalTokens,
    via: opts?.via,
  };
}

/** Map generate via → AMS (router) vs LLM (local/cloud backends). */
export function stageIdForVia(via: GenerateVia | string | undefined): TurnStageId {
  if (via === "router") return "ams";
  return "llm";
}

export function buildTurnCostTrace(stages: TurnStageCost[]): TurnCostTrace {
  const cleaned = stages.map((s) => ({
    ...s,
    latencyMs: Number.isFinite(s.latencyMs) ? Math.max(0, Math.round(s.latencyMs)) : 0,
    estimatedCostUsd: Number.isFinite(s.estimatedCostUsd) ? Math.max(0, s.estimatedCostUsd) : 0,
  }));
  const totalLatencyMs = cleaned.reduce((sum, s) => sum + s.latencyMs, 0);
  const totalEstimatedCostUsd =
    Math.round(cleaned.reduce((sum, s) => sum + s.estimatedCostUsd, 0) * 1_000_000) / 1_000_000;
  const totalTokens = cleaned.reduce((sum, s) => {
    if (s.totalTokens != null) return sum + s.totalTokens;
    const p = s.promptTokens ?? 0;
    const c = s.completionTokens ?? 0;
    return sum + p + c;
  }, 0);
  return {
    stages: cleaned,
    totalLatencyMs,
    totalEstimatedCostUsd,
    totalTokens,
  };
}

export function mergeCostTraceIntoMeta(
  meta: Record<string, unknown> | undefined,
  stages: TurnStageCost[]
): Record<string, unknown> {
  const trace = buildTurnCostTrace(stages);
  const next: Record<string, unknown> = { ...(meta ?? {}) };
  next.costTrace = trace;
  // Promote totals onto legacy metrics fields when missing (UI metrics line).
  if (next.latencyMs == null && trace.totalLatencyMs > 0) {
    next.latencyMs = trace.totalLatencyMs;
  }
  if (next.estimatedCostUsd == null) {
    next.estimatedCostUsd = trace.totalEstimatedCostUsd;
  }
  const promptSum = trace.stages.reduce((n, s) => n + (s.promptTokens ?? 0), 0);
  const completionSum = trace.stages.reduce((n, s) => n + (s.completionTokens ?? 0), 0);
  if (next.promptTokens == null && promptSum > 0) next.promptTokens = promptSum;
  if (next.completionTokens == null && completionSum > 0) next.completionTokens = completionSum;
  return next;
}

export function stagesFromGenerateResult(result: GenerateResult): TurnStageCost[] {
  if (result.via === "offline" && !result.usage) {
    return [stageFromUsage(stageIdForVia(result.via), { latencyMs: 0 }, result.via, result.providerId)];
  }
  return [
    stageFromUsage(
      stageIdForVia(result.via),
      result.usage ?? { latencyMs: 0 },
      result.via,
      result.providerId
    ),
  ];
}
