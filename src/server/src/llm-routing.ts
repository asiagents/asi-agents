import { isAmsCatalogRecipeId } from "./ams.models.js";
import { isNonChatModelId, NON_CHAT_MODEL_HINT } from "./non-chat-models.js";
import { getProviderById, type ProviderRegistryEntry } from "./providers.registry.js";
import {
  getLastCloudCreditHint,
  noteCloudProviderFailure,
} from "./providers.js";
import { fetchOllamaTagNames, getLlamaCppProbeSummary, getOllamaProbeSummary } from "./models.js";
import {
  appendProviderSpendEvent,
  getProviderApiKey,
  getAgentModelAssignment,
  getAgentRoutingPref,
  getSelectedModelId,
  getModelCascadePrefs,
  listProviderKeyStatus,
  isProviderEnabled,
} from "./store.js";
import { loadAgents } from "./agents.js";
import { stripModelReasoning } from "./strip-reasoning.js";
import {
  buildFailClosedUserMessage,
  clearLocalGenerateFailureStreak,
  getLocalFailStreak,
  noteLocalGenerateFailure,
} from "./localBackendFailClosed.js";

const OLLAMA = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const LLAMA_CPP = (process.env.LLAMA_CPP_HOST ?? process.env.OPENAI_BASE_URL ?? "").replace(/\/$/, "");
const ROUTER_BASE = (process.env.ASI_ROUTER_URL ?? "http://127.0.0.1:7821").replace(/\/$/, "");

export type GenerateVia = "router" | "llama_cpp" | "ollama" | "cloud" | "offline";

export interface GenerateUsage {
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  tokensPerSecond?: number;
}

export interface GenerateResult {
  text: string | null;
  via: GenerateVia;
  providerId?: string;
  upstreamModel?: string;
  reason?: string;
  usage?: GenerateUsage;
}

type GenerateAttempt = { text: string; usage?: GenerateUsage };

