import { loadAgents, type RegistryAgent } from "./agents.js";
import {
  appendNamedGroupMessage,
  getGroupMessages,
  getNamedGroup,
  normalizeModeratorId,
} from "./groupChats.js";
import {
  chiefGenerateFailureDetail,
  offlineAgentReply,
  resolveAgentRoute,
  routeGenerate,
} from "./llm-routing.js";
import { councilReplyPolicy } from "./reply-policy.js";
import { withTrainingContext } from "./agentTraining.js";
import { addLessonFromGroupFinal } from "./lessons.js";
import { loadState } from "./store.js";
import type { GroupMessage } from "./types.js";
import { CHIEF_ID, isChiefId, isUserModerator, USER_MODERATOR_ID } from "./withChief.js";

function maybeLessonFromFinal(
  groupId: string,
  finalMessage: GroupMessage | null,
  moderatorId: string,
  ok: boolean
): void {
  if (!ok || !finalMessage?.final || !finalMessage.text?.trim()) return;
  const group = getNamedGroup(groupId);
  addLessonFromGroupFinal({
    groupId,
    groupTitle: group?.name,
    finalText: finalMessage.text,
    moderatorId,
    memberIds: group?.memberIds,
  });
}

export type GroupConcludeResult = {
  messages: GroupMessage[];
  finalMessage: GroupMessage | null;
  draft?: string;
  label: string;
  moderatorId: string;
  ok: boolean;
  error?: string;
};

function findAgent(agentId: string): RegistryAgent | null {
  return loadAgents().agents.find((a) => a.id === agentId) ?? null;
}

function resolveMemberModel(agentId: string, agent: RegistryAgent | null): {
  primary: string;
  secondary: string | null;
  preference: ReturnType<typeof resolveAgentRoute>["preference"];
  providerTarget: ReturnType<typeof resolveAgentRoute>["providerTarget"];
} {
  if (isChiefId(agentId)) {
    const state = loadState();
    const route = resolveAgentRoute(agentId);
    const primary =
      route.primaryModelId?.trim() ||
      state.chiefPrimary?.trim() ||
      agent?.modelId?.trim() ||
      "agentchat";
    const secondary =
      route.secondaryModelId ?? state.chiefSecondary ?? agent?.secondaryModelId ?? null;
    return {
      primary,
      secondary,
      preference: route.preference,
      providerTarget: route.providerTarget,
    };
  }
  const route = resolveAgentRoute(agentId);
  const primary = route.primaryModelId?.trim() || agent?.modelId?.trim() || "agentchat";
  return {
    primary,
    secondary: route.secondaryModelId,
    preference: route.preference,
    providerTarget: route.providerTarget,
  };
}

function formatThreadContext(messages: GroupMessage[], limit = 36): string {
  const slice = messages.slice(-limit);
  if (!slice.length) return "(no prior messages)";
  return slice
    .map((m) => {
      const who = m.who === "user" ? "User" : m.who === "system" ? "System" : m.who;
      const tag = m.final ? " [FINAL]" : m.decide ? " [decide]" : "";
      const text = m.text.trim().replace(/\s+/g, " ");
      return `${who}${tag}: ${text}`;
    })
    .join("\n");
}

function synthesisSystemPrompt(agent: RegistryAgent): string {
  return withTrainingContext(
    `You are ${agent.name}, moderator of a multi-agent council on ASI Agents. ` +
      `Your job is one synthesis pass: converge the debate into a clear Final answer. ` +
      `Do not invent fake votes or tool runs. Note uncertainty briefly when models may be wrong. ` +
      councilReplyPolicy(
        "Structure: (1) short top options/shortlist if relevant, (2) one clear Final recommendation, (3) one-line caveat if unsure."
      ),
    agent.id
  );
}

function synthesisUserPrompt(thread: GroupMessage[]): string {
  return (
    `Council thread:\n${formatThreadContext(thread)}\n\n` +
    `Synthesize a converged Final answer for the user. Be concise (shortlist + verdict). ` +
    `Best-effort only — prefer "uncertain" over fabricated facts.`
  );
}

function draftSystemPrompt(agent: RegistryAgent): string {
  return withTrainingContext(
    `You are ${agent.name}. Draft a Final verdict the human moderator can edit. ` +
      `Be concise; do not claim the user has decided yet. ` +
      councilReplyPolicy(),
    agent.id
  );
}

