/**
 * Hey Jev–inspired speculative fan-out classifier (routing only — not Mac wake word).
 * One cheap slot fill: category, target, action, compound?, confidence. Unused slots ignored.
 */
import { probeRouterHealth, tryRouterGenerate, resolveRouterBackendModel } from "../llm-routing.js";
import { rankIntentMatches } from "./match.js";
import { normalizeIntentText } from "./normalize.js";
import type { FanOutCategory, FanOutDecision, FanOutSlots, IntentMatchResult } from "./types.js";

/** Below this confidence, command-like turns clarify instead of escalating to the big LLM. */
export const FANOUT_GATE = 0.65;

const CLARIFY_LINES = [
  "Sorry — say that again?",
  "I didn't catch that. One more time?",
  "Could you rephrase that as a clearer command or question?",
];

const GIVE_UP_LINE =
  "I'm not sure what you want after a couple of tries. Try something concrete like \"open inbox\" or \"create an agent\", or ask a full question.";

const QUESTION_RE =
  /^(who|what|why|how|when|where|which|whose|whom|is|are|was|were|do|does|did|can|could|would|should|will|may|might)\b|[?？]$/i;

const KNOWN_COMMAND_QUESTION =
  /^(what\s+time|whats?\s+the\s+time|what\s+date|whats?\s+today|which\s+model|what\s+model|what\s+timezone|whats?\s+my\s+timezone|who\s+are\s+you|what\s+can\s+you\s+do|connection\s+status|backend\s+status|whos?\s+here|who\s+is\s+here|who\s+is\s+present|roll\s+call|take\s+attendance|agents\s+attendance)/i;

const CHIT_CHAT_RE =
  /^(hi|hello|hey|howdy|yo|sup|thanks|thank\s+you|thx|bye|goodbye|see\s+ya|later|good\s+morning|good\s+night)(\s|$)/i;

const COMPOUND_SPLIT_RE =
  /\s+(?:and(?:\s+then)?|then|also|,?\s*then)\s+/i;

const COMMAND_VERB_RE =
  /\b(open|go\s+to|take\s+me|navigate|create|add|make|hire|delete|remove|list|show|start|end|stop|panic|rename|call\s+me|call\s+you|set|change|pick|upload|trigger|cancel|confirm|attendance|roll\s+call|repeat|echo|parrot|count)\b/i;

export function isFanOutEnabled(): boolean {
  return process.env.ASI_FANOUT !== "0";
}

function pickClarifyLine(slots: FanOutSlots): string {
  if (slots.target && slots.action) {
    return `Did you mean something about ${slots.target} (${slots.action})? Say that again more clearly.`;
  }
  if (slots.category === "command" && slots.target) {
    return `Were you trying to do something with ${slots.target}? Say it one more time.`;
  }
  return CLARIFY_LINES[Math.floor(Math.random() * CLARIFY_LINES.length)]!;
}

function categoryFromRules(
  raw: string,
  top: { score: number; intentId: string } | null
): { category: FanOutCategory; confidence: number } {
  const trimmed = raw.trim();
  const norm = normalizeIntentText(trimmed);
  if (!norm) return { category: "unclear", confidence: 0.9 };

  if (top && top.score >= FANOUT_GATE) {
    if (
      top.intentId.startsWith("greeting.") ||
      top.intentId === "help.commands" ||
      top.intentId === "chief.identity" ||
      top.intentId.startsWith("playful.")
    ) {
      return { category: "chit_chat", confidence: top.score };
    }
    return { category: "command", confidence: top.score };
  }

  if (CHIT_CHAT_RE.test(norm) || CHIT_CHAT_RE.test(trimmed.toLowerCase())) {
    return { category: "chit_chat", confidence: 0.8 };
  }

  if (KNOWN_COMMAND_QUESTION.test(norm) || KNOWN_COMMAND_QUESTION.test(trimmed.toLowerCase())) {
    return { category: "command", confidence: Math.max(top?.score ?? 0.55, 0.7) };
  }

  const looksQuestion =
    QUESTION_RE.test(trimmed) ||
    QUESTION_RE.test(norm) ||
    /\b(explain|tell\s+me\s+about|describe|compare)\b/i.test(trimmed);
  const looksCommand = COMMAND_VERB_RE.test(trimmed) || COMMAND_VERB_RE.test(norm);

  if (looksCommand && !looksQuestion) {
    return { category: "command", confidence: Math.max(top?.score ?? 0.45, 0.5) };
  }
  if (looksQuestion && !looksCommand) {
    return { category: "question", confidence: 0.78 };
  }
  if (looksQuestion && looksCommand) {
    // Ambiguous — lean command if we have any intent score, else question.
    if (top && top.score >= 0.35) {
      return { category: "command", confidence: top.score };
    }
    return { category: "question", confidence: 0.55 };
  }
  if (top && top.score >= 0.35) {
    return { category: "command", confidence: top.score };
  }
  return { category: "unclear", confidence: 0.7 };
}