function usageFromOpenAi(data: unknown, latencyMs: number): GenerateUsage {
  const d = data as {
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const promptTokens = d.usage?.prompt_tokens;
  const completionTokens = d.usage?.completion_tokens;
  const totalTokens =
    d.usage?.total_tokens ??
    (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : undefined);
  const tokensPerSecond =
    completionTokens != null && latencyMs > 0
      ? Math.round((completionTokens / latencyMs) * 1000 * 10) / 10
      : undefined;
  return { latencyMs, promptTokens, completionTokens, totalTokens, tokensPerSecond };
}

function usageFromOllama(
  data: { eval_count?: number; prompt_eval_count?: number },
  latencyMs: number
): GenerateUsage {
  const completionTokens = data.eval_count;
  const promptTokens = data.prompt_eval_count;
  const tokensPerSecond =
    completionTokens != null && latencyMs > 0
      ? Math.round((completionTokens / latencyMs) * 1000 * 10) / 10
      : undefined;
  return { latencyMs, promptTokens, completionTokens, tokensPerSecond };
}

const ROUTER_UI_IDS = new Set(["micro", "hybrid", "agentchat"]);
const CLOUD_UI_IDS = new Set(["chat1b", "chat3b", "cloud"]);

export function isRouterUiModelId(modelId?: string | null): boolean {
  return ROUTER_UI_IDS.has(String(modelId ?? "").trim());
}

export function isCloudUiModelId(modelId?: string | null): boolean {
  return CLOUD_UI_IDS.has(String(modelId ?? "").trim());
}

/** Router UI slots + AMS catalog recipes — not runnable Ollama/llama.cpp tags without weights. */
export function isUnrunnableGenerateTarget(modelId?: string | null): boolean {
  const raw = String(modelId ?? "").trim();
  if (!raw) return true;
  if (raw === "ultra") return true;
  if (isRouterUiModelId(raw)) return true;
  if (isAmsCatalogRecipeId(raw)) return true;
  return false;
}

function isEmbedOllamaTag(tag: string): boolean {
  return /embed|nomic-embed|mxbai-embed/i.test(tag);
}

/** Human-readable label for errors (never invent a fake Ollama tag). */
export function resolveBackendModel(modelId?: string | null): string {
  const raw = (modelId ?? "").trim();
  if (!raw) return "default";
  const fromEnv = process.env.ASI_CHAT_MODEL?.trim();
  if (fromEnv && isRouterUiModelId(raw)) return `${raw} (ASI_CHAT_MODEL=${fromEnv})`;
  const fromProvider = parseProviderModelId(raw);
  if (fromProvider) return `${fromProvider.providerId}:${fromProvider.upstreamModel}`;
  if (raw.startsWith("ollama:")) return raw.slice("ollama:".length);
  if (raw.startsWith("llamacpp:")) return raw.slice("llamacpp:".length);
  if (isRouterUiModelId(raw)) return `AMS router slot (${raw})`;
  if (isCloudUiModelId(raw)) return `${raw} (cloud lane)`;
  if (raw === "ultra") return "ultra (edge gate — not a chat LLM)";
  return raw;
}

/** OpenAI-compat / SLM router `model` field — not a guaranteed Ollama tag. */
export function resolveRouterBackendModel(modelId?: string | null): string {
  const fromEnv = process.env.ASI_CHAT_MODEL?.trim();
  if (fromEnv) return fromEnv;
  const raw = (modelId ?? "").trim();
  const fromProvider = raw ? parseProviderModelId(raw) : null;
  if (fromProvider) return fromProvider.upstreamModel;
  if (raw.startsWith("ollama:")) return raw.slice("ollama:".length);
  if (raw.startsWith("llamacpp:")) return raw.slice("llamacpp:".length);
  const selected = getSelectedModelId();
  if (selected?.startsWith("ollama:")) return selected.slice("ollama:".length);
  if (selected?.startsWith("llamacpp:")) return selected.slice("llamacpp:".length);
  if (raw && !isCloudUiModelId(raw) && !isRouterUiModelId(raw) && raw !== "ultra") return raw;
  return "default";
}

function resolveLlamaCppBackendModel(modelId?: string | null): string | null {
  const raw = (modelId ?? "").trim();
  // Never send an Ollama assignment to llama.cpp.
  if (raw.startsWith("ollama:")) return null;
  if (raw.startsWith("llamacpp:")) return raw.slice("llamacpp:".length);
  const fromEnv = process.env.ASI_CHAT_MODEL?.trim();
  if (fromEnv && !raw && isUsableOllamaTagCandidate(fromEnv)) return fromEnv;
  const selected = getSelectedModelId();
  if (selected?.startsWith("llamacpp:")) return selected.slice("llamacpp:".length);
  if (isRouterUiModelId(raw) || isCloudUiModelId(raw) || isAmsCatalogRecipeId(raw)) return null;
  if (parseProviderModelId(raw)) return null;
  if (raw && !ROUTER_UI_IDS.has(raw) && !CLOUD_UI_IDS.has(raw) && raw !== "ultra") return raw;
  if (fromEnv && isUsableOllamaTagCandidate(fromEnv)) return fromEnv;
  return null;
}

/** Strip `ollama:` prefix; leave bare tags unchanged. */
export function ollamaTagFromModelId(modelId?: string | null): string | null {
  const raw = (modelId ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("ollama:")) {
    const tag = raw.slice("ollama:".length).trim();
    return tag || null;
  }
  return null;
}

/** True when `want` matches an installed Ollama tag (exact or `:latest` alias). */
export function ollamaTagInstalled(want: string, tags: string[]): boolean {
  const w = want.trim();
  if (!w) return false;
  if (tags.includes(w)) return true;
  if (!w.includes(":") && tags.includes(`${w}:latest`)) return true;
  if (w.endsWith(":latest")) {
    const base = w.slice(0, -":latest".length);
    if (tags.includes(base)) return true;
  }
  return false;
}

/**
 * Ollama tag when probed/selected/assigned — null skips Ollama (fail-closed, no llama3.2 default).
 * Explicit `ollama:…` assignments always win over ASI_CHAT_MODEL / global selection.
 * Never sends AMS catalog recipes or router UI slots (`micro`) as Ollama tags.
 */
export async function resolveOllamaBackendModel(modelId?: string | null): Promise<string | null> {
  const raw = (modelId ?? "").trim();
  const explicit = ollamaTagFromModelId(raw);
  if (explicit) return explicit;

  const fromEnv = process.env.ASI_CHAT_MODEL?.trim();
  if (fromEnv && isUsableOllamaTagCandidate(fromEnv)) return fromEnv;

  if (isCloudUiModelId(raw)) return null;
  const selected = getSelectedModelId();
  if (selected?.startsWith("ollama:")) {
    const tag = selected.slice("ollama:".length).trim();
    if (tag) return tag;
  }

  // Router slots + AMS recipes: use installed Ollama pool, never the recipe id as a tag.
  if (
    isRouterUiModelId(raw) ||
    isAmsCatalogRecipeId(raw) ||
    raw === "ultra" ||
    raw === "ollama" ||
    raw === "stub" ||
    !raw
  ) {
    const tags = await fetchOllamaTagNames();
    return tags.find((t) => !isEmbedOllamaTag(t)) ?? tags[0] ?? null;
  }
  if (raw.startsWith("llamacpp:")) return null;
  if (parseProviderModelId(raw)) return null;

  const tags = await fetchOllamaTagNames();
  if (ollamaTagInstalled(raw, tags)) return raw;
  return tags.find((t) => !isEmbedOllamaTag(t)) ?? tags[0] ?? null;
}

function isUsableOllamaTagCandidate(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (isRouterUiModelId(t) || isCloudUiModelId(t) || t === "ultra") return false;
  if (isAmsCatalogRecipeId(t)) return false;
  if (t.startsWith("llamacpp:")) return false;
  // parseProviderModelId is defined below — inline colon check for cloud provider ids
  const idx = t.indexOf(":");
  if (idx > 0) {
    const providerId = t.slice(0, idx);
    if (getProviderById(providerId)) return false;
  }
  return true;
}

/** Diagnose why an Ollama generate path failed (shared by every agent). */
export async function diagnoseOllamaGenerateFailure(modelId?: string | null): Promise<{
  reason: string;
  hint: string;
}> {
  const raw = String(modelId ?? "").trim();
  const probe = await getOllamaProbeSummary();
  const tags = probe.reachable
    ? (await fetchOllamaTagNames().catch(() => [] as string[]))
    : [];

  // AMS recipes / router slots are not Ollama tags — report honestly.
  if (isAmsCatalogRecipeId(raw) || isRouterUiModelId(raw) || raw === "ultra") {
    if (!probe.reachable) {
      return {
        reason: "ams_recipe_no_ollama",
        hint: ` "${raw}" is an AMS recipe/router slot (not an Ollama tag). Ollama at ${probe.host} is unreachable — start Ollama, then pull a chat model or assign ollama:… / OpenRouter :free.`,
      };
    }
    if (!tags.length) {
      return {
        reason: "ams_recipe_no_ollama",
        hint: ` "${raw}" is an AMS recipe/router slot (not an Ollama tag). Ollama at ${probe.host} has no installed tags — pull a chat model or assign ollama:… / OpenRouter :free.`,
      };
    }
    return {
      reason: "ams_recipe_not_runnable",
      hint: ` "${raw}" is an AMS recipe/router slot (not installed as a generate target). Fail over to secondary or an Ollama tag (e.g. ${tags.find((t) => !isEmbedOllamaTag(t)) ?? tags[0]}).`,
    };
  }

  const want =
    ollamaTagFromModelId(modelId) ??
    (modelId && !isRouterUiModelId(modelId) && !isCloudUiModelId(modelId) && !String(modelId).startsWith("llamacpp:")
      ? String(modelId).trim()
      : null);

  if (!probe.reachable) {
    return {
      reason: "ollama_unreachable",
      hint: ` Ollama at ${probe.host} is unreachable${probe.error ? ` (${probe.error})` : ""} — start Ollama (\`ollama serve\` / tray) or set OLLAMA_HOST.`,
    };
  }
  if (!tags.length) {
    return {
      reason: "ollama_no_models",
      hint: ` Ollama at ${probe.host} is reachable but has no installed tags — run \`ollama pull\` then Scan models.`,
    };
  }
  if (want && !ollamaTagInstalled(want, tags)) {
    const sample = tags.slice(0, 8).join(", ");
    const more = tags.length > 8 ? `, …(+${tags.length - 8})` : "";
    return {
      reason: "ollama_model_missing",
      hint: ` Ollama is up but "${want}" is not in \`ollama list\`. Installed: ${sample}${more}.`,
    };
  }
  if (want) {
    return {
      reason: "ollama_generate_failed",
      hint: ` Ollama has "${want}" but generate timed out or returned empty (large models need a longer first load — retry once warm).`,
    };
  }
  return {
    reason: "ollama_generate_failed",
    hint: ` Ollama at ${probe.host} did not return a completion.`,
  };
}

/** Ollama generate timeout — cold-load of 20GB+ tags often exceeds 20s. */
const OLLAMA_GENERATE_TIMEOUT_MS = Number(process.env.ASI_OLLAMA_TIMEOUT_MS ?? 180_000);

export type AgentRoutePreference = "local" | "cloud" | "provider";

export interface ResolvedAgentRoute {
  /** Effective route token: `local`, `cloud`, or `provider:model`. */
  routePref: string;
  preference: AgentRoutePreference;
  providerTarget?: { providerId: string; upstreamModel: string };
  primaryModelId: string;
  secondaryModelId: string | null;
  /** Where `routePref` came from before defaulting. */
  source: "override" | "registry" | "default";
}

export function normalizeRoutePrefToken(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (s === "local" || s === "cloud") return s;
  const parsed = parseProviderModelId(s);
  return parsed ? s : null;
}

/** Per-agent generate path: app-state override → registry `routePref` → `local`. */
export function resolveAgentRoute(agentId: string): ResolvedAgentRoute {
  const id = agentId.trim();
  const agent = loadAgents().agents.find((a) => a.id === id) ?? null;
  const ov = getAgentModelAssignment(id);
  const primary = ov.primary ?? agent?.modelId ?? "agentchat";
  const secondary = ov.secondary ?? agent?.secondaryModelId ?? null;

  const fromState = getAgentRoutingPref(id);
  const fromRegistry = agent?.routePref ?? null;
  let source: ResolvedAgentRoute["source"] = "default";
  let token = "local";
  if (fromState && normalizeRoutePrefToken(fromState)) {
    token = normalizeRoutePrefToken(fromState)!;
    source = "override";
  } else if (fromRegistry && normalizeRoutePrefToken(fromRegistry)) {
    token = normalizeRoutePrefToken(fromRegistry)!;
    source = "registry";
  }

  if (token === "local") {
    return { routePref: "local", preference: "local", primaryModelId: primary, secondaryModelId: secondary, source };
  }
  if (token === "cloud") {
    return { routePref: "cloud", preference: "cloud", primaryModelId: primary, secondaryModelId: secondary, source };
  }
  const parsed = parseProviderModelId(token)!;
  return {
    routePref: token,
    preference: "provider",
    providerTarget: parsed,
    primaryModelId: primary,
    secondaryModelId: secondary,
    source,
  };
}

export function parseProviderModelId(modelId: string): { providerId: string; upstreamModel: string } | null {
  const raw = modelId.trim();
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  const providerId = raw.slice(0, idx).trim();
  const upstreamModel = raw.slice(idx + 1).trim();
  if (!providerId || !upstreamModel || !getProviderById(providerId)) return null;
  return { providerId, upstreamModel };
}

const DEFAULT_CLOUD_MODEL: Record<string, string> = {
  openrouter: "openrouter/auto",
  groq: "llama-3.1-8b-instant",
  google: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  mistral: "mistral-small-latest",
  together: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  deepseek: "deepseek-chat",
  cohere: "command-r-plus-08-2024",
  opencode: "gpt-4o-mini",
  huggingface: "meta-llama/Llama-3.1-8B-Instruct",
};

function authHeaders(entry: ProviderRegistryEntry, apiKey: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  switch (entry.apiKeyHeader.kind) {
    case "bearer":
      h.authorization = `Bearer ${apiKey}`;
      break;
    case "header":
      h[entry.apiKeyHeader.name] = apiKey;
      break;
    case "anthropic":
      h["x-api-key"] = apiKey;
      h["anthropic-version"] = "2023-06-01";
      break;
  }
  return h;
}

/** OpenAI-compat chat completion body shared by llama.cpp and SLM router. */
function chatCompletionBody(
  model: string,
  systemPrompt: string,
  prompt: string,
  maxTokens: number
): string {
  return JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: maxTokens,
  });
}

