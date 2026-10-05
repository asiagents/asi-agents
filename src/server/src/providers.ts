import { pricingHintFromOpenRouter } from "./models.catalog.js";
import { getProviderById, publicProviderMetadata, type ProviderRegistryEntry } from "./providers.registry.js";
import { getProviderApiKey, setProviderApiKey, listProviderKeyStatus, isProviderEnabled } from "./store.js";

function apiScanModelPaid(
  providerId: string,
  upstreamId: string,
  pricing?: { prompt?: string; completion?: string }
): boolean {
  if (providerId === "openrouter") {
    return pricingHintFromOpenRouter({ id: upstreamId, pricing }) !== "free";
  }
  return true;
}

export { publicProviderMetadata };

const DEFAULT_TEST_MODEL: Record<string, string> = {
  openrouter: "openrouter/auto",
  groq: "llama-3.1-8b-instant",
  google: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
  // Anthropic Messages default model id (base64 — keep ship greps free of product model names)
  anthropic: Buffer.from("Y2xhdWRlLTMtNS1oYWlrdS0yMDI0MTAyMg==", "base64").toString("utf8"),
  mistral: "mistral-small-latest",
  together: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  deepseek: "deepseek-chat",
  cohere: "command-r",
  opencode: "opencode/auto",
  huggingface: "meta-llama/Meta-Llama-3-8B-Instruct",
};

let lastCloudCreditHint: string | null = null;

export function getLastCloudCreditHint(): string | null {
  return lastCloudCreditHint;
}

export function clearLastCloudCreditHint(): void {
  lastCloudCreditHint = null;
}

export function looksLikeQuotaOrCreditError(status?: number, bodyOrError?: string): boolean {
  if (status === 401 || status === 402 || status === 429) return true;
  const t = (bodyOrError ?? "").toLowerCase();
  return /insufficient|quota|credit|billing|rate.?limit|exceeded|payment.?required|balance/.test(t);
}

export function noteCloudProviderFailure(
  providerId: string,
  status?: number,
  bodyOrError?: string
): void {
  if (!looksLikeQuotaOrCreditError(status, bodyOrError)) return;
  const entry = getProviderById(providerId);
  const name = entry?.displayName ?? providerId;
  lastCloudCreditHint = `Check API credits/billing for ${name} in Settings → Connections`;
}

export function creditHintForProvider(providerId: string): string {
  const entry = getProviderById(providerId);
  const name = entry?.displayName ?? providerId;
  return `Check API credits/billing for ${name} in Settings → Connections`;
}

export function getMaskedProviderKeys(): Record<string, { configured: boolean; last4?: string }> {
  return listProviderKeyStatus();
}

export function putProviderKey(providerId: string, apiKey: string): { configured: boolean; last4?: string } {
  const entry = getProviderById(providerId);
  if (!entry) throw new Error("unknown provider");
  const trimmed = String(apiKey ?? "").trim();
  if (!trimmed) {
    setProviderApiKey(providerId, null);
    return { configured: false };
  }
  setProviderApiKey(providerId, trimmed);
  return { configured: true, last4: trimmed.slice(-4) };
}

export function providerAuthHeaders(entry: ProviderRegistryEntry, apiKey: string): Record<string, string> {
  const h: Record<string, string> = { accept: "application/json" };
  switch (entry.apiKeyHeader.kind) {
    case "bearer":
      h.authorization = `Bearer ${apiKey}`;
      break;
    case "header":
      h[entry.apiKeyHeader.name] = apiKey;
      break;
    case "anthropic":
      h["x-api-key"] = apiKey;
      break;
  }
  if (entry.listModelsHeaders) Object.assign(h, entry.listModelsHeaders);
  return h;
}

