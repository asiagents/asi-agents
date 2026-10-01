import {
  chiefGenerateFailureDetail,
  probeRouterHealth,
  routeGenerateAfterIntentEscalation,
  type GenerateResult,
  type RouteGenerateInput,
} from "../llm-routing.js";
import { INTENT_UNKNOWN_FAIL_CLOSED } from "./maybeIntentReply.js";

export async function generateAfterIntentEscalation(
  input: RouteGenerateInput,
  modelIdForErrors: string
): Promise<{ result: GenerateResult; failClosedText?: string }> {
  const result = await routeGenerateAfterIntentEscalation(input);
  if (result.via !== "offline" && result.text) {
    return { result };
  }

  if (
    result.reason === "intent_escalate_router_down" ||
    result.reason === "intent_escalate_router_miss"
  ) {
    const health = await probeRouterHealth();
    if (!health.live) {
      return { result, failClosedText: INTENT_UNKNOWN_FAIL_CLOSED };
    }
  }

  if (result.via === "offline") {
    const { message } = chiefGenerateFailureDetail(modelIdForErrors, result.reason);
    return { result, failClosedText: message };
  }

  return { result };
}
