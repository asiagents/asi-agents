/**
 * Curated local-greeting openings for every thread (Chief, builtins, custom).
 * No "Hello — I'm {name}" / identity roll-call — specialty may color the line.
 */

export type WelcomeSpeaker = {
  isChief: boolean;
  /** Soft specialty hint (role / tag); never used as "I'm {name}". */
  specialty?: string;
};

type WelcomeFn = (s: WelcomeSpeaker) => string;

function specialtyBit(s: WelcomeSpeaker, fallback: string): string {
  const raw = (s.specialty ?? "").trim();
  if (!raw || /^specialist$/i.test(raw) || /^pro specialist$/i.test(raw)) return fallback;
  return raw.replace(/\s+/g, " ");
}

/** ~10 distinct voices; pick randomly per greeting turn. */
const WELCOME_STYLES: WelcomeFn[] = [
  (s) =>
    s.isChief
      ? "You're through to the desk. Local commands work here — say help anytime."
      : `Ready when you are. ${specialtyBit(s, "This lane")} is on deck — ask away, or say help for local commands.`,

  (s) =>
    s.isChief
      ? "Desk is quiet and listening. What do you need first?"
      : `Channel open for ${specialtyBit(s, "specialist work")}. Drop a question or say help.`,

  (s) =>
    s.isChief
      ? "On-device assistant online. Greetings stay local; heavier asks escalate."
      : `Fresh thread — ${specialtyBit(s, "specialty")} focus. Say help for what this chat can do without a model.`,

  (s) =>
    s.isChief
      ? "Hi. Skip the introductions — say help, or just start."
      : "No roll call needed. Ask about the work, or say help for local commands.",

  (s) =>
    s.isChief
      ? "Morning or midnight — the desk answers the same. What's on your mind?"
      : `Warm start for ${specialtyBit(s, "this specialty")}. Pitch the task when ready.`,

  (s) =>
    s.isChief
      ? "Local lane first. Say help for intents that never leave the machine."
      : "In-thread only — ask the specialty question, or say help for the short command list.",

  (s) =>
    s.isChief
      ? "Standing by. Navigation, roster, and system facts are a hello away."
      : `Standing by for ${specialtyBit(s, "specialist")} work. One clear ask is enough.`,

  (s) =>
    s.isChief
      ? "You've got the on-device desk. Type freely — help lists the local toolkit."
      : "Open brief. Point at the problem; say help if you want the local command menu.",

  (s) =>
    s.isChief
      ? "Signal received. Start with help, or jump straight into the request."
      : `Signal received on the ${specialtyBit(s, "agent")} line. Your move — or say help.`,

  (s) =>
    s.isChief
      ? "Welcome in. This chat prefers local answers when it can."
      : `Welcome in. ${specialtyBit(s, "Specialty")} context is already set — no name tag required.`,
];

/** Rotate/random pick among curated styles (shared by Chief + every agent). */
export function pickWelcomeMessage(speaker: WelcomeSpeaker): string {
  const i = Math.floor(Math.random() * WELCOME_STYLES.length);
  return WELCOME_STYLES[i]!(speaker);
}

/** Deterministic sample for tests / docs (style index clamped). */
export function welcomeMessageAt(speaker: WelcomeSpeaker, index: number): string {
  const i = ((index % WELCOME_STYLES.length) + WELCOME_STYLES.length) % WELCOME_STYLES.length;
  return WELCOME_STYLES[i]!(speaker);
}

export function welcomeStyleCount(): number {
  return WELCOME_STYLES.length;
}
