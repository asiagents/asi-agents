import type { ApiKey, IntegrationId, IntegrationState, Provider } from '../types/settings';
import type { OrgNode } from '../types/agents';

export const accentPresets = [
  { name: 'Purple', hex: '#7c6cf0' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Slate', hex: '#475569' },
];

/** Mirrors `src/server/src/providers.registry.ts` ids and public URLs. */
export const cloudProviderMeta: Record<
  string,
  { signupUrl: string; docsUrl: string; supportsFreeTier: boolean }
> = {
  openrouter: {
    signupUrl: 'https://openrouter.ai/signup',
    docsUrl: 'https://openrouter.ai/docs',
    supportsFreeTier: true,
  },
  groq: {
    signupUrl: 'https://console.groq.com/login',
    docsUrl: 'https://console.groq.com/docs/quickstart',
    supportsFreeTier: true,
  },
  google: {
    signupUrl: 'https://aistudio.google.com/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    supportsFreeTier: true,
  },
  openai: {
    signupUrl: 'https://platform.openai.com/signup',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    supportsFreeTier: false,
  },
  anthropic: {
    signupUrl: 'https://console.anthropic.com/',
    docsUrl: 'https://docs.anthropic.com/en/api/getting-started',
    supportsFreeTier: false,
  },
  mistral: {
    signupUrl: 'https://console.mistral.ai/',
    docsUrl: 'https://docs.mistral.ai/api/',
    supportsFreeTier: false,
  },
  together: {
    signupUrl: 'https://api.together.xyz/signup',
    docsUrl: 'https://docs.together.ai/docs/quickstart',
    supportsFreeTier: false,
  },
  deepseek: {
    signupUrl: 'https://platform.deepseek.com/signup',
    docsUrl: 'https://api-docs.deepseek.com/',
    supportsFreeTier: false,
  },
  cohere: {
    signupUrl: 'https://dashboard.cohere.com/welcome/register',
    docsUrl: 'https://docs.cohere.com/docs',
    supportsFreeTier: true,
  },
  opencode: {
    signupUrl: 'https://opencode.ai/',
    docsUrl: 'https://opencode.ai/docs',
    supportsFreeTier: true,
  },
  huggingface: {
    signupUrl: 'https://huggingface.co/settings/tokens',
    docsUrl: 'https://huggingface.co/docs/inference-providers/en/index',
    supportsFreeTier: true,
  },
};

export const cloudInferenceProviderIds = new Set(Object.keys(cloudProviderMeta));

const cloudDescription = (id: string, name: string): string => {
  const meta = cloudProviderMeta[id];
  if (!meta) return 'Cloud inference — add an API key on the server.';
  const tier = meta.supportsFreeTier ? 'Free tier available.' : 'Paid API.';
  return `${name} via :3445 provider keys. ${tier} Routing uses your key; off = fail closed.`;
};

/** Model-routing providers in Settings → Connections. */
export const providerSeed: Provider[] = [
  {
    id: 'local',
    name: 'Local runtime',
    lane: 'local',
    description: 'Runs ASI AMS Micro 70M, Hybrid 120M, and Agent chat on this device.',
    enabled: true,
    locked: true,
  },
  {
    id: 'relay',
    name: 'Escalation relay',
    lane: 'online',
    description: 'Chat 1B and Chat 3B off-device. Always shown as a handoff.',
    enabled: true,
  },
  ...(
    [
      ['openrouter', 'OpenRouter'],
      ['groq', 'Groq'],
      ['google', 'Google AI (Gemini)'],
      ['openai', 'OpenAI'],
      ['anthropic', 'Anthropic'],
      ['mistral', 'Mistral'],
      ['together', 'Together AI'],
      ['deepseek', 'DeepSeek'],
      ['cohere', 'Cohere'],
      ['opencode', 'OpenCode'],
      ['huggingface', 'Hugging Face'],
    ] as const
  ).map(([id, name]) => {
    const meta = cloudProviderMeta[id]!;
    return {
      id,
      name,
      lane: 'pro' as const,
      description: cloudDescription(id, name),
      enabled: false,
      signupUrl: meta.signupUrl,
      docsUrl: meta.docsUrl,
      supportsFreeTier: meta.supportsFreeTier,
    };
  }),
];

/** Legacy: integration-only stubs (not cloud inference registry). */
export const providerStubIds = new Set<string>(['elevenlabs', 'gmail']);

export type KeyProviderRow = {
  id: string;
  name: string;
  stub: boolean;
  signupUrl?: string;
  docsUrl?: string;
  supportsFreeTier?: boolean;
};

/** API key slots — cloud inference uses server `PUT /api/providers/keys`. */
export const keyProviders: KeyProviderRow[] = [
  ...providerSeed
    .filter((p) => p.lane === 'pro')
    .map((p) => ({
      id: p.id,
      name: p.name,
      stub: false,
      signupUrl: p.signupUrl,
      docsUrl: p.docsUrl,
      supportsFreeTier: p.supportsFreeTier,
    })),
  { id: 'elevenlabs', name: 'ElevenLabs', stub: true },
  { id: 'gmail', name: 'Gmail app password', stub: true },
];

const modelRoutingIds = new Set(providerSeed.filter((p) => p.lane === 'pro').map((p) => p.id));

/** Pro cloud rows for Settings → Models (subset of keyProviders — single source of truth). */
export const modelRoutingKeyProviders: KeyProviderRow[] = keyProviders.filter((p) =>
  modelRoutingIds.has(p.id),
);

export const apiKeySeed: ApiKey[] = [];

/**
 * When an API integration goes live, it exposes agent skills (registry `skills[]` / skill gates).
 * UI-only map — no skills are granted until the server wires the integration.
 */
export const apiToolSkillMap: {
  integrationId: IntegrationId;
  skillIds: string[];
  summary: string;
}[] = [
  {
    integrationId: 'gmail',
    skillIds: ['email-drafts', 'email-read'],
    summary: 'Gmail → draft-first mail skills',
  },
  {
    integrationId: 'imap',
    skillIds: ['email-read'],
    summary: 'IMAP → read-only mail skills',
  },
  {
    integrationId: 'elevenlabs',
    skillIds: ['voice-tts'],
    summary: 'ElevenLabs → cloud TTS skill (uses API key slot)',
  },
  {
    integrationId: 'cloud',
    skillIds: ['cloud-llm'],
    summary: 'Cloud LLM endpoint → Pro escalation skill',
  },
];

export const integrationSeed: Record<IntegrationId, IntegrationState> = {
  gmail: { enabled: false, connected: false },
  imap: { enabled: false, connected: false },
  elevenlabs: { enabled: false, connected: false },
  cloud: { enabled: false, connected: false },
};

export const orgTreeSeed: OrgNode[] = [];
