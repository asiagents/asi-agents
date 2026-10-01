import type { ProCategory, ProLook } from '../types/pro';
import { themeAssetUrl } from '../utils/themeAssets';

/** Distinct non-cube looks. Other agents reuse a core agent's cube. */
export const proLooks: Record<string, ProLook> = {
  doctor: { src: themeAssetUrl('eda60c43-502c-49dd-9889-3cf9f7d5e2ec.jpg') ?? '', kind: 'human-pixel', label: 'Human · pixel' },
  finance: { src: themeAssetUrl('2c8b0f51-0e59-4f98-9b74-055286bbd3bb.jpg') ?? '', kind: 'human-pixel', label: 'Human · pixel' },
  lawyer: { src: themeAssetUrl('0825f9a2-ad48-4495-94b0-e0cb8ae651b7.jpg') ?? '', kind: 'human-pixel', label: 'Human · pixel' },
  dragon: { src: themeAssetUrl('6f8ce385-e430-4e8d-b53a-31c4bd1c28a2.jpg') ?? '', kind: 'creature', label: 'Creature · dragon' },
  owl: { src: themeAssetUrl('e6c5c0cb-a932-4ea8-b9cc-1b218e1c4150.jpg') ?? '', kind: 'creature', label: 'Creature · owl' }
};

