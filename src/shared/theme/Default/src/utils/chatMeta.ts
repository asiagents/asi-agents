import type { ChatMessage as ApiMessage } from '@asi-api';
import type { ChatMessageMeta } from '../types/chat';

function mapCostTrace(meta: NonNullable<ApiMessage['meta']>): ChatMessageMeta['costTrace'] | undefined {
  const t = meta.costTrace;
  if (!t || !Array.isArray(t.stages)) return undefined;
  return {
    stages: t.stages.map((s) => ({
      stage: String(s.stage),
      latencyMs: Number(s.latencyMs) || 0,
      estimatedCostUsd: Number(s.estimatedCostUsd) || 0,
      promptTokens: s.promptTokens,
      completionTokens: s.completionTokens,
      totalTokens: s.totalTokens,
      via: s.via,
    })),
    totalLatencyMs: Number(t.totalLatencyMs) || 0,
    totalEstimatedCostUsd: Number(t.totalEstimatedCostUsd) || 0,
    totalTokens: Number(t.totalTokens) || 0,
  };
}

/** Map server message meta → UI metrics line (only fields the API actually sent). */
export function mapServerMessageMeta(meta?: ApiMessage['meta']): ChatMessageMeta | undefined {
  if (!meta) return undefined;
  const modelLabel = meta.secondary?.trim() || meta.primary?.trim() || meta.upstreamModel?.trim();
  const costTrace = mapCostTrace(meta);
  const hasMetrics =
    meta.latencyMs != null ||
    meta.promptTokens != null ||
    meta.completionTokens != null ||
    meta.tokensPerSecond != null ||
    meta.estimatedCostUsd != null ||
    Boolean(costTrace);
  const hasIntent = Boolean(meta.intentId?.trim()) || meta.source != null;
  const hasTrace = Boolean(meta.decisionTrace);
  if (!modelLabel && !hasMetrics && !meta.via && !hasIntent && !hasTrace) return undefined;
  return {
    modelLabel: modelLabel || undefined,
    via: meta.via,
    latencyMs: meta.latencyMs ?? costTrace?.totalLatencyMs,
    promptTokens: meta.promptTokens,
    completionTokens: meta.completionTokens,
    tokensPerSecond: meta.tokensPerSecond,
    estimatedCostUsd: meta.estimatedCostUsd ?? costTrace?.totalEstimatedCostUsd ?? 0,
    costTrace,
    intentId: meta.intentId?.trim() || undefined,
    source: meta.source,
    confidence: meta.confidence,
    decisionTrace: meta.decisionTrace
      ? {
          category: meta.decisionTrace.category,
          target: meta.decisionTrace.target,
          action: meta.decisionTrace.action,
          compound: meta.decisionTrace.compound,
          confidence: meta.decisionTrace.confidence,
          via: meta.decisionTrace.via,
          gated: meta.decisionTrace.gated,
          firstAction: meta.decisionTrace.firstAction,
          secondAction: meta.decisionTrace.secondAction,
        }
      : undefined,
  };
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`;
  return `$${n.toFixed(4)}`;
}

/**
 * Metrics line under assistant bubbles.
 * Example: `ollama:llama3.2 · 128 tok · 12.4 tok/s · 1.2s · $0`
 */
export function formatMessageMetaLine(meta: ChatMessageMeta): string | null {
  const hasMetrics =
    meta.latencyMs != null ||
    meta.promptTokens != null ||
    meta.completionTokens != null ||
    meta.tokensPerSecond != null ||
    meta.estimatedCostUsd != null ||
    Boolean(meta.costTrace);
  if (!hasMetrics) return null;
  const parts: string[] = [];
  if (meta.modelLabel) parts.push(meta.modelLabel);
  const tok =
    meta.promptTokens != null && meta.completionTokens != null
      ? meta.promptTokens + meta.completionTokens
      : meta.completionTokens ?? meta.promptTokens ?? meta.costTrace?.totalTokens;
  if (tok != null && tok > 0) parts.push(`${tok} tok`);
  if (meta.tokensPerSecond != null) parts.push(`${meta.tokensPerSecond} tok/s`);
  const latencyMs = meta.latencyMs ?? meta.costTrace?.totalLatencyMs;
  if (latencyMs != null) {
    parts.push(latencyMs >= 1000 ? `${(latencyMs / 1000).toFixed(1)}s` : `${latencyMs}ms`);
  }
  const cost = meta.estimatedCostUsd ?? meta.costTrace?.totalEstimatedCostUsd ?? 0;
  parts.push(formatUsd(cost));
  return parts.length ? parts.join(' · ') : null;
}

/** Friendly chip under messages — never expose raw intent ids (e.g. greeting.hello). */
export function formatSourceChipLabel(meta: ChatMessageMeta): string | null {
  if (meta.intentId === 'routing.clarify') return 'Say that again';
  if (meta.intentId === 'routing.give_up') return 'Gave up';
  if (meta.intentId?.startsWith('routing.')) return 'Routing';
  if (!meta.intentId?.trim() && !meta.decisionTrace) return null;
  if (meta.source === 'ams') return 'AMS';
  if (meta.source === 'llm' && !meta.decisionTrace) return null;
  if (meta.intentId?.trim() && meta.source !== 'llm') return 'ASI Agents App';
  return null;
}

/** Compact fan-out chip label — category · confidence. */
export function formatDecisionTraceChip(meta: ChatMessageMeta): string | null {
  const t = meta.decisionTrace;
  if (!t || typeof t.confidence !== 'number') return null;
  const cat = t.category?.trim() || 'route';
  const gated =
    t.gated === 'clarify'
      ? 'clarify'
      : t.gated === 'give_up'
        ? 'give up'
        : t.gated === 'escalate_llm'
          ? '→ LLM'
          : t.gated === 'split'
            ? 'compound'
            : null;
  const conf = Math.round(t.confidence * 100);
  return gated ? `${cat} · ${conf}% · ${gated}` : `${cat} · ${conf}%`;
}

export function formatDecisionTraceDetail(meta: ChatMessageMeta): string | null {
  const t = meta.decisionTrace;
  if (!t) return null;
  const parts: string[] = [];
  if (t.category) parts.push(`category=${t.category}`);
  if (t.target) parts.push(`target=${t.target}`);
  if (t.action) parts.push(`action=${t.action}`);
  if (t.compound) parts.push('compound');
  if (t.firstAction) parts.push(`1st=${t.firstAction}`);
  if (t.secondAction) parts.push(`2nd=${t.secondAction}`);
  parts.push(`conf=${t.confidence.toFixed(2)}`);
  if (t.via) parts.push(`via=${t.via}`);
  if (t.gated) parts.push(`gate=${t.gated}`);
  return parts.join(' · ');
}

/** Per-stage cost/latency lines for the decision / cost trace panel. */
export function formatCostTraceLines(meta: ChatMessageMeta): string[] {
  const stages = meta.costTrace?.stages;
  if (!stages?.length) return [];
  return stages.map((s) => {
    const ms = `${s.latencyMs}ms`;
    const usd = formatUsd(s.estimatedCostUsd);
    const tok =
      s.totalTokens != null && s.totalTokens > 0
        ? ` · ${s.totalTokens} tok`
        : s.promptTokens != null || s.completionTokens != null
          ? ` · ${(s.promptTokens ?? 0) + (s.completionTokens ?? 0)} tok`
          : '';
    const via = s.via ? ` · ${s.via}` : '';
    return `${s.stage} ${ms} · ${usd}${tok}${via}`;
  });
}