function targetFromIntent(intentId: string | undefined): string | undefined {
  if (!intentId) return undefined;
  const root = intentId.split(".")[0];
  if (!root) return undefined;
  if (root === "nav") return "nav";
  if (root === "agents" || root === "agent") return "agents";
  if (root === "meeting") return "meeting";
  if (root === "panic" || root === "backend" || root === "app") return "system";
  if (root === "prefs" || root === "model" || root === "tz" || root === "time" || root === "date")
    return "prefs";
  if (root === "help" || root === "greeting" || root === "chief" || root === "playful")
    return "help";
  if (root === "board" || root === "research" || root === "game" || root === "math") return root;
  return root;
}

function detectCompound(raw: string): boolean {
  const parts = raw.split(COMPOUND_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  // Both sides should look actionable (not "and I think…")
  return parts.slice(0, 2).every((p) => COMMAND_VERB_RE.test(p) || rankIntentMatches(p)[0]?.score >= 0.35);
}

function splitCompoundParts(raw: string): [string, string] | null {
  const parts = raw.split(COMPOUND_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return [parts[0]!, parts[1]!];
}

function rulesClassify(raw: string): FanOutDecision {
  const ranked = rankIntentMatches(raw);
  const top = ranked[0] ?? null;
  const { category, confidence: catConf } = categoryFromRules(raw, top);
  const compound = detectCompound(raw);
  const intentMatch: IntentMatchResult | undefined =
    top && top.score >= 0.35
      ? {
          intentId: top.intentId,
          handler: top.handler,
          confidence: top.score,
          slots: top.slots,
          needsConfirm: top.needsConfirm,
        }
      : undefined;

  const slots: FanOutSlots = {
    category,
    target: targetFromIntent(intentMatch?.intentId),
    action: intentMatch?.intentId,
    compound,
    confidence: Math.min(1, Math.max(catConf, intentMatch?.confidence ?? 0)),
  };

  if (compound) {
    const parts = splitCompoundParts(raw);
    if (parts) {
      const [a, b] = parts;
      const first = rankIntentMatches(a)[0];
      const second = rankIntentMatches(b)[0];
      if (first && first.score >= FANOUT_GATE) slots.firstAction = first.intentId;
      if (second && second.score >= FANOUT_GATE) slots.secondAction = second.intentId;
      slots.confidence = Math.min(
        slots.confidence,
        first?.score ?? slots.confidence,
        second?.score ?? slots.confidence
      );
    }
  }

  return {
    slots,
    via: "rules",
    gated: "proceed",
    intentMatch,
  };
}

function parseAmsJson(text: string): Partial<FanOutSlots> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const cat = String(obj.category ?? "").toLowerCase();
    const category: FanOutCategory | undefined =
      cat === "command" || cat === "question" || cat === "chit_chat" || cat === "unclear"
        ? cat
        : undefined;
    const confidence =
      typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
        ? Math.max(0, Math.min(1, obj.confidence))
        : undefined;
    return {
      ...(category ? { category } : {}),
      ...(typeof obj.target === "string" && obj.target.trim()
        ? { target: obj.target.trim().slice(0, 64) }
        : {}),
      ...(typeof obj.action === "string" && obj.action.trim()
        ? { action: obj.action.trim().slice(0, 96) }
        : {}),
      ...(typeof obj.compound === "boolean" ? { compound: obj.compound } : {}),
      ...(confidence != null ? { confidence } : {}),
    };
  } catch {
    return null;
  }
}

