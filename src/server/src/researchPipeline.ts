/** Research brief → gather → draft → report via routeGenerate (Research agent).
 * Deep / predictive modes fan out to capped virtual agents from selectedModelPool.
 */

import { loadAgents, type RegistryAgent } from "./agents.js";
import {
  chiefGenerateFailureDetail,
  parseProviderModelId,
  resolveAgentRoute,
  routeGenerate,
} from "./llm-routing.js";
import { agentReplyPolicy } from "./reply-policy.js";
import { buildAgentSystemPrompt } from "./agentSystemPrompt.js";
import { addLessonFromResearch } from "./lessons.js";
import {
  getAgentModelAssignment,
  listTasks,
  patchTask,
  pushAgentThreadMessages,
} from "./store.js";
import type { AgentTask, ChatMessage } from "./types.js";
import {
  mapWithConcurrency,
  resolveVirtualAgentPool,
  type VirtualAgentSlot,
  type VirtualPoolPreview,
} from "./researchVirtualAgents.js";
import { deskLiveWebGather, isDeskDaemonLive } from "./deskBrowser.js";

/** One-line report headers — keep short (no paragraph walls). */
export const WEB_SEARCH_DISCLAIMER =
  "Based on model knowledge — live web was not used.";

export const LIVE_WEB_DISCLAIMER =
  "Grounded in live web via Virtual Desk.";

export const LIVE_WEB_OFFLINE_DISCLAIMER =
  "Live web skipped (Desk offline) — model knowledge only.";

export const PREDICTIVE_DISCLAIMER =
  "Scenario rehearsal, not a calibrated forecast.";

export type ResearchBriefOpts = {
  researchId: string;
  question: string;
  agentId: string;
  type: string;
  depth: string;
  selection: string;
  format: string;
  participate: boolean;
  /** Cap for virtual-agent fan-out (deep / predictive). */
  maxVirtualAgents?: number | null;
  /** Default true for deep + predictive; false forces single-agent path. */
  multiAgent?: boolean | null;
  /** Prefer free OpenRouter + Ollama before paid (default true). */
  preferFree?: boolean | null;
  /**
   * When true, attempt live page fetch/search via Desk browser (:3456).
   * Fail-closed to model knowledge + honest disclaimer when Desk offline / empty.
   */
  liveWeb?: boolean | null;
};

export type ResearchStepResult = {
  step: "gather" | "draft" | "review" | "report" | "fanout" | string;
  ok: boolean;
  error?: string;
  via?: string;
  detail?: string;
};

export type ResearchPipelineResult = {
  ok: boolean;
  stub: false;
  webSearchAvailable: boolean;
  disclaimer: string;
  report?: string;
  steps: ResearchStepResult[];
  error?: string;
  message: string;
  tasks: AgentTask[];
  virtualPool?: VirtualPoolPreview;
  multiAgent?: boolean;
  liveWebRequested?: boolean;
  deskLive?: boolean;
};

function msgId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findAgent(agentId: string): RegistryAgent | null {
  return loadAgents().agents.find((a) => a.id === agentId) ?? null;
}

function tasksForResearch(researchId: string): AgentTask[] {
  return listTasks().filter((t) => t.researchId === researchId);
}

function findStepTask(researchId: string, step: string): AgentTask | undefined {
  return tasksForResearch(researchId).find((t) => t.step === step);
}

function wantsMultiAgent(opts: ResearchBriefOpts): boolean {
  if (opts.multiAgent === false) return false;
  if (opts.multiAgent === true) return true;
  return opts.type === "deep" || opts.type === "predictive";
}

function isPredictive(opts: ResearchBriefOpts): boolean {
  return opts.type === "predictive";
}

