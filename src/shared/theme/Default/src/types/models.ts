export type CoreModelId =
'micro' |
'hybrid' |
'ultra' |
'agentchat' |
'chat1b' |
'chat3b' |
'cloud' |
'pending' |
'offline';

/** Scanned runtime ids from GET /api/models (ollama:, llamacpp:, custom-). */
export type ScannedModelId = `ollama:${string}` | `llamacpp:${string}` | `custom-${string}`;

export type ModelId = CoreModelId | ScannedModelId;

export type ModelTier = 'local' | 'edge' | 'escalate' | 'cloud' | 'status';

export type ModelLane = 'local' | 'online' | 'pro';

export interface ModelInfo {
  id: ModelId;
  name: string;
  role: string;
  tier: ModelTier;
  note: string;
}

export interface ModelLaneInfo {
  id: ModelLane;
  label: string;
  description: string;
  ids: ModelId[];
}