import assert from "node:assert/strict";
import { runIntentHandler } from "./handlers.js";
import { welcomeMessageAt, welcomeStyleCount } from "./welcomeMessages.js";

const ctx = (threadKey: string) => ({
  threadKey,
  primaryModelId: "micro",
  secondaryModelId: null as string | null,
});

const identityRollCall = /^(Hello|Hi)\s*[—-]\s*I'm\s+/i;
const hiIAm = /^Hi\s+I\s+am\s+/i;

const chiefHi = await runIntentHandler("static.greeting", "greeting.hello", {}, ctx("chief"));
assert.doesNotMatch(chiefHi.text, identityRollCall);
assert.doesNotMatch(chiefHi.text, hiIAm);
assert.doesNotMatch(chiefHi.text, /I'm Chief/i);

const agentHi = await runIntentHandler(
  "static.greeting",
  "greeting.hello",
  {},
  ctx("agent:asasas")
);
assert.doesNotMatch(agentHi.text, /I'm Chief/i);
assert.doesNotMatch(agentHi.text, identityRollCall);
assert.doesNotMatch(agentHi.text, /I'm asasas/i);

// Agent-agnostic: same handler path for an arbitrary custom id (speaker falls back to id/role).
const otherHi = await runIntentHandler(
  "static.greeting",
  "greeting.hello",
  {},
  ctx("agent:finance")
);
assert.doesNotMatch(otherHi.text, identityRollCall);
assert.doesNotMatch(otherHi.text, /I'm finance/i);

const who = await runIntentHandler("static.chief", "chief.identity", {}, ctx("agent:asasas"));
assert.doesNotMatch(who.text, /^I'm Chief,/);
assert.match(who.text, /Chief is a different chat/);

// Curated set exists and none of the styles use identity roll-call.
assert.ok(welcomeStyleCount() >= 10);
for (let i = 0; i < welcomeStyleCount(); i++) {
  const chief = welcomeMessageAt({ isChief: true, specialty: "on-device assistant" }, i);
  const specialist = welcomeMessageAt({ isChief: false, specialty: "Finance" }, i);
  const custom = welcomeMessageAt({ isChief: false, specialty: "Chat specialist" }, i);
  for (const text of [chief, specialist, custom]) {
    assert.doesNotMatch(text, identityRollCall);
    assert.doesNotMatch(text, hiIAm);
    assert.doesNotMatch(text, new RegExp("\\bI'm\\s+[A-Z]"));
  }
}

console.log("greeting identity tests ok");
console.log("  chief:", chiefHi.text);
console.log("  agent:", agentHi.text);
console.log("  other:", otherHi.text);
console.log("  who:  ", who.text);
console.log("  styles:", welcomeStyleCount());
for (let i = 0; i < welcomeStyleCount(); i++) {
  console.log(`  [${i}]`, welcomeMessageAt({ isChief: false, specialty: "Design" }, i));
}
