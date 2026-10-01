import { tryInAppIntent } from "./inAppIntents";
import { inAppTurnEntries } from "./inAppTurnEntries";

type AppendFn = (entries: ReturnType<typeof inAppTurnEntries>) => Promise<unknown>;

/** When matched, persist handled turn on the active thread and return true. */
export async function sendInAppIfHandled(
  text: string,
  assistantRole: "chief" | "agent",
  append: AppendFn
): Promise<boolean> {
  const turn = tryInAppIntent(text);
  if (!turn) return false;
  await append(inAppTurnEntries(turn, assistantRole));
  return true;
}
