import type { ModelCard } from '@asi-api';
import { deskCoreModels, hfDownloadCatalog } from '../data/modelCatalog';
import { modelLabel } from './modelScanBridge';
import { passesScanBrowseFilters, type BrowseFilterId, isApiScanCard, isLocalScanCard } from './modelBrowseFilters';

export type AssignmentRoleFilter =
  | 'coding'
  | 'vision'
  | 'embed'
  | 'agentic'
  | 'chat';

export const ASSIGNMENT_ROLE_FILTERS: { id: AssignmentRoleFilter; label: string }[] = [
  { id: 'agentic', label: 'Agentic / router' },
  { id: 'coding', label: 'Coding' },
  { id: 'vision', label: 'Vision' },
  { id: 'embed', label: 'Embed' },
  { id: 'chat', label: 'Chat' },
];

export type AssignmentModelOption = {
  id: string;
  label: string;
  tags: string[];
  kind: 'scanned' | 'core' | 'recipe';
};

/** Music / audio gen / TTS / image-video — not assignable as chat backends. */
const NON_CHAT_MODEL_RE =
  /lyria|musicgen|stable-?audio|riffusion|suno|udio\b|elevenlabs|eleven.?labs|bark\b|tts\b|whisper|speech.?to.?text|text.?to.?speech|vocode|melody|soundgen|audio\/|\/audio|imagen|dall-?e|stable.?diffusion|midjourney|flux\.|runway|veo-|sora\b|video.?gen|text->audio|text-to-audio/i;

export function isNonChatAssignableModel(id: string, name = '', tags: string[] = []): boolean {
  const hay = `${id} ${name} ${tags.join(' ')}`;
  if (NON_CHAT_MODEL_RE.test(hay)) return true;
  return tags.some((t) => /^(audio|music|tts|stt|image-gen|video)$/i.test(t));
}

/** Infer skill roles from id/name/tags for Browse rows and assignment filters. */
export function inferAssignmentRoles(
  id: string,
  name: string,
  tags: string[]
): AssignmentRoleFilter[] {
  const hay = `${id} ${name}`.toLowerCase();
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  const roles: AssignmentRoleFilter[] = [];
  if (isNonChatAssignableModel(id, name, tags)) return roles;
  if (
    tagSet.has('embed') ||
    tags.includes('embed') ||
    /embed|nomic-embed|mxbai-embed|bge-|e5-/i.test(hay)
  ) {
    roles.push('embed');
  }
  if (
    tagSet.has('vision') ||
    tags.includes('vision') ||
    /llava|vision|moondream|pixtral|bakllava|vl-|llama3\.2-vision|qwen2-vl|minicpm-v/i.test(hay)
  ) {
    roles.push('vision');
  }
  if (
    tagSet.has('coding') ||
    tags.includes('coding') ||
    /code|coder|deepseek-r1|starcoder|codellama|qwen.*coder|codestral/i.test(hay)
  ) {
    roles.push('coding');
  }
  if (
    tagSet.has('agentic') ||
    tags.includes('agentic') ||
    /micro|hybrid|agentchat|router|ams-micro|ams-hybrid/i.test(hay) ||
    id === 'micro' ||
    id === 'hybrid' ||
    id === 'agentchat'
  ) {
    roles.push('agentic');
  }
  if (tagSet.has('chat') || tags.includes('chat')) roles.push('chat');
  if (roles.length === 0 && !roles.includes('embed')) roles.push('chat');
  else if (
    !roles.includes('embed') &&
    !roles.includes('chat') &&
    (roles.includes('vision') || roles.includes('coding') || roles.includes('agentic'))
  ) {
    roles.push('chat');
  }
  return roles;
}

