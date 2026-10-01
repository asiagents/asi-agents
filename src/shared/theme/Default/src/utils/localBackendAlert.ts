import type { ModelsScanMeta } from '@asi-api';

export type LocalBackendAlertSeverity = 'warn' | 'danger';

export type LocalBackendAlert = {
  /** Stable id for toast dedupe (kind + host). */
  id: string;
  severity: LocalBackendAlertSeverity;
  title: string;
  detail: string;
  suggestions: string[];
};

const TITLE_VARIANTS: Record<string, string[]> = {
  ollama_down: [
    'Ollama is not reachable',
    'Local Ollama looks down',
    'Cannot reach Ollama',
  ],
  ollama_empty: [
    'Ollama has no models pulled',
    'Ollama is up — tag list empty',
    'No Ollama chat models yet',
  ],
  llama_down: [
    'llama.cpp is not reachable',
    'OpenAI-compat host looks down',
    'Cannot reach llama.cpp',
  ],
  api_down: [
    'Models API unreachable',
    'ASI server scan failed',
    'Cannot scan local models',
  ],
};

function pickVariant(key: string, variants: string[], seedKey: string): string {
  const list = TITLE_VARIANTS[key] ?? variants;
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) | 0;
  const i = Math.abs(h) % list.length;
  return list[i] ?? variants[0] ?? key;
}

/**
 * Honest alert from GET /api/models probe meta.
 * Shows when Ollama is down / empty, or configured llama.cpp is down — never fakes "live".
 */
export function alertFromScanMeta(
  meta: ModelsScanMeta | null | undefined,
  unreachable: boolean
): LocalBackendAlert | null {
  if (unreachable || !meta?.probes) {
    const id = 'api_down';
    return {
      id,
      severity: 'danger',
      title: pickVariant('api_down', TITLE_VARIANTS.api_down, id),
      detail: 'Model status could not be read — chats fail closed until the ASI server on :3445 answers.',
      suggestions: [
        'Start the ASI server (`npm run start` / `npm run dev`)',
        'Then open Settings → Models and Scan',
      ],
    };
  }

  const { ollama, llamacpp } = meta.probes;

  if (!ollama.reachable) {
    const id = `ollama_down:${ollama.host}`;
    return {
      id,
      severity: 'danger',
      title: pickVariant('ollama_down', TITLE_VARIANTS.ollama_down, id),
      detail: `Ollama at ${ollama.host} did not answer${ollama.error ? ` (${ollama.error})` : ''}. Local generate stays fail-closed — nothing is marked live.`,
      suggestions: [
        'Start Ollama (`ollama serve` or the tray app)',
        'If Ollama is on another host / Docker / WSL, set OLLAMA_HOST',
        'Scan models again in Settings → Models',
        'Restart the ASI server if the probe still fails',
      ],
    };
  }

  if (ollama.reachable && ollama.count === 0) {
    const id = `ollama_empty:${ollama.host}`;
    return {
      id,
      severity: 'warn',
      title: pickVariant('ollama_empty', TITLE_VARIANTS.ollama_empty, id),
      detail: `Ollama is reachable at ${ollama.host}, but no tags are installed yet.`,
      suggestions: [
        'Pull a chat model (`ollama pull …`)',
        'Scan models in Settings → Models',
      ],
    };
  }

  if (llamacpp.configured && !llamacpp.reachable) {
    const id = `llama_down:${llamacpp.base ?? 'configured'}`;
    return {
      id,
      severity: 'danger',
      title: pickVariant('llama_down', TITLE_VARIANTS.llama_down, id),
      detail: `llama.cpp / OpenAI-compat at ${llamacpp.base ?? '(configured)'} is unreachable${llamacpp.error ? ` (${llamacpp.error})` : ''}.`,
      suggestions: [
        'Start llama.cpp or LM Studio on that host',
        'Confirm LLAMA_CPP_HOST / OPENAI_BASE_URL',
        'Scan models again',
      ],
    };
  }

  return null;
}
