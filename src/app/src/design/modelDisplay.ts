/** Design-handoff placeholders — see docs/design/agent-display.md */

export type ModelChipCopy = { title: string; subline: string };

export const MODEL_CATALOG: Record<string, ModelChipCopy> = {
  "ams-micro-70m": { title: "ASI AMS Micro 70M", subline: "Local router · on-device (default)" },
  "ams-hybrid-120m": { title: "ASI AMS Hybrid 120M", subline: "Local router · optional" },
  "ultra-gate-1m": { title: "Ultra gate ~1M", subline: "Edge toy · not ship brain" },
  "agent-chat-50-100m": { title: "ASI AMS Agent Chat (~50–100M)", subline: "Short replies · optional" },
  "chat-1b": { title: "Chat 1B", subline: "Escalate · off-device" },
  "chat-3b": { title: "Chat 3B", subline: "Escalate · off-device" },
  "cloud-model": { title: "Cloud model", subline: "Escalate · user-approved" },
};

export const MODEL_STATE_CHIPS: Record<"pending" | "offline", ModelChipCopy> = {
  pending: { title: "Model pending", subline: "Weights or router not ready" },
  offline: { title: "Model offline", subline: "Service unreachable · fail closed" },
};

const LEGACY_ID_MAP: Record<string, string> = {
  "showcase-70m": "ams-micro-70m",
  "showcase-132m": "ams-hybrid-120m",
};

export const DEFAULT_CHAT_MODEL_CHIP = MODEL_CATALOG["ams-micro-70m"];

export const GROUP_MODELS_USED: ModelChipCopy[] = [
  MODEL_CATALOG["ams-micro-70m"],
  MODEL_CATALOG["ams-hybrid-120m"],
];

export function resolveModelChip(id: string, fallbackName: string, fallbackMeta: string): ModelChipCopy {
  const mapped = LEGACY_ID_MAP[id] ?? id;
  const hit = MODEL_CATALOG[mapped];
  if (hit) return hit;
  return { title: fallbackName, subline: fallbackMeta };
}
