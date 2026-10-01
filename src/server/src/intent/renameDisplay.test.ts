/**
 * Rename name extraction + Chief display label smoke tests.
 */
import assert from "node:assert/strict";
import { formatAgentDisplayName, normalizeStaffRoleLabel } from "../agentDisplay.js";
import { classifyFanOut } from "./fanOut.js";
import { matchIntent } from "./match.js";
import { runIntentHandler } from "./handlers.js";

// --- display helper ---
assert.equal(
  formatAgentDisplayName({ name: "Chief", roleTag: "chief", isChief: true, id: "chief" }),
  "Chief (chief)"
);
assert.equal(
  formatAgentDisplayName({ name: "Secratary", roleTag: "chief", isChief: true, id: "chief" }),
  "Secratary (chief)"
);
assert.equal(
  formatAgentDisplayName({ name: "Secratary", roleTag: "secretary", isChief: true, id: "chief" }),
  "Secratary (secretary)"
);
assert.equal(normalizeStaffRoleLabel("Staff"), "chief");
assert.equal(normalizeStaffRoleLabel("buddy"), "buddy");

// --- rename parse stops at compound ---
{
  const out = await runIntentHandler(
    "agent.rename",
    "agent.rename",
    { name: "secratary and add a new image" },
    {
      threadKey: "chief",
      primaryModelId: "micro",
      secondaryModelId: "",
      rawText: "hey rename yourself to Secratary and add a new image",
    }
  );
  assert.match(out.text, /^Renamed to Secratary \(chief\)\.?$/);
  assert.ok(out.clientActions?.some((a) => a.type === "refresh_agents"));
}

// --- avatar intent matches ---
{
  const m = matchIntent("add a new image");
  assert.notEqual(m, "escalate");
  assert.notEqual(m, "overlong");
  if (m !== "escalate" && m !== "overlong") {
    assert.equal(m.intentId, "agent.set_avatar");
  }
}

// --- fan-out compound rename + avatar ---
{
  const d = await classifyFanOut("hey rename yourself to Secratary and add a new image", {
    skipAms: true,
    missCount: 0,
  });
  assert.equal(d.slots.compound, true);
  // Prefer split when both sides score; otherwise rename alone still extracts clean name.
  if (d.gated === "split") {
    assert.ok(
      d.slots.firstAction === "agent.rename" || d.slots.firstAction === "agent.rename_bare"
    );
    assert.equal(d.slots.secondAction, "agent.set_avatar");
  }
}

console.log("agent rename/display tests ok");
