/**
 * Resolve capped virtual-agent slots from selectedModelPool for deep / predictive research.
 * Prefer live Ollama + Free OpenRouter; optionally paid when keys exist. Fail-closed when none usable.
 */

import { fetchOllamaTagNames, getOllamaProbeSummary } from "./models.js";
import { parseProviderModelId } from "./llm-routing.js";
import { getProviderById } from "./providers.registry.js";
import { getProviderApiKey, getSelectedModelPool, listProviderKeyStatus } from "./store.js";

export const DEFAULT_MAX_VIRTUAL_AGENTS = 6;
export const ABSOLUTE_MAX_VIRTUAL_AGENTS = 16;
export const DEFAULT_CONCURRENCY = 3;

export type VirtualAgentTier = "local" | "free" | "paid";

export type VirtualAgentSlot = {
  slotId: string;
  modelId: string;
  label: string;
  angle: string;
  tier: VirtualAgentTier;
};

export type VirtualPoolPreview = {
  agents: VirtualAgentSlot[];
  poolSize: number;
  usableCount: number;
  maxAgents: number;
  concurrency: number;
  usedPaid: boolean;
  preferFree: boolean;
  ollamaReachable: boolean;
  openRouterConfigured: boolean;
  source: string;
  emptyReason?: string;
};

const PREDICTIVE_ANGLES = [
  "Base-case forecast — most likely path given known constraints",
  "Upside scenario — what would have to go right, and how you'd notice early",
  "Downside / risk scenario — failure modes, second-order effects",
  "Leading indicators — measurable signals that would confirm or falsify the forecast",
  "Contrarian / falsifiers — strongest arguments against the leading narrative",
  "Stakeholder reactions — how distinct actors might respond over the time horizon",
  "Branch points — decisions or events that split futures",
  "Assumptions audit — weak premises and what evidence would change them",
];

const DEEP_ANGLES = [
  "Evidence & known facts — what is relatively solid vs speculative",
  "Counterarguments — strongest challenges to the obvious answer",
  "Recent developments — what may have shifted recently (model knowledge only)",
  "Consensus map — where informed sources typically agree or disagree",
  "Edge cases & caveats — failure modes of naive conclusions",
  "Alternatives — competing explanations or options with tradeoffs",
  "Practical implications — what a decision-maker should do next",
  "Open questions — what remains unknown and how to resolve it",
];

export function resolveMaxVirtualAgents(requested?: number | null): number {
  const envRaw = Number(process.env.ASI_RESEARCH_MAX_VIRTUAL_AGENTS ?? DEFAULT_MAX_VIRTUAL_AGENTS);
  const envCap = Number.isFinite(envRaw)
    ? Math.min(ABSOLUTE_MAX_VIRTUAL_AGENTS, Math.max(1, Math.floor(envRaw)))
    : DEFAULT_MAX_VIRTUAL_AGENTS;
  if (requested == null || !Number.isFinite(requested)) return envCap;
  return Math.min(envCap, ABSOLUTE_MAX_VIRTUAL_AGENTS, Math.max(1, Math.floor(requested)));
}

export function resolveResearchConcurrency(maxAgents: number): number {
  const envRaw = Number(process.env.ASI_RESEARCH_VIRTUAL_CONCURRENCY ?? DEFAULT_CONCURRENCY);
  const envConc = Number.isFinite(envRaw)
    ? Math.min(ABSOLUTE_MAX_VIRTUAL_AGENTS, Math.max(1, Math.floor(envRaw)))
    : DEFAULT_CONCURRENCY;
  return Math.min(envConc, maxAgents);
}

function isFreeOpenRouterId(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.includes(":free") || lower.endsWith("/free");
}

function isEmbedLike(tag: string): boolean {
  return /embed|nomic-embed|bge-|e5-|minilm/i.test(tag);
}

type Candidate = { modelId: string; tier: VirtualAgentTier; label: string };

function classifyPoolId(raw: string, ollamaTags: Set<string>, ollamaReachable: boolean): Candidate | null {
  const id = raw.trim();
  if (!id) return null;

  if (id.startsWith("ollama:")) {
    const tag = id.slice("ollama:".length).trim();
    if (!tag || isEmbedLike(tag)) return null;
    if (!ollamaReachable) return null;
    if (ollamaTags.size > 0 && !ollamaTags.has(tag) && !ollamaTags.has(`${tag}:latest`)) {
      // Allow exact match via :latest alias
      const bare = tag.replace(/:latest$/, "");
      if (![...ollamaTags].some((t) => t === bare || t === `${bare}:latest` || t.startsWith(`${bare}:`))) {
        return null;
      }
    }
    return { modelId: id, tier: "local", label: `Ollama · ${tag}` };
  }

  if (id.startsWith("llamacpp:")) {
    return { modelId: id, tier: "local", label: `llama.cpp · ${id.slice("llamacpp:".length)}` };
  }

  const parsed = parseProviderModelId(id);
  if (parsed) {
    const key = getProviderApiKey(parsed.providerId);
    if (!key) return null;
    if (!getProviderById(parsed.providerId)) return null;
    if (parsed.providerId === "openrouter" && isFreeOpenRouterId(parsed.upstreamModel)) {
      return {
        modelId: id,
        tier: "free",
        label: `OpenRouter free · ${parsed.upstreamModel}`,
      };
    }
    if (parsed.providerId === "openrouter" && isFreeOpenRouterId(id)) {
      return { modelId: id, tier: "free", label: `OpenRouter free · ${parsed.upstreamModel}` };
    }
    // Paid / unknown cloud — only when key present
    return {
      modelId: id,
      tier: "paid",
      label: `${parsed.providerId} · ${parsed.upstreamModel}`,
    };
  }

  // Bare OpenRouter-style ids sometimes land in the pool without provider prefix
  if (id.includes("/") && (isFreeOpenRouterId(id) || id.includes(":"))) {
    const key = getProviderApiKey("openrouter");
    if (!key) return null;
    const modelId = id.startsWith("openrouter:") ? id : `openrouter:${id}`;
    const free = isFreeOpenRouterId(id);
    return {
      modelId,
      tier: free ? "free" : "paid",
      label: `${free ? "OpenRouter free" : "OpenRouter"} · ${id.replace(/^openrouter:/, "")}`,
    };
  }

  return null;
}

