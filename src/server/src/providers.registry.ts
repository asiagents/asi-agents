/** Public metadata for cloud inference providers (no secrets). */
export type ApiKeyHeaderPattern =
  | { kind: "bearer" }
  | { kind: "header"; name: string }
  | { kind: "anthropic" };

export interface ProviderRegistryEntry {
  id: string;
  displayName: string;
  signupUrl: string;
  docsUrl: string;
  apiKeyHeader: ApiKeyHeaderPattern;
  baseUrl: string;
  supportsFreeTier: boolean;
  /** OpenAI-compat `GET {baseUrl}{path}` when set. */
  listModelsPath?: string;
  /** Extra request headers when listing models (e.g. Anthropic version). */
  listModelsHeaders?: Record<string, string>;
}

/**
 * Cloud inference providers with OpenAI-compat list + generate (Anthropic uses Messages API).
 * Hugging Face uses Inference Providers router: https://router.huggingface.co/v1
 */
export const PROVIDER_REGISTRY: ProviderRegistryEntry[] = [
  {
    id: "openrouter",
    displayName: "OpenRouter",
    signupUrl: "https://openrouter.ai/signup",
    docsUrl: "https://openrouter.ai/docs",
    apiKeyHeader: { kind: "bearer" },
    baseUrl: "https://openrouter.ai/api/v1",
    supportsFreeTier: true,
    listModelsPath: "/models",
  },
  {
    id: "groq",
    displayName: "Groq",
    signupUrl: "https://console.groq.com/login",
    docsUrl: "https://console.groq.com/docs/quickstart",
    apiKeyHeader: { kind: "bearer" },
    baseUrl: "https://api.groq.com/openai/v1",
    supportsFreeTier: true,
    listModelsPath: "/models",
  },
  {
    id: "google",
    displayName: "Google AI (Gemini)",
    signupUrl: "https://aistudio.google.com/apikey",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    apiKeyHeader: { kind: "bearer" },
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    supportsFreeTier: true,
    listModelsPath: "/models",
  },
  {
    id: "openai",
    displayName: "OpenAI",
    signupUrl: "https://platform.openai.com/signup",
    docsUrl: "https://platform.openai.com/docs/api-reference",
    apiKeyHeader: { kind: "bearer" },
    baseUrl: "https://api.openai.com/v1",
    supportsFreeTier: false,
    listModelsPath: "/models",
  },
  {
    id: "anthropic",
    displayName: "Anthropic",
    signupUrl: "https://console.anthropic.com/",
    docsUrl: "https://docs.anthropic.com/en/api/getting-started",
    apiKeyHeader: { kind: "anthropic" },
    baseUrl: "https://api.anthropic.com/v1",
    supportsFreeTier: false,
    listModelsPath: "/models",
    listModelsHeaders: { "anthropic-version": "2023-06-01" },
  },
  {
    id: "mistral",
    displayName: "Mistral",
    signupUrl: "https://console.mistral.ai/",
    docsUrl: "https://docs.mistral.ai/api/",
    apiKeyHeader: { kind: "bearer" },
    baseUrl: "https://api.mistral.ai/v1",
    supportsFreeTier: false,
    listModelsPath: "/models",
  },
  {
    id: "together",
    displayName: "Together AI",
    signupUrl: "https://api.together.xyz/signup",
    docsUrl: "https://docs.together.ai/docs/quickstart",
    apiKeyHeader: { kind: "bearer" },
    baseUrl: "https://api.together.xyz/v1",
    supportsFreeTier: false,
    listModelsPath: "/models",
  },
  {
    id: "deepseek",
    displayName: "DeepSeek",
    signupUrl: "https://platform.deepseek.com/signup",
    docsUrl: "https://api-docs.deepseek.com/",
    apiKeyHeader: { kind: "bearer" },
    baseUrl: "https://api.deepseek.com/v1",
    supportsFreeTier: false,
    listModelsPath: "/models",
  },
  {
    id: "cohere",
    displayName: "Cohere",
    signupUrl: "https://dashboard.cohere.com/welcome/register",
    docsUrl: "https://docs.cohere.com/docs",
    apiKeyHeader: { kind: "bearer" },
    baseUrl: "https://api.cohere.com/compatibility/v1",
    supportsFreeTier: true,
    listModelsPath: "/models",
  },
  {
    id: "opencode",
    displayName: "OpenCode",
    signupUrl: "https://opencode.ai/",
    docsUrl: "https://opencode.ai/docs",
    apiKeyHeader: { kind: "bearer" },
    baseUrl: "https://api.opencode.ai/v1",
    supportsFreeTier: true,
    listModelsPath: "/models",
  },
  {
    id: "huggingface",
    displayName: "Hugging Face",
    signupUrl: "https://huggingface.co/settings/tokens",
    docsUrl: "https://huggingface.co/docs/inference-providers/en/index",
    apiKeyHeader: { kind: "bearer" },
    baseUrl: "https://router.huggingface.co/v1",
    supportsFreeTier: true,
    listModelsPath: "/models",
  },
];

export function getProviderById(id: string): ProviderRegistryEntry | undefined {
  return PROVIDER_REGISTRY.find((p) => p.id === id);
}

export function publicProviderMetadata(): {
  id: string;
  displayName: string;
  signupUrl: string;
  docsUrl: string;
  supportsFreeTier: boolean;
}[] {
  return PROVIDER_REGISTRY.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    signupUrl: p.signupUrl,
    docsUrl: p.docsUrl,
    supportsFreeTier: p.supportsFreeTier,
  }));
}