function parseOpenAiChat(data: unknown, latencyMs: number): GenerateAttempt | null {
  const d = data as { choices?: Array<{ message?: { content?: string } }> };
  const text = d.choices?.[0]?.message?.content?.trim() || null;
  if (!text) return null;
  const usage = usageFromOpenAi(data, latencyMs);
  const hasTokenFields =
    usage.promptTokens != null || usage.completionTokens != null || usage.totalTokens != null;
  return { text, usage: hasTokenFields ? usage : { latencyMs } };
}

/**
 * When `GET {ASI_ROUTER_URL}/health` is OK, forward generate to `POST …/v1/chat/completions`.
 * Returns null when router is off, HTTP errors, or empty content (caller falls back to local→cloud).
 */
export async function tryRouterGenerate(
  prompt: string,
  model: string,
  systemPrompt: string
): Promise<GenerateAttempt | null> {
  const health = await probeRouterHealth();
  if (!health.live) return null;
  const started = performance.now();
  try {
    const res = await fetch(`${ROUTER_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: chatCompletionBody(model, systemPrompt, prompt, 2048),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    return parseOpenAiChat(await res.json(), Math.round(performance.now() - started));
  } catch {
    return null;
  }
}

/**
 * Ollama generate. Always send `system` so Modelfile personas (e.g. a custom
 * phi3 SYSTEM card) cannot override Chief / agent identity from the app.
 * Prefer `/api/chat` (messages); fall back to `/api/generate` with `system`.
 * Chat and generate use separate try blocks so a chat timeout still tries generate.
 */
export async function tryOllama(
  prompt: string,
  model: string,
  systemPrompt: string
): Promise<GenerateAttempt | null> {
  const started = performance.now();
  const system = systemPrompt.trim() || "You are a concise assistant.";
  const timeoutMs = OLLAMA_GENERATE_TIMEOUT_MS;

  try {
    const chatRes = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (chatRes.ok) {
      const data = (await chatRes.json()) as {
        message?: { content?: string };
        eval_count?: number;
        prompt_eval_count?: number;
      };
      const text = data.message?.content?.trim() || null;
      if (text) {
        return { text, usage: usageFromOllama(data, Math.round(performance.now() - started)) };
      }
    }
  } catch {
    /* fall through to /api/generate */
  }

  try {
    const res = await fetch(`${OLLAMA}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, prompt, system, stream: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      response?: string;
      eval_count?: number;
      prompt_eval_count?: number;
    };
    const text = data.response?.trim() || null;
    if (!text) return null;
    const latencyMs = Math.round(performance.now() - started);
    return { text, usage: usageFromOllama(data, latencyMs) };
  } catch {
    return null;
  }
}

