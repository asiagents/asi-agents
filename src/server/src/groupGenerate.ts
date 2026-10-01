import { loadAgents, type RegistryAgent } from "./agents.js";
import {
  appendNamedGroupMessage,
  getGroupMessages,
  getNamedGroup,
  isGroupSessionExpired,
} from "./groupChats.js";
import { chatMetaFromGenerate } from "./generate-meta.js";
import {
  chiefGenerateFailureDetail,
  offlineAgentReply,
  resolveAgentRoute,
  routeGenerate,
} from "./llm-routing.js";
import { systemPromptForRegistryAgent } from "./agentSystemPrompt.js";
import { loadState } from "./store.js";
import type { GroupMessage } from "./types.js";
import { isChiefId } from "./withChief.js";

export type GroupGenerateMemberResult = {
  agentId: string;
  name: string;
  ok: boolean;
  modelId: string;
  via?: string;
  error?: string;
};

export type GroupGenerateResult = {
  messages: GroupMessage[];
  results: GroupGenerateMemberResult[];
  label: string;
  error?: string;
  sessionExpired?: boolean;
};

function findAgent(agentId: string): RegistryAgent | null {
  return loadAgents().agents.find((a) => a.id === agentId) ?? null;
}

function systemPromptForMember(agent: RegistryAgent): string {
  return systemPromptForRegistryAgent(
    agent,
    isChiefId(agent.id) ? "council-chair" : "council-member"
  );
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
  const primary =
    route.primaryModelId?.trim() || agent?.modelId?.trim() || "agentchat";
  return {
    primary,
    secondary: route.secondaryModelId,
    preference: route.preference,
    providerTarget: route.providerTarget,
  };
}

function formatThreadContext(messages: GroupMessage[], limit = 24): string {
  const slice = messages.slice(-limit);
  if (!slice.length) return "(no prior messages)";
  return slice
    .map((m) => {
      const who = m.who === "user" ? "User" : m.who;
      const text = m.text.trim().replace(/\s+/g, " ");
      return `${who}: ${text}`;
    })
    .join("\n");
}

function debatePrompt(agent: RegistryAgent, thread: GroupMessage[]): string {
  const context = formatThreadContext(thread);
  return (
    `Council thread so far:\n${context}\n\n` +
    `Respond as ${agent.name} only. Advance the debate on the user's latest request. ` +
    `If naming or shortlisting is asked, contribute concrete options from your role.`
  );
}

/**
 * One council round: optional user text, then each voting member replies via routeGenerate.
 * Fail-closed per member (visible error line) — never silent-empty the whole council.
 */
export async function runGroupGenerate(
  groupId: string,
  opts?: { text?: string | null }
): Promise<GroupGenerateResult | null> {
  const group = getNamedGroup(groupId);
  if (!group) return null;

  if (isGroupSessionExpired(group)) {
    const mins = group.maxDurationMinutes ?? 0;
    const msg = `Session time limit reached (${mins} min) — generate blocked (fail closed). End or reopen the session, or raise Max time.`;
    appendNamedGroupMessage(groupId, { who: "system", text: msg, decide: true });
    return {
      messages: getGroupMessages(groupId) ?? [],
      results: [],
      label: "Session time expired",
      error: msg,
      sessionExpired: true,
    };
  }

  const text = opts?.text != null ? String(opts.text).trim() : "";
  if (text) {
    appendNamedGroupMessage(groupId, { who: "user", text });
  }

  let thread = getGroupMessages(groupId) ?? [];
  if (!thread.some((m) => m.who === "user" && m.text.trim())) {
    appendNamedGroupMessage(groupId, {
      who: "system",
      text: "No user message to debate — send a prompt first.",
      decide: true,
    });
    return {
      messages: getGroupMessages(groupId) ?? [],
      results: [],
      label: "No user message",
    };
  }

  const results: GroupGenerateMemberResult[] = [];
  // Voting members only — observers sit in the room but do not generate.
  const observerSet = new Set(group.observerIds ?? []);
  const memberIds = (group.memberIds.length ? group.memberIds : ["chief"]).filter(
    (id) => !observerSet.has(id)
  );

  for (const agentId of memberIds) {
    const agent = findAgent(agentId);
    const name = agent?.name ?? agentId;
    const { primary, secondary, preference, providerTarget } = resolveMemberModel(
      agentId,
      agent
    );

    if (!agent) {
      const err = `Unknown council member "${agentId}" — skipped.`;
      appendNamedGroupMessage(groupId, { who: "system", text: err, decide: true });
      results.push({ agentId, name, ok: false, modelId: primary, error: err });
      continue;
    }

    try {
      const result = await routeGenerate({
        prompt: debatePrompt(agent, thread),
        modelId: primary,
        secondaryModelId: secondary,
        systemPrompt: systemPromptForMember(agent),
        routePreference: preference,
        providerTarget,
        agentId,
      });

      const meta = chatMetaFromGenerate(primary, secondary, result, { agentId });

      if (result.via !== "offline" && result.text?.trim()) {
        const reply = result.text.trim();
        appendNamedGroupMessage(groupId, { who: agentId, text: reply, meta });
        results.push({
          agentId,
          name,
          ok: true,
          modelId: primary,
          via: result.via,
        });
      } else {
        const { message } = chiefGenerateFailureDetail(primary, result.reason, { bumpStreak: false });
        const failText = await offlineAgentReply(name, primary, result.reason);
        appendNamedGroupMessage(groupId, {
          who: agentId,
          text: failText,
          meta: {
            ...meta,
            reason: result.reason ?? "generate_offline",
          },
        });
        results.push({
          agentId,
          name,
          ok: false,
          modelId: primary,
          via: result.via,
          error: message,
        });
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const failText = `${name} is blocked (fail closed). Generate threw: ${detail}`;
      appendNamedGroupMessage(groupId, {
        who: agentId,
        text: failText,
        meta: {
          primary,
          agentId,
          estimatedCostUsd: 0,
          costTrace: {
            stages: [{ stage: "llm", latencyMs: 0, estimatedCostUsd: 0, via: "offline" }],
            totalLatencyMs: 0,
            totalEstimatedCostUsd: 0,
            totalTokens: 0,
          },
        },
      });
      results.push({
        agentId,
        name,
        ok: false,
        modelId: primary,
        error: detail,
      });
    }

    thread = getGroupMessages(groupId) ?? thread;
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  const label =
    failCount === 0
      ? `Council round complete (${okCount} replies)`
      : `Council round complete (${okCount} ok, ${failCount} failed closed)`;

  return {
    messages: getGroupMessages(groupId) ?? [],
    results,
    label,
  };
}
