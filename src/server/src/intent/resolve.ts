import {
  bumpClarifyMiss,
  clearIntentPending,
  getClarifyMissCount,
  getIntentPending,
  loadState,
  pushRoutingDecision,
  resetClarifyMiss,
  saveState,
  setIntentPending,
} from "../store.js";
import {
  gateOpsCapability,
  isOpsCapability,
  opsPermissionGranted,
} from "../opsPermissions.js";
import {
  classifyFanOut,
  fanOutToDecisionTrace,
  isFanOutEnabled,
} from "./fanOut.js";
import { runIntentHandler } from "./handlers.js";
import { matchIntent, rankIntentMatches } from "./match.js";
import { normalizeIntentText } from "./normalize.js";
import { trySimpleArithmeticReply } from "./simpleArithmetic.js";
import type {
  DecisionTrace,
  FanOutDecision,
  IntentMatchResult,
  IntentResolveOutcome,
  IntentThreadContext,
} from "./types.js";

export function isIntentLayerEnabled(): boolean {
  return process.env.ASI_INTENT_LAYER !== "0";
}

const HELP_FOLLOWUP =
  /^(like what|what things|for example|such as|what exactly|which things|what\??|examples?\??)$/i;

const ANY_NAME_OK =
  /^(any\s+names?\s*(are\s+)?(fine|ok|okay)?|add\s+any\s+names?|pick\s+(any|a)\s+name|whatever\s+names?|you\s+(pick|choose)(\s+the)?\s+names?)$/i;

function threadMessages(threadKey: string) {
  const state = loadState();
  if (threadKey === "chief") return state.chiefThread ?? [];
  if (threadKey.startsWith("agent:")) {
    return state.agentThreads?.[threadKey.slice("agent:".length)] ?? [];
  }
  if (threadKey.startsWith("pro:")) {
    return state.proThreads?.[threadKey.slice("pro:".length)] ?? [];
  }
  return [];
}

function lastInAppIntentId(threadKey: string): string | null {
  const msgs = threadMessages(threadKey);
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === "user") continue;
    if (m.meta?.source === "in-app" && m.meta.intentId) return m.meta.intentId;
    break;
  }
  return null;
}

function lastUserText(threadKey: string): string | null {
  const msgs = threadMessages(threadKey);
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user" && msgs[i].text?.trim()) return msgs[i].text.trim();
  }
  return null;
}

/** Pull count/role from a prior "create … agent" user turn when follow-up is "any name". */
export function parseCreateHints(text: string): { count?: string; role?: string; name?: string } {
  const norm = normalizeIntentText(text);
  if (!norm) return {};
  const batch = /(?:need|want|create|add|make)\s+(\d+)\s+(?:([a-z][\w-]*)\s+)?agents?/.exec(norm);
  if (batch) {
    return {
      count: batch[1],
      role: batch[2]?.trim() || undefined,
      name: batch[1],
    };
  }
  const role = /(?:create|add|make|need|want)\s+([a-z][\w-]*)\s+agent/.exec(norm);
  if (role?.[1] && !/^\d+$/.test(role[1])) {
    return { role: role[1], name: role[1], count: "1" };
  }
  if (/(?:create|add|make|new)\s+agent/.test(norm) || /\b(?:need|want)\s+agents?\b/.test(norm)) {
    return { count: "1" };
  }
  return {};
}

function isCreateIntentId(id: string): boolean {
  return id === "agents.create" || id.startsWith("agents.create.");
}

function mergeCreateFollowupSlots(
  matched: IntentMatchResult,
  threadKey: string
): IntentMatchResult {
  if (!isCreateIntentId(matched.intentId)) return matched;
  const hasRole =
    matched.slots.role &&
    !["agent", "agents", "any", "name", "names"].includes(matched.slots.role.toLowerCase()) &&
    !/^\d+$/.test(matched.slots.role);
  const hasCount = Boolean(matched.slots.count && /^\d+$/.test(matched.slots.count));
  if (hasRole || (hasCount && matched.intentId === "agents.create.batch")) return matched;

  const prior = lastUserText(threadKey);
  if (!prior) return matched;
  const hints = parseCreateHints(prior);
  if (!hints.count && !hints.role) return matched;
  return {
    ...matched,
    slots: {
      ...matched.slots,
      ...(hints.count ? { count: hints.count } : {}),
      ...(hints.role ? { role: hints.role, name: hints.role } : {}),
    },
  };
}

