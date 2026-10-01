import type { ModelId } from '../types/models';

export type CatalogStatus = 'online' | 'offline' | 'dead';
export type CatalogLane = 'local' | 'online' | 'pro';

export interface CatalogModel {
  id: string;
  name: string;
  provider: string;
  providerId?: string;
  lane: CatalogLane;
  baseStatus: CatalogStatus;
  params: string;
  paramsM: number;
  latencyMs: number;
  encrypted: boolean;
  /** `core` = desk router ids only (assignments). `downloadable` = HF/Ollama recipes. Not shown as installed scans. */
  source: 'scanned' | 'downloadable' | 'api' | 'core';
  coreId?: ModelId;
  note: string;
  /** Real Hugging Face repo id when recommending a download. */
  hfRepo?: string;
  /** `ollama pull …` when applicable. */
  ollamaPull?: string;
}

/** Internal desk model ids — not mixed into Browse as fake scans. */
export const deskCoreModels: CatalogModel[] = [
  {
    id: 'micro',
    name: 'Desk micro router',
    provider: 'Local desk',
    lane: 'local',
    baseStatus: 'online',
    params: '70M',
    paramsM: 70,
    latencyMs: 18,
    encrypted: false,
    source: 'core',
    coreId: 'micro',
    note: 'Default local router slot in desk config.',
  },
  {
    id: 'hybrid',
    name: 'Desk hybrid router',
    provider: 'Local desk',
    lane: 'local',
    baseStatus: 'online',
    params: '120M',
    paramsM: 120,
    latencyMs: 32,
    encrypted: false,
    source: 'core',
    coreId: 'hybrid',
    note: 'Optional larger local router slot.',
  },
  {
    id: 'agentchat',
    name: 'Agent chat slot',
    provider: 'Local desk',
    lane: 'local',
    baseStatus: 'online',
    params: '~80M',
    paramsM: 80,
    latencyMs: 24,
    encrypted: false,
    source: 'core',
    coreId: 'agentchat',
    note: 'Short specialist replies.',
  },
  {
    id: 'chat1b',
    name: 'Escalation 1B slot',
    provider: 'Relay',
    providerId: 'relay',
    lane: 'online',
    baseStatus: 'online',
    params: '1B',
    paramsM: 1000,
    latencyMs: 180,
    encrypted: true,
    source: 'core',
    coreId: 'chat1b',
    note: 'Handoff target id — wire to a real API model in assignments.',
  },
  {
    id: 'chat3b',
    name: 'Escalation 3B slot',
    provider: 'Relay',
    providerId: 'relay',
    lane: 'online',
    baseStatus: 'online',
    params: '3B',
    paramsM: 3000,
    latencyMs: 260,
    encrypted: true,
    source: 'core',
    coreId: 'chat3b',
    note: 'Handoff target id — wire to a real API model in assignments.',
  },
  {
    id: 'cloud',
    name: 'Cloud escalation slot',
    provider: 'Pro API',
    lane: 'pro',
    baseStatus: 'online',
    params: '—',
    paramsM: 0,
    latencyMs: 400,
    encrypted: true,
    source: 'core',
    coreId: 'cloud',
    note: 'Uses configured provider keys — not a model name.',
  },
];

/**
 * Real public model names (Hugging Face / Ollama). Shown as download recipes only until scan lists them.
 */
export const hfDownloadCatalog: CatalogModel[] = [
  {
    id: 'hf-qwen2.5-1.5b-instruct',
    name: 'Qwen2.5-1.5B-Instruct',
    provider: 'Hugging Face',
    lane: 'local',
    baseStatus: 'offline',
    params: '1.5B',
    paramsM: 1500,
    latencyMs: 90,
    encrypted: false,
    source: 'downloadable',
    hfRepo: 'Qwen/Qwen2.5-1.5B-Instruct',
    ollamaPull: 'qwen2.5:1.5b-instruct',
    note: 'Small instruct model; good on CPU with Q4 GGUF or Ollama.',
  },
  {
    id: 'hf-phi-3-mini',
    name: 'Phi-3-mini-4k-instruct',
    provider: 'Hugging Face',
    lane: 'local',
    baseStatus: 'offline',
    params: '3.8B',
    paramsM: 3800,
    latencyMs: 160,
    encrypted: false,
    source: 'downloadable',
    hfRepo: 'microsoft/Phi-3-mini-4k-instruct',
    ollamaPull: 'phi3:mini',
    note: 'Microsoft small instruct; ~4 GB RAM for Q4.',
  },
  {
    id: 'hf-llama-3.2-3b',
    name: 'Llama-3.2-3B-Instruct',
    provider: 'Hugging Face',
    lane: 'local',
    baseStatus: 'offline',
    params: '3B',
    paramsM: 3000,
    latencyMs: 140,
    encrypted: false,
    source: 'downloadable',
    hfRepo: 'meta-llama/Llama-3.2-3B-Instruct',
    ollamaPull: 'llama3.2:3b',
    note: 'Meta instruct; accept HF license on first download.',
  },
  {
    id: 'hf-mistral-7b',
    name: 'Mistral-7B-Instruct-v0.3',
    provider: 'Hugging Face',
    lane: 'local',
    baseStatus: 'offline',
    params: '7B',
    paramsM: 7000,
    latencyMs: 220,
    encrypted: false,
    source: 'downloadable',
    hfRepo: 'mistralai/Mistral-7B-Instruct-v0.3',
    ollamaPull: 'mistral:7b-instruct',
    note: 'Strong 7B; prefer GPU or Q4 GGUF.',
  },
  {
    id: 'hf-llava',
    name: 'LLaVA 1.6 (Mistral 7B)',
    provider: 'Hugging Face · vision',
    lane: 'local',
    baseStatus: 'offline',
    params: '7B + vision',
    paramsM: 7000,
    latencyMs: 280,
    encrypted: false,
    source: 'downloadable',
    hfRepo: 'llava-hf/llava-v1.6-mistral-7b-hf',
    ollamaPull: 'llava',
    note: 'Image + chat; needs vision-capable runtime.',
  },
  {
    id: 'hf-nomic-embed',
    name: 'nomic-embed-text-v1.5',
    provider: 'Hugging Face · embed',
    lane: 'local',
    baseStatus: 'offline',
    params: 'embed',
    paramsM: 0,
    latencyMs: 40,
    encrypted: false,
    source: 'downloadable',
    hfRepo: 'nomic-ai/nomic-embed-text-v1.5',
    ollamaPull: 'nomic-embed-text',
    note: 'Embeddings for RAG — not a chat model.',
  },
  {
    id: 'hf-whisper',
    name: 'Whisper large v3',
    provider: 'Hugging Face · audio',
    lane: 'local',
    baseStatus: 'offline',
    params: 'STT',
    paramsM: 0,
    latencyMs: 120,
    encrypted: false,
    source: 'downloadable',
    hfRepo: 'openai/whisper-large-v3',
    ollamaPull: 'whisper',
    note: 'Speech-to-text; use Ollama or faster-whisper locally.',
  },
];

/** Union for lookups (assignments, labels). */
export const modelCatalog: CatalogModel[] = [...deskCoreModels, ...hfDownloadCatalog];
