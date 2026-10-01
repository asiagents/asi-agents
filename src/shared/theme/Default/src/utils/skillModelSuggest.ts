import { deskCoreModels } from '../data/modelCatalog';

const CORE_IDS = new Set<string>(
  deskCoreModels.flatMap((m) => (m.coreId ? [m.coreId, m.id] : [m.id])),
);

/** Optional catalog capability hints — only used when source models are not assignable desk ids. */
const SKILL_CAPABILITY_HINTS: Record<string, string> = {
  'code-review': 'code',
  'test-writing': 'code',
  'shell-sandbox': 'code',
  'ui-mockups': 'vision',
  'slides': 'documents',
  citations: 'chat',
  'lit-review': 'chat',
  'data-cleaning': 'chat',
};

export type ModelSuggestion = {
  primaryModelId: string | null;
  secondaryModelId: string | null;
  rationale: string;
  catalogHint?: string;
};

function asAssignable(id: string | null | undefined): string | null {
  if (!id || !CORE_IDS.has(id)) return null;
  return id;
}

/** Suggest primary/secondary for PATCH /api/agents/:id/models — never invents ids. */
export function suggestModelsForSkillImport(opts: {
  skillId: string;
  sourcePrimary: string | null;
  sourceSecondary: string | null;
}): ModelSuggestion {
  const primary = asAssignable(opts.sourcePrimary);
  const secondary = asAssignable(opts.sourceSecondary);
  if (primary) {
    return {
      primaryModelId: primary,
      secondaryModelId: secondary && secondary !== primary ? secondary : null,
      rationale: 'Copied from the source agent’s desk-assignable models.',
    };
  }
  const cap = SKILL_CAPABILITY_HINTS[opts.skillId];
  if (cap) {
    return {
      primaryModelId: null,
      secondaryModelId: null,
      rationale: 'Source model is not a desk core id — pick models manually or browse the catalog.',
      catalogHint: cap,
    };
  }
  return {
    primaryModelId: null,
    secondaryModelId: null,
    rationale: 'No automatic model mapping for this skill.',
  };
}

export function isAssignableModelId(id: string): boolean {
  return CORE_IDS.has(id);
}
