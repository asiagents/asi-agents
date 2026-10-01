import assert from "node:assert/strict";
import { trySimpleArithmeticReply } from "./simpleArithmetic.js";

const cases: { text: string; expect: string | null }[] = [
  { text: "seventeen times 19", expect: "323" },
  { text: "what's seventeen times 19", expect: "323" },
  { text: "what is 17x19", expect: "323" },
  { text: "17 * 19", expect: "323" },
  { text: "aofr seventeen time 19 how bad is response cant it be just a number?", expect: "323" },
  {
    text: "What is seventeen times nineteen plus twenty-three? Show steps and end with FINAL= the integer.",
    expect: "346",
  },
  { text: "2 + 2", expect: "4" },
  { text: "what time is it", expect: null },
  { text: "open inbox", expect: null },
  { text: "Why is the claim that two plus two equals five for large values of two false?", expect: null },
];

for (const { text, expect } of cases) {
  const got = trySimpleArithmeticReply(text);
  assert.equal(got, expect, `arith "${text}"`);
}

console.log("simpleArithmetic.test.ts ok");
