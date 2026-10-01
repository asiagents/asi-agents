import type { ThreadAppendEntry } from "@asi-api";
import type { InAppHandledTurn } from "./inAppIntents";

export function inAppTurnEntries(
  turn: InAppHandledTurn,
  assistantRole: "chief" | "agent"
): ThreadAppendEntry[] {
  return [
    { role: "user", text: turn.userText, intentId: turn.intentId, source: "in-app" },
    { role: assistantRole, text: turn.replyText, intentId: turn.intentId, source: "in-app" },
  ];
}