function formatBriefUserMessage(opts: ResearchBriefOpts): string {
  return [
    "[Research brief]",
    `Type: ${opts.type}`,
    `Depth: ${opts.depth}`,
    `Answer selection: ${opts.selection}`,
    `Report format: ${opts.format}`,
    `User participation: ${opts.participate ? "yes" : "no"}`,
    `Multi-agent: ${wantsMultiAgent(opts) ? "yes" : "no"}`,
    `Live web (Virtual Desk): ${opts.liveWeb ? "requested" : "off"}`,
    opts.maxVirtualAgents != null ? `Max virtual agents: ${opts.maxVirtualAgents}` : null,
    "",
    "Question:",
    opts.question.trim(),
  ]
    .filter((line) => line != null)
    .join("\n");
}

function formatGuidance(opts: ResearchBriefOpts): string {
  const depthHint =
    opts.depth === "5m"
      ? "Keep it short (about a 5-minute skim)."
      : opts.depth === "thorough"
        ? "Be thorough; cover major angles and caveats."
        : opts.depth === "30m"
          ? "Aim for solid coverage without padding."
          : "Balanced depth — useful without fluff.";
  const typeHint =
    opts.type === "factcheck"
      ? "Focus on verifying the claim; separate supported vs unsupported."
      : opts.type === "compare"
        ? "Compare options side-by-side with clear tradeoffs."
        : opts.type === "literature"
          ? "Emphasize known literature themes and citation-style pointers (names/titles only if confident)."
          : opts.type === "quick"
            ? "Prioritize the fastest useful answer."
            : opts.type === "predictive"
              ? "Predictive mode: forecast, scenarios (base/upside/downside), leading indicators, assumptions, and branch points. Label uncertainty honestly — not calibrated probabilities."
              : "Deep dive — structure findings clearly; synthesize multiple angles.";
  const selectionHint =
    opts.selection === "cited"
      ? "Prefer well-known / widely referenced points."
      : opts.selection === "consensus"
        ? "Highlight where sources typically agree."
        : opts.selection === "newest"
          ? "Prefer recent developments when known."
          : "Show agreements and disagreements clearly.";
  const formatHint =
    opts.format === "bullets"
      ? "Output as a clear bullet list."
      : opts.format === "citations"
        ? "Lead with citation-style pointers, then findings."
        : opts.format === "executive"
          ? "Executive summary first, then brief supporting detail."
          : "Short memo structure (headline, findings, caveats).";
  return `${depthHint} ${typeHint} ${selectionHint} ${formatHint}`;
}

function systemPromptFor(agent: RegistryAgent, liveWebActive: boolean): string {
  const webBit = liveWebActive
    ? `${LIVE_WEB_DISCLAIMER} Cite only Desk-fetched URLs/excerpts when present. Do not invent other URLs.`
    : `${WEB_SEARCH_DISCLAIMER} Do not invent live URLs or claim you browsed the web.`;
  return buildAgentSystemPrompt({
    agentId: agent.id,
    kind: "specialist",
    name: agent.name,
    role: agent.role,
    roleTag: agent.roleTag,
    skills: agent.skills.length ? agent.skills : ["research", "citations"],
    extra:
      `You are running an automated research pipeline step. ${webBit} ` +
      "Do not write a long Disclaimer paragraph — a one-line source note is prepended separately. " +
      "If unsure, say so. Never fake tool runs.",
  });
}

function virtualSystemPrompt(slot: VirtualAgentSlot, predictive: boolean, liveWebActive: boolean): string {
  const webBit = liveWebActive ? LIVE_WEB_DISCLAIMER : WEB_SEARCH_DISCLAIMER;
  return (
    `You are a virtual research specialist (${slot.label}) contributing one angle only. ` +
    `Your assigned angle: ${slot.angle}. ` +
    `${webBit} ` +
    (predictive ? `${PREDICTIVE_DISCLAIMER} ` : "") +
    (liveWebActive
      ? `Use the shared live-web excerpts when relevant; do not invent other URLs. `
      : `Stay on your angle; do not invent live URLs or claim you searched the web. `) +
    `Be concrete and concise. Flag uncertainty. Do not write a long Disclaimer paragraph. ` +
    agentReplyPolicy()
  );
}