function formatUserFinal(opts: {
  shortlist?: string[];
  verdict: string;
}): string {
  const picks = (opts.shortlist ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const lines: string[] = ["Final"];
  if (picks.length) {
    lines.push("Top picks:");
    picks.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    lines.push("");
  }
  lines.push(opts.verdict.trim());
  return lines.join("\n");
}

/**
 * Conclude a council thread.
 * - Agent moderator: one synthesis generate → Final message.
 * - User moderator: post user's verdict as Final; optional Chief draft (draftOnly) for edit.
 * Fail-closed: visible error Final/system line, never silent success.
 */
export async function runGroupConclude(
  groupId: string,
  opts?: {
    verdict?: string | null;
    shortlist?: string[] | null;
    /** When user is moderator: ask Chief for a draft without posting Final. */
    draftOnly?: boolean;
  }
): Promise<GroupConcludeResult | null> {
  const group = getNamedGroup(groupId);
  if (!group) return null;

  const moderatorId = normalizeModeratorId(group.moderatorId, group.memberIds);
  const thread = getGroupMessages(groupId) ?? [];

  if (!thread.some((m) => m.who === "user" && m.text.trim()) && !thread.some((m) => m.final)) {
    const msg = appendNamedGroupMessage(groupId, {
      who: "system",
      text: "Nothing to conclude — send a debate prompt first.",
      decide: true,
    });
    return {
      messages: getGroupMessages(groupId) ?? [],
      finalMessage: null,
      label: "No debate yet",
      moderatorId,
      ok: false,
      error: msg?.text,
    };
  }

  // User moderator path
  if (isUserModerator(moderatorId)) {
    if (opts?.draftOnly) {
      const chief = findAgent(CHIEF_ID);
      const name = chief?.name ?? "Chief";
      if (!chief) {
        return {
          messages: thread,
          finalMessage: null,
          label: "Chief unavailable for draft",
          moderatorId,
          ok: false,
          error: "Chief not in registry",
        };
      }
      const { primary, secondary, preference, providerTarget } = resolveMemberModel(CHIEF_ID, chief);
      try {
        const result = await routeGenerate({
          prompt:
            `Council thread:\n${formatThreadContext(thread)}\n\n` +
            `Draft a Final verdict for the human moderator to edit (shortlist + recommendation).`,
          modelId: primary,
          secondaryModelId: secondary,
          systemPrompt: draftSystemPrompt(chief),
          routePreference: preference,
          providerTarget,
        });
        if (result.via !== "offline" && result.text?.trim()) {
          return {
            messages: getGroupMessages(groupId) ?? thread,
            finalMessage: null,
            draft: result.text.trim(),
            label: "Chief draft ready — edit and post Final",
            moderatorId,
            ok: true,
          };
        }
        const { message } = chiefGenerateFailureDetail(primary, result.reason, { bumpStreak: false });
        const failText = await offlineAgentReply(name, primary, result.reason);
        return {
          messages: getGroupMessages(groupId) ?? thread,
          finalMessage: null,
          label: "Draft failed closed",
          moderatorId,
          ok: false,
          error: `${failText} (${message})`,
        };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return {
          messages: getGroupMessages(groupId) ?? thread,
          finalMessage: null,
          label: "Draft failed closed",
          moderatorId,
          ok: false,
          error: detail,
        };
      }
    }

    const verdict = opts?.verdict != null ? String(opts.verdict).trim() : "";
    if (!verdict) {
      return {
        messages: thread,
        finalMessage: null,
        label: "Verdict required",
        moderatorId,
        ok: false,
        error: "Write a verdict (or ask Chief to draft) before posting Final.",
      };
    }
    const shortlist = Array.isArray(opts?.shortlist)
      ? opts!.shortlist!.map(String)
      : undefined;
    const text = formatUserFinal({ shortlist, verdict });
    const finalMessage = appendNamedGroupMessage(groupId, {
      who: USER_MODERATOR_ID,
      text,
      final: true,
    });
    maybeLessonFromFinal(groupId, finalMessage, moderatorId, true);
    return {
      messages: getGroupMessages(groupId) ?? [],
      finalMessage,
      label: "Final posted (you moderated)",
      moderatorId,
      ok: true,
    };
  }

  // Agent moderator — one synthesis pass
  const agent = findAgent(moderatorId);
  const name = agent?.name ?? moderatorId;
  if (!agent) {
    const err = `Moderator "${moderatorId}" is unknown — cannot synthesize.`;
    appendNamedGroupMessage(groupId, { who: "system", text: err, decide: true });
    return {
      messages: getGroupMessages(groupId) ?? [],
      finalMessage: null,
      label: "Moderator missing",
      moderatorId,
      ok: false,
      error: err,
    };
  }

  const { primary, secondary, preference, providerTarget } = resolveMemberModel(moderatorId, agent);

  try {
    const result = await routeGenerate({
      prompt: synthesisUserPrompt(thread),
      modelId: primary,
      secondaryModelId: secondary,
      systemPrompt: synthesisSystemPrompt(agent),
      routePreference: preference,
      providerTarget,
    });

    if (result.via !== "offline" && result.text?.trim()) {
      const body = result.text.trim();
      const text = body.startsWith("Final") ? body : `Final\n\n${body}`;
      const finalMessage = appendNamedGroupMessage(groupId, {
        who: moderatorId,
        text,
        final: true,
      });
      maybeLessonFromFinal(groupId, finalMessage, moderatorId, true);
      return {
        messages: getGroupMessages(groupId) ?? [],
        finalMessage,
        label: `Final by ${name}`,
        moderatorId,
        ok: true,
      };
    }

    const { message } = chiefGenerateFailureDetail(primary, result.reason, { bumpStreak: false });
    const failText = await offlineAgentReply(name, primary, result.reason);
    const finalMessage = appendNamedGroupMessage(groupId, {
      who: moderatorId,
      text: `Final (failed closed)\n\n${failText}`,
      final: true,
    });
    return {
      messages: getGroupMessages(groupId) ?? [],
      finalMessage,
      label: `Synthesis failed closed (${name})`,
      moderatorId,
      ok: false,
      error: message,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const finalMessage = appendNamedGroupMessage(groupId, {
      who: moderatorId,
      text: `Final (failed closed)\n\n${name} could not synthesize: ${detail}`,
      final: true,
    });
    return {
      messages: getGroupMessages(groupId) ?? [],
      finalMessage,
      label: "Synthesis failed closed",
      moderatorId,
      ok: false,
      error: detail,
    };
  }
}
