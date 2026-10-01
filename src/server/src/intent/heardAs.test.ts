import assert from "node:assert/strict";
import { applyHeardAs, DEFAULT_VOICE_DICTIONARY } from "../voiceDictionary.js";
import { normalizeIntentText } from "./normalize.js";

assert.equal(applyHeardAs("call cheese please", DEFAULT_VOICE_DICTIONARY), "call chief please");
assert.equal(applyHeardAs("open the in box", DEFAULT_VOICE_DICTIONARY), "open the inbox");
assert.equal(applyHeardAs("fin ants report", DEFAULT_VOICE_DICTIONARY), "finance report");

// Intent normalize applies heard_as then fillers — "cheese" → "chief".
const norm = normalizeIntentText("hey cheese what time is it");
assert.match(norm, /chief/);
assert.doesNotMatch(norm, /cheese/);

console.log("heard_as / normalize tests ok");