function anglesForMode(mode: "predictive" | "deep"): string[] {
  return mode === "predictive" ? PREDICTIVE_ANGLES : DEEP_ANGLES;
}

/**
 * Pick maximum useful virtual agents from the assignment pool.
 * Prefer local + free; include paid only after free/local are exhausted (or when preferFree=false).
 */
export async function resolveVirtualAgentPool(opts?: {
  maxAgents?: number | null;
  preferFree?: boolean;
  mode?: "predictive" | "deep";
}): Promise<VirtualPoolPreview> {
  const maxAgents = resolveMaxVirtualAgents(opts?.maxAgents);
  const preferFree = opts?.preferFree !== false;
  const mode = opts?.mode === "predictive" ? "predictive" : "deep";
  const concurrency = resolveResearchConcurrency(maxAgents);
  const pool = getSelectedModelPool();
  const openRouterConfigured = Boolean(getProviderApiKey("openrouter")?.trim());

  const ollamaProbe = await getOllamaProbeSummary();
  const ollamaReachable = ollamaProbe.reachable === true;
  let ollamaTags = new Set<string>();
  if (ollamaReachable) {
    try {
      ollamaTags = new Set(await fetchOllamaTagNames());
    } catch {
      ollamaTags = new Set();
    }
  }

  const classified: Candidate[] = [];
  const seen = new Set<string>();
  for (const raw of pool) {
    const c = classifyPoolId(raw, ollamaTags, ollamaReachable);
    if (!c) continue;
    if (seen.has(c.modelId)) continue;
    seen.add(c.modelId);
    classified.push(c);
  }

  // If pool empty but Ollama is live, seed from installed chat tags (local-first).
  if (classified.length === 0 && ollamaReachable && ollamaTags.size > 0) {
    for (const tag of ollamaTags) {
      if (isEmbedLike(tag)) continue;
      const modelId = `ollama:${tag}`;
      if (seen.has(modelId)) continue;
      seen.add(modelId);
      classified.push({ modelId, tier: "local", label: `Ollama · ${tag}` });
      if (classified.length >= maxAgents) break;
    }
  }

  const local = classified.filter((c) => c.tier === "local");
  const free = classified.filter((c) => c.tier === "free");
  const paid = classified.filter((c) => c.tier === "paid");

  let ordered: Candidate[] = [];
  if (preferFree) {
    ordered = [...local, ...free, ...paid];
  } else {
    ordered = [...local, ...free, ...paid];
  }

  // Drop paid when preferFree and we already have enough free/local
  const enoughWithoutPaid = local.length + free.length >= Math.min(2, maxAgents);
  if (preferFree && enoughWithoutPaid) {
    ordered = ordered.filter((c) => c.tier !== "paid");
  }

  const picked = ordered.slice(0, maxAgents);
  const usedPaid = picked.some((c) => c.tier === "paid");
  const angles = anglesForMode(mode);

  const agents: VirtualAgentSlot[] = picked.map((c, i) => ({
    slotId: `va-${i + 1}`,
    modelId: c.modelId,
    label: c.label,
    angle: angles[i % angles.length]!,
    tier: c.tier,
  }));

  let emptyReason: string | undefined;
  if (agents.length === 0) {
    const keys = Object.entries(listProviderKeyStatus())
      .filter(([, s]) => s.configured)
      .map(([id]) => id);
    if (pool.length === 0 && !ollamaReachable) {
      emptyReason =
        "No model pool and Ollama unreachable — save Free OpenRouter / Ollama models in Browse Models, or start Ollama.";
    } else if (!ollamaReachable && !openRouterConfigured && keys.length === 0) {
      emptyReason =
        "No usable backends — start Ollama or add an OpenRouter key, then select models into the pool.";
    } else if (pool.length > 0) {
      emptyReason =
        "selectedModelPool has ids but none are runnable right now (Ollama down, missing tags, or cloud keys missing).";
    } else {
      emptyReason = "No virtual agents available (fail closed).";
    }
  }

  return {
    agents,
    poolSize: pool.length,
    usableCount: classified.length,
    maxAgents,
    concurrency,
    usedPaid,
    preferFree,
    ollamaReachable,
    openRouterConfigured,
    source: preferFree ? "pool:prefer-free+local" : "pool:all-usable",
    emptyReason,
  };
}

/** Run async work over items with a fixed concurrency cap. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
