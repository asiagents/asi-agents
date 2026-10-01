/**
 * User-facing fail-closed copy when local generate backends are down.
 * Rotating variants + actionable suggestions — never invents a model reply.
 */

export type LocalBackendFailReason =
  | "ollama_unreachable"
  | "ollama_no_models"
  | "ollama_model_missing"
  | "ollama_generate_failed"
  | "llamacpp_unset"
  | "llamacpp_unreachable"
  | "ams_recipe_not_runnable"
  | "ams_recipe_no_ollama"
  | "local_unavailable_no_provider_keys"
  | "local_and_cloud_failed"
  | "non_chat_model"
  | "cloud_needs_key"
  | "intent_escalate_router_down"
  | "intent_escalate_router_miss";

export type FailClosedCtx = {
  modelTried: string;
  agentName?: string;
  reason?: string;
  ollamaHost: string;
  llamaCppHost: string | null;
  routerBase: string;
  /** Consecutive local fail-closed generates; ≥ threshold adds reboot tip. */
  failureStreak: number;
};

/** After this many consecutive local fail-closed generates, suggest a PC restart as last resort. */
export const RESTART_PC_STREAK = 3;

let localFailStreak = 0;

export function getLocalFailStreak(): number {
  return localFailStreak;
}

export function noteLocalGenerateFailure(reason?: string): number {
  if (!isLocalBackendFailReason(reason)) return localFailStreak;
  localFailStreak += 1;
  return localFailStreak;
}

export function clearLocalGenerateFailureStreak(): void {
  localFailStreak = 0;
}

export function isLocalBackendFailReason(reason?: string): boolean {
  if (!reason) return true;
  return (
    reason.startsWith("ollama_") ||
    reason.startsWith("llamacpp_") ||
    reason.startsWith("ams_recipe_") ||
    reason === "local_unavailable_no_provider_keys" ||
    reason === "local_and_cloud_failed" ||
    reason === "intent_escalate_router_down" ||
    reason === "intent_escalate_router_miss"
  );
}

function rotateIndex(n: number, seed: number): number {
  if (n <= 0) return 0;
  const s = Math.abs(seed) || 1;
  return s % n;
}

function pickVariant(variants: string[], seed: number): string {
  return variants[rotateIndex(variants.length, seed)] ?? variants[0] ?? "";
}

function whatFailed(ctx: FailClosedCtx): string {
  const reason = ctx.reason ?? "";
  const model = ctx.modelTried || "(none)";
  switch (reason) {
    case "ollama_unreachable":
      return `Ollama at ${ctx.ollamaHost}`;
    case "ollama_no_models":
      return `Ollama at ${ctx.ollamaHost} (running, no chat tags pulled)`;
    case "ollama_model_missing":
      return `Ollama model "${model}" (not in ollama list)`;
    case "ollama_generate_failed":
      return `Ollama generate for "${model}" @ ${ctx.ollamaHost}`;
    case "llamacpp_unset":
      return "llama.cpp / OpenAI-compat host (LLAMA_CPP_HOST unset)";
    case "llamacpp_unreachable":
      return `llama.cpp @ ${ctx.llamaCppHost ?? "(configured)"}`;
    case "ams_recipe_no_ollama":
    case "ams_recipe_not_runnable":
      return `AMS / router slot "${model}" (not a live Ollama tag)`;
    case "intent_escalate_router_down":
      return `SLM router @ ${ctx.routerBase}`;
    case "cloud_needs_key":
      return `Cloud model "${model}" (no provider key)`;
    case "non_chat_model":
      return `Non-chat model "${model}"`;
    case "local_and_cloud_failed":
      return `Local backends then cloud keys (model "${model}")`;
    case "local_unavailable_no_provider_keys":
    default:
      return `Local generate path for "${model}"`;
  }
}

