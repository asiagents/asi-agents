import type { Agent } from '../types/agents';

export type ResearchType =
  | 'quick'
  | 'deep'
  | 'predictive'
  | 'literature'
  | 'factcheck'
  | 'compare';
export type ResearchDepth = '5m' | '15m' | '30m' | 'thorough';
export type ResearchSelection = 'cited' | 'consensus' | 'newest' | 'balanced';
export type ResearchFormat = 'bullets' | 'memo' | 'citations' | 'executive';

export interface ResearchBriefValues {
  type: ResearchType;
  depth: ResearchDepth;
  selection: ResearchSelection;
  format: ResearchFormat;
  participate: boolean;
  /** Cap for deep / predictive multi-agent fan-out (server also caps via env). */
  maxVirtualAgents: number;
  /** When true, research uses Virtual Desk browser for live pages (fail-closed if Desk offline). */
  liveWeb: boolean;
}

/** Default concurrent virtual-agent cap shown in the brief sheet. */
export const DEFAULT_MAX_VIRTUAL_AGENTS = 6;

export const RESEARCH_TYPE_OPTIONS: { id: ResearchType; label: string; hint: string }[] = [
  { id: 'quick', label: 'Quick scan', hint: 'Single-agent, fast answers' },
  {
    id: 'deep',
    label: 'Deep research (multi-agent)',
    hint: 'Fan-out across Free OpenRouter + Ollama from your model pool',
  },
  {
    id: 'predictive',
    label: 'Predictive research',
    hint: 'Forecast, scenarios, leading indicators via multi-agent fan-out',
  },
  { id: 'literature', label: 'Literature', hint: 'Papers & citations' },
  { id: 'factcheck', label: 'Fact-check', hint: 'Verify a claim' },
  { id: 'compare', label: 'Compare', hint: 'Side-by-side options' },
];

/** Types that fan out to virtual agents from selectedModelPool. */
export function isMultiAgentResearchType(type: ResearchType): boolean {
  return type === 'deep' || type === 'predictive';
}

export const RESEARCH_DEPTH_OPTIONS: { id: ResearchDepth; label: string }[] = [
  { id: '5m', label: '≈ 5 min' },
  { id: '15m', label: '≈ 15 min' },
  { id: '30m', label: '≈ 30 min' },
  { id: 'thorough', label: 'Thorough' },
];

export const RESEARCH_SELECTION_OPTIONS: { id: ResearchSelection; label: string; hint: string }[] = [
  { id: 'cited', label: 'Most cited', hint: 'Prefer well-referenced sources' },
  { id: 'consensus', label: 'Consensus', hint: 'What most sources agree on' },
  { id: 'newest', label: 'Newest', hint: 'Recency first' },
  { id: 'balanced', label: 'Balanced', hint: 'Show disagreements clearly' },
];

export const RESEARCH_FORMAT_OPTIONS: { id: ResearchFormat; label: string }[] = [
  { id: 'bullets', label: 'Bullet list' },
  { id: 'memo', label: 'Short memo' },
  { id: 'citations', label: 'Citations first' },
  { id: 'executive', label: 'Executive summary' },
];

export const DEFAULT_RESEARCH_BRIEF: ResearchBriefValues = {
  type: 'deep',
  depth: '15m',
  selection: 'balanced',
  format: 'memo',
  participate: false,
  maxVirtualAgents: DEFAULT_MAX_VIRTUAL_AGENTS,
  liveWeb: true,
};

const RESEARCH_INTENT =
  /\b(research|investigate|look\s*up|find\s+sources?|literature|deep\s*dive|fact[-\s]?check|compare\s+(options|sources)|gather\s+(sources|evidence)|predict(ive)?\s*(research|forecast|scenario)?|forecast|leading\s+indicators?)\b/i;

/** True when chatting with Research (id / role / tag). */
export function isResearchAgent(agent: Pick<Agent, 'id' | 'role' | 'roleTag' | 'name'> | null | undefined): boolean {
  if (!agent) return false;
  const hay = `${agent.id} ${agent.role} ${agent.roleTag} ${agent.name}`.toLowerCase();
  return (
    hay.includes('research') ||
    agent.roleTag === 'Find' ||
    /\banalyst\b/.test(hay) && hay.includes('research')
  );
}

export function looksLikeResearchIntent(text: string): boolean {
  return RESEARCH_INTENT.test(text.trim());
}

/** Open the brief for Research agent, or when the message tags research intent (e.g. group). */
export function shouldOpenResearchBrief(opts: {
  text: string;
  agent?: Pick<Agent, 'id' | 'role' | 'roleTag' | 'name'> | null;
  /** Group/council: true if Research (or research-tagged) is among members. */
  researchInGroup?: boolean;
  /** Skip if this message already carries a brief prefix (avoid loops). */
  skipPrefixed?: boolean;
}): boolean {
  const text = opts.text.trim();
  if (!text) return false;
  if (opts.skipPrefixed !== false && text.startsWith('[Research brief]')) return false;
  if (opts.agent && isResearchAgent(opts.agent)) return true;
  if (opts.researchInGroup && looksLikeResearchIntent(text)) return true;
  if (!opts.agent && looksLikeResearchIntent(text)) return true;
  return false;
}

export function formatResearchBriefMessage(question: string, brief: ResearchBriefValues): string {
  const type = RESEARCH_TYPE_OPTIONS.find((o) => o.id === brief.type)?.label ?? brief.type;
  const depth = RESEARCH_DEPTH_OPTIONS.find((o) => o.id === brief.depth)?.label ?? brief.depth;
  const selection = RESEARCH_SELECTION_OPTIONS.find((o) => o.id === brief.selection)?.label ?? brief.selection;
  const format = RESEARCH_FORMAT_OPTIONS.find((o) => o.id === brief.format)?.label ?? brief.format;
  const multi = isMultiAgentResearchType(brief.type);
  return [
    '[Research brief]',
    `Type: ${type}`,
    `Depth: ${depth}`,
    `Answer selection: ${selection}`,
    `Report format: ${format}`,
    `User participation: ${brief.participate ? 'yes — I will add notes/votes' : 'no — agents only'}`,
    `Live web (Virtual Desk): ${brief.liveWeb ? 'on' : 'off'}`,
    multi ? `Max virtual agents: ${brief.maxVirtualAgents}` : null,
    '',
    'Question:',
    question.trim(),
  ]
    .filter((line) => line != null)
    .join('\n');
}

export const PARTICIPATION_PROMPTS = [
  {
    id: 'constraints',
    text: 'Any must-include sources, constraints, or deadlines Research should respect?',
  },
  {
    id: 'avoid',
    text: 'Any angles, vendors, or biases you want Research to avoid?',
  },
  {
    id: 'vote',
    text: 'If sources conflict, which call should win? (vote: most cited / consensus / newest / your pick)',
  },
] as const;

export function formatParticipationReply(promptId: string, promptText: string, answer: string): string {
  return `[Research participation · ${promptId}]\nPrompt: ${promptText}\nMy input: ${answer.trim()}`;
}
