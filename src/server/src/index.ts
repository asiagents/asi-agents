import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { mountDeskRoutes, mountBrowserRoutes, ensureDeskDaemon } from "@asi-agents/virtual-computer";
import { getAgentChatThread, postAgentChat } from "./agentChat.js";
import { getProChatThread, postProChat } from "./proChat.js";
import { ChiefGenerateError, getChiefThread, postChiefChat } from "./chief.js";
import { listModels, probeHardware } from "./models.js";
import { getModelsCatalog } from "./models.catalog.js";
import { getSkillsCatalog } from "./skills.catalog.js";
import { listModelDownloads } from "./modelDownloads.js";
import { downloadAmsWeights, listAmsInstallSnapshot, placeAmsGguf } from "./ams.models.js";
import { normalizeOllamaPullTag, pullOllamaModel, getOllamaHost } from "./ollamaPull.js";
import { listRecommendedTools } from "./recommendedTools.js";
import {
  fetchProviderModels,
  getMaskedProviderKeys,
  publicProviderMetadata,
  putProviderKey,
  testProviderConnection,
} from "./providers.js";
import { getProviderById } from "./providers.registry.js";
import { probeRouterHealth } from "./llm-routing.js";
import { routerReady } from "./modelPaths.js";
import { buildRegistry } from "./registry.js";
import { createAgents, loadAgents, patchAgentReportsTo } from "./agents.js";
import {
  getAgentLearnings,
  sendAllAgentsToTraining,
  trainingStatusSnapshot,
} from "./agentTraining.js";
import {
  createLesson,
  deleteLesson,
  listLessons,
  patchLesson,
} from "./lessons.js";
import {
  clearCompanyBriefing,
  fetchCompanyBriefingFromUrl,
  getCompanyBriefing,
  setCompanyBriefingFromPaste,
} from "./companyBriefing.js";
import { normalizeBoardStances, type BoardStancesMap } from "./board.js";
import { normalizeBoardTopic, runBoardAsk } from "./boardAsk.js";
import { createTaskFromBoardDecision } from "./boardTicket.js";
import { CUSTOM_SET_ID, listProSets, proSetMemberIds } from "./proSets.js";
import {
  loadState,
  saveState,
  getBoardState,
  updateBoard,
  getCustomProAgentIds,
  setCustomProAgentIds,
  getGroupSession,
  setGroupSession,
  getSelectedModelId,
  setSelectedModelId,
  getSelectedModelPool,
  setSelectedModelPool,
  getModelCascadePrefs,
  setModelCascadePrefs,
  patchAgentModelAssignment,
  listAgentModelAssignments,
  putAgentModelAssignments,
  listAgentRouting,
  putAgentRouting,
  attachImportedSkill,
  detachImportedSkill,
  getUserPrefs,
  setUserPrefs,
  getVoiceDictionary,
  setVoiceDictionary,
  getProviderEnabledMap,
  setProviderEnabled,
} from "./store.js";
import type { ProfileHomeMode, ProfilePrefsSlice, UserProfileId } from "./types.js";
import { DEFAULT_VOICE_DICTIONARY } from "./voiceDictionary.js";
import {
  archiveDeletedLogs,
  emptyRecycleBin,
  listRecycleBin,
  permanentlyDeleteRecycleItem,
  purgeExpiredRecycleBin,
  RECYCLE_RETENTION_OPTIONS,
  restoreRecycleItem,
  setRecycleRetentionDays,
  softClearAgentThread,
  softClearChiefThread,
  softClearGroupMessages,
  softClearProThread,
  softDeleteCustomProAgent,
  softDeleteRegistryAgent,
  startRecycleBinPurgeJob,
} from "./recycleBin.js";
import {
  addChatRosterMember,
  addGroupMember,
  addGroupObserver,
  appendNamedGroupMessage,
  chatRosterIsFiltered,
  createGroupChat,
  deleteGroupChat,
  getActiveGroupId,
  getChatRosterIds,
  getGroupMessages,
  getNamedGroup,
  groupSessionSnapshot,
  listGroupSummaries,
  patchGroupChat,
  removeChatRosterMember,
  removeGroupMember,
  removeGroupObserver,
  setActiveGroupId,
  setChatRosterIds,
  setGroupMembers,
  setNamedGroupProposalDecision,
  switchCouncilMode,
} from "./groupChats.js";
import { runGroupGenerate } from "./groupGenerate.js";
import { runGroupConclude } from "./groupConclude.js";
import { isChiefId } from "./withChief.js";
import { probeNetwork } from "./network.js";
import { probeInternetSpeed } from "./speedTest.js";
import { mountChannelRoutes } from "./channels.js";
import { mountInboxMailRoutes } from "./inbox-mail.js";
import { mountInboxSendRoutes } from "./inbox-send.js";
import { mountTaskRoutes } from "./tasks.js";
import { mountCronRoutes, startCronJob } from "./cron.js";
import { mountAgentApiKeyRoutes, requireAgentApiKeyIfSet } from "./agentApiKeys.js";
import { mountSkillTemplateRoutes } from "./skillTemplates.js";
import { mountCalendarRoutes } from "./calendar.js";
import { mountOAuthClientRoutes } from "./oauthClients.js";
import { mountGoogleDriveRoutes } from "./google-drive.js";
import { mountFileManagerRoutes } from "./files.js";
import { mountAmsRoutes } from "./ams.js";
import { mountAdapterRoutes } from "./adapters.js";
import { mountSkillsGraphRoutes } from "./skills.graph.js";
import { mountKnowledgeGraphRoutes } from "./knowledge.graph.js";
import { mountAuditRoutes } from "./audit.js";
import { mountControlPlaneRoutes } from "./controlPlaneRoutes.js";
import { mountModulesCatalogRoutes } from "./modulesCatalog.js";
import { getPostgresModuleStatus } from "./postgresPrefs.js";
import {
  appendAgentThread,
  appendChiefThread,
  appendProThread,
  parseThreadAppendBody,
} from "./threadAppend.js";
import { getStandingPermissionRules, setStandingPermissionRules } from "./standingPermissions.js";
import type { PermissionPolicy } from "./types.js";
import type { RecycleLogEntry } from "./types.js";

const HOST = (process.env.ASI_SERVER_HOST ?? "127.0.0.1").trim() || "127.0.0.1";
const PORT = Number(process.env.ASI_SERVER_PORT ?? process.env.ASI_ENGINE_PORT ?? 3445);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "8mb" }));

app.get("/health", async (_req, res) => {
  const routerProbe = await probeRouterHealth();
  const artifactsReady = routerReady();
  const live = routerProbe.live;
  res.json({
    ok: true,
    service: "asi-agents-server",
    port: PORT,
    router: {
      port: 7821,
      /** true when nothing answers on :7821 — not the same as artifacts on disk */
      stub: !live,
      artifactsReady,
      status: live ? "live" : "off",
      ...(live
        ? {}
        : {
            startHint: artifactsReady
              ? "npm run start:router — then Ollama and/or LLAMA_CPP_HOST for completions"
              : "Add models/router artifacts, then npm run start:router",
          }),
    },
  });
});

/** Alias for clients that only proxy /api/* (same payload as GET /health). */
app.get("/api/health", async (_req, res) => {
  const routerProbe = await probeRouterHealth();
  const artifactsReady = routerReady();
  const live = routerProbe.live;
  res.json({
    ok: true,
    service: "asi-agents-server",
    port: PORT,
    router: {
      port: 7821,
      stub: !live,
      artifactsReady,
      status: live ? "live" : "off",
      ...(live
        ? {}
        : {
            startHint: artifactsReady
              ? "npm run start:router — then Ollama and/or LLAMA_CPP_HOST for completions"
              : "Add models/router artifacts, then npm run start:router",
          }),
    },
  });
});

app.get("/registry", async (_req, res) => {
  const services = await buildRegistry();
  res.json({ services });
});

app.get("/api/onboarding", (_req, res) => {
  const s = loadState();
  res.json({
    complete: s.onboardingComplete === true,
    path: s.onboardingPath ?? null,
  });
});

app.post("/api/onboarding", (req, res) => {
  const pathChoice = req.body?.path;
  const state = loadState();
  state.onboardingComplete = true;
  if (pathChoice === "chat" || pathChoice === "manual") {
    state.onboardingPath = pathChoice;
  }
  saveState(state);
  res.json({ ok: true, complete: true, path: state.onboardingPath ?? null });
});

