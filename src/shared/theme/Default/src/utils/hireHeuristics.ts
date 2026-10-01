/**
 * Client-side hire skill heuristics (mirrors server hireHeuristics — no LLM).
 * Used to auto-suggest AMS skill ids as the user types role/brief.
 */

const ROLE_SKILL_DEFAULTS: Record<string, string[]> = {
  travel: ['travel'],
  finance: ['budgeting', 'spend-gates', 'forecasting'],
  money: ['budgeting', 'spend-gates', 'invoicing'],
  coding: ['code-review', 'shell-sandbox', 'test-writing'],
  code: ['code-review', 'shell-sandbox', 'test-writing'],
  build: ['code-review', 'shell-sandbox', 'test-writing'],
  research: ['citations', 'literature', 'lit-review'],
  design: ['ui-mockups', 'slides', 'brand-voice'],
  create: ['ui-mockups', 'slides', 'story'],
  writer: ['story', 'brand-voice', 'proposal-draft'],
  writing: ['story', 'brand-voice', 'proposal-draft'],
  legal: ['contract-review', 'case-law', 'nda-draft'],
  health: ['triage-notes', 'care-plans', 'symptom-triage'],
  teaching: ['lesson-plans', 'quiz-gen'],
  ops: ['scheduling', 'mail-triage', 'ticket-summarize'],
  marketing: ['seo', 'brand-voice', 'slides'],
  council: ['citations', 'ticket-summarize', 'proposal-draft'],
};

const SKILL_HINTS: { words: string[]; skills: string[] }[] = [
  { words: ['code', 'coding', 'software', 'engineer', 'dev', 'debug', 'refactor'], skills: ['code-review', 'shell-sandbox', 'test-writing'] },
  { words: ['research', 'cite', 'literature', 'survey', 'investigate', 'analyst', 'brief'], skills: ['citations', 'literature', 'lit-review'] },
  { words: ['finance', 'budget', 'money', 'invoice', 'payroll', 'tax', 'spend', 'forecast'], skills: ['budgeting', 'spend-gates', 'forecasting', 'invoicing'] },
  { words: ['travel', 'trip', 'itinerary', 'flight', 'hotel'], skills: ['travel'] },
  { words: ['design', 'ui', 'ux', 'mockup', 'figma', 'visual'], skills: ['ui-mockups', 'slides', 'brand-voice'] },
  { words: ['write', 'writing', 'draft', 'copy', 'blog', 'story', 'editor'], skills: ['story', 'brand-voice', 'proposal-draft'] },
  { words: ['legal', 'contract', 'law', 'nda', 'compliance'], skills: ['contract-review', 'case-law', 'nda-draft'] },
  { words: ['health', 'medical', 'clinic', 'patient', 'care'], skills: ['triage-notes', 'care-plans', 'symptom-triage'] },
  { words: ['teach', 'lesson', 'tutor', 'quiz', 'classroom'], skills: ['lesson-plans', 'quiz-gen'] },
  { words: ['ops', 'schedule', 'mail', 'ticket', 'support'], skills: ['scheduling', 'mail-triage', 'ticket-summarize'] },
  { words: ['market', 'seo', 'growth', 'campaign'], skills: ['seo', 'brand-voice', 'slides'] },
  { words: ['data', 'stats', 'clean', 'analy'], skills: ['stats', 'data-cleaning'] },
];

function haystack(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

/** Suggest AMS skill ids from role + brief (filter against knownCatalog when provided). */
export function suggestHireSkills(opts: {
  role?: string;
  brief?: string;
  knownCatalogIds?: string[];
  limit?: number;
}): string[] {
  const limit = Math.min(12, Math.max(1, opts.limit ?? 4));
  const roleKey = (opts.role ?? '').trim().toLowerCase();
  const text = haystack(opts.role, opts.brief);
  const scores = new Map<string, number>();
  const bump = (id: string, n: number) => scores.set(id, (scores.get(id) ?? 0) + n);

  if (roleKey && ROLE_SKILL_DEFAULTS[roleKey]) {
    for (const id of ROLE_SKILL_DEFAULTS[roleKey]) bump(id, 5);
  } else if (roleKey) {
    for (const [key, ids] of Object.entries(ROLE_SKILL_DEFAULTS)) {
      if (roleKey.includes(key) || key.includes(roleKey.split(/\s+/)[0] ?? '')) {
        for (const id of ids) bump(id, 4);
      }
    }
  }

  for (const row of SKILL_HINTS) {
    let hits = 0;
    for (const w of row.words) {
      if (text.includes(w)) hits += 1;
    }
    if (hits > 0) {
      for (const id of row.skills) bump(id, hits);
    }
  }

  let ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (opts.knownCatalogIds?.length) {
    const known = new Set(opts.knownCatalogIds);
    ranked = ranked.filter(([id]) => known.has(id));
  }
  return ranked.slice(0, limit).map(([id]) => id);
}

/** Parse "Name (role)" into parts. */
export function parseNameRoleInput(raw: string): { name: string; role?: string } {
  const s = raw.trim();
  const m = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!m) return { name: s.slice(0, 64) };
  const name = m[1]!.trim().slice(0, 64);
  const role = m[2]!.trim().slice(0, 120);
  return role ? { name: name || s.slice(0, 64), role } : { name: name || s.slice(0, 64) };
}

export function formatNameRolePreview(name: string, role?: string): string {
  const n = name.trim();
  const r = (role ?? '').trim();
  if (!n) return r ? `(${r})` : '';
  return r ? `${n} (${r})` : n;
}

export type HireModelRole = 'coding' | 'vision' | 'agentic' | 'chat';

export function inferHireModelRoleClient(role?: string, brief?: string, skills: string[] = []): HireModelRole {
  const text = haystack(role, brief, skills.join(' '));
  if (/code|coding|build|shell|test|dev|engineer|refactor/.test(text)) return 'coding';
  if (/vision|image|ui|mockup|design|visual|slide/.test(text)) return 'vision';
  if (/agent|router|orchestr|council|tool/.test(text)) return 'agentic';
  return 'chat';
}

function modelLooksLike(id: string, want: HireModelRole): boolean {
  const hay = id.toLowerCase();
  if (want === 'coding') return /code|coder|starcoder|codellama|codestral|deepseek|qwen.*coder/i.test(hay);
  if (want === 'vision') return /llava|vision|moondream|pixtral|vl-|minicpm-v/i.test(hay);
  if (want === 'agentic') return /micro|hybrid|agentchat|router|ams-/i.test(hay);
  return !/embed|whisper|tts|lyria|musicgen/i.test(hay);
}

/** Pick a model id from the saved Browse pool (local only). */
export function pickModelFromPoolClient(opts: {
  poolIds: string[];
  role?: string;
  brief?: string;
  skills?: string[];
}): string | null {
  const pool = opts.poolIds.filter((id) => id.trim());
  if (!pool.length) return null;
  const want = inferHireModelRoleClient(opts.role, opts.brief, opts.skills ?? []);
  const preferred = pool.filter((id) => modelLooksLike(id, want));
  const chatish = pool.filter((id) => modelLooksLike(id, 'chat'));
  return (preferred[0] ?? chatish[0] ?? pool[0]) ?? null;
}
