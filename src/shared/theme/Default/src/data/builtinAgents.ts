import type { Agent } from "../types/agents";
import { themeAssetUrl } from "../utils/themeAssets";

const chiefCube =
  themeAssetUrl("e2b650a4-4c63-42fc-b52f-60d2a4fb8025.jpg") ??
  "/e2b650a4-4c63-42fc-b52f-60d2a4fb8025.jpg";

/** Built-in Chief — always available even before registry scan. */
export const builtinAgents: Agent[] = [
  {
    id: "chief",
    name: "Chief",
    roleTag: "chief",
    role: "Chief of staff",
    initials: "CH",
    cube: chiefCube,
    status: "active",
    primary: "micro",
    secondary: "hybrid",
    currentTask: "Online · flat with you",
    lastActive: "now",
    skills: [
      { name: "mail-triage", enabled: true, gate: "free" },
      { name: "scheduling", enabled: true, gate: "free" },
      { name: "ticket-summarize", enabled: true, gate: "free" },
      { name: "proposal-draft", enabled: true, gate: "free" },
      { name: "shift-handoff", enabled: true, gate: "free" },
    ],
    learnings: [],
    folders: [],
    cloudUsed: 0,
    cloudCap: 0,
    logEntries: 0,
    isChief: true,
  },
];
