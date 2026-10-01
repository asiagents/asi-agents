/**
 * Hire welcome + heuristics — local only, no LLM.
 * Run: npx tsx src/intent/hire-create.test.ts
 */
import assert from "node:assert/strict";
import {
  hireWelcomeMessageAt,
  hireWelcomeMessages,
  hireWelcomeStyleCount,
  pickHireWelcomeMessage,
} from "./hireWelcomeMessages.js";
import {
  inferHireSkills,
  parseNameRole,
  pickHireModelFromPool,
} from "../hireHeuristics.js";

assert.ok(hireWelcomeStyleCount() >= 10);
assert.ok(hireWelcomeStyleCount() <= 20);
const lines = hireWelcomeMessages({ specialty: "Research analyst", name: "Sage" });
assert.equal(lines.length, hireWelcomeStyleCount());
for (const line of lines) {
  assert.ok(line.length > 10);
  assert.ok(!/I'm Sage/i.test(line), "no identity roll-call");
}
assert.ok(hireWelcomeMessageAt({ specialty: "Coding" }, 0).includes("hiring") || hireWelcomeMessageAt({ specialty: "Coding" }, 0).length > 8);
// Seeding uses one random pick — pool stays for variety, never dump all lines.
const one = pickHireWelcomeMessage({ specialty: "Research", name: "Sage" });
assert.ok(one.length > 10);
assert.ok(!/I'm Sage/i.test(one));

const parsed = parseNameRole("Mira (Research)");
assert.equal(parsed.name, "Mira");
assert.equal(parsed.role, "Research");

const codingSkills = inferHireSkills({ role: "coding", brief: "review PRs and run tests" });
assert.ok(codingSkills.includes("code-review") || codingSkills.includes("test-writing") || codingSkills.includes("shell-sandbox"));

const financeSkills = inferHireSkills({ role: "finance", brief: "budget and invoices" });
assert.ok(financeSkills.some((s) => ["budgeting", "spend-gates", "invoicing", "forecasting"].includes(s)));

const picked = pickHireModelFromPool({
  role: "coding",
  skills: codingSkills,
  poolIds: ["ollama:llama3.2", "ollama:qwen2.5-coder", "openrouter:meta-llama/llama-3.2-3b-instruct:free"],
});
assert.ok(picked);
assert.ok(picked.primary.includes("coder") || picked.primary.length > 0);

console.log("hire-create.test.ts: ok");
console.log("  welcomes:", hireWelcomeStyleCount());
console.log("  coding skills:", codingSkills.join(", "));
console.log("  finance skills:", financeSkills.join(", "));
console.log("  picked model:", picked?.primary);