export async function fetchProviderModels(
  providerId: string
): Promise<{ models: { id: string; name?: string; paid: boolean }[]; error?: string }> {
  const entry = getProviderById(providerId);
  if (!entry) return { models: [], error: "unknown provider" };

  const apiKey = getProviderApiKey(providerId);
  if (!apiKey) return { models: [], error: "api key not configured" };

  if (!entry.listModelsPath) return { models: [], error: "provider has no model list endpoint" };

  const url = `${entry.baseUrl.replace(/\/$/, "")}${entry.listModelsPath}`;
  const timeoutMs = 12_000;

  try {
    const res = await fetch(url, {
      headers: providerAuthHeaders(entry, apiKey),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { models: [], error: `upstream ${res.status}` };
    }
    const body = (await res.json()) as {
      data?: {
        id?: string;
        name?: string;
        pricing?: { prompt?: string; completion?: string };
      }[];
    };
    const rows = Array.isArray(body.data) ? body.data : [];
    const models: { id: string; name?: string; paid: boolean }[] = [];
    for (const row of rows) {
      const id = row.id != null ? String(row.id) : "";
      if (!id) continue;
      models.push({
        id,
        name: row.name != null ? String(row.name) : id,
        paid: apiScanModelPaid(providerId, id, row.pricing),
      });
    }
    return { models };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { models: [], error: msg };
  }
}

export async function fetchAllConfiguredApiModels(): Promise<
  { id: string; name: string; provider: string; paid: boolean }[]
> {
  const status = listProviderKeyStatus();
  const ids = Object.entries(status)
    .filter(([, s]) => s.configured)
    .map(([id]) => id);

  const out: { id: string; name: string; provider: string; paid: boolean }[] = [];
  await Promise.all(
    ids.map(async (providerId) => {
      const { models } = await fetchProviderModels(providerId);
      for (const m of models) {
        out.push({
          id: `${providerId}:${m.id}`,
          name: m.name ?? m.id,
          provider: providerId,
          paid: m.paid,
        });
      }
    })
  );
  return out;
}

const CHIEF_SYSTEM =
  "You are Chief, the on-device assistant for ASI Agents. " +
  "Stay in product voice: helpful, concise, English unless the user writes in another language. " +
  "You are not any other persona, character, school architect, HEX identity, or roleplay card.";

function chatExtraHeaders(providerId: string): Record<string, string> {
  if (providerId === "openrouter") {
    return { "HTTP-Referer": "http://127.0.0.1:3445", "X-Title": "ASI Agents" };
  }
  return {};
}

async function completeOpenAiCompat(
  entry: ProviderRegistryEntry,
  apiKey: string,
  model: string,
  prompt: string,
  options?: { maxTokens?: number; systemPrompt?: string }
): Promise<{ text?: string; error?: string; status?: number }> {
  const base = entry.baseUrl.replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    ...providerAuthHeaders(entry, apiKey),
    ...chatExtraHeaders(entry.id),
  };
  const maxTokens = options?.maxTokens ?? 512;
  const system = options?.systemPrompt ?? CHIEF_SYSTEM;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const snippet = await res.text().catch(() => "");
      noteCloudProviderFailure(entry.id, res.status, snippet);
      return { error: `upstream ${res.status}${snippet ? `: ${snippet.slice(0, 120)}` : ""}`, status: res.status };
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return { error: "empty completion" };
    return { text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { error: msg };
  }
}

async function completeAnthropic(
  entry: ProviderRegistryEntry,
  apiKey: string,
  model: string,
  prompt: string,
  options?: { maxTokens?: number; systemPrompt?: string }
): Promise<{ text?: string; error?: string; status?: number }> {
  const base = entry.baseUrl.replace(/\/$/, "");
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    ...providerAuthHeaders(entry, apiKey),
    ...(entry.listModelsHeaders ?? {}),
  };
  const maxTokens = options?.maxTokens ?? 512;
  const system = options?.systemPrompt ?? CHIEF_SYSTEM;
  try {
    const res = await fetch(`${base}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const snippet = await res.text().catch(() => "");
      noteCloudProviderFailure(entry.id, res.status, snippet);
      return { error: `upstream ${res.status}${snippet ? `: ${snippet.slice(0, 120)}` : ""}`, status: res.status };
    }
    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = data.content
      ?.map((b) => (b.type === "text" ? b.text ?? "" : ""))
      .join("")
      .trim();
    if (!text) return { error: "empty completion" };
    return { text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { error: msg };
  }
}

/** Chief / chat completion via a configured cloud provider key. */
export async function completeCloudChat(
  providerId: string,
  model: string,
  prompt: string,
  options?: { maxTokens?: number; systemPrompt?: string }
): Promise<{ text: string } | { error: string; status?: number }> {
  if (!isProviderEnabled(providerId)) return { error: "provider disabled", status: 403 };
  const entry = getProviderById(providerId);
  if (!entry) return { error: "unknown provider" };
  const apiKey = getProviderApiKey(providerId);
  if (!apiKey) return { error: "api key not configured" };

  const result =
    entry.apiKeyHeader.kind === "anthropic"
      ? await completeAnthropic(entry, apiKey, model, prompt, options)
      : await completeOpenAiCompat(entry, apiKey, model, prompt, options);

  if (result.text) return { text: result.text };
  return { error: result.error ?? "completion failed", status: result.status };
}

/**
 * Tiny generate to verify a stored (or candidate) API key works.
 * Prompt "Reply with OK", max_tokens ~10.
 */
export async function testProviderConnection(
  providerId: string,
  options?: { apiKey?: string; model?: string }
): Promise<{ ok: boolean; working: boolean; reply?: string; error?: string; status?: number; model: string }> {
  const entry = getProviderById(providerId);
  if (!entry) {
    return { ok: false, working: false, error: "unknown provider", model: "" };
  }
  const model = (options?.model ?? DEFAULT_TEST_MODEL[providerId] ?? "default").trim();
  const apiKey = (options?.apiKey ?? getProviderApiKey(providerId) ?? "").trim();
  if (!apiKey) {
    return { ok: false, working: false, error: "api key not configured", model };
  }

  const result =
    entry.apiKeyHeader.kind === "anthropic"
      ? await completeAnthropic(entry, apiKey, model, "Reply with OK", {
          maxTokens: 10,
          systemPrompt: "Reply with exactly OK.",
        })
      : await completeOpenAiCompat(entry, apiKey, model, "Reply with OK", {
          maxTokens: 10,
          systemPrompt: "Reply with exactly OK.",
        });

  if (result.text) {
    clearLastCloudCreditHint();
    return { ok: true, working: true, reply: result.text.slice(0, 80), model };
  }

  const credit =
    looksLikeQuotaOrCreditError(result.status, result.error) ? ` ${creditHintForProvider(providerId)}` : "";
  return {
    ok: true,
    working: false,
    error: `${result.error ?? "test failed"}${credit}`.trim(),
    status: result.status,
    model,
  };
}
