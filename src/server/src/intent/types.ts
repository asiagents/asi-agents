export type IntentHandlerId = string;

export interface IntentCatalogRow {
  id: string;
  handler: IntentHandlerId;
  confirm?: boolean;
  phrases?: string[];
  keywords?: string[];
  optionalKeywords?: string[];
  negatives?: string[];
  regex?: string;
  path?: string;
  minScore?: number;
}

export interface IntentCatalog {
  version: number;
  intentCount: number;
  thresholds: { high: number; low: number; margin: number };
  intents: IntentCatalogRow[];
}

export type ClientAction =
  | { type: "navigate"; path: string }
  | { type: "panic" }
  | { type: "pro_create" }
  | { type: "pro_delete"; name?: string }
  | { type: "navigate_agent"; agentId?: string; path: string }
  | { type: "set_display_name"; name: string }
  | { type: "refresh_agents" };

export interface IntentMatchResult {
  intentId: string;
  handler: IntentHandlerId;
  confidence: number;
  slots: Record<string, string>;
  needsConfirm: boolean;
}

/** Speculative fan-out slots (hey-jev style). Unused slots are ignored. */
export type FanOutCategory = "command" | "question" | "chit_chat" | "unclear";

export type FanOutGated =
  | "proceed"
  | "clarify"
  | "give_up"
  | "escalate_llm"
  | "split";

export interface FanOutSlots {
  category: FanOutCategory;
  target?: string;
  action?: string;
  compound: boolean;
  confidence: number;
  firstAction?: string;
  secondAction?: string;
}

export interface FanOutDecision {
  slots: FanOutSlots;
  via: "rules" | "ams" | "rules+ams";
  gated: FanOutGated;
  clarifyText?: string;
  intentMatch?: IntentMatchResult;
  /** Wall ms for this classify call; 0 when unknown. */
  latencyMs?: number;
  /** Rough USD for AMS refine; 0 when local / unknown. */
  estimatedCostUsd?: number;
}

/** Per-turn routing transparency for chat meta + Audits. */
export interface DecisionTrace {
  category?: FanOutCategory | string;
  target?: string;
  action?: string;
  compound?: boolean;
  confidence: number;
  via?: "rules" | "ams" | "rules+ams";
  gated?: FanOutGated | string;
  firstAction?: string;
  secondAction?: string;
}

export type IntentResolveOutcome =
  | {
      kind: "answered";
      text: string;
      intentId: string;
      confidence: number;
      clientActions?: ClientAction[];
      source?: "browser";
      decisionTrace?: DecisionTrace;
      /** Fan-out classifier stage timing when fan-out ran. */
      classifierStage?: {
        stage: "classifier";
        latencyMs: number;
        estimatedCostUsd: number;
        via?: string;
      };
    }
  | {
      kind: "pending_confirm";
      text: string;
      intentId: string;
      decisionTrace?: DecisionTrace;
      classifierStage?: {
        stage: "classifier";
        latencyMs: number;
        estimatedCostUsd: number;
        via?: string;
      };
    }
  | {
      kind: "escalate";
      reason: "unknown" | "ambiguous" | "overlong";
      decisionTrace?: DecisionTrace;
      classifierStage?: {
        stage: "classifier";
        latencyMs: number;
        estimatedCostUsd: number;
        via?: string;
      };
    };

export interface IntentThreadContext {
  threadKey: string;
  primaryModelId: string;
  secondaryModelId: string | null;
  /** Original user text (case preserved) for rename / slot polish. */
  rawText?: string;
  /** True when ops intent is running after chat confirm.yes. */
  afterOpsConfirm?: boolean;
}