function persistFanOut(threadKey: string, text: string, decision: FanOutDecision): DecisionTrace {
  const trace = fanOutToDecisionTrace(decision)!;
  pushRoutingDecision({
    threadKey,
    textPreview: text,
    category: decision.slots.category,
    target: decision.slots.target,
    action: decision.slots.action,
    compound: decision.slots.compound,
    confidence: decision.slots.confidence,
    via: decision.via,
    gated: decision.gated,
  });
  return trace;
}

function rankedToMatch(intentId: string, rawForSlots: string): IntentMatchResult | null {
  const hit = rankIntentMatches(rawForSlots).find((r) => r.intentId === intentId);
  if (!hit) return null;
  return {
    intentId: hit.intentId,
    handler: hit.handler,
    confidence: hit.score,
    slots: hit.slots,
    needsConfirm: hit.needsConfirm,
  };
}

async function runMatched(
  matched: IntentMatchResult,
  ctxWithRaw: IntentThreadContext,
  trace?: DecisionTrace
): Promise<IntentResolveOutcome> {
  matched = mergeCreateFollowupSlots(matched, ctxWithRaw.threadKey);

  if (isOpsCapability(matched.intentId)) {
    const gate = gateOpsCapability(matched.intentId);
    if (gate.policy === "never") {
      return {
        kind: "answered",
        text: gate.message ?? "Blocked by standing permission (Never).",
        intentId: matched.intentId,
        confidence: 1,
        decisionTrace: trace,
      };
    }
    if (gate.needConfirm && !opsPermissionGranted(matched.intentId)) {
      setIntentPending(ctxWithRaw.threadKey, {
        intentId: matched.intentId,
        handler: matched.handler,
        slots: matched.slots,
      });
      return {
        kind: "pending_confirm",
        text: gate.message ?? "Reply yes to approve once, or use Settings → Permissions.",
        intentId: matched.intentId,
        decisionTrace: trace,
      };
    }
  }

  if (matched.needsConfirm) {
    setIntentPending(ctxWithRaw.threadKey, {
      intentId: matched.intentId,
      handler: matched.handler,
      slots: matched.slots,
    });
    return {
      kind: "pending_confirm",
      text: `Confirm ${matched.intentId.replace(/\./g, " ")}? Reply yes to proceed or no to cancel.`,
      intentId: matched.intentId,
      decisionTrace: trace,
    };
  }

  const { text, clientActions, source } = await runIntentHandler(
    matched.handler,
    matched.intentId,
    matched.slots,
    ctxWithRaw
  );
  return {
    kind: "answered",
    text,
    intentId: matched.intentId,
    confidence: matched.confidence,
    clientActions,
    source,
    decisionTrace: trace,
  };
}

async function resolveCompoundSplit(
  decision: FanOutDecision,
  rawText: string,
  ctxWithRaw: IntentThreadContext,
  trace: DecisionTrace
): Promise<IntentResolveOutcome | null> {
  const firstId = decision.slots.firstAction;
  const secondId = decision.slots.secondAction;
  if (!firstId || !secondId) return null;

  const parts = rawText.split(/\s+(?:and(?:\s+then)?|then|also|,?\s*then)\s+/i);
  const firstRaw = parts[0]?.trim() || rawText;
  const secondRaw = parts[1]?.trim() || rawText;

  const first = rankedToMatch(firstId, firstRaw) ?? decision.intentMatch;
  const second = rankedToMatch(secondId, secondRaw);
  if (!first || !second) return null;
  if (first.needsConfirm || second.needsConfirm) {
    // Fail-closed: don't auto-run confirmable compound actions
    return {
      kind: "answered",
      text: "That looks like two actions, and at least one needs confirmation. Ask for each separately.",
      intentId: "routing.compound_blocked",
      confidence: decision.slots.confidence,
      decisionTrace: trace,
    };
  }

  const a = await runIntentHandler(first.handler, first.intentId, first.slots, {
    ...ctxWithRaw,
    rawText: firstRaw,
  });
  const b = await runIntentHandler(second.handler, second.intentId, second.slots, {
    ...ctxWithRaw,
    rawText: secondRaw,
  });
  const actions = [...(a.clientActions ?? []), ...(b.clientActions ?? [])];
  return {
    kind: "answered",
    text: `${a.text}\n${b.text}`.trim(),
    intentId: `${first.intentId}+${second.intentId}`,
    confidence: Math.min(first.confidence, second.confidence),
    clientActions: actions.length ? actions : undefined,
    source: a.source ?? b.source,
    decisionTrace: trace,
  };
}

