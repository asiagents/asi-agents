import type { ModelId } from './models';

export interface ChatMessageMeta {
  modelLabel?: string;
  via?: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  tokensPerSecond?: number;
  /** Total estimated USD; 0 when unknown / local. */
  estimatedCostUsd?: number;
  costTrace?: {
    stages: Array<{
      stage: string;
      latencyMs: number;
      estimatedCostUsd: number;
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      via?: string;
    }>;
    totalLatencyMs: number;
    totalEstimatedCostUsd: number;
    totalTokens: number;
  };
  intentId?: string;
  source?: "in-app" | "ams" | "llm" | "browser";
  confidence?: number;
  /** Fan-out routing slots (transparent like intent chips). */
  decisionTrace?: {
    category?: string;
    target?: string;
    action?: string;
    compound?: boolean;
    confidence: number;
    via?: "rules" | "ams" | "rules+ams";
    gated?: string;
    firstAction?: string;
    secondAction?: string;
  };
}

export interface ChatMessage {
  kind: 'message';
  id: string;
  author: string;
  text: string;
  time: string;
  model?: ModelId;
  meta?: ChatMessageMeta;
  /** Converged Final answer from council conclude. */
  final?: boolean;
}

export type HandoffState = 'done' | 'awaiting' | 'declined';

export interface ChatHandoff {
  kind: 'handoff';
  id: string;
  from: string;
  to: string;
  model: ModelId;
  reason: string;
  time: string;
  state: HandoffState;
}

export interface ChatSystem {
  kind: 'system';
  id: string;
  text: string;
  time: string;
  tone?: 'neutral' | 'success' | 'danger';
}

export type ChatItem = ChatMessage | ChatHandoff | ChatSystem;

export interface ChatReply {
  author: string;
  model: ModelId;
  text: string;
}

export interface Proposal {
  title: string;
  by: string;
  model: ModelId;
  points: string[];
  note: string;
}

export interface NextUp {
  label: string;
  detail: string;
  to?: string;
  targetId?: string;
}

export type ApprovalKind = 'escalation' | 'outbound' | 'permission';
export type ApprovalState = 'open' | 'approved' | 'rejected' | 'local';

export interface Approval {
  id: string;
  threadId: string;
  agentId: string;
  kind: ApprovalKind;
  title: string;
  detail: string;
  model?: ModelId;
  state: ApprovalState;
  time: string;
}

export interface ThreadDef {
  id: string;
  title: string;
  subtitle: string;
  agentId: string;
  /** Pro mode: exact specialist set name shown under the chat header. */
  setName?: string;
  items: ChatItem[];
  reply: ChatReply;
  nextUp: NextUp | null;
  badge?: string;
}