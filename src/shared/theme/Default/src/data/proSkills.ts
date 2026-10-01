import type { ProSkill } from '../types/pro';

/** Offline fallback when GET /api/skills/catalog is unavailable (subset of config/ams-skills.catalog.json). */
export const fallbackSkillCatalog: ProSkill[] = [
  { id: 'triage-notes', name: 'Triage notes', group: 'Health' },
  { id: 'dosage-check', name: 'Dosage check', group: 'Health' },
  { id: 'claims-coding', name: 'Claims coding', group: 'Health' },
  { id: 'budgeting', name: 'Budgeting', group: 'Money' },
  { id: 'spend-gates', name: 'Spend gates', group: 'Money' },
  { id: 'forecasting', name: 'Forecasting', group: 'Money' },
  { id: 'tax-prep', name: 'Tax prep', group: 'Money' },
  { id: 'contract-review', name: 'Contract review', group: 'Legal' },
  { id: 'case-law', name: 'Case-law search', group: 'Legal' },
  { id: 'citations', name: 'Citations', group: 'Research' },
  { id: 'lit-review', name: 'Literature review', group: 'Research' },
  { id: 'literature', name: 'Literature search', group: 'Research' },
  { id: 'stats', name: 'Statistics', group: 'Research' },
  { id: 'data-cleaning', name: 'Data cleaning', group: 'Research' },
  { id: 'lesson-plans', name: 'Lesson plans', group: 'Teaching' },
  { id: 'quiz-gen', name: 'Quiz builder', group: 'Teaching' },
  { id: 'code-review', name: 'Code review', group: 'Build' },
  { id: 'test-writing', name: 'Test writing', group: 'Build' },
  { id: 'shell-sandbox', name: 'Shell (sandbox)', group: 'Build' },
  { id: 'ui-mockups', name: 'UI mockups', group: 'Create' },
  { id: 'slides', name: 'Slides & decks', group: 'Create' },
  { id: 'brand-voice', name: 'Brand voice', group: 'Create' },
  { id: 'story', name: 'Story drafting', group: 'Create' },
  { id: 'lore', name: 'Lore building', group: 'Create' },
  { id: 'seo', name: 'SEO audit', group: 'Grow' },
  { id: 'scheduling', name: 'Scheduling', group: 'Ops' },
  { id: 'mail-triage', name: 'Mail triage', group: 'Ops' },
  { id: 'travel', name: 'Travel planning', group: 'Life' },
];

/** @deprecated Use ProContext `skillsCatalog` from GET /api/skills/catalog */
export const skillCatalog = fallbackSkillCatalog;
