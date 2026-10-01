import type { ModelCard } from '@asi-api';
import { providerSeed } from '../data/settings';
import { isScannedModel } from './modelScanBridge';

const providerNameById = new Map(providerSeed.map((p) => [p.id, p.name]));

/** Honest routing label for a scanned/API model card — no fake “connected” state. */
export function modelBackendLabel(card: ModelCard): { lane: 'local' | 'cloud'; label: string } {
  const providerId = card.provider?.trim();
  if (providerId) {
    const name = providerNameById.get(providerId) ?? providerId;
    return { lane: 'cloud', label: name };
  }

  if (isScannedModel(card)) {
    return { lane: 'local', label: 'Local GGUF' };
  }

  const localHint =
    card.tags.includes('local') ||
    card.tags.includes('showcase') ||
    card.source === 'in-house' ||
    card.source === 'drop-in';

  if (localHint) {
    return { lane: 'local', label: 'Local / Ollama' };
  }

  return { lane: 'cloud', label: 'Cloud API' };
}