/** Strip model-written disclaimer walls; keep a single short source line. */
function withShortDisclaimer(reportText: string, disclaimer: string): string {
  let text = reportText.trim();
  // Drop leading **Disclaimer:** / **Source Note:** / Disclaimer: blocks.
  text = text.replace(
    /^(?:\*\*?Disclaimer:?\*\*?|\*\*?Source Note:?\*\*?|Disclaimer:|Source Note:)\s*[^\n]*(?:\n(?!\n|#{1,3}\s|\*\*)[^\n]*)*\n*/i,
    ""
  );
  // Drop leading one-liners we or the model already added about live web / model knowledge.
  text = text.replace(
    /^(?:Based on model knowledge[^\n]*|Grounded in live web[^\n]*|Live web (?:skipped|excerpts|search|via)[^\n]*|Findings (?:are )?based[^\n]*)\n+/i,
    ""
  );
  text = text.replace(/^\*{3,}\s*\n+/, "").trim();
  if (!text) return disclaimer;
  return `${disclaimer}\n\n${text}`;
}

function resolveModels(agentId: string, agent: RegistryAgent | null): {
  primary: string;
  secondary: string | null;
  preference: ReturnType<typeof resolveAgentRoute>["preference"];
  providerTarget: ReturnType<typeof resolveAgentRoute>["providerTarget"];
} {
  const route = resolveAgentRoute(agentId);
  const ov = getAgentModelAssignment(agentId);
  const primary =
    route.primaryModelId?.trim() || ov.primary?.trim() || agent?.modelId?.trim() || "agentchat";
  const secondary =
    route.secondaryModelId ?? ov.secondary ?? agent?.secondaryModelId ?? null;
  return {
    primary,
    secondary,
    preference: route.preference,
    providerTarget: route.providerTarget,
  };
}

async function generateStep(input: {
  agent: RegistryAgent;
  agentId: string;
  prompt: string;
  modelId?: string;
  systemPrompt?: string;
  liveWebActive?: boolean;
  routePreference?: ReturnType<typeof resolveAgentRoute>["preference"];
  providerTarget?: ReturnType<typeof resolveAgentRoute>["providerTarget"];
}): Promise<
  | { ok: true; text: string; via: string; primary: string }
  | { ok: false; error: string; primary: string; via?: string }
> {
  const resolved = resolveModels(input.agentId, input.agent);
  const primary = input.modelId?.trim() || resolved.primary;
  const secondary = input.modelId?.trim() ? null : resolved.secondary;
  const preference = input.routePreference ?? resolved.preference;
  const providerTarget = input.providerTarget ?? resolved.providerTarget;
  try {
    const result = await routeGenerate({
      prompt: input.prompt,
      modelId: primary,
      secondaryModelId: secondary,
      systemPrompt: input.systemPrompt ?? systemPromptFor(input.agent, input.liveWebActive === true),
      routePreference: preference,
      providerTarget,
      agentId: input.agentId,
    });
    if (result.via !== "offline" && result.text?.trim()) {
      return { ok: true, text: result.text.trim(), via: result.via, primary };
    }
    const { message } = chiefGenerateFailureDetail(primary, result.reason);
    return { ok: false, error: message, primary, via: result.via };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: detail, primary };
  }
}

function clipNote(s: string, n = 280): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function formatFanoutNotes(
  results: { slot: VirtualAgentSlot; ok: boolean; text?: string; error?: string; via?: string }[]
): string {
  return results
    .map((r, i) => {
      const head = `### Virtual agent ${i + 1}: ${r.slot.label}\nAngle: ${r.slot.angle}\nModel: ${r.slot.modelId}` +
        (r.via ? ` · via ${r.via}` : "");
      if (!r.ok) return `${head}\nStatus: FAILED — ${r.error ?? "unknown"}`;
      return `${head}\n${r.text ?? ""}`;
    })
    .join("\n\n");
}

/**
 * Run gather → draft → (auto-pass review) → report for a researchId.
 * Deep / predictive: fan-out gather across capped virtual agents from the model pool.
 * Optional live web via Virtual Desk browser (:3456); fail-closed to model knowledge when offline.
 * Fail-closed: no invented report when generate fails; never invent search results.
 */
export async function runResearchPipeline(opts: ResearchBriefOpts): Promise<ResearchPipelineResult> {
  const liveWebRequested = opts.liveWeb === true;
  const steps: ResearchStepResult[] = [];
  const agentId = opts.agentId.trim() || "research";
  const agent = findAgent(agentId);
  const multiAgent = wantsMultiAgent(opts);
  let virtualPool: VirtualPoolPreview | undefined;
  let webSearchAvailable = false;
  let deskLive = false;
  let liveEvidence = "";

  if (liveWebRequested) {
    deskLive = await isDeskDaemonLive();
    if (deskLive) {
      const live = await deskLiveWebGather({
        query: opts.question,
        agentId,
        maxPages: opts.depth === "thorough" || opts.depth === "30m" ? 3 : 2,
      });
      deskLive = live.deskLive;
      if (live.ok && live.webSearchAvailable && live.evidenceText) {
        webSearchAvailable = true;
        liveEvidence = live.evidenceText;
        steps.push({
          step: "liveweb",
          ok: true,
          via: "desk-browser",
          detail: `${live.pages.length} page(s) fetched`,
        });
      } else {
        steps.push({
          step: "liveweb",
          ok: false,
          error: live.error ?? "No usable live pages",
          via: "desk-browser",
        });
      }
    } else {
      steps.push({
        step: "liveweb",
        ok: false,
        error: "Desk offline on :3456",
        via: "desk-browser",
      });
    }
  }

  const webDisclaimer = webSearchAvailable
    ? LIVE_WEB_DISCLAIMER
    : liveWebRequested
      ? LIVE_WEB_OFFLINE_DISCLAIMER
      : WEB_SEARCH_DISCLAIMER;
  const disclaimer = isPredictive(opts) ? `${webDisclaimer} ${PREDICTIVE_DISCLAIMER}` : webDisclaimer;

  const pushThread = (messages: ChatMessage[]) => {
    pushAgentThreadMessages(agentId, messages);
  };

  const briefUser: ChatMessage = {
    id: msgId(),
    role: "user",
    text: formatBriefUserMessage(opts),
    at: new Date().toISOString(),
    meta: { agentId, source: "in-app", intentId: "research.brief" },
  };
  const startSystem: ChatMessage = {
    id: msgId(),
    role: "system",
    text:
      (multiAgent
        ? `Research pipeline started (multi-agent fan-out → draft → report). `
        : `Research pipeline started (gather → draft → report). `) +
      (webSearchAvailable
        ? `Live web: ${steps.find((s) => s.step === "liveweb")?.detail ?? "pages fetched"}. `
        : liveWebRequested
          ? "Live web skipped (Desk offline or empty). "
          : "") +
      disclaimer,
    at: new Date().toISOString(),
    meta: { agentId, source: "in-app", intentId: "research.pipeline" },
  };
  pushThread([briefUser, startSystem]);

  if (webSearchAvailable && liveEvidence) {
    pushThread([
      {
        id: msgId(),
        role: "system",
        text: `### Live web evidence (Virtual Desk)\n\n${liveEvidence}`,
        at: new Date().toISOString(),
        meta: { agentId, source: "browser", intentId: "research.liveweb" },
      },
    ]);
  }

  const liveBlock = webSearchAvailable && liveEvidence
    ? `\n\nLive web excerpts (Virtual Desk — use only these as live sources):\n${liveEvidence}\n`
    : "";
  const noInvent = webSearchAvailable
    ? `Cite only URLs present in the live excerpts. Do not invent additional URLs.`
    : `Do not invent URLs or claim you searched the live web.`;
  if (!agent) {
    const gather = findStepTask(opts.researchId, "gather");
    if (gather) {
      patchTask(gather.id, {
        status: "blocked",
        note: `Unknown agent "${agentId}" — pipeline stopped (fail closed).`,
      });
    }
    const err = `Unknown research agent "${agentId}" — pipeline stopped (fail closed).`;
    pushThread([
      {
        id: msgId(),
        role: "system",
        text: err,
        at: new Date().toISOString(),
        meta: { agentId, source: "in-app", intentId: "research.pipeline" },
      },
    ]);
    return {
      ok: false,
      stub: false,
      webSearchAvailable,
      disclaimer,
      steps,
      error: err,
      message: err,
      tasks: tasksForResearch(opts.researchId),
      multiAgent,
      liveWebRequested,
      deskLive,
    };
  }

  const guidance = formatGuidance(opts);
  const question = opts.question.trim();
  const predictive = isPredictive(opts);
  const liveWebActive = webSearchAvailable;

  // —— gather (single or multi-agent fan-out) ——
  const gatherTask = findStepTask(opts.researchId, "gather");
  if (gatherTask) {
    patchTask(gatherTask.id, {
      status: "ongoing",
      note: multiAgent ? "Running multi-agent gather…" : "Running gather…",
    });
  }

  let gatherText = "";
  let gatherVia = "pipeline";
  let gatherPrimary = resolveModels(agentId, agent).primary;

  if (multiAgent) {
    virtualPool = await resolveVirtualAgentPool({
      maxAgents: opts.maxVirtualAgents,
      preferFree: opts.preferFree !== false,
      mode: predictive ? "predictive" : "deep",
    });

    if (virtualPool.agents.length === 0) {
      const err =
        virtualPool.emptyReason ??
        "No usable virtual agents from selectedModelPool (fail closed).";
      steps.push({ step: "fanout", ok: false, error: err });
      steps.push({ step: "gather", ok: false, error: err });
      if (gatherTask) {
        patchTask(gatherTask.id, { status: "blocked", note: clipNote(err) });
      }
      pushThread([
        {
          id: msgId(),
          role: "system",
          text: `${err} No report was invented (fail closed).`,
          at: new Date().toISOString(),
          meta: { agentId, source: "in-app", intentId: "research.pipeline" },
        },
      ]);
      return {
        ok: false,
        stub: false,
        webSearchAvailable,
        disclaimer,
        steps,
        error: err,
        message: `${err} Tasks updated; no report posted.`,
        tasks: tasksForResearch(opts.researchId),
        virtualPool,
        multiAgent,
        liveWebRequested,
        deskLive,
      };
    }

    pushThread([
      {
        id: msgId(),
        role: "system",
        text:
          `Fan-out: ${virtualPool.agents.length} virtual agent(s) ` +
          `(cap ${virtualPool.maxAgents}, concurrency ${virtualPool.concurrency}` +
          `${virtualPool.usedPaid ? ", includes paid" : ", free/local preferred"}). ` +
          virtualPool.agents.map((a) => a.label).join("; "),
        at: new Date().toISOString(),
        meta: { agentId, source: "in-app", intentId: "research.fanout" },
      },
    ]);

    let fanDone = 0;
    const fanTotal = virtualPool.agents.length;
    const fanResults = await mapWithConcurrency(
      virtualPool.agents,
      virtualPool.concurrency,
      async (slot, index) => {
        pushThread([
          {
            id: msgId(),
            role: "system",
            text: `Virtual agent ${index + 1}/${fanTotal} starting · ${slot.label} — ${clipNote(slot.angle, 120)}`,
            at: new Date().toISOString(),
            meta: { agentId, source: "in-app", intentId: "research.fanout.progress" },
          },
        ]);

        const prompt =
          `Research question:\n${question}\n\n` +
          `Pipeline step: VIRTUAL GATHER (${slot.slotId}).\n` +
          `Your angle only: ${slot.angle}\n` +
          `${guidance}\n\n` +
          `${disclaimer}\n` +
          `${liveBlock}\n` +
          (predictive
            ? `Contribute forecast / scenario / indicator notes for your angle. `
            : `List key facts, uncertainties, and (if confident) well-known source names. `) +
          `${noInvent} Keep it structured and concise.`;

        const gen = await generateStep({
          agent,
          agentId,
          prompt,
          modelId: slot.modelId,
          systemPrompt: virtualSystemPrompt(slot, predictive, liveWebActive),
          liveWebActive,
          // Pin to the virtual model: cloud when provider-prefixed, else local stack
          routePreference: parseProviderPref(slot.modelId),
          providerTarget: parseProviderTarget(slot.modelId),
        });

        fanDone += 1;
        if (!gen.ok) {
          pushThread([
            {
              id: msgId(),
              role: "system",
              text: `Virtual agent ${index + 1}/${fanTotal} failed (${fanDone}/${fanTotal} done) · ${slot.label} — ${clipNote(gen.error ?? "unknown", 160)}`,
              at: new Date().toISOString(),
              meta: { agentId, source: "in-app", intentId: "research.fanout.progress" },
            },
          ]);
          return { slot, ok: false as const, error: gen.error, via: gen.via };
        }
        pushThread([
          {
            id: msgId(),
            role: "system",
            text: `Virtual agent ${index + 1}/${fanTotal} notes ready (${fanDone}/${fanTotal}) · ${slot.label}`,
            at: new Date().toISOString(),
            meta: { agentId, source: "in-app", intentId: "research.fanout.progress" },
          },
          {
            id: msgId(),
            role: "agent",
            text: `### Partial notes — ${slot.label}\nAngle: ${slot.angle}\n\n${clipNote(gen.text, 1200)}`,
            at: new Date().toISOString(),
            meta: {
              agentId,
              source: "llm",
              intentId: "research.fanout.note",
              primary: slot.modelId,
              via: gen.via,
            },
          },
        ]);
        return { slot, ok: true as const, text: gen.text, via: gen.via };
      }
    );

    const okCount = fanResults.filter((r) => r.ok).length;
    steps.push({
      step: "fanout",
      ok: okCount > 0,
      detail: `${okCount}/${fanResults.length} virtual agents returned notes`,
      via: "multi",
    });

    if (okCount === 0) {
      const err = `All ${fanResults.length} virtual agents failed — no gather notes (fail closed).`;
      steps.push({ step: "gather", ok: false, error: err });
      if (gatherTask) {
        patchTask(gatherTask.id, {
          status: "blocked",
          note: clipNote(err),
        });
      }
      pushThread([
        {
          id: msgId(),
          role: "system",
          text: `${err} No report was invented (fail closed).`,
          at: new Date().toISOString(),
          meta: { agentId, source: "in-app", intentId: "research.pipeline" },
        },
      ]);
      return {
        ok: false,
        stub: false,
        webSearchAvailable,
        disclaimer,
        steps,
        error: err,
        message: `${err} Tasks updated; no report posted.`,
        tasks: tasksForResearch(opts.researchId),
        virtualPool,
        multiAgent,
        liveWebRequested,
        deskLive,
      };
    }

    gatherText = formatFanoutNotes(fanResults);
    gatherVia = "multi";
    steps.push({
      step: "gather",
      ok: true,
      via: gatherVia,
      detail: `${okCount} agent note(s)`,
    });
    if (gatherTask) {
      patchTask(gatherTask.id, {
        status: "completed",
        note: clipNote(`Multi-agent gather: ${okCount}/${fanResults.length} ok`),
      });
    }
  } else {
    const gatherPrompt =
      `Research question:\n${question}\n\n` +
      `Pipeline step: GATHER.\n${guidance}\n\n` +
      `${disclaimer}\n` +
      `${liveBlock}\n` +
      (predictive
        ? `List forecast angles, scenario axes, leading indicators, and key uncertainties. `
        : `List the key angles, known facts, uncertainties, and (if confident) well-known source names or paper/book titles worth checking. `) +
      `${noInvent} Keep it structured and concise.`;

    const gather = await generateStep({ agent, agentId, prompt: gatherPrompt, liveWebActive });
    if (!gather.ok) {
      steps.push({ step: "gather", ok: false, error: gather.error, via: gather.via });
      if (gatherTask) {
        patchTask(gatherTask.id, {
          status: "blocked",
          note: clipNote(`Gather failed: ${gather.error}`),
        });
      }
      const err = `Gather failed — ${gather.error}`;
      pushThread([
        {
          id: msgId(),
          role: "system",
          text: `${err} No report was invented (fail closed).`,
          at: new Date().toISOString(),
          meta: { agentId, source: "in-app", intentId: "research.pipeline", primary: gather.primary },
        },
      ]);
      return {
        ok: false,
        stub: false,
        webSearchAvailable,
        disclaimer,
        steps,
        error: err,
        message: `${err} Tasks updated; no report posted.`,
        tasks: tasksForResearch(opts.researchId),
        multiAgent,
        liveWebRequested,
        deskLive,
      };
    }
    gatherText = gather.text;
    gatherVia = gather.via;
    gatherPrimary = gather.primary;
    steps.push({ step: "gather", ok: true, via: gather.via });
    if (gatherTask) {
      patchTask(gatherTask.id, { status: "completed", note: clipNote(gather.text) });
    }
  }

  // —— draft ——
  pushThread([
    {
      id: msgId(),
      role: "system",
      text: multiAgent
        ? "Gather complete — drafting synthesis from virtual-agent notes…"
        : "Gather complete — drafting findings…",
      at: new Date().toISOString(),
      meta: { agentId, source: "in-app", intentId: "research.pipeline" },
    },
  ]);
  const draftTask = findStepTask(opts.researchId, "draft");
  if (draftTask) {
    patchTask(draftTask.id, { status: "ongoing", note: "Running draft…" });
  }
  const draftPrompt =
    `Research question:\n${question}\n\n` +
    `Gather notes${multiAgent ? " (multi-agent fan-out)" : ""}:\n${gatherText}\n\n` +
    `Pipeline step: DRAFT.\n${guidance}\n\n` +
    `${disclaimer}\n` +
    `${liveBlock}\n` +
    (predictive
      ? `Draft a predictive memo: base/upside/downside scenarios, leading indicators, assumptions, branch points. Flag uncertainty. `
      : `Write draft findings from the gather notes${liveWebActive ? " and live excerpts" : " and your knowledge"}. Flag uncertainty. `) +
    `${noInvent}`;

  const draft = await generateStep({ agent, agentId, prompt: draftPrompt, liveWebActive });
  if (!draft.ok) {
    steps.push({ step: "draft", ok: false, error: draft.error, via: draft.via });
    if (draftTask) {
      patchTask(draftTask.id, {
        status: "blocked",
        note: clipNote(`Draft failed: ${draft.error}`),
      });
    }
    const err = `Draft failed — ${draft.error}`;
    pushThread([
      {
        id: msgId(),
        role: "system",
        text: `${err} Gather notes were saved on Tasks; no report invented (fail closed).`,
        at: new Date().toISOString(),
        meta: { agentId, source: "in-app", intentId: "research.pipeline", primary: draft.primary },
      },
    ]);
    return {
      ok: false,
      stub: false,
      webSearchAvailable,
      disclaimer,
      steps,
      error: err,
      message: `${err} Tasks updated; no report posted.`,
      tasks: tasksForResearch(opts.researchId),
      virtualPool,
      multiAgent,
      liveWebRequested,
      deskLive,
    };
  }
  steps.push({ step: "draft", ok: true, via: draft.via });
  if (draftTask) {
    patchTask(draftTask.id, { status: "completed", note: clipNote(draft.text) });
  }

  // —— review (auto-pass for MVP) ——
  const reviewTask = findStepTask(opts.researchId, "review");
  if (reviewTask) {
    patchTask(reviewTask.id, {
      status: "completed",
      note: multiAgent
        ? "Auto-passed — multi-agent gather used for report"
        : "Auto-passed for MVP — draft used for report",
    });
  }
  steps.push({ step: "review", ok: true });

  // —— report ——
  pushThread([
    {
      id: msgId(),
      role: "system",
      text: "Draft ready — writing final research report…",
      at: new Date().toISOString(),
      meta: { agentId, source: "in-app", intentId: "research.pipeline" },
    },
  ]);
  const reportTask = findStepTask(opts.researchId, "report");
  if (reportTask) {
    patchTask(reportTask.id, { status: "ongoing", note: "Writing report…" });
  }
  const reportPrompt =
    `Research question:\n${question}\n\n` +
    `Gather notes:\n${gatherText}\n\n` +
    `Draft findings:\n${draft.text}\n\n` +
    `Pipeline step: REPORT.\n${guidance}\n\n` +
    `${liveBlock}\n` +
    `Produce the final research report in the requested format. ` +
    `Do NOT write a Disclaimer section or paragraph — a one-line source note is prepended automatically. ` +
    `Begin directly with the report body` +
    (predictive ? ` (scenario rehearsal, not a calibrated forecast)` : "") +
    `. ` +
    (webSearchAvailable
      ? `Cite only URLs present in the live excerpts. `
      : "") +
    (predictive
      ? `Include sections: Forecast headline; Scenarios (base / upside / downside); Leading indicators; Assumptions & weak points; Branch points; Limitations. `
      : "") +
    (multiAgent ? `Mention that findings synthesized ${virtualPool?.agents.length ?? "multiple"} virtual-agent angles. ` : "") +
    `${noInvent} End with a short "Limitations" section.`;

  const reportGen = await generateStep({ agent, agentId, prompt: reportPrompt, liveWebActive });
  if (!reportGen.ok) {
    steps.push({ step: "report", ok: false, error: reportGen.error, via: reportGen.via });
    if (reportTask) {
      patchTask(reportTask.id, {
        status: "blocked",
        note: clipNote(`Report failed: ${reportGen.error}`),
      });
    }
    const err = `Report failed — ${reportGen.error}`;
    pushThread([
      {
        id: msgId(),
        role: "system",
        text: `${err} Draft is on Tasks; no report invented (fail closed).`,
        at: new Date().toISOString(),
        meta: {
          agentId,
          source: "in-app",
          intentId: "research.pipeline",
          primary: reportGen.primary,
        },
      },
    ]);
    return {
      ok: false,
      stub: false,
      webSearchAvailable,
      disclaimer,
      steps,
      error: err,
      message: `${err} Tasks updated; no report posted.`,
      tasks: tasksForResearch(opts.researchId),
      virtualPool,
      multiAgent,
      liveWebRequested,
      deskLive,
    };
  }

  const reportText = withShortDisclaimer(reportGen.text, disclaimer);

  steps.push({ step: "report", ok: true, via: reportGen.via });
  if (reportTask) {
    patchTask(reportTask.id, { status: "completed", note: clipNote(reportText) });
  }

  pushThread([
    {
      id: msgId(),
      role: "agent",
      text: reportText,
      at: new Date().toISOString(),
      meta: {
        agentId,
        source: "llm",
        intentId: "research.report",
        primary: reportGen.primary || gatherPrimary,
        via: reportGen.via,
      },
    },
  ]);

  addLessonFromResearch({
    question,
    report: reportText,
    agentId,
    researchId: opts.researchId,
  });

  const agentNote = multiAgent
    ? ` multi-agent (${virtualPool?.agents.length ?? 0} virtual)`
    : "";
  const webNote = webSearchAvailable ? " · live web via Desk" : liveWebRequested ? " · live web unavailable" : "";

  return {
    ok: true,
    stub: false,
    webSearchAvailable,
    disclaimer,
    report: reportText,
    steps,
    message: `Research report ready${agentNote}${webNote} — posted to Research chat; gather/draft/report marked done on Tasks.`,
    tasks: tasksForResearch(opts.researchId),
    virtualPool,
    multiAgent,
    liveWebRequested,
    deskLive,
  };
}

function parseProviderPref(
  modelId: string
): ReturnType<typeof resolveAgentRoute>["preference"] {
  return parseProviderModelId(modelId) ? "provider" : "local";
}

function parseProviderTarget(
  modelId: string
): ReturnType<typeof resolveAgentRoute>["providerTarget"] {
  return parseProviderModelId(modelId) ?? undefined;
}
