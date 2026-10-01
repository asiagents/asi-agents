export { maybeIntentReply, INTENT_UNKNOWN_FAIL_CLOSED } from "./maybeIntentReply.js";
export { resolveIntent, isIntentLayerEnabled } from "./resolve.js";
export { matchIntent, rankIntentMatches } from "./match.js";
export { loadIntentCatalog } from "./loadCatalog.js";
export {
  classifyFanOut,
  applyFanOutGate,
  FANOUT_GATE,
  isFanOutEnabled,
  fanOutToDecisionTrace,
} from "./fanOut.js";
export type { ClientAction, IntentThreadContext, DecisionTrace, FanOutDecision } from "./types.js";