export async function tryOpenAiCompatLocal(
  prompt: string,
  model: string,
  systemPrompt: string
): Promise<GenerateAttempt | null> {
  if (!LLAMA_CPP) return null;
  const started = performance.now();
  try {
    const res = await fetch(`${LLAMA_CPP}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: chatCompletionBody(model, systemPrompt, prompt, 2048),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return parseOpenAiChat(await res.json(), Math.round(performance.now() - started));
  } catch {
    return null;
  }
}

async function tryOpenAiCompatCloud(
  entry: ProviderRegistryEntry,
  apiKey: string,
  upstreamModel: string,
  systemPrompt: string,
  prompt: string
): Promise<GenerateAttempt | null> {
  const url = `${entry.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const started = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(entry, apiKey),
      body: JSON.stringify({
        model: upstreamModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 768,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const snippet = await res.text().catch(() => "");
      noteCloudProviderFailure(entry.id, res.status, snippet);
      return null;
    }
    return parseOpenAiChat(await res.json(), Math.round(performance.now() - started));
  } catch {
    return null;
  }
}

async function tryAnthropicCloud(
  entry: ProviderRegistryEntry,
  apiKey: string,
  upstreamModel: string,
  systemPrompt: string,
  prompt: string
): Promise<GenerateAttempt | null> {
  const url = `${entry.baseUrl.replace(/\/$/, "")}/messages`;
  const started = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(entry, apiKey),
      body: JSON.stringify({
        model: upstreamModel,
        max_tokens: 768,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const snippet = await res.text().catch(() => "");
      noteCloudProviderFailure(entry.id, res.status, snippet);
      return null;
    }
    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const block = data.content?.find((c) => c.type === "text" || c.text);
    const text = block?.text?.trim() || null;
    if (!text) return null;
    const latencyMs = Math.round(performance.now() - started);
    const promptTokens = data.usage?.input_tokens;
    const completionTokens = data.usage?.output_tokens;
    const tokensPerSecond =
      completionTokens != null && latencyMs > 0
        ? Math.round((completionTokens / latencyMs) * 1000 * 10) / 10
        : undefined;
    return {
      text,
      usage: { latencyMs, promptTokens, completionTokens, tokensPerSecond },
    };
  } catch {
    return null;
  }
}

async function tryProviderCloud(
  providerId: string,
  upstreamModel: string,
  systemPrompt: string,
  prompt: string
): Promise<GenerateAttempt | null> {
  if (!isProviderEnabled(providerId)) return null;
  const entry = getProviderById(providerId);
  if (!entry) return null;
  const apiKey = getProviderApiKey(providerId);
  if (!apiKey) return null;
  if (entry.apiKeyHeader.kind === "anthropic") {
    return tryAnthropicCloud(entry, apiKey, upstreamModel, systemPrompt, prompt);
  }
  return tryOpenAiCompatCloud(entry, apiKey, upstreamModel, systemPrompt, prompt);
}

function configuredProviderIds(): string[] {
  const status = listProviderKeyStatus();
  return Object.entries(status)
    .filter(([id, s]) => s.configured && isProviderEnabled(id))
    .map(([id]) => id);
}

export interface RouteGenerateInput {
  prompt: string;
  modelId?: string | null;
  secondaryModelId?: string | null;
  systemPrompt: string;
  /** When set, cloud (or pinned provider) is tried before local/router stack. */
  routePreference?: AgentRoutePreference;
  providerTarget?: { providerId: string; upstreamModel: string };
  /** Optional agent id for spend / call audit attribution. */
  agentId?: string | null;
}

function buildCloudTargets(
  primary: string,
  secondary: string,
  providerTarget?: { providerId: string; upstreamModel: string },
  extraModelIds: string[] = []
): { providerId: string; upstreamModel: string }[] {
  const cloudTargets: { providerId: string; upstreamModel: string }[] = [];
  const pushCloud = (modelId: string) => {
    const parsed = modelId.trim() ? parseProviderModelId(modelId) : null;
    if (!parsed) return;
    if (cloudTargets.some((t) => t.providerId === parsed.providerId && t.upstreamModel === parsed.upstreamModel)) {
      return;
    }
    cloudTargets.push(parsed);
  };
  pushCloud(primary);
  pushCloud(secondary);
  for (const id of extraModelIds) pushCloud(id);
  for (const providerId of configuredProviderIds()) {
    if (cloudTargets.some((t) => t.providerId === providerId)) continue;
    const upstreamModel = DEFAULT_CLOUD_MODEL[providerId];
    if (upstreamModel) cloudTargets.push({ providerId, upstreamModel });
  }
  if (providerTarget) {
    const rest = cloudTargets.filter(
      (t) =>
        t.providerId !== providerTarget.providerId || t.upstreamModel !== providerTarget.upstreamModel
    );
    return [providerTarget, ...rest];
  }
  return cloudTargets;
}

function resultFromAttempt(
  attempt: GenerateAttempt,
  via: GenerateVia,
  extra?: Pick<GenerateResult, "providerId" | "upstreamModel" | "reason">
): GenerateResult {
  // Always persist the stripped text — never fall back to raw CoT / think dumps.
  const cleaned = stripModelReasoning(attempt.text).trim();
  return {
    text: cleaned,
    via,
    usage: attempt.usage,
    ...extra,
  };
}

async function attemptLocalStack(
  prompt: string,
  modelId: string,
  systemPrompt: string,
  options?: { skipRouter?: boolean }
): Promise<GenerateResult | null> {
  // Explicit local runtime assignments skip the AMS router (wrong model + long hang).
  // AMS catalog recipes / router UI slots also skip — router is not a chat LLM for recipes.
  const skipRouter =
    options?.skipRouter ||
    modelId.startsWith("ollama:") ||
    modelId.startsWith("llamacpp:") ||
    isAmsCatalogRecipeId(modelId);

  if (!skipRouter) {
    const routerModel = resolveRouterBackendModel(modelId);
    const attempt = await tryRouterGenerate(prompt, routerModel, systemPrompt);
    if (attempt) return resultFromAttempt(attempt, "router");
  }
  const llamaModel = resolveLlamaCppBackendModel(modelId);
  if (llamaModel) {
    const attempt = await tryOpenAiCompatLocal(prompt, llamaModel, systemPrompt);
    if (attempt) return resultFromAttempt(attempt, "llama_cpp");
  }
  const ollamaModel = await resolveOllamaBackendModel(modelId);
  if (ollamaModel) {
    const attempt = await tryOllama(prompt, ollamaModel, systemPrompt);
    if (attempt) return resultFromAttempt(attempt, "ollama");
  }
  return null;
}

/**
 * Local generate with secondary + optional Cascade order + Ollama-pool failover before fail-closed.
 * When primary is an AMS recipe / `micro` slot, secondary is tried first.
 * Cascade extras (Settings → Models → Cascade) run after primary and before secondary when enabled.
 */
async function attemptLocalStackWithFailover(
  prompt: string,
  primary: string,
  secondary: string,
  systemPrompt: string,
  options?: { skipRouter?: boolean; failoverExtra?: string[] }
): Promise<GenerateResult | null> {
  const ordered: string[] = [];
  const push = (id: string) => {
    const t = id.trim();
    if (!t) return;
    if (parseProviderModelId(t)) return; // cloud path handles provider:model
    if (!ordered.includes(t)) ordered.push(t);
  };

  const extras = options?.failoverExtra ?? [];
  if (isUnrunnableGenerateTarget(primary) && secondary.trim()) {
    push(secondary);
    for (const id of extras) push(id);
    push(primary);
  } else {
    push(primary);
    for (const id of extras) push(id);
    push(secondary);
  }

  const triedOllamaTags = new Set<string>();
  for (const modelId of ordered) {
    const resolved = await resolveOllamaBackendModel(modelId);
    if (resolved) triedOllamaTags.add(resolved);
    const local = await attemptLocalStack(prompt, modelId, systemPrompt, options);
    if (local) return local;
  }

  // Ollama pool: first chat-capable installed tag not already tried
  const tags = await fetchOllamaTagNames();
  for (const tag of tags) {
    if (isEmbedOllamaTag(tag)) continue;
    if (triedOllamaTags.has(tag)) continue;
    const attempt = await tryOllama(prompt, tag, systemPrompt);
    if (attempt) return resultFromAttempt(attempt, "ollama");
    break; // one pool attempt — avoid serial cold-loads of every tag
  }
  return null;
}

/** Cascade failover ids when enabled; empty when off. */
function cascadeFailoverExtra(): string[] {
  const prefs = getModelCascadePrefs();
  if (!prefs.enabled || prefs.order.length === 0) return [];
  return prefs.order;
}

async function offlineReasonForLocalMiss(
  modelId: string,
  keys: string[]
): Promise<string> {
  if (modelId.startsWith("llamacpp:")) {
    if (!LLAMA_CPP) return "llamacpp_unset";
    const llama = await getLlamaCppProbeSummary();
    if (!llama.reachable) return "llamacpp_unreachable";
    return "llamacpp_unreachable";
  }

  const diag = await diagnoseOllamaGenerateFailure(modelId);
  if (
    diag.reason === "ollama_model_missing" ||
    diag.reason === "ollama_unreachable" ||
    diag.reason === "ollama_no_models" ||
    diag.reason === "ollama_generate_failed" ||
    diag.reason === "ams_recipe_not_runnable" ||
    diag.reason === "ams_recipe_no_ollama" ||
    modelId.startsWith("ollama:")
  ) {
    return diag.reason;
  }

  // Prefer a concrete local-backend reason when both stacks look down.
  const [ollama, llama] = await Promise.all([getOllamaProbeSummary(), getLlamaCppProbeSummary()]);
  if (!ollama.reachable && !llama.configured) return "ollama_unreachable";
  if (!ollama.reachable && llama.configured && !llama.reachable) return "ollama_unreachable";
  if (ollama.reachable && ollama.count === 0 && !llama.configured) return "ollama_no_models";
  if (!llama.configured && !ollama.reachable) return "llamacpp_unset";

  return keys.length ? "local_and_cloud_failed" : "local_unavailable_no_provider_keys";
}

function recordSpendAudit(
  result: GenerateResult,
  input: RouteGenerateInput,
  primary: string
): GenerateResult {
  if (result.via !== "offline" && result.text) {
    clearLocalGenerateFailureStreak();
  }

  const u = result.usage;
  if (
    result.via !== "offline" &&
    u &&
    (u.promptTokens != null || u.completionTokens != null || u.totalTokens != null || u.latencyMs != null)
  ) {
    try {
      appendProviderSpendEvent({
        via: result.via,
        providerId: result.providerId,
        model: (result.upstreamModel ?? primary) || undefined,
        agentId: input.agentId?.trim() || undefined,
        promptTokens: u.promptTokens ?? 0,
        completionTokens: u.completionTokens ?? 0,
        totalTokens: u.totalTokens,
        latencyMs: u.latencyMs ?? 0,
      });
    } catch (e) {
      console.warn("[spend-audit]", e instanceof Error ? e.message : e);
    }
  }
  return result;
}

/**
 * After in-app intent layer misses: try AMS router first, then local stack without a second router hop.
 */
export async function routeGenerateAfterIntentEscalation(
  input: RouteGenerateInput
): Promise<GenerateResult> {
  const { prompt, systemPrompt } = input;
  const primary = (input.modelId ?? "").trim();
  const secondary = (input.secondaryModelId ?? "").trim();
  if (isNonChatModelId(primary)) {
    return { text: null, via: "offline", reason: "non_chat_model" };
  }
  const failoverExtra = cascadeFailoverExtra();
  const cloudTargets = buildCloudTargets(primary, secondary, input.providerTarget, failoverExtra);
  const escalateOnlyRouter = process.env.ASI_INTENT_ESCALATE_ONLY_ROUTER === "1";
  const explicitLocal =
    primary.startsWith("ollama:") || primary.startsWith("llamacpp:");

  if (!explicitLocal && !isAmsCatalogRecipeId(primary)) {
    const routerAttempt = await tryRouterGenerate(
      prompt,
      resolveRouterBackendModel(primary),
      systemPrompt
    );
    if (routerAttempt) {
      return recordSpendAudit(resultFromAttempt(routerAttempt, "router"), input, primary);
    }
  }

  if (escalateOnlyRouter) {
    const health = await probeRouterHealth();
    if (!health.live) {
      return { text: null, via: "offline", reason: "intent_escalate_router_down" };
    }
    return { text: null, via: "offline", reason: "intent_escalate_router_miss" };
  }

  const cloudFirst =
    input.routePreference === "cloud" || input.routePreference === "provider";
  const preferredCloudReason =
    input.routePreference === "provider" ? "provider_preferred" : "cloud_preferred";
  const fallbackCloudReason = "local_unavailable";

  if (cloudFirst) {
    const cloud = await attemptCloud(cloudTargets, prompt, systemPrompt, preferredCloudReason);
    if (cloud) return recordSpendAudit(cloud, input, primary);
    const local = await attemptLocalStackWithFailover(prompt, primary, secondary, systemPrompt, {
      skipRouter: true,
      failoverExtra,
    });
    if (local) return recordSpendAudit(local, input, primary);
  } else {
    const local = await attemptLocalStackWithFailover(prompt, primary, secondary, systemPrompt, {
      skipRouter: true,
      failoverExtra,
    });
    if (local) return recordSpendAudit(local, input, primary);
    const cloud = await attemptCloud(cloudTargets, prompt, systemPrompt, fallbackCloudReason);
    if (cloud) return recordSpendAudit(cloud, input, primary);
  }

  const keys = configuredProviderIds();
  return {
    text: null,
    via: "offline",
    reason: await offlineReasonForLocalMiss(primary, keys),
  };
}

async function attemptCloud(
  cloudTargets: { providerId: string; upstreamModel: string }[],
  prompt: string,
  systemPrompt: string,
  cloudReason: string
): Promise<GenerateResult | null> {
  for (const target of cloudTargets) {
    const reply = await tryProviderCloud(target.providerId, target.upstreamModel, systemPrompt, prompt);
    if (reply) {
      return resultFromAttempt(reply, "cloud", {
        providerId: target.providerId,
        upstreamModel: target.upstreamModel,
        reason: cloudReason,
      });
    }
  }
  return null;
}

/**
 * When loopback router is live: `POST …/v1/chat/completions` first (local stack).
 * Then local (llama.cpp, Ollama), secondary failover, optional Cascade order, Ollama pool,
 * then configured cloud keys — unless `routePreference` is cloud/provider.
 * Fail-closed: returns via `offline` when nothing answers.
 */
export async function routeGenerate(input: RouteGenerateInput): Promise<GenerateResult> {
  const { prompt, systemPrompt } = input;
  const primary = (input.modelId ?? "").trim();
  const secondary = (input.secondaryModelId ?? "").trim();
  if (isNonChatModelId(primary)) {
    return { text: null, via: "offline", reason: "non_chat_model" };
  }
  const failoverExtra = cascadeFailoverExtra();
  const cloudTargets = buildCloudTargets(primary, secondary, input.providerTarget, failoverExtra);
  const keys = configuredProviderIds();
  const cloudFirst =
    input.routePreference === "cloud" ||
    input.routePreference === "provider" ||
    isCloudUiModelId(primary);
  const preferredCloudReason =
    input.routePreference === "provider" ? "provider_preferred" : "cloud_preferred";
  const fallbackCloudReason = "local_unavailable";

  const finish = (result: GenerateResult): GenerateResult => recordSpendAudit(result, input, primary);

  if (isCloudUiModelId(primary) && keys.length === 0) {
    return finish({ text: null, via: "offline", reason: "cloud_needs_key" });
  }

  if (cloudFirst) {
    const cloud = await attemptCloud(cloudTargets, prompt, systemPrompt, preferredCloudReason);
    if (cloud) return finish(cloud);
    const local = await attemptLocalStackWithFailover(prompt, primary, secondary, systemPrompt, {
      failoverExtra,
    });
    if (local) return finish(local);
  } else {
    const local = await attemptLocalStackWithFailover(prompt, primary, secondary, systemPrompt, {
      failoverExtra,
    });
    if (local) return finish(local);
    const cloud = await attemptCloud(cloudTargets, prompt, systemPrompt, fallbackCloudReason);
    if (cloud) return finish(cloud);
  }

  return finish({
    text: null,
    via: "offline",
    reason: await offlineReasonForLocalMiss(primary, keys),
  });
}

/** Fast fail when :7821 is off; short TTL so stub paths do not re-wait every generate hop. */
const ROUTER_PROBE_TIMEOUT_MS = 500;
const ROUTER_PROBE_CACHE_MS_LIVE = 3000;
const ROUTER_PROBE_CACHE_MS_OFF = 1200;

let routerProbeCache: { at: number; result: { live: boolean; status?: number } } | null = null;

/** Loopback SLM router (`:7821`) — health probe for registry and generate gating. */
export async function probeRouterHealth(): Promise<{ live: boolean; status?: number }> {
  const now = Date.now();
  if (routerProbeCache) {
    const ttl = routerProbeCache.result.live ? ROUTER_PROBE_CACHE_MS_LIVE : ROUTER_PROBE_CACHE_MS_OFF;
    if (now - routerProbeCache.at < ttl) return routerProbeCache.result;
  }
  try {
    const res = await fetch(`${ROUTER_BASE}/health`, {
      signal: AbortSignal.timeout(ROUTER_PROBE_TIMEOUT_MS),
    });
    const result = { live: res.ok, status: res.status };
    routerProbeCache = { at: now, result };
    return result;
  } catch {
    const result = { live: false as const };
    routerProbeCache = { at: now, result };
    return result;
  }
}

export function chiefGenerateFailureDetail(
  modelId: string,
  reason?: string,
  opts?: { bumpStreak?: boolean }
): { message: string; tried: string[] } {
  const label = resolveBackendModel(modelId);
  const tried = [
    `SLM router @ ${ROUTER_BASE}/v1/chat/completions (when GET /health OK; skipped for ollama:/llamacpp: assignments)`,
    `llama.cpp/OpenAI-compat${LLAMA_CPP ? ` @ ${LLAMA_CPP}` : " (unset)"}`,
    `Ollama @ ${OLLAMA} (only installed tags — no default llama3.2; timeout ${OLLAMA_GENERATE_TIMEOUT_MS}ms)`,
  ];
  const keys = configuredProviderIds();
  if (keys.length) {
    tried.push(`cloud providers (${keys.join(", ")})`);
  }

  if (reason === "non_chat_model") {
    return {
      message: `Model "${label}" cannot be used for chat. ${NON_CHAT_MODEL_HINT}`,
      tried,
    };
  }

  const bump = opts?.bumpStreak !== false;
  const streak = bump ? noteLocalGenerateFailure(reason) : getLocalFailStreak();
  const base = buildFailClosedUserMessage({
    modelTried: label,
    reason,
    ollamaHost: OLLAMA,
    llamaCppHost: LLAMA_CPP || null,
    routerBase: ROUTER_BASE,
    failureStreak: streak,
  });
  const credit = getLastCloudCreditHint();
  const message = credit ? `${base}\n\n${credit}` : base;
  return { message, tried };
}

export async function offlineAgentReply(
  agentName: string,
  modelTried: string,
  reason?: string
): Promise<string> {
  if (reason === "non_chat_model" || isNonChatModelId(modelTried)) {
    return `${agentName} is blocked (fail closed). ${NON_CHAT_MODEL_HINT} (assigned: "${modelTried}")`;
  }

  // Refresh reason from live probes when the caller only passed a generic offline.
  let effectiveReason = reason;
  if (
    !effectiveReason ||
    effectiveReason === "local_unavailable_no_provider_keys" ||
    effectiveReason === "local_and_cloud_failed" ||
    modelTried.startsWith("ollama:") ||
    modelTried.startsWith("llamacpp:") ||
    isAmsCatalogRecipeId(modelTried) ||
    isRouterUiModelId(modelTried)
  ) {
    const keys = configuredProviderIds();
    effectiveReason = await offlineReasonForLocalMiss(modelTried, keys);
  }

  const streak = noteLocalGenerateFailure(effectiveReason);
  return buildFailClosedUserMessage({
    agentName,
    modelTried,
    reason: effectiveReason,
    ollamaHost: OLLAMA,
    llamaCppHost: LLAMA_CPP || null,
    routerBase: ROUTER_BASE,
    failureStreak: streak,
  });
}