async function maybeAmsRefine(raw: string, base: FanOutDecision): Promise<FanOutDecision> {
  // Only spend AMS when rules are soft / mid — not on clear hits or clear questions.
  const conf = base.slots.confidence;
  if (conf >= FANOUT_GATE || conf < 0.35) return base;
  if (base.slots.category === "question" && conf >= 0.55) return base;

  const health = await probeRouterHealth();
  if (!health.live) return base;

  const system =
    "You are a tiny router. Reply with ONLY JSON, no markdown: " +
    '{"category":"command|question|chit_chat|unclear","target":"nav|agents|meeting|system|prefs|help|none",' +
    '"action":"short action or intent id","compound":false,"confidence":0.0}. ' +
    "Unused slots may be omitted. Do not answer the user.";
  try {
    const attempt = await tryRouterGenerate(
      `Classify this user turn for ASI Agents routing:\n${raw.slice(0, 400)}`,
      resolveRouterBackendModel("micro"),
      system
    );
    if (!attempt?.text) return base;
    const parsed = parseAmsJson(attempt.text);
    if (!parsed) return base;
    const slots: FanOutSlots = {
      ...base.slots,
      ...parsed,
      compound: parsed.compound ?? base.slots.compound,
      confidence: parsed.confidence ?? base.slots.confidence,
      category: parsed.category ?? base.slots.category,
    };
    return { ...base, slots, via: "rules+ams" };
  } catch {
    return base;
  }
}

/**
 * Apply confidence gate. Command-like low confidence → clarify (never big LLM).
 * Questions at/above gate → escalate. Unclear → clarify.
 */
export function applyFanOutGate(
  decision: FanOutDecision,
  missCount: number
): FanOutDecision {
  const { slots } = decision;
  const conf = slots.confidence;

  // Compound with two solid actions → split path
  if (
    slots.compound &&
    slots.firstAction &&
    slots.secondAction &&
    conf >= FANOUT_GATE
  ) {
    return { ...decision, gated: "split" };
  }

  if (slots.category === "question" && conf >= FANOUT_GATE) {
    // High-confidence question → AMS/LLM (not a local command)
    return { ...decision, gated: "escalate_llm" };
  }

  if (slots.category === "unclear" || conf < FANOUT_GATE) {
    // Low confidence or unclear: clarify / give up — do NOT escalate to big LLM
    if (missCount + 1 >= 2) {
      return {
        ...decision,
        gated: "give_up",
        clarifyText: GIVE_UP_LINE,
      };
    }
    return {
      ...decision,
      gated: "clarify",
      clarifyText: pickClarifyLine(slots),
    };
  }

  // Command / chit_chat with confidence ≥ gate
  if (slots.category === "command" || slots.category === "chit_chat") {
    if (decision.intentMatch && decision.intentMatch.confidence >= FANOUT_GATE) {
      return { ...decision, gated: "proceed" };
    }
    // Looks like a command but no solid intent — clarify, don't invent via LLM
    if (missCount + 1 >= 2) {
      return { ...decision, gated: "give_up", clarifyText: GIVE_UP_LINE };
    }
    return {
      ...decision,
      gated: "clarify",
      clarifyText: pickClarifyLine(slots),
    };
  }

  // Mid question or leftover → escalate only if clearly a question
  if (slots.category === "question") {
    return { ...decision, gated: "escalate_llm" };
  }

  return {
    ...decision,
    gated: "clarify",
    clarifyText: pickClarifyLine(slots),
  };
}

export async function classifyFanOut(
  rawText: string,
  opts?: { missCount?: number; skipAms?: boolean }
): Promise<FanOutDecision> {
  const started = performance.now();
  if (!isFanOutEnabled()) {
    return {
      slots: {
        category: "question",
        compound: false,
        confidence: 1,
      },
      via: "rules",
      gated: "escalate_llm",
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      estimatedCostUsd: 0,
    };
  }

  let decision = rulesClassify(rawText);
  if (!opts?.skipAms) {
    decision = await maybeAmsRefine(rawText, decision);
  }
  const gated = applyFanOutGate(decision, opts?.missCount ?? 0);
  return {
    ...gated,
    latencyMs: Math.max(0, Math.round(performance.now() - started)),
    estimatedCostUsd: 0,
  };
}

export function fanOutToDecisionTrace(decision: FanOutDecision): NonNullable<
  import("../types.js").ChatMessage["meta"]
>["decisionTrace"] {
  const { slots } = decision;
  return {
    category: slots.category,
    target: slots.target,
    action: slots.action,
    compound: slots.compound,
    confidence: slots.confidence,
    via: decision.via,
    gated: decision.gated,
    ...(slots.firstAction ? { firstAction: slots.firstAction } : {}),
    ...(slots.secondAction ? { secondAction: slots.secondAction } : {}),
  };
}
