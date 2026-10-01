/** Curated display-name suggestion sets for agent create / identity pickers.
 *  PG / non-infringing: common names + roles, clearly fictional labels, or public-domain figures.
 *  Suggestions only — picking does not create an agent until the user confirms.
 */

export type AgentNameSuggestion = {
  /** Display name shown in the roster */
  name: string;
  /** Optional short role / tagline applied when the suggestion is picked */
  role?: string;
};

export type AgentNameSet = {
  id: string;
  label: string;
  description: string;
  names: AgentNameSuggestion[];
};

export const AGENT_NAME_SETS: AgentNameSet[] = [
  {
    id: 'hollywood',
    label: 'Hollywood Classics',
    description: 'Public-domain / classic story figures (suggestions, not portrayals)',
    names: [
      { name: 'Sherlock', role: 'Consulting detective' },
      { name: 'Watson', role: 'Field chronicler' },
      { name: 'Dorothy', role: 'Pathfinder' },
      { name: 'Alice', role: 'Curious explorer' },
      { name: 'Robin', role: 'Outlaw strategist' },
      { name: 'Marian', role: 'Quiet operator' },
      { name: 'Holmes Jr.', role: 'Case lead' },
      { name: 'Dracula', role: 'Night shift lead' },
      { name: 'Frank', role: 'Maker of monsters' },
      { name: 'Juliet', role: 'Drama liaison' },
      { name: 'Prospero', role: 'Stage director' },
      { name: 'Ophelia', role: 'Scene reader' },
    ],
  },
  {
    id: 'coding',
    label: 'Coding Roles',
    description: 'Engineering titles as display names',
    names: [
      { name: 'Staff Engineer', role: 'Deep systems' },
      { name: 'Tech Lead', role: 'Delivery lead' },
      { name: 'Principal Engineer', role: 'Architecture' },
      { name: 'Backend Dev', role: 'APIs & data' },
      { name: 'Frontend Dev', role: 'UI craft' },
      { name: 'Full-Stack', role: 'End-to-end' },
      { name: 'SRE', role: 'Reliability' },
      { name: 'DevOps', role: 'Pipelines' },
      { name: 'Security Eng', role: 'Hardening' },
      { name: 'QA Lead', role: 'Quality gate' },
    ],
  },
  {
    id: 'employee',
    label: 'Employee Titles',
    description: 'Common workplace roles',
    names: [
      { name: 'PM', role: 'Product manager' },
      { name: 'Analyst', role: 'Insights' },
      { name: 'Coordinator', role: 'Ops glue' },
      { name: 'Specialist', role: 'Domain focus' },
      { name: 'Associate', role: 'Generalist' },
      { name: 'Director', role: 'Org lead' },
      { name: 'Intern', role: 'Learning fast' },
      { name: 'Consultant', role: 'External view' },
      { name: 'Ops Manager', role: 'Run the desk' },
      { name: 'Executive Asst', role: 'Calendar & triage' },
    ],
  },
  {
    id: 'scifi',
    label: 'Sci-Fi Crew',
    description: 'Fictional space-ops callsigns',
    names: [
      { name: 'Nova', role: 'Nav lead' },
      { name: 'Orbit', role: 'Comms' },
      { name: 'Quark', role: 'Science officer' },
      { name: 'Vector', role: 'Tactics' },
      { name: 'Echo-7', role: 'Sensor net' },
      { name: 'Lyra', role: 'Cartographer' },
      { name: 'Helix', role: 'Bio systems' },
      { name: 'Pulse', role: 'Life support' },
      { name: 'Drift', role: 'Pilot' },
      { name: 'Axiom', role: 'Mission AI' },
    ],
  },
  {
    id: 'mythology',
    label: 'Mythology',
    description: 'Well-known myth names as local nicknames',
    names: [
      { name: 'Athena', role: 'Strategy' },
      { name: 'Hermes', role: 'Messenger' },
      { name: 'Apollo', role: 'Clarity' },
      { name: 'Artemis', role: 'Hunt & focus' },
      { name: 'Odin', role: 'Counsel' },
      { name: 'Freya', role: 'Alliance' },
      { name: 'Anubis', role: 'Archives' },
      { name: 'Isis', role: 'Restoration' },
      { name: 'Thor', role: 'Force majeure' },
      { name: 'Bastet', role: 'Watchful' },
    ],
  },
  {
    id: 'nature',
    label: 'Nature',
    description: 'Earth & weather inspired names',
    names: [
      { name: 'Cedar', role: 'Steady support' },
      { name: 'River', role: 'Flow & triage' },
      { name: 'Sage', role: 'Calm advice' },
      { name: 'Moss', role: 'Quiet maintainer' },
      { name: 'Storm', role: 'Incident response' },
      { name: 'Willow', role: 'Flexible planner' },
      { name: 'Flint', role: 'Spark ideas' },
      { name: 'Coral', role: 'Reef of notes' },
      { name: 'Summit', role: 'High-level view' },
      { name: 'Meadow', role: 'Soft landing' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance Desk',
    description: 'Numbers and markets persona labels',
    names: [
      { name: 'Ledger', role: 'Bookkeeper' },
      { name: 'Audit', role: 'Controls' },
      { name: 'Margin', role: 'Risk desk' },
      { name: 'Yield', role: 'Returns' },
      { name: 'Capex', role: 'Investments' },
      { name: 'Basis', role: 'Fundamentals' },
      { name: 'Float', role: 'Cash timing' },
      { name: 'Parity', role: 'FX watch' },
      { name: 'Covenant', role: 'Compliance' },
      { name: 'Runway', role: 'Burn tracker' },
    ],
  },
  {
    id: 'design',
    label: 'Design Studio',
    description: 'Craft and visual roles',
    names: [
      { name: 'Pixel', role: 'UI polish' },
      { name: 'Kern', role: 'Typography' },
      { name: 'Sketch', role: 'Concept art' },
      { name: 'Palette', role: 'Color systems' },
      { name: 'Grid', role: 'Layout' },
      { name: 'Motion', role: 'Animation' },
      { name: 'Foil', role: 'Contrast' },
      { name: 'Craft', role: 'Prototypes' },
      { name: 'Ink', role: 'Illustration' },
      { name: 'Frame', role: 'Composition' },
    ],
  },
  {
    id: 'research',
    label: 'Research Lab',
    description: 'Inquiry and evidence roles',
    names: [
      { name: 'Cite', role: 'Sources' },
      { name: 'Hypothesis', role: 'Experiment design' },
      { name: 'Survey', role: 'Field notes' },
      { name: 'Abstract', role: 'Summaries' },
      { name: 'Peer', role: 'Reviewer' },
      { name: 'Archive', role: 'Literature' },
      { name: 'Sample', role: 'Data collection' },
      { name: 'Null', role: 'Skepticism' },
      { name: 'Method', role: 'Process rigor' },
      { name: 'Brief', role: 'Research briefs' },
    ],
  },
  {
    id: 'playful',
    label: 'Playful',
    description: 'Light nicknames for casual desks',
    names: [
      { name: 'Waffle', role: 'Breakfast brainstorms' },
      { name: 'Zippy', role: 'Quick takes' },
      { name: 'Noodle', role: 'Side quests' },
      { name: 'Biscuit', role: 'Comfort replies' },
      { name: 'Sparkle', role: 'Cheer squad' },
      { name: 'Mochi', role: 'Soft landings' },
      { name: 'Pickle', role: 'Odd jobs' },
      { name: 'Bubbles', role: 'Status updates' },
      { name: 'Jelly', role: 'Sticky notes' },
      { name: 'Pogo', role: 'Bounce ideas' },
    ],
  },
  {
    id: 'international',
    label: 'International',
    description: 'Common given names from many languages',
    names: [
      { name: 'Amara', role: 'Bridge builder' },
      { name: 'Kenji', role: 'Detail oriented' },
      { name: 'Sofia', role: 'Warm host' },
      { name: 'Omar', role: 'Steady guide' },
      { name: 'Ines', role: 'Clear writer' },
      { name: 'Diego', role: 'Field runner' },
      { name: 'Mei', role: 'Quiet focus' },
      { name: 'Noor', role: 'Light touch' },
      { name: 'Lukas', role: 'Practical help' },
      { name: 'Asha', role: 'Hope & follow-through' },
    ],
  },
  {
    id: 'fantasy',
    label: 'Fantasy Guild',
    description: 'Clearly fictional adventure callsigns',
    names: [
      { name: 'Quillthorn', role: 'Scribe' },
      { name: 'Ashward', role: 'Warden' },
      { name: 'Mirell', role: 'Herbalist' },
      { name: 'Torven', role: 'Scout' },
      { name: 'Bryndel', role: 'Quartermaster' },
      { name: 'Selk', role: 'Cartographer' },
      { name: 'Orin Vale', role: 'Pathfinder' },
      { name: 'Nyssa', role: 'Rune keeper' },
      { name: 'Kael Drift', role: 'Courier' },
      { name: 'Fenwick', role: 'Guild clerk' },
    ],
  },
  {
    id: 'newsroom',
    label: 'Newsroom',
    description: 'Editorial desk titles',
    names: [
      { name: 'Editor', role: 'Copy desk' },
      { name: 'Reporter', role: 'Field notes' },
      { name: 'Fact Check', role: 'Verification' },
      { name: 'Headline', role: 'Hooks' },
      { name: 'Beat', role: 'Coverage lead' },
      { name: 'Wire', role: 'Breaking news' },
      { name: 'Op-Ed', role: 'Opinion' },
      { name: 'Photo Desk', role: 'Visuals' },
      { name: 'Producer', role: 'Show rundown' },
      { name: 'Stringer', role: 'Tips & leads' },
    ],
  },
  {
    id: 'ops',
    label: 'Ops & Support',
    description: 'Keep-the-lights-on roles',
    names: [
      { name: 'On-Call', role: 'Incidents' },
      { name: 'Triage', role: 'Intake' },
      { name: 'Runbook', role: 'Playbooks' },
      { name: 'Pager', role: 'Alerts' },
      { name: 'Helpdesk', role: 'Tickets' },
      { name: 'Success', role: 'Customer care' },
      { name: 'Escalation', role: 'Hard cases' },
      { name: 'Watchdog', role: 'Health checks' },
      { name: 'Release', role: 'Ship checklist' },
      { name: 'Backbone', role: 'Infra glue' },
    ],
  },
  {
    id: 'hospitality',
    label: 'Hospitality',
    description: 'Service and kitchen nicknames',
    names: [
      { name: 'Host', role: 'Front of house' },
      { name: 'Sommelier', role: 'Pairings' },
      { name: 'Line Cook', role: 'Prep & fire' },
      { name: 'Concierge', role: 'Guest asks' },
      { name: 'Pastry', role: 'Sweets & polish' },
      { name: 'Maitre D', role: 'Seating flow' },
      { name: 'Barista', role: 'Warm opens' },
      { name: 'Sous', role: 'Second in command' },
      { name: 'Porter', role: 'Logistics' },
      { name: 'Reservations', role: 'Scheduling' },
    ],
  },
];

export function getAgentNameSet(id: string): AgentNameSet | undefined {
  return AGENT_NAME_SETS.find((s) => s.id === id);
}

export function randomFromSet(set: AgentNameSet): AgentNameSuggestion {
  const i = Math.floor(Math.random() * set.names.length);
  return set.names[i] ?? set.names[0]!;
}
