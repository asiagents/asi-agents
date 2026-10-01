/**
 * Curated local hire / first-open welcome lines for newly created agents.
 * Pool of ~18 voices — seed ONE random line into a fresh thread (not the whole set).
 * Pattern mirrors intent/welcomeMessages.ts (specialty-colored, no name roll-call).
 */

export type HireWelcomeSpeaker = {
  /** Soft specialty hint (role / tag / brief). */
  specialty?: string;
  /** Optional display name for rare "glad you hired me" lines — never "I'm {name}". */
  name?: string;
};

type HireFn = (s: HireWelcomeSpeaker) => string;

function specialtyBit(s: HireWelcomeSpeaker, fallback: string): string {
  const raw = (s.specialty ?? "").trim();
  if (!raw || /^specialist$/i.test(raw) || /^pro specialist$/i.test(raw)) return fallback;
  return raw.replace(/\s+/g, " ").slice(0, 80);
}

/** 10–20 distinct hire/welcome openings — pick one at seed time for variety without spam. */
const HIRE_WELCOME_STYLES: HireFn[] = [
  (s) =>
    `Thanks for hiring me onto the roster. ${specialtyBit(s, "This specialty")} is ready whenever you are.`,

  (s) =>
    `Happy to be here. Point me at the work — ${specialtyBit(s, "this lane")} is what I show up for.`,

  () =>
    "First day on the desk. No model required for this hello — say what you want me doing.",

  (s) =>
    `Glad you created this seat. Ask what ${specialtyBit(s, "the role")} should own, or drop a first task.`,

  () =>
    "Standing by. Tell me priorities, constraints, or who I report to on this work.",

  (s) =>
    `Warm start — ${specialtyBit(s, "specialty")} context is on file. What should I tackle first?`,

  () =>
    "Thanks for the hire. I'm local and listening — brief me, or ask what I can help with.",

  (s) =>
    `Roster check-in complete. Ready for ${specialtyBit(s, "specialist")} work — your move.`,

  () =>
    "Appreciate the create. Skills and model can change later; for now, what are we building toward?",

  (s) =>
    `Signal received. ${specialtyBit(s, "This agent")} lane is live — ask a question or assign a first to-do.`,

  () =>
    "Quiet hello from the new seat. One line is enough — what's the first useful thing I can do?",

  (s) =>
    `Onboarded for ${specialtyBit(s, "this role")}. Keep it light: a brief, a question, or a check-in.`,

  () =>
    "Here when you need me. No wall of intros — just say go.",

  (s) =>
    `Seat open for ${specialtyBit(s, "the specialty")}. Drop context when you're ready.`,

  () =>
    "Local hire complete. Chat stays quiet until you ask — what's on deck?",

  (s) =>
    `Good to meet the work. ${specialtyBit(s, "This lane")} is the focus; your call on where we start.`,

  () =>
    "Thanks — I'm in. One welcome is plenty; tell me the first task or question.",

  (s) =>
    `Ready quietly. ${specialtyBit(s, "Specialty")} tools can wait — what should we do first?`,
];

/** All curated hire lines (pool for tests / inspection — seeding uses pickHireWelcomeMessage). */
export function hireWelcomeMessages(speaker: HireWelcomeSpeaker): string[] {
  return HIRE_WELCOME_STYLES.map((fn) => fn(speaker));
}

/** Deterministic sample for tests. */
export function hireWelcomeMessageAt(speaker: HireWelcomeSpeaker, index: number): string {
  const i = ((index % HIRE_WELCOME_STYLES.length) + HIRE_WELCOME_STYLES.length) % HIRE_WELCOME_STYLES.length;
  return HIRE_WELCOME_STYLES[i]!(speaker);
}

export function hireWelcomeStyleCount(): number {
  return HIRE_WELCOME_STYLES.length;
}

/** One random line from the pool — preferred for hire seed (comfortable, not spam). */
export function pickHireWelcomeMessage(speaker: HireWelcomeSpeaker): string {
  const i = Math.floor(Math.random() * HIRE_WELCOME_STYLES.length);
  return HIRE_WELCOME_STYLES[i]!(speaker);
}
