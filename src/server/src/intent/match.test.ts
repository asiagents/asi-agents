import assert from "node:assert/strict";
import { matchIntent } from "./match.js";

const cases: { text: string; expectId: string }[] = [
  { text: "hi", expectId: "greeting.hello" },
  { text: "hello chief", expectId: "greeting.hello" },
  { text: "what time is it", expectId: "time.now" },
  { text: "what's the date today", expectId: "date.today" },
  { text: "what timezone am i in", expectId: "tz.local" },
  { text: "help", expectId: "help.commands" },
  { text: "like what", expectId: "help.commands" },
  { text: "call me Cutey Pie", expectId: "prefs.display_name" },
  { text: "rename yourself to Cutey Pie", expectId: "agent.rename" },
  { text: "rename to Cutey Pie", expectId: "agent.rename_bare" },
  { text: "can I call you Vijay", expectId: "agent.rename" },
  { text: "can i call you Vijay?", expectId: "agent.rename" },
  { text: "I'll call you Vijay", expectId: "agent.rename" },
  { text: "I will call you Vijay", expectId: "agent.rename" },
  { text: "your name is Vijay", expectId: "agent.rename" },
  { text: "add a new image", expectId: "agent.set_avatar" },
  { text: "change your avatar", expectId: "agent.set_avatar" },
  { text: "be my secretary", expectId: "agent.set_staff_role" },
  { text: "list my agents", expectId: "agents.list" },
  { text: "agents attendance", expectId: "agents.attendance" },
  { text: "take attendance", expectId: "agents.attendance" },
  { text: "who's here", expectId: "agents.attendance" },
  { text: "who is here", expectId: "agents.attendance" },
  { text: "roll call", expectId: "agents.attendance" },
  { text: "repeat after me hello team", expectId: "playful.echo" },
  { text: "echo this: hi", expectId: "playful.echo" },
  { text: "count from 1 to 10", expectId: "playful.count" },
  { text: "count to 20", expectId: "playful.count" },
  { text: "open inbox", expectId: "nav.inbox" },
  { text: "go to the office", expectId: "nav.office" },
  { text: "take me to group", expectId: "nav.group" },
  { text: "open agents page", expectId: "nav.agents" },
  { text: "start the meeting", expectId: "meeting.start" },
  { text: "end meeting please", expectId: "meeting.end" },
  { text: "is the meeting open", expectId: "meeting.status" },
  { text: "panic", expectId: "panic.trigger" },
  { text: "who are you", expectId: "chief.identity" },
  { text: "which model am i on", expectId: "model.current" },
  { text: "connection status", expectId: "backend.status" },
  { text: "open board", expectId: "nav.board" },
  { text: "who's on the board", expectId: "board.list" },
  { text: "yes confirm", expectId: "confirm.yes" },
  { text: "no cancel", expectId: "confirm.no" },
  { text: "create a travel agent", expectId: "agents.create.role" },
  { text: "create a finance agent., add any name", expectId: "agents.create.role" },
  { text: "i need 4 agents now", expectId: "agents.create.batch" },
  { text: "create 4 agents", expectId: "agents.create.batch" },
  { text: "any names are fine", expectId: "agents.create.any_name" },
  { text: "add any name", expectId: "agents.create.any_name" },
  { text: "create an agent", expectId: "agents.create" },
];

for (const { text, expectId } of cases) {
  const m = matchIntent(text);
  assert.notEqual(m, "escalate", `expected match for "${text}"`);
  assert.notEqual(m, "overlong", `expected match for "${text}"`);
  if (m === "escalate" || m === "overlong") throw new Error("unreachable");
  assert.equal(m.intentId, expectId, `phrase "${text}"`);
}

assert.equal(matchIntent("asdf qwer zxcv"), "escalate");
assert.equal(matchIntent("explain quantum gravity"), "escalate");

const travel = matchIntent("create a travel agent., add any name");
assert.notEqual(travel, "escalate");
assert.notEqual(travel, "overlong");
if (travel !== "escalate" && travel !== "overlong") {
  assert.equal(travel.slots.role, "travel");
}

const batch = matchIntent("i need 4 agents now");
assert.notEqual(batch, "escalate");
assert.notEqual(batch, "overlong");
if (batch !== "escalate" && batch !== "overlong") {
  assert.equal(batch.slots.count, "4");
}

console.log(`intent match tests ok (${cases.length + 4} cases)`);