function explanationVariants(ctx: FailClosedCtx): string[] {
  const what = whatFailed(ctx);
  const reason = ctx.reason ?? "";
  const base = [
    `${what} did not answer. ASI did not invent a reply — generate stayed fail-closed.`,
    `${what} is unavailable right now. Nothing was faked as online.`,
    `Could not complete a local completion via ${what}. The chat path failed closed on purpose.`,
  ];
  if (reason === "ollama_unreachable") {
    return [
      `Ollama at ${ctx.ollamaHost} did not respond. Local chat is paused until the daemon is reachable.`,
      `No reply from Ollama (${ctx.ollamaHost}). ASI kept fail-closed rather than pretending a model answered.`,
      `The Ollama service behind ${ctx.ollamaHost} looks down. Start it (or fix OLLAMA_HOST) before retrying.`,
    ];
  }
  if (reason === "ollama_no_models") {
    return [
      `Ollama is reachable at ${ctx.ollamaHost}, but no chat models are pulled yet.`,
      `Ollama @ ${ctx.ollamaHost} is up with an empty tag list — pull a model before chatting.`,
      `Local Ollama answered tags, but nothing is installed to generate with.`,
    ];
  }
  if (reason === "llamacpp_unset") {
    return [
      `llama.cpp is not configured (set LLAMA_CPP_HOST or OPENAI_BASE_URL), and no other local backend answered.`,
      `No llama.cpp / LM Studio host is set. Generate failed closed instead of guessing.`,
      `LLAMA_CPP_HOST is unset — point it at your OpenAI-compat server, or use Ollama.`,
    ];
  }
  if (reason === "llamacpp_unreachable") {
    return [
      `llama.cpp at ${ctx.llamaCppHost} did not answer. Generate failed closed.`,
      `Could not reach the OpenAI-compat server at ${ctx.llamaCppHost}.`,
      `llama.cpp / LM Studio @ ${ctx.llamaCppHost} looks down — start it, then retry.`,
    ];
  }
  if (reason === "ams_recipe_no_ollama" || reason === "ams_recipe_not_runnable") {
    return [
      `"${ctx.modelTried}" is an AMS recipe / router slot, not a live Ollama tag — nothing runnable answered.`,
      `Assigned slot "${ctx.modelTried}" needs a real ollama:… tag or cloud model; fail-closed for now.`,
      `AMS micro / catalog id "${ctx.modelTried}" is not installed as generate weights.`,
    ];
  }
  return base;
}

/** Ordered, actionable recovery tips (restart PC only after repeated failures). */
export function failClosedSuggestions(ctx: FailClosedCtx): string[] {
  const reason = ctx.reason ?? "";
  const tips: string[] = [];

  if (reason === "ollama_unreachable" || reason === "ollama_generate_failed" || !reason) {
    tips.push("Start Ollama (`ollama serve` or the tray app) and confirm it answers on the host above");
    tips.push("If Ollama runs on another machine / Docker / WSL, set OLLAMA_HOST (e.g. http://host.docker.internal:11434)");
  }
  if (reason === "ollama_no_models" || reason === "ollama_model_missing") {
    tips.push("Pull a chat model (`ollama pull …`) then Scan models in Settings → Models");
  }
  if (reason === "llamacpp_unset") {
    tips.push("Set LLAMA_CPP_HOST (or OPENAI_BASE_URL) to your llama.cpp / LM Studio base URL");
    tips.push("Or start Ollama and assign an ollama:… model");
  }
  if (reason === "llamacpp_unreachable") {
    tips.push("Start llama.cpp / LM Studio so /v1/models answers on the configured host");
  }
  if (reason.startsWith("ams_recipe_") || reason === "intent_escalate_router_down") {
    tips.push("Assign a live ollama:… tag, or run `npm run start:router` when router artifacts exist");
  }
  if (reason === "cloud_needs_key" || reason === "local_unavailable_no_provider_keys") {
    tips.push("Add a cloud provider key under Settings → Connections, or bring a local backend online");
  }

  tips.push("Open Settings → Models and tap Scan models");
  tips.push("Restart the ASI server (`npm run start` / `npm run dev` from the repo root)");
  tips.push("In chat (with ops.diagnose Always): say diagnose backends");

  if (ctx.failureStreak >= RESTART_PC_STREAK) {
    tips.push(
      "Last resort after repeated failures: restart this PC, then start Ollama / llama.cpp again (chat can suggest via ops.suggest_reboot — never forces reboot)"
    );
  }

  // Dedupe while preserving order
  const seen = new Set<string>();
  return tips.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

export function buildFailClosedUserMessage(ctx: FailClosedCtx): string {
  const seed = ctx.failureStreak + (ctx.modelTried?.length ?? 0) + (ctx.reason?.length ?? 0);
  const explanation = pickVariant(explanationVariants(ctx), seed);
  const who = ctx.agentName?.trim() ? `${ctx.agentName} is blocked (fail closed). ` : "";
  const suggestions = failClosedSuggestions(ctx);
  const tipBlock =
    suggestions.length > 0
      ? `\n\nTry this:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";
  return `${who}${explanation}${tipBlock}`;
}

/** Short one-liner for chiefGenerateFailureDetail.message (API 503 body). */
export function buildFailClosedSummary(ctx: FailClosedCtx): string {
  const seed = ctx.failureStreak + (ctx.reason?.length ?? 0) + 1;
  const explanation = pickVariant(explanationVariants(ctx), seed);
  const firstTips = failClosedSuggestions(ctx).slice(0, 3);
  const tip =
    firstTips.length > 0 ? ` Next: ${firstTips.join(" · ")}` : "";
  return `${explanation}${tip}`;
}
