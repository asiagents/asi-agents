import assert from "node:assert/strict";
import { stripModelReasoning } from "./strip-reasoning.js";

const open = "<" + "think" + ">";
const close = "</" + "think" + ">";
const openThinking = "<" + "thinking" + ">";
const closeThinking = "</" + "thinking" + ">";

const cases: { name: string; input: string; expectIncludes?: string; expectExcludes?: string[] }[] = [
  {
    name: "qwen think block",
    input: `${open}\n分步骤思考用户问题\n${close}\nIndia gained independence in 1947.`,
    expectIncludes: "India gained independence in 1947.",
    expectExcludes: ["分步骤思考", open, close],
  },
  {
    name: "orphan closer with Chinese plan",
    input: `分步骤思考：\n1. 分析问题\n2. 给出答案\n${close}\nNehru was a key independence leader.`,
    expectIncludes: "Nehru was a key independence leader.",
    expectExcludes: ["分步骤思考", close, "分析问题"],
  },
  {
    name: "clean english unchanged",
    input: "Hello — here is a short answer.",
    expectIncludes: "Hello — here is a short answer.",
  },
  {
    name: "thinking tag variant",
    input: `${openThinking}secret plan${closeThinking}\nVisible reply.`,
    expectIncludes: "Visible reply.",
    expectExcludes: ["secret plan", openThinking],
  },
  {
    name: "chinese cot then english without tags",
    input:
      "分步骤思考：\n1. 先理解问题\n2. 再给出英文答案\nThe Partition of India happened in 1947.",
    expectIncludes: "The Partition of India happened in 1947.",
    expectExcludes: ["分步骤思考", "先理解问题"],
  },
];

for (const c of cases) {
  const out = stripModelReasoning(c.input);
  if (c.expectIncludes) {
    assert.ok(out.includes(c.expectIncludes), `${c.name}: expected includes ${c.expectIncludes}, got: ${out}`);
  }
  for (const bad of c.expectExcludes ?? []) {
    assert.ok(!out.includes(bad), `${c.name}: should not include ${bad}, got: ${out}`);
  }
  console.log(`ok strip-reasoning — ${c.name}`);
}

console.log("strip-reasoning tests passed");
