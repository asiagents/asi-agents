/**
 * Home To-do assign → seed agent chat + ping Boss (fail-closed, no LLM required).
 */
import { appendAgentThread, appendChiefThread } from "./threadAppend.js";
import { pushBossTaskAlert } from "./store.js";
import type { AgentTask } from "./types.js";
import { BOSS_ID, isBossId, isChiefId } from "./withChief.js";

function clip(s: string, n = 120): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

export type TodoKickoffResult = {
  kicked: boolean;
  chatSeeded: boolean;
  bossPinged: boolean;
  reason?: string;
};

/**
 * When a to-do is assigned to an agent (not Personal/Boss):
 * 1. Seed that agent's (or Chief's) chat with a kickoff — no LLM call.
 * 2. Ping Boss via mention/inbox-style alert.
 */
export function kickoffAssignedTodo(
  task: AgentTask,
  opts?: { event?: "assigned" | "blocked" | "completed" | "needs_approval" }
): TodoKickoffResult {
  const event = opts?.event ?? "assigned";
  const agentId = (task.agentId ?? "").trim();
  if (!agentId || isBossId(agentId)) {
    return { kicked: false, chatSeeded: false, bossPinged: false, reason: "personal" };
  }

  let chatSeeded = false;
  if (event === "assigned") {
    const assignLine = `To-do assigned: ${clip(task.title, 200)}${
      task.category ? ` · ${task.category}` : ""
    }${task.priority && task.priority !== "normal" ? ` · ${task.priority}` : ""}`;
    const waitLine =
      "Assigned — queued. Waiting for model (fail-closed; no invented progress).";

    if (isChiefId(agentId)) {
      const msgs = appendChiefThread([
        { role: "user", text: assignLine, source: "in-app" },
        { role: "chief", text: waitLine, source: "in-app" },
      ]);
      chatSeeded = msgs.length > 0;
    } else {
      const msgs = appendAgentThread(agentId, [
        { role: "user", text: assignLine, source: "in-app" },
        { role: "agent", text: waitLine, source: "in-app" },
      ]);
      chatSeeded = Boolean(msgs?.length);
    }
  }

  const pingText =
    event === "blocked"
      ? `Blocked on to-do: ${clip(task.title)} — needs attention`
      : event === "completed"
        ? `Done: ${clip(task.title)} (${agentId})`
        : event === "needs_approval"
          ? `Approval needed: ${clip(task.title)} (${agentId})`
          : `Assigned to ${agentId}: ${clip(task.title)}`;

  pushBossTaskAlert({
    taskId: task.id,
    text: pingText,
    fromAuthor: agentId,
    commentId: `todo-${event}-${task.id}`,
  });

  return {
    kicked: true,
    chatSeeded,
    bossPinged: true,
    reason: chatSeeded ? undefined : "chat_seed_skipped_or_unknown_agent",
  };
}

export function shouldKickoffAssignee(agentId: string | undefined | null): boolean {
  const id = (agentId ?? "").trim();
  return Boolean(id) && id !== BOSS_ID;
}
