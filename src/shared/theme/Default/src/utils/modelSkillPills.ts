import type { CatalogModel } from '../data/modelCatalog';
import type { ModelCard } from '@asi-api';
import {
  inferAssignmentRoles,
  type AssignmentRoleFilter,
} from './assignmentModelOptions';

const ROLE_LABEL: Record<AssignmentRoleFilter, string> = {
  coding: 'coding',
  vision: 'vision',
  embed: 'embed',
  agentic: 'agentic',
  chat: 'chat',
};

/** Re-export size helper for callers that still import it from here. */
export { inferModelSizeLabel } from './modelParamsRam';

/** Compact skill / capability pills for Browse model rows (skills only — not params). */
export function modelSkillPills(card: ModelCard | CatalogModel): string[] {
  const isCard = 'meta' in card;
  const id = card.id;
  const name = card.name;
  const tags = isCard ? (card.tags ?? []) : [];
  const roles = inferAssignmentRoles(id, name, tags);
  const pills = roles.map((r) => ROLE_LABEL[r]);

  // Extra display chips from scan tags / family heuristics (not assignment filters).
  const hay = `${id} ${name} ${tags.join(' ')}`.toLowerCase();
  if (/\btools?\b|function.?call|hermes/.test(hay) && !pills.includes('tools')) pills.push('tools');
  if (/\breason|deepseek-r1|\bo1\b|\bo3\b|qwq/.test(hay) && !pills.includes('reasoning')) {
    pills.push('reasoning');
  }
  if (/\baudio|whisper|tts|stt|speech/.test(hay) && !pills.includes('audio')) pills.push('audio');

  const seen = new Set<string>();
  return pills.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** True when the card matches any of the active skill role filters (OR). Empty set = pass. */
export function passesSkillRoleFilters(
  card: ModelCard | CatalogModel,
  roles: Set<AssignmentRoleFilter>
): boolean {
  if (roles.size === 0) return true;
  const isCard = 'meta' in card;
  const tags = isCard ? (card.tags ?? []) : [];
  const inferred = inferAssignmentRoles(card.id, card.name, tags);
  return inferred.some((r) => roles.has(r));
}
