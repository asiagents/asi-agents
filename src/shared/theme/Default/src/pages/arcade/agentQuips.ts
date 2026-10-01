/** Silly one-liners for arcade agent games (local only). */
export const RACE_QUIPS = [
  "Forgot to patch models!",
  "Routing via cloud…",
  "Chief says pedal faster!",
  "AMS Micro is my turbo",
  "Fail-closed but fast",
  "Ollama ate my lunch",
  "This bike runs on intents",
  "Council approved this lane",
  "Panic button is NOT mapped here",
];

export const BRAWL_QUIPS = [
  "Your prompt engineering is weak!",
  "I was trained on better data!",
  "Handoff to my fists!",
  "Local-only and locally violent",
  "404: your defense not found",
  "Deploying secondary model… of PAIN",
];

export const CHAOS_QUIPS = [
  "wanders into inbox",
  "trips on a cable",
  "starts a meeting solo",
  "opens 47 tabs",
  "yells at the router",
  "petitions for GPU",
];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