export async function resolveIntent(
  rawText: string,
  ctx: IntentThreadContext
): Promise<IntentResolveOutcome> {
  const ctxWithRaw: IntentThreadContext = { ...ctx, rawText };
  const pending = getIntentPending(ctx.threadKey);
  const confirmMatch = matchIntent(rawText);
  if (pending && confirmMatch !== "escalate" && confirmMatch !== "overlong") {
    if (confirmMatch.intentId === "confirm.yes") {
      clearIntentPending(ctx.threadKey);
      resetClarifyMiss(ctx.threadKey);
      if (isOpsCapability(pending.intentId)) {
        const state = loadState();
        const item = state.permissions.find((p) => p.id === pending.intentId);
        if (item && item.status === "pending") {
          item.status = "approved";
          saveState(state);
        }
      }
      const { text, clientActions } = await runIntentHandler(
        pending.handler,
        pending.intentId,
        pending.slots,
        { ...ctxWithRaw, afterOpsConfirm: isOpsCapability(pending.intentId) }
      );
      return {
        kind: "answered",
        text,
        intentId: pending.intentId,
        confidence: 1,
        clientActions,
      };
    }
    if (confirmMatch.intentId === "confirm.no") {
      clearIntentPending(ctx.threadKey);
      resetClarifyMiss(ctx.threadKey);
      return {
        kind: "answered",
        text: "Cancelled.",
        intentId: "confirm.no",
        confidence: 1,
      };
    }
    // "any names are fine" while a create is pending → execute create with stored slots
    if (
      isCreateIntentId(pending.intentId) &&
      (confirmMatch.intentId === "agents.create.any_name" ||
        ANY_NAME_OK.test(normalizeIntentText(rawText)))
    ) {
      clearIntentPending(ctx.threadKey);
      resetClarifyMiss(ctx.threadKey);
      const { text, clientActions } = await runIntentHandler(
        pending.handler,
        pending.intentId,
        pending.slots,
        ctxWithRaw
      );
      return {
        kind: "answered",
        text,
        intentId: pending.intentId,
        confidence: 1,
        clientActions,
      };
    }
  }

  // Local arithmetic before fan-out / Ollama — just the number, high confidence.
  const arith = trySimpleArithmeticReply(rawText);
  if (arith != null) {
    resetClarifyMiss(ctx.threadKey);
    const decisionTrace: DecisionTrace = {
      category: "command",
      target: "math",
      action: "math.simple",
      compound: false,
      confidence: 1,
      via: "rules",
      gated: "proceed",
    };
    pushRoutingDecision({
      threadKey: ctx.threadKey,
      textPreview: rawText,
      category: "command",
      target: "math",
      action: "math.simple",
      compound: false,
      confidence: 1,
      via: "rules",
      gated: "proceed",
    });
    return {
      kind: "answered",
      text: arith,
      intentId: "math.simple",
      confidence: 1,
      decisionTrace,
    };
  }

  // --- Speculative fan-out (hey-jev) before / alongside classic match ---
  let decisionTrace: DecisionTrace | undefined;
  let classifierStage:
    | {
        stage: "classifier";
        latencyMs: number;
        estimatedCostUsd: number;
        via?: string;
      }
    | undefined;
  if (isFanOutEnabled()) {
    const missCount = getClarifyMissCount(ctx.threadKey);
    const decision = await classifyFanOut(rawText, { missCount });
    decisionTrace = persistFanOut(ctx.threadKey, rawText, decision);
    classifierStage = {
      stage: "classifier",
      latencyMs: decision.latencyMs ?? 0,
      estimatedCostUsd: decision.estimatedCostUsd ?? 0,
      via: decision.via,
    };

    if (decision.gated === "clarify" || decision.gated === "give_up") {
      bumpClarifyMiss(ctx.threadKey);
      if (decision.gated === "give_up") resetClarifyMiss(ctx.threadKey);
      return {
        kind: "answered",
        text: decision.clarifyText ?? "Sorry — say that again?",
        intentId: decision.gated === "give_up" ? "routing.give_up" : "routing.clarify",
        confidence: decision.slots.confidence,
        decisionTrace,
        classifierStage,
      };
    }

    if (decision.gated === "escalate_llm") {
      // Genuine question path — AMS / LLM may answer. Reset miss streak.
      resetClarifyMiss(ctx.threadKey);
      return { kind: "escalate", reason: "unknown", decisionTrace, classifierStage };
    }

    if (decision.gated === "split") {
      const compound = await resolveCompoundSplit(decision, rawText, ctxWithRaw, decisionTrace);
      if (compound) {
        resetClarifyMiss(ctx.threadKey);
        return { ...compound, classifierStage };
      }
      // Split failed → fall through to single-intent match
    }

    // proceed: prefer solid fan-out intentMatch when classic match would escalate
    if (decision.gated === "proceed" && decision.intentMatch) {
      const classic = matchIntent(rawText);
      if (classic === "escalate" || classic === "overlong") {
        resetClarifyMiss(ctx.threadKey);
        const matchedOut = await runMatched(decision.intentMatch, ctxWithRaw, decisionTrace);
        return { ...matchedOut, classifierStage };
      }
    }
  }

  let matched = matchIntent(rawText);
  if (matched === "overlong") {
    return { kind: "escalate", reason: "overlong", decisionTrace, classifierStage };
  }

  // After greeting ("Say help…"), short clarifiers stay on help.commands — not raw LLM.
  if (matched === "escalate") {
    const norm = normalizeIntentText(rawText);
    const prev = lastInAppIntentId(ctx.threadKey);
    if (
      (prev === "greeting.hello" || prev === "help.commands") &&
      HELP_FOLLOWUP.test(norm)
    ) {
      matched = {
        intentId: "help.commands",
        handler: "help.commands",
        confidence: 0.9,
        slots: {},
        needsConfirm: false,
      };
    } else if (ANY_NAME_OK.test(norm)) {
      // Follow-up after an LLM asked for names — still create from prior user turn.
      const hints = parseCreateHints(lastUserText(ctx.threadKey) ?? "");
      if (hints.count || hints.role || /agent/.test(normalizeIntentText(lastUserText(ctx.threadKey) ?? ""))) {
        matched = {
          intentId: "agents.create.any_name",
          handler: "agents.create",
          confidence: 0.9,
          slots: {
            ...(hints.count ? { count: hints.count } : {}),
            ...(hints.role ? { role: hints.role, name: hints.role } : {}),
          },
          needsConfirm: false,
        };
      } else if (isFanOutEnabled()) {
        // Fail-closed: command-like unknown without follow-up context → clarify, not LLM
        const missCount = getClarifyMissCount(ctx.threadKey);
        bumpClarifyMiss(ctx.threadKey);
        const giveUp = missCount + 1 >= 2;
        if (giveUp) resetClarifyMiss(ctx.threadKey);
        return {
          kind: "answered",
          text: giveUp
            ? "I'm not sure what you want after a couple of tries. Try something concrete like \"open inbox\" or \"create an agent\", or ask a full question."
            : "Sorry — say that again?",
          intentId: giveUp ? "routing.give_up" : "routing.clarify",
          confidence: 0.4,
          decisionTrace: decisionTrace ?? {
            category: "unclear",
            confidence: 0.4,
            gated: giveUp ? "give_up" : "clarify",
            via: "rules",
          },
          classifierStage,
        };
      } else {
        return { kind: "escalate", reason: "unknown", decisionTrace, classifierStage };
      }
    } else {
      // Last-chance create patterns the catalog margin might miss
      const hints = parseCreateHints(rawText);
      if (hints.count || hints.role) {
        matched = {
          intentId: hints.role ? "agents.create.role" : "agents.create.batch",
          handler: "agents.create",
          confidence: 0.85,
          slots: {
            ...(hints.count ? { count: hints.count, name: hints.count } : {}),
            ...(hints.role ? { role: hints.role, name: hints.role } : {}),
          },
          needsConfirm: false,
        };
      } else if (isFanOutEnabled() && decisionTrace?.category === "command") {
        // Low-confidence command that classic match missed — already should have clarified
        // in fan-out gate; if we get here, fail-closed clarify rather than LLM.
        bumpClarifyMiss(ctx.threadKey);
        return {
          kind: "answered",
          text: "Sorry — say that again?",
          intentId: "routing.clarify",
          confidence: decisionTrace.confidence,
          decisionTrace: { ...decisionTrace, gated: "clarify" },
          classifierStage,
        };
      } else {
        return { kind: "escalate", reason: "unknown", decisionTrace, classifierStage };
      }
    }
  }

  resetClarifyMiss(ctx.threadKey);
  const matchedOut = await runMatched(matched, ctxWithRaw, decisionTrace);
  return { ...matchedOut, classifierStage };
}
