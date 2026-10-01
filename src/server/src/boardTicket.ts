/**
 * Board → Tasks: one-click ticket from the current decision + stances.
 */
import { createTask } from "./store.js";
import { getBoardState } from "./store.js";
import type { AgentTask } from "./types.js";
import { CHIEF_ID } from "./withChief.js";

function stanceLabel(stance: string): string {
  if (stance === "for") return "For";
  if (stance === "against") return "Against";
  if (stance === "info") return "Needs info";
  return stance;
}

export function createTaskFromBoardDecision(opts?: {
  agentId?: string;
}): { task: AgentTask } | { error: string } {
  const board = getBoardState();
  const topic = (board.topic ?? "").trim();
  if (!topic) {
    return { error: "Add a decision / question on the Board first." };
  }

  const agentId = (opts?.agentId?.trim() || CHIEF_ID).trim() || CHIEF_ID;
  const lines: string[] = [`Board decision: ${topic}`, "", "Stances:"];
  const ids = Array.isArray(board.boardIds) ? board.boardIds : [];
  let any = false;
  for (const id of ids) {
    const s = board.stances?.[id];
    if (!s?.stance) continue;
    any = true;
    const note = s.note?.trim() ? ` — ${s.note.trim()}` : "";
    lines.push(`• ${id}: ${stanceLabel(s.stance)}${note}`);
  }
  if (!any) lines.push("(No stances recorded yet.)");

  const title =
    topic.length > 120 ? `Board: ${topic.slice(0, 117)}…` : `Board: ${topic}`;
  const task = createTask({
    title,
    agentId,
    status: "pending",
    note: lines.join("\n").slice(0, 4000),
    category: "work",
    origin: "board",
  });
  return { task };
}