app.get("/api/chief/thread", (_req, res) => res.json(getChiefThread()));

/** Clear Chief thread messages (soft-delete into recycle bin; keep model prefs). */
app.delete("/api/chief/thread", (_req, res) => {
  try {
    const messages = softClearChiefThread();
    res.json({ ok: true, messages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "clear failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/chief/chat", async (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text required" });
  const modelId = req.body?.modelId != null ? String(req.body.modelId) : null;
  try {
    const messages = await postChiefChat(text, modelId);
    res.json({ messages });
  } catch (e) {
    if (e instanceof ChiefGenerateError) {
      return res.status(503).json({ error: e.message, code: e.code, tried: e.tried });
    }
    const msg = e instanceof Error ? e.message : "chief chat failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/chief/thread/append", (req, res) => {
  const entries = parseThreadAppendBody(req.body);
  if (!entries) return res.status(400).json({ error: "entries array required" });
  const messages = appendChiefThread(entries);
  if (!messages.length) return res.status(400).json({ error: "no valid messages" });
  res.json({ messages });
});

app.get("/api/agents", (_req, res) => {
  const payload = loadAgents();
  res.json({
    ...payload,
    agents: payload.agents.map((a) => ({
      ...a,
      learnings: getAgentLearnings(a.id),
    })),
  });
});

/** Persist one or more agents into config/agents.registry.json (same path as Chief create-agent intents).
 * Fully local (templates + heuristics) — never calls an LLM / Ollama / OpenRouter.
 * Default hire is flat: omit reportsTo (or null) — do not auto-nest under last agent / invent a tree.
 * Optional brief → skill/model heuristics; primaryModelId from Browse pool or auto-pick.
 */
app.post("/api/agents", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const name = body.name != null ? String(body.name).trim() : "";
  const role = body.role != null ? String(body.role).trim() : "";
  const brief = body.brief != null ? String(body.brief).trim() : "";
  const countRaw = body.count;
  const count =
    typeof countRaw === "number" && Number.isFinite(countRaw)
      ? countRaw
      : typeof countRaw === "string" && /^\d+$/.test(countRaw.trim())
        ? Number(countRaw.trim())
        : undefined;
  const skillsIn = Array.isArray(body.skills) ? body.skills.map(String) : undefined;
  const agentsIn = Array.isArray(body.agents) ? body.agents : undefined;
  const primaryModelId =
    "primaryModelId" in body
      ? body.primaryModelId == null || body.primaryModelId === ""
        ? null
        : String(body.primaryModelId).trim()
      : undefined;
  const secondaryModelId =
    "secondaryModelId" in body
      ? body.secondaryModelId == null || body.secondaryModelId === ""
        ? null
        : String(body.secondaryModelId).trim()
      : undefined;
  const skipAutoModel = body.skipAutoModel === true || body.modelMode === "none";
  const seedWelcome = body.seedWelcome !== false;
  // Optional: only set when caller explicitly provides reportsTo (empty = flat).
  const topReportsTo =
    "reportsTo" in body
      ? body.reportsTo == null || body.reportsTo === ""
        ? null
        : String(body.reportsTo).trim()
      : undefined;
  try {
    if (agentsIn?.length) {
      const result = createAgents({
        skills: skillsIn,
        brief: brief || undefined,
        reportsTo: topReportsTo,
        primaryModelId,
        secondaryModelId,
        skipAutoModel,
        seedWelcome,
        agents: agentsIn.map(
          (row: {
            name?: unknown;
            role?: unknown;
            roleTag?: unknown;
            skills?: unknown;
            brief?: unknown;
            reportsTo?: unknown;
            primaryModelId?: unknown;
            secondaryModelId?: unknown;
          }) => ({
            name: row?.name != null ? String(row.name) : undefined,
            role: row?.role != null ? String(row.role) : undefined,
            roleTag: row?.roleTag != null ? String(row.roleTag) : undefined,
            brief: row?.brief != null ? String(row.brief).trim() || undefined : undefined,
            skills: Array.isArray(row?.skills) ? row.skills.map(String) : undefined,
            primaryModelId:
              row && "primaryModelId" in row
                ? row.primaryModelId == null || row.primaryModelId === ""
                  ? null
                  : String(row.primaryModelId).trim()
                : undefined,
            secondaryModelId:
              row && "secondaryModelId" in row
                ? row.secondaryModelId == null || row.secondaryModelId === ""
                  ? null
                  : String(row.secondaryModelId).trim()
                : undefined,
            reportsTo:
              row && "reportsTo" in row
                ? row.reportsTo == null || row.reportsTo === ""
                  ? null
                  : String(row.reportsTo).trim()
                : undefined,
          })
        ),
      });
      return res.status(201).json(result);
    }
    if (!name && !role && count == null) {
      return res.status(400).json({ error: "name, role, count, or agents[] required" });
    }
    const result = createAgents({
      name: name || undefined,
      role: role || undefined,
      brief: brief || undefined,
      count: count ?? 1,
      skills: skillsIn,
      reportsTo: topReportsTo,
      primaryModelId,
      secondaryModelId,
      skipAutoModel,
      seedWelcome,
    });
    if (!result.created.length) {
      return res.status(500).json({ error: "nothing written" });
    }
    return res.status(201).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "create failed";
    return res.status(500).json({ error: msg });
  }
});

/** Patch org chart manager (`reportsTo`). null/"" = flat peer. Chief forbidden. */
app.patch("/api/agents/:id", (req, res) => {
  const agentId = String(req.params.id ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agent id required" });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (!("reportsTo" in body)) {
    return res.status(400).json({ error: "reportsTo required (string id or null for flat)" });
  }
  const reportsTo =
    body.reportsTo == null || body.reportsTo === "" ? null : String(body.reportsTo).trim();
  const result = patchAgentReportsTo(agentId, reportsTo);
  if ("error" in result) {
    const status =
      result.error.includes("unknown") ? 404 : result.error.includes("Chief") ? 400 : 400;
    return res.status(status).json({ error: result.error });
  }
  res.json({ agent: result.agent, agents: loadAgents().agents });
});

/** Work vs Personal profile prefs (app-state). */
app.get("/api/prefs", (_req, res) => {
  res.json({ prefs: getUserPrefs() });
});

app.put("/api/prefs", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const patch: {
    activeProfile?: UserProfileId;
    profiles?: Partial<Record<UserProfileId, Partial<ProfilePrefsSlice>>>;
    englishOnlyReplies?: boolean;
  } = {};
  if (body.activeProfile === "work" || body.activeProfile === "personal") {
    patch.activeProfile = body.activeProfile;
  }
  if (typeof body.englishOnlyReplies === "boolean") {
    patch.englishOnlyReplies = body.englishOnlyReplies;
  }
  if (body.profiles && typeof body.profiles === "object") {
    const profiles: Partial<Record<UserProfileId, Partial<ProfilePrefsSlice>>> = {};
    for (const id of ["work", "personal"] as UserProfileId[]) {
      const slice = body.profiles[id];
      if (!slice || typeof slice !== "object") continue;
      const next: Partial<ProfilePrefsSlice> = {};
      if (Array.isArray(slice.favoriteAgentIds)) {
        next.favoriteAgentIds = slice.favoriteAgentIds.map(String);
      }
      if (slice.homeMode === "super" || slice.homeMode === "multi" || slice.homeMode === "pro") {
        next.homeMode = slice.homeMode as ProfileHomeMode;
      }
      if ("displayContext" in slice) {
        next.displayContext = slice.displayContext == null ? "" : String(slice.displayContext);
      }
      profiles[id] = next;
    }
    patch.profiles = profiles;
  }
  // Also accept active-slice shorthand: favoriteAgentIds / homeMode / displayContext apply to active profile.
  const activeHint =
    patch.activeProfile ?? getUserPrefs().activeProfile;
  const activePatch: Partial<ProfilePrefsSlice> = {};
  if (Array.isArray(body.favoriteAgentIds)) {
    activePatch.favoriteAgentIds = body.favoriteAgentIds.map(String);
  }
  if (body.homeMode === "super" || body.homeMode === "multi" || body.homeMode === "pro") {
    activePatch.homeMode = body.homeMode;
  }
  if ("displayContext" in body && body.profiles == null) {
    activePatch.displayContext = body.displayContext == null ? "" : String(body.displayContext);
  }
  if (Object.keys(activePatch).length) {
    patch.profiles = {
      ...(patch.profiles ?? {}),
      [activeHint]: { ...(patch.profiles?.[activeHint] ?? {}), ...activePatch },
    };
  }
  const before = getUserPrefs();
  const beforeMode = before.profiles[before.activeProfile]?.homeMode ?? "multi";
  const prefs = setUserPrefs(patch);
  const afterMode = prefs.profiles[prefs.activeProfile]?.homeMode ?? "multi";
  // Work/Personal or homeMode change → new council session (Chief shared; seats mode-specific).
  if (beforeMode !== afterMode || before.activeProfile !== prefs.activeProfile) {
    try {
      switchCouncilMode(afterMode, beforeMode);
    } catch {
      /* fail closed — prefs still saved; council stays on prior snapshot */
    }
  }
  res.json({ prefs });
});

/** heard_as vocabulary for intent normalize + client STT (Settings → Voice / Dictionary). */
app.get("/api/voice/dictionary", (_req, res) => {
  res.json({ entries: getVoiceDictionary(), defaults: DEFAULT_VOICE_DICTIONARY });
});

app.put("/api/voice/dictionary", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const raw = Array.isArray(body.entries) ? body.entries : body;
  const entries = setVoiceDictionary(raw);
  res.json({ entries });
});

/** Company briefing + agent training (Settings → Company / Training). */
app.get("/api/company/briefing", (_req, res) => {
  res.json({ briefing: getCompanyBriefing() });
});

app.put("/api/company/briefing", (req, res) => {
  const text = req.body?.text != null ? String(req.body.text) : "";
  const result = setCompanyBriefingFromPaste(text);
  if ("error" in result) return res.status(400).json({ error: result.error });
  res.json({ briefing: result });
});

app.post("/api/company/briefing/fetch", async (req, res) => {
  const url = req.body?.url != null ? String(req.body.url) : "";
  const result = await fetchCompanyBriefingFromUrl(url);
  if (!result.ok) {
    return res.status(result.status ?? 502).json({ error: result.error });
  }
  res.json({ briefing: result.briefing });
});

app.delete("/api/company/briefing", (_req, res) => {
  clearCompanyBriefing();
  res.json({ ok: true, briefing: null });
});

app.get("/api/agents/training", (_req, res) => {
  res.json(trainingStatusSnapshot());
});

app.post("/api/agents/training/send-all", (_req, res) => {
  const result = sendAllAgentsToTraining();
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(result);
});

/** Lessons — takeaways from research, training, group Finals, or manual notes. */
app.get("/api/lessons", (_req, res) => {
  res.json({ lessons: listLessons() });
});

app.post("/api/lessons", (req, res) => {
  const title = req.body?.title != null ? String(req.body.title) : "";
  const body = req.body?.body != null ? String(req.body.body) : "";
  const source = req.body?.source != null ? String(req.body.source) : "manual";
  const agentIds = Array.isArray(req.body?.agentIds) ? req.body.agentIds.map(String) : [];
  const pinned = req.body?.pinned === true;
  const result = createLesson({ title, body, source, agentIds, pinned });
  if ("error" in result) return res.status(400).json({ error: result.error });
  res.status(201).json({ lesson: result });
});

app.patch("/api/lessons/:id", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const patch: { pinned?: boolean; title?: string; body?: string } = {};
  if (req.body?.pinned !== undefined) patch.pinned = req.body.pinned === true;
  if (req.body?.title != null) patch.title = String(req.body.title);
  if (req.body?.body != null) patch.body = String(req.body.body);
  if (patch.pinned === undefined && patch.title === undefined && patch.body === undefined) {
    return res.status(400).json({ error: "pinned, title, or body required" });
  }
  const result = patchLesson(id, patch);
  if ("error" in result) {
    const status = result.error.includes("not found") ? 404 : 400;
    return res.status(status).json({ error: result.error });
  }
  res.json({ lesson: result, lessons: listLessons() });
});

app.delete("/api/lessons/:id", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const result = deleteLesson(id);
  if ("error" in result) return res.status(404).json({ error: result.error });
  res.json({ ok: true, lessons: listLessons() });
});

/** Soft-delete a registry agent into the recycle bin (Chief forbidden). */
app.delete("/api/agents/:id", (req, res) => {
  const agentId = String(req.params.id ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agent id required" });
  const result = softDeleteRegistryAgent(agentId);
  if ("error" in result) {
    const status = result.error.includes("Chief")
      ? 400
      : result.error.includes("unknown")
        ? 404
        : 400;
    return res.status(status).json({ error: result.error });
  }
  res.json({ ok: true, recycled: result.item != null, item: result.item });
});

app.get("/api/agents/:id/thread", (req, res) => {
  const agentId = String(req.params.id ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agent id required" });
  if (isChiefId(agentId)) return res.status(400).json({ error: "use /api/chief/thread for Chief" });
  const thread = getAgentChatThread(agentId);
  if (!thread) return res.status(404).json({ error: "unknown agent" });
  res.json(thread);
});

/** Clear registry agent thread messages (soft-delete into recycle bin). */
app.delete("/api/agents/:id/thread", (req, res) => {
  const agentId = String(req.params.id ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agent id required" });
  if (isChiefId(agentId)) return res.status(400).json({ error: "use DELETE /api/chief/thread for Chief" });
  if (!getAgentChatThread(agentId)) return res.status(404).json({ error: "unknown agent" });
  try {
    const messages = softClearAgentThread(agentId);
    if (!messages) return res.status(400).json({ error: "clear failed" });
    res.json({ ok: true, messages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "clear failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/agents/:id/chat", requireAgentApiKeyIfSet, async (req, res) => {
  const agentId = String(req.params.id ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agent id required" });
  if (isChiefId(agentId)) return res.status(400).json({ error: "use /api/chief/chat for Chief" });
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text required" });
  const modelId = req.body?.modelId != null ? String(req.body.modelId) : null;
  const messages = await postAgentChat(agentId, text, modelId);
  if (!messages) return res.status(404).json({ error: "unknown agent" });
  res.json({ messages });
});

app.post("/api/agents/:id/thread/append", (req, res) => {
  const agentId = String(req.params.id ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agent id required" });
  if (isChiefId(agentId)) return res.status(400).json({ error: "use /api/chief/thread/append for Chief" });
  const entries = parseThreadAppendBody(req.body);
  if (!entries) return res.status(400).json({ error: "entries array required" });
  const messages = appendAgentThread(agentId, entries);
  if (!messages) return res.status(404).json({ error: "unknown agent or no valid messages" });
  res.json({ messages });
});

app.get("/api/pro/agents/:proId/thread", (req, res) => {
  const proId = String(req.params.proId ?? "").trim();
  if (!proId) return res.status(400).json({ error: "pro agent id required" });
  if (isChiefId(proId)) return res.status(400).json({ error: "use /api/chief/thread for Chief" });
  const thread = getProChatThread(proId);
  if (!thread) return res.status(404).json({ error: "unknown pro agent" });
  res.json(thread);
});

/** Clear Pro specialist thread messages (soft-delete into recycle bin). */
app.delete("/api/pro/agents/:proId/thread", (req, res) => {
  const proId = String(req.params.proId ?? "").trim();
  if (!proId) return res.status(400).json({ error: "pro agent id required" });
  if (isChiefId(proId)) return res.status(400).json({ error: "use DELETE /api/chief/thread for Chief" });
  if (!getProChatThread(proId)) return res.status(404).json({ error: "unknown pro agent" });
  try {
    const messages = softClearProThread(proId);
    if (!messages) return res.status(400).json({ error: "clear failed" });
    res.json({ ok: true, messages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "clear failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/pro/agents/:proId/chat", async (req, res) => {
  const proId = String(req.params.proId ?? "").trim();
  if (!proId) return res.status(400).json({ error: "pro agent id required" });
  if (isChiefId(proId)) return res.status(400).json({ error: "use /api/chief/chat for Chief" });
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text required" });
  const modelId = req.body?.modelId != null ? String(req.body.modelId) : null;
  if (!getProChatThread(proId)) return res.status(404).json({ error: "unknown pro agent" });
  try {
    const messages = await postProChat(proId, text, modelId);
    res.json({ messages });
  } catch (e) {
    if (e instanceof ChiefGenerateError) {
      return res.status(503).json({ error: e.message, code: e.code, tried: e.tried });
    }
    const msg = e instanceof Error ? e.message : "pro chat failed";
    if (msg === "unknown pro agent") return res.status(404).json({ error: msg });
    res.status(500).json({ error: msg });
  }
});

app.post("/api/pro/agents/:proId/thread/append", (req, res) => {
  const proId = String(req.params.proId ?? "").trim();
  if (!proId) return res.status(400).json({ error: "pro agent id required" });
  if (isChiefId(proId)) return res.status(400).json({ error: "use /api/chief/thread/append for Chief" });
  const entries = parseThreadAppendBody(req.body);
  if (!entries) return res.status(400).json({ error: "entries array required" });
  const messages = appendProThread(proId, entries);
  if (!messages) return res.status(404).json({ error: "unknown pro agent or no valid messages" });
  res.json({ messages });
});

app.get("/api/board", (_req, res) => {
  res.json(getBoardState());
});

app.put("/api/board", (req, res) => {
  const rawIds = req.body?.boardIds;
  const rawStances = req.body?.stances;
  const rawTopic = req.body?.topic;
  if (rawIds === undefined && rawStances === undefined && rawTopic === undefined) {
    return res.status(400).json({ error: "boardIds, stances, or topic required" });
  }
  const patch: { boardIds?: string[]; stances?: BoardStancesMap; topic?: string } = {};
  if (rawIds !== undefined) {
    if (!Array.isArray(rawIds)) return res.status(400).json({ error: "boardIds array required" });
    const ids = rawIds.map((id) => String(id)).filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ error: "boardIds must not be empty" });
    patch.boardIds = ids;
  }
  if (rawStances !== undefined) {
    if (rawStances !== null && typeof rawStances !== "object") {
      return res.status(400).json({ error: "stances must be an object" });
    }
    patch.stances = normalizeBoardStances(rawStances);
  }
  if (rawTopic !== undefined) {
    patch.topic = normalizeBoardTopic(rawTopic);
  }
  res.json(updateBoard(patch));
});

/** Ask each picked board agent to take a stance on the decision topic via routeGenerate. */
app.post("/api/board/ask", async (req, res) => {
  try {
    const topic =
      req.body?.topic != null ? normalizeBoardTopic(req.body.topic) : undefined;
    if (topic !== undefined && !topic) {
      return res.status(400).json({ error: "Decision / question required" });
    }
    const result = await runBoardAsk({ topic });
    if (!result.topic && result.results.length === 0) {
      return res.status(400).json({ error: "Decision / question required", ...result });
    }
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/** One-click: create a Tasks ticket from the current board decision + stances. */
app.post("/api/board/ticket", (req, res) => {
  const agentId =
    req.body?.agentId != null && String(req.body.agentId).trim()
      ? String(req.body.agentId).trim()
      : undefined;
  const result = createTaskFromBoardDecision({ agentId });
  if ("error" in result) return res.status(400).json({ error: result.error });
  res.status(201).json({ task: result.task });
});

app.get("/api/pro/sets", (_req, res) => {
  const customAgentIds = getCustomProAgentIds();
  const sets = listProSets().map((s) => ({
    ...s,
    agentIds: proSetMemberIds(s.id, customAgentIds),
  }));
  sets.push({
    id: CUSTOM_SET_ID,
    name: "Custom",
    agentIds: proSetMemberIds(CUSTOM_SET_ID, customAgentIds),
  });
  res.json({ sets, activeSetId: loadState().activeProSetId ?? "software" });
});

app.get("/api/pro/sets/:setId/members", (req, res) => {
  const setId = String(req.params.setId ?? "");
  const customAgentIds = getCustomProAgentIds();
  res.json({ setId, agentIds: proSetMemberIds(setId, customAgentIds) });
});

app.put("/api/pro/custom", (req, res) => {
  const raw = req.body?.agentIds;
  if (!Array.isArray(raw)) return res.status(400).json({ error: "agentIds array required" });
  const ids = raw.map((id) => String(id)).filter(Boolean);
  const withoutChief = ids.filter((id) => !isChiefId(id));
  if (ids.length !== withoutChief.length && ids.length === 0) {
    return res.status(400).json({ error: "cannot remove Chief from custom set" });
  }
  res.json({ agentIds: setCustomProAgentIds(withoutChief) });
});

app.patch("/api/pro/active", (req, res) => {
  const setId = String(req.body?.setId ?? "").trim();
  if (!setId) return res.status(400).json({ error: "setId required" });
  const state = loadState();
  state.activeProSetId = setId;
  saveState(state);
  res.json({ ok: true, activeSetId: setId });
});

app.get("/api/providers", (_req, res) => {
  res.json({ providers: publicProviderMetadata(), enabled: getProviderEnabledMap() });
});

app.get("/api/providers/enabled", (_req, res) => {
  res.json({ enabled: getProviderEnabledMap() });
});

app.put("/api/providers/enabled", (req, res) => {
  const id = String(req.body?.id ?? req.body?.providerId ?? "").trim();
  if (!id) return res.status(400).json({ error: "id required" });
  if (req.body?.enabled == null) return res.status(400).json({ error: "enabled required" });
  try {
    const enabled = setProviderEnabled(id, req.body.enabled === true);
    res.json({ enabled });
  } catch {
    return res.status(400).json({ error: "unknown provider" });
  }
});

app.get("/api/providers/keys", (_req, res) => {
  res.json({ keys: getMaskedProviderKeys() });
});

app.put("/api/providers/keys", (req, res) => {
  const providerId = String(req.body?.providerId ?? req.body?.id ?? "").trim();
  const apiKey = req.body?.apiKey != null ? String(req.body.apiKey) : "";
  if (!providerId) return res.status(400).json({ error: "providerId required" });
  if (!getProviderById(providerId)) return res.status(400).json({ error: "unknown provider" });
  try {
    const status = putProviderKey(providerId, apiKey);
    res.json({ providerId, ...status });
  } catch {
    res.status(400).json({ error: "invalid provider" });
  }
});

/** Tiny generate to verify a provider key (stored or candidate). */
app.post("/api/providers/keys/test", async (req, res) => {
  const providerId = String(req.body?.providerId ?? req.body?.id ?? "").trim();
  const apiKey = req.body?.apiKey != null ? String(req.body.apiKey).trim() : undefined;
  const model = req.body?.model != null ? String(req.body.model).trim() : undefined;
  if (!providerId) return res.status(400).json({ ok: false, working: false, error: "providerId required" });
  if (!getProviderById(providerId)) {
    return res.status(400).json({ ok: false, working: false, error: "unknown provider" });
  }
  const result = await testProviderConnection(providerId, {
    ...(apiKey ? { apiKey } : {}),
    ...(model ? { model } : {}),
  });
  res.status(result.working ? 200 : result.ok ? 200 : 400).json(result);
});

app.get("/api/providers/:id/models", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!getProviderById(id)) return res.status(404).json({ models: [], error: "unknown provider" });
  const result = await fetchProviderModels(id);
  res.json(result);
});

app.get("/api/models", async (_req, res) => {
  const payload = await listModels();
  const routerProbe = await probeRouterHealth();
  payload.meta.routerLive = routerProbe.live;
  payload.meta.routerStub = !routerProbe.live;
  // routerReady stays artifacts-on-disk only — never imply process is live
  res.json(payload);
});

app.get("/api/models/catalog", async (req, res) => {
  const q = req.query.q != null ? String(req.query.q) : undefined;
  const capabilitiesRaw = req.query.capabilities;
  const capabilities =
    typeof capabilitiesRaw === "string"
      ? capabilitiesRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : Array.isArray(capabilitiesRaw)
        ? capabilitiesRaw.map((s) => String(s).trim()).filter(Boolean)
        : undefined;
  const browseRaw = req.query.browse;
  const browse =
    typeof browseRaw === "string"
      ? browseRaw
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s): s is "free" | "local" | "api" => s === "free" || s === "local" || s === "api")
      : undefined;
  const offset = req.query.offset != null ? Number(req.query.offset) : undefined;
  const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
  const payload = await getModelsCatalog({ q, capabilities, browse, offset, limit });
  res.json(payload);
});

app.get("/api/skills/catalog", (req, res) => {
  const q = req.query.q != null ? String(req.query.q) : undefined;
  const group = req.query.group != null ? String(req.query.group) : undefined;
  const offset = req.query.offset != null ? Number(req.query.offset) : undefined;
  const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
  res.json(getSkillsCatalog({ q, group, offset, limit }));
});

app.get("/api/models/downloads", (_req, res) => {
  res.json(listModelDownloads());
});

/**
 * Pull an Ollama model tag via the local Ollama HTTP API (`POST /api/pull`).
 * Streams NDJSON progress lines: `{ status, completed?, total?, error? }` then a final `{ ok, tag, host }`.
 * Body: `{ tag: string }` (e.g. `qwen2.5:1.5b-instruct`).
 */
app.post("/api/models/ollama/pull", async (req, res) => {
  const tag = normalizeOllamaPullTag((req.body ?? {})?.tag ?? (req.body ?? {})?.name);
  if (!tag) {
    res.status(400).json({ error: "tag required (e.g. qwen2.5:1.5b-instruct)" });
    return;
  }
  res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
  res.setHeader("cache-control", "no-cache");
  res.setHeader("x-ollama-host", getOllamaHost());
  const writeLine = (obj: Record<string, unknown>) => {
    if (res.writableEnded) return;
    res.write(`${JSON.stringify(obj)}\n`);
  };
  try {
    const result = await pullOllamaModel(tag, (p) => {
      writeLine({
        status: p.status,
        ...(p.digest ? { digest: p.digest } : {}),
        ...(typeof p.total === "number" ? { total: p.total } : {}),
        ...(typeof p.completed === "number" ? { completed: p.completed } : {}),
      });
    });
    writeLine({ ok: true, tag: result.tag, host: result.host, status: "success" });
    res.end();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "pull failed";
    const status = e && typeof e === "object" && "status" in e ? Number((e as { status: number }).status) : 502;
    if (!res.headersSent) {
      res.status(status).json({ error: msg, tag, host: getOllamaHost() });
      return;
    }
    writeLine({ ok: false, error: msg, tag, host: getOllamaHost(), status: "error" });
    res.end();
  }
});

/** AMS product recipes vs real `.gguf` on disk — never fakes installed weights. */
app.get("/api/models/ams", (_req, res) => {
  res.json(listAmsInstallSnapshot());
});

/**
 * Optional helper: copy a local `.gguf` into `models/ams/` and re-probe status.
 * Body: `{ sourcePath: string, recipeId?: string, fileName?: string }`
 */
app.post("/api/models/ams/place", (req, res) => {
  const body = (req.body ?? {}) as { sourcePath?: string; recipeId?: string; fileName?: string };
  const sourcePath = String(body.sourcePath ?? "").trim();
  if (!sourcePath) {
    res.status(400).json({ error: "sourcePath required (local path to a .gguf file)" });
    return;
  }
  const result = placeAmsGguf(sourcePath, {
    recipeId: body.recipeId != null ? String(body.recipeId).trim() : undefined,
    fileName: body.fileName != null ? String(body.fileName).trim() : undefined,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ...result, snapshot: listAmsInstallSnapshot() });
});

/**
 * Pull ship AMS GGUFs (Micro 70M / Hybrid 120M) into models/ams/ via install script.
 * Body: `{ recipeId?: "ams-micro-70m" | "ams-hybrid-120m" }` — omit to install both.
 * Needs HF_TOKEN for gated HF repos. Never fakes installed status.
 */
app.post("/api/models/ams/download", async (req, res) => {
  const body = (req.body ?? {}) as { recipeId?: string };
  const recipeId = body.recipeId != null ? String(body.recipeId).trim() : undefined;
  try {
    const result = await downloadAmsWeights(recipeId ? { recipeId } : undefined);
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AMS download failed";
    res.status(502).json({ ok: false, error: msg, snapshot: listAmsInstallSnapshot() });
  }
});

app.get("/api/tools/recommended", (_req, res) => {
  res.json(listRecommendedTools());
});

app.get("/api/models/selection", (_req, res) => {
  res.json({
    selectedModelId: getSelectedModelId(),
    selectedModelIds: getSelectedModelPool(),
  });
});

app.patch("/api/models/selection", (req, res) => {
  let selectedModelId = getSelectedModelId();
  let selectedModelIds = getSelectedModelPool();
  if ("selectedModelId" in (req.body ?? {})) {
    const raw = req.body?.selectedModelId;
    selectedModelId = setSelectedModelId(raw == null || raw === "" ? null : String(raw));
  }
  if ("selectedModelIds" in (req.body ?? {})) {
    const raw = req.body?.selectedModelIds;
    selectedModelIds = setSelectedModelPool(Array.isArray(raw) ? raw.map(String) : []);
  }
  res.json({ selectedModelId, selectedModelIds });
});

/** Ordered failover chain (Cascade tab). Not Micro→Hybrid staging. */
app.get("/api/models/cascade", (_req, res) => {
  res.json(getModelCascadePrefs());
});

app.patch("/api/models/cascade", (req, res) => {
  const body = req.body ?? {};
  const patch: { enabled?: boolean; order?: string[] } = {};
  if ("enabled" in body) patch.enabled = body.enabled === true;
  if ("order" in body) {
    patch.order = Array.isArray(body.order) ? body.order.map(String) : [];
  }
  res.json(setModelCascadePrefs(patch));
});

app.get("/api/agents/model-assignments", (_req, res) => {
  res.json({ assignments: listAgentModelAssignments() });
});

app.put("/api/agents/model-assignments", (req, res) => {
  const raw = req.body?.assignments;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return res.status(400).json({ error: "assignments object required" });
  }
  res.json({ assignments: putAgentModelAssignments(raw as Record<string, { primary?: string; secondary?: string }>) });
});

app.get("/api/agents/routing", (_req, res) => {
  res.json({ routing: listAgentRouting() });
});

app.put("/api/agents/routing", (req, res) => {
  const raw = req.body?.routing;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return res.status(400).json({ error: "routing object required" });
  }
  res.json({ routing: putAgentRouting(raw as Record<string, string>) });
});

app.patch("/api/agents/:id/models", (req, res) => {
  const agentId = String(req.params.id ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agent id required" });
  const body = req.body as {
    primaryModelId?: string | null;
    secondaryModelId?: string | null;
    routePref?: string | null;
  };
  const result = patchAgentModelAssignment(agentId, {
    primaryModelId: body.primaryModelId,
    secondaryModelId: body.secondaryModelId,
    routePref: body.routePref,
  });
  if (!result) return res.status(400).json({ error: "invalid agent id or routePref" });
  res.json({ agentId, ...result });
});

app.patch("/api/agents/:id/skills", (req, res) => {
  const agentId = String(req.params.id ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agent id required" });
  if (isChiefId(agentId)) return res.status(400).json({ error: "Chief skills are fixed" });
  const skill = String(req.body?.skill ?? "").trim();
  if (!skill) return res.status(400).json({ error: "skill required" });
  const known = loadAgents().agents.some((a) => a.id === agentId);
  if (!known) return res.status(404).json({ error: "unknown agent" });
  const action = req.body?.action === "detach" ? "detach" : "attach";
  const skills =
    action === "detach" ? detachImportedSkill(agentId, skill) : attachImportedSkill(agentId, skill);
  if (skills === null) return res.status(400).json({ error: "invalid request" });
  res.json({ agentId, skills });
});

app.get("/api/hardware", async (_req, res) => {
  res.json(await probeHardware());
});

/** OS/public online probe. Null fields = unavailable; never invent values. */
app.get("/api/network", async (_req, res) => {
  res.json(await probeNetwork());
});

/**
 * Internet download Mbps via Netflix fast.com (server-side sample; see speedTest.ts).
 * Fail-closed: downloadMbps null when unmeasurable. Client useInternetSpeed caches <=1/3h.
 */
app.get("/api/network/speed", async (_req, res) => {
  res.json(await probeInternetSpeed());
});

app.get("/api/permissions", (_req, res) => {
  res.json({ items: loadState().permissions });
});

app.post("/api/permissions/:id/:action", (req, res) => {
  const { id, action } = req.params;
  const state = loadState();
  const item = state.permissions.find((p) => p.id === id);
  if (!item) return res.status(404).json({ ok: false });
  if (action === "approve") item.status = "approved";
  else if (action === "deny") item.status = "denied";
  else if (action === "always") {
    item.status = "always";
    const knownStanding = new Set(getStandingPermissionRules().map((r) => r.id));
    if (knownStanding.has(id)) {
      state.standingPermissionPolicies = {
        ...(state.standingPermissionPolicies ?? {}),
        [id]: "always",
      };
    }
  } else return res.status(400).json({ ok: false });
  saveState(state);
  res.json({ ok: true });
});

app.get("/api/permissions/standing", (_req, res) => {
  res.json({ rules: getStandingPermissionRules() });
});

app.put("/api/permissions/standing", (req, res) => {
  const body = req.body as { rules?: { id: string; policy: PermissionPolicy }[] };
  if (!body || !Array.isArray(body.rules)) {
    return res.status(400).json({ ok: false, message: "rules array required" });
  }
  const rules = setStandingPermissionRules(body.rules);
  res.json({ rules });
});

mountChannelRoutes(app);
mountInboxMailRoutes(app);
mountInboxSendRoutes(app);
mountTaskRoutes(app);
mountCronRoutes(app);
mountAgentApiKeyRoutes(app);
mountSkillTemplateRoutes(app);
mountControlPlaneRoutes(app);
mountCalendarRoutes(app);
mountOAuthClientRoutes(app);
mountGoogleDriveRoutes(app);
mountFileManagerRoutes(app);
mountAmsRoutes(app);
mountAdapterRoutes(app);
mountSkillsGraphRoutes(app);
mountKnowledgeGraphRoutes(app);
mountAuditRoutes(app);

/** Fine-tune jobs are not shipped; company briefing training is separate (`/api/agents/training`). */
app.get("/api/train/status", (_req, res) => {
  const company = trainingStatusSnapshot();
  res.json({
    shipped: false,
    status: "not_shipped",
    jobs: [],
    message: "Model fine-tuning / weight-train jobs are not shipped. Company briefing training uses /api/agents/training.",
    companyTraining: {
      shipped: true,
      trainedCount: company.trainedCount,
      lastTrainedAt: company.lastTrainedAt,
      hasBriefing: Boolean(company.briefing),
    },
  });
});

/** Company-ops capability map (honest stubs vs shipped). */
app.get("/api/company-ops", (_req, res) => {
  res.json({
    items: [
      {
        id: "byo-adapters",
        title: "BYO adapters",
        status: "shipped",
        summary:
          "Allowlisted subprocess/HTTP adapter registry in Settings → Company (#adapters). Invoke gated by ASI_AMS_SKILL_RUN; fail-closed; no chat shell.",
        roadmap: "Richer BYO agent-runtime connectors later — still not free-form shell from chat.",
      },
      {
        id: "postgres",
        title: "Postgres",
        status: "partial",
        summary: (() => {
          const pg = getPostgresModuleStatus();
          if (pg.setupRequired) {
            return "Use Postgres is on — connection string required. FileStore stays active until then.";
          }
          return "FileStore default. Toggle, export/import, and dual-write stub shipped; full PostgresStore driver later.";
        })(),
        roadmap:
          "Optional @asi-agents/postgres-store behind ControlPlaneStore; Settings → Company ops. See docs/OPTIONAL-POSTGRES-MODULE.md.",
      },
      {
        id: "byo-model-providers",
        title: "BYO model providers (enterprise)",
        status: "partial",
        summary:
          "Eleven cloud API-key providers shipped (incl. Hugging Face router). Azure OpenAI and AWS Bedrock enterprise cards are not wired.",
        roadmap:
          "Modular enterprise cards: Use Azure / Use Bedrock toggles, base URL + deployment + region fields, secret saved. Separate from BYO agent-runtime adapters.",
      },
      {
        id: "skill-studio",
        title: "Skill Studio",
        status: "shipped",
        summary:
          "Simple AMS skill graph (catalog nodes, group hubs, agent-pick edges) at Settings → Company (#skill-studio). Not full Paperclip Studio.",
        roadmap: "Richer orchestration / editing still unshipped — graph is visual + click-to-open only.",
      },
      {
        id: "cron",
        title: "Cron routines",
        status: "shipped",
        summary: "5-field crontab or everyMinutes fallback — creates a pending task on fire.",
        roadmap: "Multi-host / distributed scheduler later.",
      },
      {
        id: "agent-api-keys",
        title: "Agent API keys",
        status: "shipped",
        summary: "Per-agent Bearer token with scopes chat + tasks:read (loopback UI exempt).",
        roadmap: "Per-route audit of key use.",
      },
      {
        id: "ticket-threads",
        title: "Ticket threads",
        status: "shipped",
        summary: "Comments with @agent mentions, size-capped attachments, persisted in app-state.",
        roadmap: "Rich markdown / collaborative edit later.",
      },
    ],
  });
});


function handleGroupDecide(
  groupId: string,
  body: { action?: unknown; text?: unknown },
  res: express.Response
) {
  const group = getNamedGroup(groupId);
  if (!group) return res.status(404).json({ error: "unknown group" });
  const action = String(body?.action ?? "").trim();
  const text = String(body?.text ?? "").trim();
  const labels: Record<string, string> = {
    approve: "Approved — council notified",
    ask: "Asked for more detail",
    reject: "Rejected — logged",
    reopen: "Proposal reopened for discussion",
  };
  if (action === "message") {
    if (!text) return res.status(400).json({ error: "text required for message" });
    appendNamedGroupMessage(groupId, { who: "user", text });
    return res.json({ label: "Message posted" });
  }
  if (action === "reopen") {
    const proposalDecision = setNamedGroupProposalDecision(groupId, "open");
    appendNamedGroupMessage(groupId, { who: "system", text: labels.reopen, decide: true });
    return res.json({ label: labels.reopen, proposalDecision });
  }
  if (action === "ask" && text) {
    appendNamedGroupMessage(groupId, { who: "user", text });
  }
  let proposalDecision = group.proposalDecision;
  if (action === "approve") {
    proposalDecision = setNamedGroupProposalDecision(groupId, "approved") ?? proposalDecision;
  } else if (action === "reject") {
    proposalDecision = setNamedGroupProposalDecision(groupId, "rejected") ?? proposalDecision;
  }
  const label = labels[action] ?? "Recorded";
  if (labels[action]) {
    appendNamedGroupMessage(groupId, { who: "system", text: label, decide: true });
  }
  return res.json({ label, proposalDecision });
}

app.get("/api/groups", (_req, res) => {
  res.json(listGroupSummaries());
});

app.post("/api/groups", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const rawMembers = req.body?.memberIds;
  const memberIds = Array.isArray(rawMembers) ? rawMembers.map(String) : undefined;
  const activate = req.body?.activate !== false;
  try {
    const group = createGroupChat({ name, memberIds, activate });
    res.status(201).json({ group: groupSessionSnapshot(group), ...listGroupSummaries() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create failed";
    res.status(400).json({ error: msg });
  }
});

app.get("/api/groups/:id", (req, res) => {
  const group = getNamedGroup(String(req.params.id ?? ""));
  if (!group) return res.status(404).json({ error: "unknown group" });
  res.json(groupSessionSnapshot(group));
});

app.patch("/api/groups/:id", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const name = req.body?.name != null ? String(req.body.name) : undefined;
  const topicProvided = req.body != null && Object.prototype.hasOwnProperty.call(req.body, "topic");
  const topicRaw = topicProvided ? req.body.topic : undefined;
  const sessionRaw = req.body?.session != null ? String(req.body.session).trim() : undefined;
  const moderatorRaw =
    req.body?.moderatorId != null ? String(req.body.moderatorId).trim() : undefined;
  const maxDurationProvided =
    req.body != null && Object.prototype.hasOwnProperty.call(req.body, "maxDurationMinutes");
  const maxDurationMinutes = maxDurationProvided ? req.body.maxDurationMinutes : undefined;
  const announceTopic = req.body?.announceTopic === true;
  if (sessionRaw != null && sessionRaw !== "open" && sessionRaw !== "closed") {
    return res.status(400).json({ error: "session must be open|closed" });
  }
  const patched = patchGroupChat(id, {
    name,
    topic: topicProvided ? (topicRaw == null ? null : String(topicRaw)) : undefined,
    session: sessionRaw as "open" | "closed" | undefined,
    moderatorId: moderatorRaw,
    maxDurationMinutes: maxDurationProvided ? maxDurationMinutes : undefined,
  });
  if (!patched) return res.status(404).json({ error: "unknown group" });
  if (topicProvided && announceTopic) {
    const label = patched.topic?.trim()
      ? `Topic set to “${patched.topic.trim()}”`
      : "Topic cleared";
    appendNamedGroupMessage(id, { who: "system", text: label });
  }
  if (req.body?.activate === true) setActiveGroupId(id);
  res.json(groupSessionSnapshot(patched));
});

app.delete("/api/groups/:id", (req, res) => {
  const ok = deleteGroupChat(String(req.params.id ?? ""));
  if (!ok) return res.status(400).json({ error: "cannot delete (unknown or last group)" });
  res.json({ ok: true, ...listGroupSummaries() });
});

app.put("/api/groups/:id/members", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const raw = req.body?.memberIds;
  if (!Array.isArray(raw)) return res.status(400).json({ error: "memberIds array required" });
  const group = setGroupMembers(id, raw.map(String));
  if (!group) return res.status(404).json({ error: "unknown group or empty members" });
  res.json(groupSessionSnapshot(group));
});

app.post("/api/groups/:id/members", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const agentId = String(req.body?.agentId ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agentId required" });
  const group = addGroupMember(id, agentId);
  if (!group) return res.status(404).json({ error: "unknown group" });
  res.json(groupSessionSnapshot(group));
});

app.delete("/api/groups/:id/members/:agentId", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const agentId = String(req.params.agentId ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agentId required" });
  if (isChiefId(agentId)) return res.status(400).json({ error: "Chief cannot be removed" });
  const group = removeGroupMember(id, agentId);
  if (!group) return res.status(404).json({ error: "unknown group" });
  res.json(groupSessionSnapshot(group));
});

app.post("/api/groups/:id/observers", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const agentId = String(req.body?.agentId ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agentId required" });
  if (isChiefId(agentId)) return res.status(400).json({ error: "Chief cannot be an observer" });
  const group = addGroupObserver(id, agentId);
  if (!group) return res.status(404).json({ error: "unknown group" });
  res.json(groupSessionSnapshot(group));
});

app.delete("/api/groups/:id/observers/:agentId", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const agentId = String(req.params.agentId ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agentId required" });
  const group = removeGroupObserver(id, agentId);
  if (!group) return res.status(404).json({ error: "unknown group" });
  res.json(groupSessionSnapshot(group));
});

app.get("/api/groups/:id/messages", (req, res) => {
  const messages = getGroupMessages(String(req.params.id ?? ""));
  if (!messages) return res.status(404).json({ error: "unknown group" });
  res.json({ messages });
});

/** Clear group messages (soft-delete into recycle bin); keep members, topic, session. */
app.delete("/api/groups/:id/messages", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "group id required" });
  try {
    const messages = softClearGroupMessages(id);
    if (!messages) return res.status(404).json({ error: "unknown group" });
    res.json({ ok: true, messages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "clear failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/groups/:id/decide", (req, res) => {
  handleGroupDecide(String(req.params.id ?? ""), req.body ?? {}, res);
});

app.post("/api/groups/:id/generate", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const text =
    req.body?.text != null
      ? String(req.body.text)
      : req.body?.prompt != null
        ? String(req.body.prompt)
        : undefined;
  try {
    const out = await runGroupGenerate(id, { text });
    if (!out) return res.status(404).json({ error: "unknown group" });
    if (out.sessionExpired) {
      return res.status(403).json({
        error: "session_expired",
        message: out.error ?? out.label,
        ...out,
      });
    }
    res.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "generate_failed", message });
  }
});

app.post("/api/groups/:id/conclude", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const verdict = req.body?.verdict != null ? String(req.body.verdict) : undefined;
  const draftOnly = req.body?.draftOnly === true;
  const shortlist = Array.isArray(req.body?.shortlist)
    ? req.body.shortlist.map((x: unknown) => String(x))
    : undefined;
  try {
    const out = await runGroupConclude(id, { verdict, shortlist, draftOnly });
    if (!out) return res.status(404).json({ error: "unknown group" });
    res.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "conclude_failed", message });
  }
});

app.post("/api/groups/:id/activate", (req, res) => {
  const group = setActiveGroupId(String(req.params.id ?? ""));
  if (!group) return res.status(404).json({ error: "unknown group" });
  res.json(groupSessionSnapshot(group));
});

/** 1:1 chat sidebar roster — add/remove agents from the thread list (not the registry). */
app.get("/api/chat/roster", (_req, res) => {
  res.json({
    agentIds: getChatRosterIds(),
    filtered: chatRosterIsFiltered(),
  });
});

app.put("/api/chat/roster", (req, res) => {
  const raw = req.body?.agentIds;
  if (!Array.isArray(raw)) return res.status(400).json({ error: "agentIds array required" });
  const agentIds = setChatRosterIds(raw.map(String));
  res.json({ agentIds, filtered: true });
});

app.post("/api/chat/roster/members", (req, res) => {
  const agentId = String(req.body?.agentId ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agentId required" });
  if (isChiefId(agentId)) return res.status(400).json({ error: "Chief is always in chat" });
  // If roster is unfiltered ("all"), materialize remaining agents minus nothing + add.
  if (!chatRosterIsFiltered()) {
    const all = loadAgents().agents.map((a) => a.id).filter((id) => !isChiefId(id));
    const next = all.includes(agentId) ? all : [...all, agentId];
    const agentIds = setChatRosterIds(next);
    return res.json({ agentIds, filtered: true });
  }
  const agentIds = addChatRosterMember(agentId);
  res.json({ agentIds, filtered: true });
});

app.delete("/api/chat/roster/members/:agentId", (req, res) => {
  const agentId = String(req.params.agentId ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agentId required" });
  if (isChiefId(agentId)) return res.status(400).json({ error: "Chief cannot be removed" });
  if (!chatRosterIsFiltered()) {
    const all = loadAgents()
      .agents.map((a) => a.id)
      .filter((id) => !isChiefId(id) && id !== agentId);
    const agentIds = setChatRosterIds(all);
    return res.json({ agentIds, filtered: true });
  }
  const agentIds = removeChatRosterMember(agentId);
  if (!agentIds) return res.status(400).json({ error: "could not remove" });
  res.json({ agentIds, filtered: true });
});

app.get("/api/group/session", (_req, res) => {
  const active = getNamedGroup(getActiveGroupId());
  if (active) return res.json(groupSessionSnapshot(active));
  res.json(getGroupSession());
});

/**
 * Desk mode → council session. Multi/Pro seats are mode-specific (Chief shared).
 * Entering Multi/Pro or switching between them resets topic/votes/moderator;
 * prior messages stay readable. Offline clients fail closed (no invented state).
 */
app.post("/api/group/council-mode", (req, res) => {
  const mode = String(req.body?.mode ?? "").trim();
  if (mode !== "super" && mode !== "multi" && mode !== "pro") {
    return res.status(400).json({ error: "mode must be super|multi|pro" });
  }
  const previousMode =
    req.body?.previousMode === "super" ||
    req.body?.previousMode === "multi" ||
    req.body?.previousMode === "pro"
      ? req.body.previousMode
      : undefined;
  try {
    const out = switchCouncilMode(mode, previousMode);
    res.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "council mode switch failed";
    res.status(500).json({ error: msg });
  }
});

app.patch("/api/group/session", (req, res) => {
  const raw = String(req.body?.session ?? "").trim();
  if (raw !== "open" && raw !== "closed") return res.status(400).json({ error: "session must be open|closed" });
  const id = getActiveGroupId();
  const patched = patchGroupChat(id, { session: raw });
  if (patched) return res.json(groupSessionSnapshot(patched));
  res.json(setGroupSession(raw));
});

app.get("/api/group", (_req, res) => {
  const active = getNamedGroup(getActiveGroupId());
  if (active) return res.json(groupSessionSnapshot(active));
  res.json(getGroupSession());
});

app.get("/api/group/messages", (_req, res) => {
  const messages = getGroupMessages(getActiveGroupId());
  res.json({ messages: messages ?? loadState().groupMessages });
});

app.delete("/api/group/messages", (_req, res) => {
  try {
    const messages = softClearGroupMessages(getActiveGroupId());
    if (!messages) return res.status(404).json({ error: "unknown group" });
    res.json({ ok: true, messages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "clear failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/group/generate", async (req, res) => {
  const text =
    req.body?.text != null
      ? String(req.body.text)
      : req.body?.prompt != null
        ? String(req.body.prompt)
        : undefined;
  try {
    const out = await runGroupGenerate(getActiveGroupId(), { text });
    if (!out) return res.status(404).json({ error: "unknown group" });
    if (out.sessionExpired) {
      return res.status(403).json({
        error: "session_expired",
        message: out.error ?? out.label,
        ...out,
      });
    }
    res.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "generate_failed", message });
  }
});

app.post("/api/group/conclude", async (req, res) => {
  const verdict = req.body?.verdict != null ? String(req.body.verdict) : undefined;
  const draftOnly = req.body?.draftOnly === true;
  const shortlist = Array.isArray(req.body?.shortlist)
    ? req.body.shortlist.map((x: unknown) => String(x))
    : undefined;
  try {
    const out = await runGroupConclude(getActiveGroupId(), { verdict, shortlist, draftOnly });
    if (!out) return res.status(404).json({ error: "unknown group" });
    res.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "conclude_failed", message });
  }
});

app.post("/api/group/decide", (req, res) => {
  handleGroupDecide(getActiveGroupId(), req.body ?? {}, res);
});

/** Legacy member add/remove on the active group (mirrors /api/groups/:id/members). */
app.put("/api/group/members", (req, res) => {
  const raw = req.body?.memberIds;
  if (!Array.isArray(raw)) return res.status(400).json({ error: "memberIds array required" });
  const group = setGroupMembers(getActiveGroupId(), raw.map(String));
  if (!group) return res.status(404).json({ error: "unknown group or empty members" });
  res.json(groupSessionSnapshot(group));
});

app.post("/api/group/members", (req, res) => {
  const agentId = String(req.body?.agentId ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agentId required" });
  const group = addGroupMember(getActiveGroupId(), agentId);
  if (!group) return res.status(404).json({ error: "unknown group" });
  res.json(groupSessionSnapshot(group));
});

app.delete("/api/group/members/:agentId", (req, res) => {
  const agentId = String(req.params.agentId ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agentId required" });
  if (isChiefId(agentId)) return res.status(400).json({ error: "Chief cannot be removed" });
  const group = removeGroupMember(getActiveGroupId(), agentId);
  if (!group) return res.status(404).json({ error: "unknown group" });
  res.json(groupSessionSnapshot(group));
});

app.post("/api/group/observers", (req, res) => {
  const agentId = String(req.body?.agentId ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agentId required" });
  if (isChiefId(agentId)) return res.status(400).json({ error: "Chief cannot be an observer" });
  const group = addGroupObserver(getActiveGroupId(), agentId);
  if (!group) return res.status(404).json({ error: "unknown group" });
  res.json(groupSessionSnapshot(group));
});

app.delete("/api/group/observers/:agentId", (req, res) => {
  const agentId = String(req.params.agentId ?? "").trim();
  if (!agentId) return res.status(400).json({ error: "agentId required" });
  const group = removeGroupObserver(getActiveGroupId(), agentId);
  if (!group) return res.status(404).json({ error: "unknown group" });
  res.json(groupSessionSnapshot(group));
});

app.post("/ctl/models/unload", (_req, res) => {
  res.json({ ok: true, message: "Clear model RAM requested (stub)" });
});

app.post("/ctl/ollama/restart", (_req, res) => res.json({ ok: true, stub: true }));
app.post("/ctl/router/restart", (_req, res) => res.json({ ok: true, stub: true }));
app.post("/ctl/desk/restart", async (_req, res) => {
  try {
    const result = await ensureDeskDaemon({ waitMs: 20000 });
    res.status(result.ok ? 200 : result.autostartEnabled === false ? 403 : 503).json({
      stub: false,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Desk restart failed";
    res.status(500).json({ ok: false, stub: false, error: message });
  }
});
app.post("/ctl/app/restart", (_req, res) => res.json({ ok: true, stub: true }));
app.post("/ctl/calls/kill-online", (_req, res) => res.json({ ok: true, stub: true }));
app.post("/ctl/calls/kill-all", (_req, res) => res.json({ ok: true, stub: true }));

mountDeskRoutes(app);
mountBrowserRoutes(app);
mountModulesCatalogRoutes(app);

const serverDist = path.dirname(fileURLToPath(import.meta.url));

/** Companion Agent art — modules/Companion Agent/<skin> → /companion/<skin>/{gifs,references}/… */
const companionRoot = path.resolve(serverDist, "../../../modules/Companion Agent");
const COMPANION_SKINS = [
  "squari",
  "drakko",
  "mochi",
  "paperclip-x",
  "capsule",
  "nekowire",
  "pixel-knight",
] as const;
if (fs.existsSync(companionRoot)) {
  for (const skin of COMPANION_SKINS) {
    const dir = path.join(companionRoot, skin);
    if (fs.existsSync(dir)) {
      app.use(`/companion/${skin}`, express.static(dir, { fallthrough: true, maxAge: "1h" }));
    }
  }
}

const appDist = path.resolve(serverDist, "../../app/dist");
if (fs.existsSync(path.join(appDist, "index.html"))) {
  app.use(express.static(appDist));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/ctl") ||
      req.path.startsWith("/companion") ||
      req.path === "/health" ||
      req.path === "/registry"
    ) {
      return next();
    }
    res.sendFile(path.join(appDist, "index.html"));
  });
}

/** Settings → Logs & Recycle bin (persisted in app-state). */
app.get("/api/recycle", (_req, res) => {
  res.json({
    ...listRecycleBin(),
    retentionOptions: [...RECYCLE_RETENTION_OPTIONS],
  });
});

app.put("/api/recycle/retention", (req, res) => {
  const days = setRecycleRetentionDays(req.body?.days ?? req.body?.retentionDays);
  const listed = listRecycleBin();
  res.json({
    ...listed,
    retentionDays: days,
    retentionOptions: [...RECYCLE_RETENTION_OPTIONS],
  });
});

app.post("/api/recycle/purge", (_req, res) => {
  const purged = purgeExpiredRecycleBin();
  const { items, retentionDays } = listRecycleBin();
  res.json({ ok: true, purged, items, retentionDays });
});

app.post("/api/recycle/empty", (_req, res) => {
  const removed = emptyRecycleBin();
  res.json({ ok: true, removed, items: [], retentionDays: listRecycleBin().retentionDays });
});

app.post("/api/recycle/:id/restore", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "id required" });
  const result = restoreRecycleItem(id);
  if ("error" in result) return res.status(400).json({ error: result.error });
  res.json({ ok: true, item: result.item, ...listRecycleBin() });
});

app.delete("/api/recycle/:id", (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "id required" });
  if (!permanentlyDeleteRecycleItem(id)) return res.status(404).json({ error: "not found" });
  res.json({ ok: true, ...listRecycleBin() });
});

/** Soft-delete control-log (or similar) entries into the recycle bin. */
app.post("/api/recycle/logs", (req, res) => {
  const raw = req.body?.entries;
  if (!Array.isArray(raw) || !raw.length) {
    return res.status(400).json({ error: "entries array required" });
  }
  const entries: RecycleLogEntry[] = raw
    .map((row: Record<string, unknown>): RecycleLogEntry => {
      const toneRaw = row?.tone;
      const tone: RecycleLogEntry["tone"] =
        toneRaw === "success" || toneRaw === "warn" || toneRaw === "danger" || toneRaw === "neutral"
          ? toneRaw
          : "neutral";
      return {
        id: String(row?.id ?? "").trim() || `log-${Date.now().toString(36)}`,
        time: String(row?.time ?? ""),
        actor: String(row?.actor ?? "Unknown"),
        agentId: row?.agentId != null ? String(row.agentId) : undefined,
        text: String(row?.text ?? ""),
        tone,
      };
    })
    .filter((e) => e.text);
  const label = req.body?.label != null ? String(req.body.label) : undefined;
  const item = archiveDeletedLogs(entries, label);
  res.status(201).json({ ok: true, recycled: item != null, item, ...listRecycleBin() });
});

/** Soft-delete a custom Pro agent (client supplies snapshot). */
app.post("/api/recycle/custom-pro", (req, res) => {
  const agent = req.body?.agent;
  if (!agent || typeof agent !== "object" || !String(agent.id ?? "").trim()) {
    return res.status(400).json({ error: "agent snapshot required" });
  }
  const thread = Array.isArray(req.body?.thread) ? req.body.thread : undefined;
  const item = softDeleteCustomProAgent(agent, thread);
  res.json({ ok: true, recycled: item != null, item, ...listRecycleBin() });
});

app.listen(PORT, HOST, () => {
  startRecycleBinPurgeJob();
  startCronJob();
  const ui = fs.existsSync(path.join(appDist, "index.html")) ? " (UI + API)" : " (API only — run npm run build)";
  console.log(`ASI Agents http://${HOST}:${PORT}${ui}`);
});