/** Merge live scan ids with desk router slots (never hide Ollama tags from GET /api/models). */
export function buildAssignmentModelOptions(scanned: ModelCard[]): AssignmentModelOption[] {
  const map = new Map<string, AssignmentModelOption>();

  for (const m of scanned) {
    if (isNonChatAssignableModel(m.id, m.name, m.tags ?? [])) continue;
    map.set(m.id, {
      id: m.id,
      label: m.name,
      tags: m.tags ?? [],
      kind: 'scanned',
    });
  }

  for (const row of deskCoreModels) {
    const id = row.coreId ?? row.id;
    if (!map.has(id)) {
      map.set(id, { id, label: row.name, tags: ['local', 'router'], kind: 'core' });
    }
  }

  for (const row of hfDownloadCatalog) {
    const id = row.coreId ?? row.id;
    if (isNonChatAssignableModel(id, row.name ?? '', [])) continue;
    if (!map.has(id)) {
      map.set(id, { id, label: modelLabel(id), tags: ['recipe'], kind: 'recipe' });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function filterAssignmentOptions(
  options: AssignmentModelOption[],
  scannedById: Map<string, ModelCard>,
  browse: Set<BrowseFilterId>,
  roles: Set<AssignmentRoleFilter>,
  query: string
): AssignmentModelOption[] {
  const q = query.trim().toLowerCase();
  return options.filter((opt) => {
    if (isNonChatAssignableModel(opt.id, opt.label, opt.tags)) return false;
    if (q && !`${opt.id} ${opt.label}`.toLowerCase().includes(q)) return false;

    const card = scannedById.get(opt.id);
    if (browse.size > 0) {
      if (card) {
        if (!passesScanBrowseFilters(card, browse)) return false;
      } else if (browse.has('api') && !browse.has('local')) {
        return false;
      }
    }

    if (roles.size > 0) {
      const inferred = inferAssignmentRoles(opt.id, opt.label, opt.tags);
      const ok = inferred.some((r) => roles.has(r));
      if (!ok) return false;
    }

    return true;
  });
}

/** Options limited to the Browse multi-select pool (plus any extras for labels if needed). */
export function buildPoolAssignmentOptions(
  scanned: ModelCard[],
  poolIds: string[]
): AssignmentModelOption[] {
  if (poolIds.length === 0) return [];
  const all = buildAssignmentModelOptions(scanned);
  const byId = new Map(all.map((o) => [o.id, o]));
  const out: AssignmentModelOption[] = [];
  for (const id of poolIds) {
    if (isNonChatAssignableModel(id)) continue;
    const existing = byId.get(id);
    if (existing) {
      out.push(existing);
      continue;
    }
    out.push({ id, label: modelLabel(id), tags: [], kind: 'recipe' });
  }
  return out;
}

export function isLocalFreeCard(m: ModelCard): boolean {
  if (m.paid === true) return false;
  return isLocalScanCard(m);
}

export function isOnlineFreeCard(m: ModelCard): boolean {
  if (m.paid === true) return false;
  return isApiScanCard(m);
}

/**
 * Distribute selected free local + free online mix across agents (seed-script style).
 * Falls back to the full pool when no free split is available.
 */
export function buildAutoAssignments(
  agentIds: string[],
  poolCards: ModelCard[]
): Record<string, { primary: string; secondary?: string }> {
  const chatPool = poolCards.filter((m) => !isNonChatAssignableModel(m.id, m.name, m.tags ?? []));
  const localFree = chatPool.filter(isLocalFreeCard);
  const onlineFree = chatPool.filter(isOnlineFreeCard);
  const anyPool = chatPool;
  const localPool = localFree.length ? localFree : onlineFree.length ? onlineFree : anyPool;
  const onlinePool = onlineFree.length ? onlineFree : localFree.length ? localFree : anyPool;
  if (!localPool.length && !onlinePool.length) return {};

  const out: Record<string, { primary: string; secondary?: string }> = {};
  for (let i = 0; i < agentIds.length; i++) {
    const id = agentIds[i]!;
    const useLocal = i % 2 === 0;
    const primaryPool = useLocal ? localPool : onlinePool;
    const secondaryPool = useLocal ? onlinePool : localPool;
    if (!primaryPool.length) continue;
    const primary = primaryPool[i % primaryPool.length]!.id;
    const secondary =
      secondaryPool.length > 0 ? secondaryPool[(i + 1) % secondaryPool.length]!.id : undefined;
    out[id] = {
      primary,
      ...(secondary && secondary !== primary ? { secondary } : {}),
    };
  }
  return out;
}
