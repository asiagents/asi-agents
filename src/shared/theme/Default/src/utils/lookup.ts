import { agents } from '../data/agents';
import { builtinAgents } from '../data/builtinAgents';
import { modelLanes, models } from '../data/models';
import type { Agent } from '../types/agents';
import type { CoreModelId, ModelId, ModelInfo, ModelLane } from '../types/models';

export function getModel(id: ModelId): ModelInfo {
  const core = models.find((m) => m.id === id);
  if (core) {
    // Router UI slots are catalog recipes until the SLM router has live weights.
    if (id === 'micro' || id === 'hybrid' || id === 'agentchat' || id === 'ultra') {
      return {
        ...core,
        role: 'AMS recipe (not installed)',
        note: `${core.note} Catalog recipe — not a live generate target until weights / router are installed.`,
      };
    }
    return core;
  }
  if (typeof id === 'string' && id.startsWith('ams-gguf:')) {
    const name = id.slice('ams-gguf:'.length);
    return { id, name, role: 'AMS GGUF · on-device', tier: 'local', note: `Installed AMS weight: ${name}` };
  }
  if (typeof id === 'string' && id.startsWith('ams-onnx:')) {
    const name = id.slice('ams-onnx:'.length);
    return {
      id,
      name,
      role: 'AMS ONNX on disk',
      tier: 'local',
      note: `Installed AMS ONNX (not GGUF): ${name}. Reference router :7821 is Ollama/llama.cpp only — ONNX ready for a future hop.`,
    };
  }
  if (
    typeof id === 'string' &&
    (id.startsWith('ams-') || id === 'agent-chat-50-100m' || id === 'ultra-gate-1m')
  ) {
    const pretty =
      id === 'ams-micro-70m'
        ? 'ASI AMS Micro 70M'
        : id === 'ams-hybrid-120m'
          ? 'ASI AMS Hybrid 120M'
          : id === 'agent-chat-50-100m'
            ? 'ASI AMS Agent Chat (~50–100M)'
            : id;
    return {
      id,
      name: pretty,
      role: 'AMS recipe (not installed)',
      tier: 'status',
      note: 'Catalog recipe from models/ams — not a generate target until matching .gguf is on disk.',
    };
  }
  if (typeof id === 'string' && id.startsWith('ollama:')) {
    const name = id.slice('ollama:'.length);
    return { id, name, role: 'Ollama · on-device', tier: 'local', note: `Live tag: ${name}` };
  }
  if (typeof id === 'string' && id.startsWith('llamacpp:')) {
    const name = id.slice('llamacpp:'.length);
    return { id, name, role: 'llama.cpp · on-device', tier: 'local', note: `OpenAI-compat model: ${name}` };
  }
  if (typeof id === 'string' && id.startsWith('custom-')) {
    const name = id.slice('custom-'.length);
    return { id, name, role: 'GGUF · on-device', tier: 'local', note: `Scanned from models/custom` };
  }
  if (typeof id === 'string' && id.includes(':')) {
    const idx = id.indexOf(':');
    const provider = id.slice(0, idx);
    const name = id.slice(idx + 1) || id;
    const providerLabel =
      provider === 'openrouter' ? 'OpenRouter' :
      provider === 'ollama' ? 'Ollama' :
      provider === 'llamacpp' ? 'llama.cpp' :
      provider;
    return { id, name, role: `${providerLabel} · cloud`, tier: 'cloud', note: id };
  }
  // OpenRouter-style `org/model` ids — never fall through to AMS Micro.
  if (typeof id === 'string' && id.includes('/')) {
    const slash = id.lastIndexOf('/');
    const org = id.slice(0, slash);
    const name = id.slice(slash + 1) || id;
    return {
      id,
      name: name || id,
      role: org ? `OpenRouter · ${org}` : 'OpenRouter · cloud',
      tier: 'cloud',
      note: id,
    };
  }
  if (!id || (typeof id === 'string' && !id.trim())) {
    return { id: 'pending', name: 'Unassigned', role: 'No model', tier: 'edge', note: 'Assign a primary model' };
  }
  // Honest unknown — do not pretend the catalog default (AMS Micro) is selected.
  return {
    id,
    name: id,
    role: 'Saved pool · unknown source',
    tier: 'status',
    note: `Pool id “${id}” is not in the local catalog.`,
  };
}

/** Resolve by id from an optional live roster, else module roster, then builtins (Chief). */
export function getAgent(id: string, roster?: readonly Agent[]): Agent | undefined {
  const list = roster ?? agents;
  return list.find((a) => a.id === id) ?? builtinAgents.find((a) => a.id === id);
}

export function laneOf(id: ModelId): ModelLane | null {
  if (typeof id === 'string' && (id.startsWith('ollama:') || id.startsWith('llamacpp:') || id.startsWith('custom-'))) {
    return 'local';
  }
  const core = id as CoreModelId;
  return modelLanes.find((l) => l.ids.includes(core as (typeof modelLanes)[number]['ids'][number]))?.id ?? null;
}
