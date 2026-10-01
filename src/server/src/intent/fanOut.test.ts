/**
 * Fan-out classifier smoke tests (hey-jev-inspired routing, no Mac wake word).
 */
import assert from "node:assert/strict";
import { applyFanOutGate, FANOUT_GATE, classifyFanOut } from "./fanOut.js";
import type { FanOutDecision } from "./types.js";

function base(partial: Partial<FanOutDecision["slots"]> & { category: FanOutDecision["slots"]["category"] }): FanOutDecision {
  return {
    slots: {
      compound: false,
      confidence: 0.9,
      ...partial,
    },
    via: "rules",
    gated: "proceed",
  };
}

{
  const d = applyFanOutGate(
    base({ category: "command", confidence: 0.5, target: "nav" }),
    0
  );
  assert.equal(d.gated, "clarify");
  assert.ok(d.clarifyText);
}

{
  const d = applyFanOutGate(
    base({ category: "command", confidence: 0.5 }),
    1
  );
  assert.equal(d.gated, "give_up");
}

{
  const d = applyFanOutGate(
    base({
      category: "command",
      confidence: 0.9,
      action: "nav.inbox",
    }),
    0
  );
  // No intentMatch → still clarify for command without solid match
  assert.equal(d.gated, "clarify");
}

{
  const d = applyFanOutGate(
    {
      ...base({ category: "command", confidence: 0.9, action: "nav.inbox" }),
      intentMatch: {
        intentId: "nav.inbox",
        handler: "nav",
        confidence: 0.9,
        slots: {},
        needsConfirm: false,
      },
    },
    0
  );
  assert.equal(d.gated, "proceed");
}

{
  const d = applyFanOutGate(base({ category: "question", confidence: 0.8 }), 0);
  assert.equal(d.gated, "escalate_llm");
}

{
  const d = applyFanOutGate(
    base({
      category: "command",
      confidence: 0.9,
      compound: true,
      firstAction: "nav.inbox",
      secondAction: "agents.list",
    }),
    0
  );
  assert.equal(d.gated, "split");
}

assert.ok(FANOUT_GATE >= 0.6 && FANOUT_GATE <= 0.7);

{
  const d = await classifyFanOut("open inbox", { skipAms: true, missCount: 0 });
  assert.equal(d.slots.category, "command");
  assert.ok(d.slots.confidence >= FANOUT_GATE);
  assert.equal(d.gated, "proceed");
  assert.equal(d.intentMatch?.intentId, "nav.inbox");
}

{
  const d = await classifyFanOut("asdfzxcv nonsense", { skipAms: true, missCount: 0 });
  assert.ok(d.gated === "clarify" || d.gated === "give_up" || d.slots.confidence < FANOUT_GATE || d.slots.category === "unclear" || d.gated === "escalate_llm");
  // Fail-closed: must not silently proceed without a match
  if (d.gated === "proceed") {
    assert.ok(d.intentMatch);
  }
}

{
  const d = await classifyFanOut("who invented the telephone", { skipAms: true, missCount: 0 });
  assert.equal(d.gated, "escalate_llm");
}

console.log("fan-out tests ok");
