/** Known Hugging Face pages for AMS product models (vvarghese). */
export const AMS_HF_ORG = 'https://huggingface.co/vvarghese';

const AMS_HF_BY_ID: Record<string, string> = {
  'ams-micro-70m': `${AMS_HF_ORG}/ams-micro-70m`,
  'ams-hybrid-120m': `${AMS_HF_ORG}/ams-hybrid-120m`,
  'ams-agent-chat': AMS_HF_ORG,
  'agent-chat-50-100m': AMS_HF_ORG,
  'ams-ultra-gate': AMS_HF_ORG,
  'ultra-gate-1m': AMS_HF_ORG,
};

/** Specific model page when known; otherwise the vvarghese org. */
export function amsHfUrl(id?: string | null): string {
  const key = String(id ?? '').trim();
  if (key && AMS_HF_BY_ID[key]) return AMS_HF_BY_ID[key];
  return AMS_HF_ORG;
}

export function isAmsRouterRecipeId(id?: string | null): boolean {
  const key = String(id ?? '').trim();
  return key === 'ams-micro-70m' || key === 'ams-hybrid-120m';
}

export function isAmsRecipeId(id?: string | null): boolean {
  const key = String(id ?? '').trim();
  return (
    key.startsWith('ams-') ||
    key === 'agent-chat-50-100m' ||
    key === 'ultra-gate-1m' ||
    Boolean(AMS_HF_BY_ID[key])
  );
}

/** Place-into path shown when GGUF must be dropped manually. */
export const AMS_PLACE_PATH = 'models/ams/';