export const proCategories: ProCategory[] = [
{
  id: 'health',
  name: 'Healthcare',
  blurb: 'Clinical notes and checks. Never diagnoses.',
  agents: [
  { id: 'p-mira', name: 'Dr. Mira', role: 'Clinical notes', categoryId: 'health', look: 'doctor', height: 'tall', skills: ['triage-notes', 'citations'], model: 'hybrid' },
  { id: 'p-pharm', name: 'Pharm', role: 'Dosage checker', categoryId: 'health', look: 'owl', height: 'mid', skills: ['dosage-check'], model: 'micro' },
  { id: 'p-claims', name: 'Claims', role: 'Billing coder', categoryId: 'health', look: 'analyst', height: 'short', skills: ['claims-coding', 'data-cleaning'], model: 'agentchat' }]

},
{
  id: 'finance',
  name: 'Finance',
  blurb: 'Budgets, forecasts, and tax paperwork.',
  agents: [
  { id: 'p-ledger', name: 'Ledger', role: 'Budget analyst', categoryId: 'finance', look: 'finance', height: 'mid', skills: ['budgeting', 'forecasting'], model: 'hybrid' },
  { id: 'p-forecast', name: 'Forecast', role: 'Forecaster', categoryId: 'finance', look: 'analyst', height: 'short', skills: ['forecasting', 'stats'], model: 'chat1b' },
  { id: 'p-taxie', name: 'Taxie', role: 'Tax prep', categoryId: 'finance', look: 'owl', height: 'short', skills: ['tax-prep'], model: 'micro' },
  { id: 'p-audit', name: 'Audit', role: 'Auditor', categoryId: 'finance', look: 'lawyer', height: 'tall', skills: ['contract-review', 'data-cleaning'], model: 'hybrid' }]

},
{
  id: 'legal',
  name: 'Legal',
  blurb: 'Contracts and precedent. Drafts only.',
  agents: [
  { id: 'p-counsel', name: 'Counsel', role: 'Contract reviewer', categoryId: 'legal', look: 'lawyer', height: 'tall', skills: ['contract-review'], model: 'chat3b' },
  { id: 'p-clerk', name: 'Clerk', role: 'Case-law finder', categoryId: 'legal', look: 'owl', height: 'mid', skills: ['case-law', 'citations'], model: 'hybrid' },
  { id: 'p-comply', name: 'Comply', role: 'Compliance', categoryId: 'legal', look: 'critic', height: 'short', skills: ['contract-review'], model: 'micro' }]

},
{
  id: 'education',
  name: 'Education',
  blurb: 'Tutoring, lessons, and practice quizzes.',
  agents: [
  { id: 'p-hoot', name: 'Prof. Hoot', role: 'Tutor', categoryId: 'education', look: 'owl', height: 'tall', skills: ['lesson-plans', 'citations'], model: 'hybrid' },
  { id: 'p-quiz', name: 'Quizzer', role: 'Quiz maker', categoryId: 'education', look: 'planner', height: 'short', skills: ['quiz-gen'], model: 'agentchat' },
  { id: 'p-syllabus', name: 'Syllabus', role: 'Lesson planner', categoryId: 'education', look: 'writer', height: 'mid', skills: ['lesson-plans', 'scheduling'], model: 'micro' }]

},
{
  id: 'software',
  name: 'Software',
  blurb: 'Build, test, and ship in a sandbox you can watch.',
  agents: [
  { id: 'p-coder', name: 'Coder', role: 'Engineer', categoryId: 'software', look: 'coder', height: 'mid', skills: ['code-review', 'test-writing', 'shell-sandbox'], model: 'hybrid', deskAgentId: 'coder' },
  { id: 'p-review', name: 'Reviewer', role: 'Code review', categoryId: 'software', look: 'critic', height: 'short', skills: ['code-review'], model: 'chat1b' },
  { id: 'p-qa', name: 'Tester', role: 'QA', categoryId: 'software', look: 'scout', height: 'short', skills: ['test-writing', 'shell-sandbox'], model: 'micro', deskAgentId: 'scout' },
  { id: 'p-drake', name: 'Drake', role: 'Architect', categoryId: 'software', look: 'dragon', height: 'tall', skills: ['code-review', 'ui-mockups'], model: 'chat3b' }]

},
{
  id: 'design',
  name: 'Design',
  blurb: 'Interfaces, brand, and motion.',
  agents: [
  { id: 'p-pixel', name: 'Pixel', role: 'UI designer', categoryId: 'design', look: 'designer', height: 'mid', skills: ['ui-mockups'], model: 'hybrid' },
  { id: 'p-brand', name: 'Brand', role: 'Brand voice', categoryId: 'design', look: 'writer', height: 'tall', skills: ['brand-voice'], model: 'micro' },
  { id: 'p-motion', name: 'Flicker', role: 'Motion', categoryId: 'design', look: 'dragon', height: 'short', skills: ['ui-mockups', 'story'], model: 'agentchat' }]

},
{
  id: 'marketing',
  name: 'Marketing',
  blurb: 'Reach, copy, and campaigns. Every post is a draft.',
  agents: [
  { id: 'p-reach', name: 'Reach', role: 'SEO', categoryId: 'marketing', look: 'research', height: 'mid', skills: ['seo'], model: 'chat1b' },
  { id: 'p-copy', name: 'Copy', role: 'Copywriter', categoryId: 'marketing', look: 'writer', height: 'short', skills: ['brand-voice', 'story'], model: 'hybrid' },
  { id: 'p-social', name: 'Social', role: 'Social planner', categoryId: 'marketing', look: 'finance', height: 'tall', skills: ['scheduling', 'brand-voice'], model: 'micro' }]

},
{
  id: 'science',
  name: 'Science',
  blurb: 'Data, statistics, and literature.',
  agents: [
  { id: 'p-lab', name: 'Lab', role: 'Data cleaner', categoryId: 'science', look: 'analyst', height: 'short', skills: ['data-cleaning'], model: 'micro' },
  { id: 'p-stats', name: 'Sigma', role: 'Statistician', categoryId: 'science', look: 'owl', height: 'tall', skills: ['stats', 'data-cleaning'], model: 'chat3b' },
  { id: 'p-lit', name: 'Lit', role: 'Literature review', categoryId: 'science', look: 'research', height: 'mid', skills: ['lit-review', 'citations'], model: 'hybrid', deskAgentId: 'research' },
  { id: 'p-grant', name: 'Grant', role: 'Grant writer', categoryId: 'science', look: 'lawyer', height: 'tall', skills: ['story', 'citations'], model: 'chat1b' }]

},
{
  id: 'ops',
  name: 'Operations',
  blurb: 'Schedules, mail, and inventory.',
  agents: [
  { id: 'p-dispatch', name: 'Dispatch', role: 'Scheduler', categoryId: 'ops', look: 'planner', height: 'mid', skills: ['scheduling'], model: 'micro' },
  { id: 'p-mail', name: 'Postie', role: 'Mail triage', categoryId: 'ops', look: 'mailroom', height: 'short', skills: ['mail-triage'], model: 'agentchat' },
  { id: 'p-keeper', name: 'Keeper', role: 'Inventory', categoryId: 'ops', look: 'dragon', height: 'tall', skills: ['data-cleaning', 'scheduling'], model: 'micro' }]

},
{
  id: 'creative',
  name: 'Creative writing',
  blurb: 'Stories, narration, and edits.',
  agents: [
  { id: 'p-quill', name: 'Quill', role: 'Story writer', categoryId: 'creative', look: 'writer', height: 'mid', skills: ['story'], model: 'hybrid' },
  { id: 'p-voice', name: 'Voice', role: 'Narrator', categoryId: 'creative', look: 'narrator', height: 'tall', skills: ['story', 'brand-voice'], model: 'micro' },
  { id: 'p-editor', name: 'Edit', role: 'Editor', categoryId: 'creative', look: 'critic', height: 'short', skills: ['story', 'citations'], model: 'chat1b' }]

},
{
  id: 'fantasy',
  name: 'Fantasy & games',
  blurb: 'Worlds, quests, and playtests.',
  agents: [
  { id: 'p-ember', name: 'Ember', role: 'Lore keeper', categoryId: 'fantasy', look: 'dragon', height: 'tall', skills: ['lore', 'story'], model: 'hybrid' },
  { id: 'p-sage', name: 'Sage', role: 'Quest designer', categoryId: 'fantasy', look: 'owl', height: 'mid', skills: ['lore', 'ui-mockups'], model: 'micro' },
  { id: 'p-level', name: 'Blocks', role: 'Level designer', categoryId: 'fantasy', look: 'designer', height: 'short', skills: ['ui-mockups'], model: 'agentchat' },
  { id: 'p-play', name: 'Scout', role: 'Playtester', categoryId: 'fantasy', look: 'scout', height: 'short', skills: ['test-writing'], model: 'micro', deskAgentId: 'scout' }]

},
{
  id: 'personal',
  name: 'Personal life',
  blurb: 'Habits, travel, and money at home.',
  agents: [
  { id: 'p-coach', name: 'Coach', role: 'Habits', categoryId: 'personal', look: 'doctor', height: 'mid', skills: ['scheduling'], model: 'micro' },
  { id: 'p-nomad', name: 'Nomad', role: 'Travel planner', categoryId: 'personal', look: 'scout', height: 'short', skills: ['travel', 'scheduling'], model: 'agentchat' },
  { id: 'p-buddy', name: 'Penny', role: 'Money buddy', categoryId: 'personal', look: 'finance', height: 'short', skills: ['budgeting'], model: 'micro' }]

}];