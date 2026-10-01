import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deskResearchMovie, deskResearchSong } from "../deskBrowser.js";
import { createAgents, loadAgents, patchAgentAvatar } from "../agents.js";
import { formatAgentDisplayName, normalizeStaffRoleLabel } from "../agentDisplay.js";
import { findProAgent } from "../proAgents.js";
import { listProSets, proSetMemberIds } from "../proSets.js";
import { probeRouterHealth } from "../llm-routing.js";
import {
  assertOpsAllowed,
  isOpsCapability,
  runOpsDiagnose,
  runOpsSuggestReboot,
  scheduleAsiProcessRestart,
  type OpsCapability,
} from "../opsPermissions.js";
import { getLocalFailStreak } from "../localBackendFailClosed.js";
import {
  getBoardState,
  getGroupSession,
  loadState,
  saveState,
  getAgentDisplayName,
  setAgentDisplayName,
  setAgentRoleLabel,
  getAgentRoleLabel,
  setGroupSession,
} from "../store.js";
import type { ClientAction, IntentCatalogRow, IntentThreadContext } from "./types.js";
import { listIntentRows } from "./loadCatalog.js";
import { pickWelcomeMessage } from "./welcomeMessages.js";
import { trySimpleArithmeticReply } from "./simpleArithmetic.js";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "../../../../");

const ROUTER_BASE = (process.env.ASI_ROUTER_URL ?? "http://127.0.0.1:7821").replace(/\/$/, "");

function appVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
    ) as { version?: string };
    return pkg.version?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

/** Speaker for this thread — Chief on chief thread, else registry/Pro display name. */
function speakerFromCtx(ctx: IntentThreadContext): {
  id: string;
  name: string;
  isChief: boolean;
  role?: string;
  roleTag?: string;
} {
  const key = ctx.threadKey;
  if (key === "chief" || !key) {
    const agents = loadAgents().agents;
    const chief = agents.find((a) => a.id === "chief");
    const name = chief?.name?.trim() || "Chief";
    const roleTag = normalizeStaffRoleLabel(
      getAgentRoleLabel("chief") ?? chief?.roleTag ?? "chief"
    );
    return {
      id: "chief",
      name,
      isChief: true,
      role: chief?.role?.trim() || "Chief of staff",
      roleTag,
    };
  }
  if (key.startsWith("agent:")) {
    const id = key.slice("agent:".length);
    const row = loadAgents().agents.find((a) => a.id === id);
    return {
      id,
      name: row?.name?.trim() || id,
      isChief: false,
      role: row?.role?.trim() || "specialist",
      roleTag: row?.roleTag ?? undefined,
    };
  }
  if (key.startsWith("pro:")) {
    const id = key.slice("pro:".length);
    const row = findProAgent(id);
    return {
      id,
      name: row?.name?.trim() || id,
      isChief: false,
      role: row?.role?.trim() || "Pro specialist",
    };
  }
  return { id: "chief", name: "Chief", isChief: true, role: "Chief of staff", roleTag: "chief" };
}

function threadAgentId(ctx: IntentThreadContext): string {
  if (ctx.threadKey.startsWith("agent:")) return ctx.threadKey.slice("agent:".length);
  if (ctx.threadKey.startsWith("pro:")) return ctx.threadKey.slice("pro:".length);
  return "chief";
}

/** Prefer case from the original utterance; stop at compound joiners / punctuation. */
function extractAgentRenameName(raw: string | undefined, slot: string): string {
  const fallback = truncateRenameCapture(slot);
  if (!raw?.trim()) return fallback;
  const patterns = [
    /(?:can\s+(?:i|we)\s+)?call\s+you\s+(.+)/i,
    /i(?:['’]?ll| will)\s+call\s+you\s+(.+)/i,
    /(?:rename\s+yourself\s+to|call\s+yourself(?:\s+to)?|rename\s+(?:chief\s+)?to|change\s+your\s+name\s+to|your\s+name\s+is)\s+(.+)/i,
    /^rename\s+to\s+(.+)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(raw.trim());
    const captured = m?.[1];
    if (captured) {
      const name = truncateRenameCapture(captured);
      if (name) return name;
    }
  }
  return fallback;
}

/** Keep name tokens only — stop at " and ", " then ", " also ", punctuation. */
function truncateRenameCapture(captured: string): string {
  let name = captured.trim();
  const cut = name.search(/\s+(?:and(?:\s+then)?|then|also)\b/i);
  if (cut >= 0) name = name.slice(0, cut);
  name = name
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[?.!,;:]+$/g, "")
    .trim();
  return name.slice(0, 64);
}

function findAgentByName(name: string): { id: string; name: string } | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const agents = loadAgents().agents;
  const exact = agents.find((a) => a.name.toLowerCase() === q || a.id.toLowerCase() === q);
  if (exact) return { id: exact.id, name: exact.name };
  const partial = agents.find((a) => a.name.toLowerCase().includes(q));
  return partial ? { id: partial.id, name: partial.name } : null;
}

function rowById(intentId: string): IntentCatalogRow | undefined {
  return listIntentRows().find((r) => r.id === intentId);
}

export async function runIntentHandler(
  handler: string,
  intentId: string,
  slots: Record<string, string>,
  ctx: IntentThreadContext
): Promise<{ text: string; clientActions?: ClientAction[]; source?: "browser" }> {
  const now = new Date();

  switch (handler) {
    case "static.greeting": {
      // Shared path for Chief, builtins, and every custom agent — no "I'm {name}" roll-call.
      const speaker = speakerFromCtx(ctx);
      return {
        text: pickWelcomeMessage({
          isChief: speaker.isChief,
          specialty: speaker.role,
        }),
      };
    }
    case "static.bye":
      return { text: "Goodbye." };
    case "static.chief": {
      const speaker = speakerFromCtx(ctx);
      if (speaker.isChief) {
        const label = formatAgentDisplayName({
          name: speaker.name,
          roleTag: speaker.roleTag,
          isChief: true,
          id: "chief",
        });
        return {
          text:
            `I'm ${label}, ${speaker.role ?? "Chief of staff"} for ASI Agents. ` +
            "I handle navigation, roster, meetings, and system facts locally before AMS Micro on :7821.",
        };
      }
      return {
        text:
          `I'm ${speaker.name}, a ${speaker.role ?? "specialist"} in ASI Agents. ` +
          "I stay in this thread's persona — Chief is a different chat.",
      };
    }
    case "prefs.set_display_name": {
      const name = truncateRenameCapture(slots.name ?? "");
      if (!name) {
        return { text: 'Say a name, e.g. call me Cutey Pie.' };
      }
      return {
        text: `Got it — your display name is now ${name}.`,
        clientActions: [{ type: "set_display_name", name }],
      };
    }
    case "agent.rename": {
      const name = extractAgentRenameName(ctx.rawText, slots.name ?? "");
      if (!name) {
        return { text: 'Say a name, e.g. rename yourself to Cutey Pie.' };
      }
      const agentId = threadAgentId(ctx);
      const saved = setAgentDisplayName(agentId, name);
      if (!saved) {
        return { text: "Could not save that name." };
      }
      const roleTag =
        agentId === "chief"
          ? normalizeStaffRoleLabel(getAgentRoleLabel(agentId) ?? "chief")
          : undefined;
      const label =
        agentId === "chief"
          ? formatAgentDisplayName({ name: saved, roleTag, isChief: true, id: "chief" })
          : saved;
      return {
        text: `Renamed to ${label}.`,
        clientActions: [{ type: "refresh_agents" }],
      };
    }
    case "agent.set_avatar": {
      const agentId = threadAgentId(ctx);
      const result = patchAgentAvatar(agentId);
      if ("error" in result) {
        return { text: `Could not update photo: ${result.error}` };
      }
      const row = result.agent;
      const label = formatAgentDisplayName({
        name: row.name,
        roleTag: row.roleTag,
        isChief: row.isChief,
        id: row.id,
      });
      return {
        text: `Updated photo for ${label}. Pick another in Agents → ${row.name}.`,
        clientActions: [
          { type: "refresh_agents" },
          { type: "navigate_agent", agentId, path: `/agents/${agentId}` },
        ],
      };
    }
    case "agent.set_staff_role": {
      const rawRole = (slots.name ?? slots.role ?? slots.extra ?? "").trim();
      const fromRaw =
        ctx.rawText?.match(/\b(chief|secretary|secratary|buddy|staff)\b/i)?.[1] ?? rawRole;
      const label = normalizeStaffRoleLabel(fromRaw);
      setAgentRoleLabel("chief", label);
      const name = getAgentDisplayName("chief") ?? "Chief";
      const heading = formatAgentDisplayName({
        name,
        roleTag: label,
        isChief: true,
        id: "chief",
      });
      return {
        text: `Staff role set — now ${heading}. Title stays Chief of staff.`,
        clientActions: [{ type: "refresh_agents" }],
      };
    }
    case "time.now":
      return {
        text: `It's ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (answered locally — system clock).`,
      };
    case "date.today":
      return {
        text: `Today is ${now.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })} (answered locally).`,
      };
    case "time.tz":
      return {
        text: `Your timezone is ${Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown"} (answered locally).`,
      };
    case "location.unavailable":
      return {
        text:
          "I don't have your physical location — ASI Agents doesn't use GPS or location services. I can tell you the system timezone if that helps (answered locally).",
      };
    case "help.commands": {
      const speaker = speakerFromCtx(ctx);
      const ids = listIntentRows().map((r) => r.id).slice(0, 20);
      if (speaker.isChief) {
        return {
          text:
            `Local intents (sample): ${ids.join(", ")}… ` +
            "Pipeline: in-app → AMS Micro (:7821) → full LLM stack.",
        };
      }
      return {
        text:
          `I'm ${speaker.name}. Local commands here: time, date, timezone, help, rename yourself. ` +
          "For writing or specialist work, just ask — I will answer as this agent, not as Chief. " +
          "Pipeline: in-app → AMS Micro (:7821) → full LLM stack.",
      };
    }
    case "app.version":
      return { text: `ASI Agents version ${appVersion()} (answered locally).` };
    case "thread.model": {
      const state = loadState();
      let primary = ctx.primaryModelId;
      if (ctx.threadKey.startsWith("agent:")) {
        const aid = ctx.threadKey.slice("agent:".length);
        primary = state.agentThreadPrimary?.[aid] ?? primary;
      } else if (ctx.threadKey.startsWith("pro:")) {
        const pid = ctx.threadKey.slice("pro:".length);
        primary = state.proThreadPrimary?.[pid] ?? primary;
      } else {
        primary = state.chiefPrimary;
      }
      const sec = ctx.secondaryModelId;
      return {
        text: sec
          ? `Primary model: ${primary}. Secondary: ${sec} (from thread state).`
          : `Primary model: ${primary} (from thread state).`,
      };
    }
    case "backend.status": {
      const h = await probeRouterHealth();
      return {
        text: h.live
          ? `SLM router at ${ROUTER_BASE} is live (GET /health OK).`
          : `SLM router at ${ROUTER_BASE} is not reachable.`,
      };
    }
    case "agents.list": {
      const agents = loadAgents().agents;
      const custom = loadState().customProAgentIds ?? [];
      const names = agents.map((a) => a.name).join(", ");
      const customNote = custom.length ? ` Custom Pro ids: ${custom.join(", ")}.` : "";
      return {
        text: agents.length
          ? `Registry agents (${agents.length}): ${names}.${customNote}`
          : `No registry agents loaded.${customNote}`,
      };
    }
    case "agents.attendance": {
      const agents = loadAgents().agents;
      if (!agents.length) {
        return { text: "Roll call: no registry agents loaded (answered locally)." };
      }
      const presentStatuses = new Set(["active", "idle", "waiting"]);
      const lines = agents.map((a) => {
        const present = presentStatuses.has(a.status);
        const label = present
          ? a.status === "active"
            ? "present"
            : "ready"
          : a.status === "offline"
            ? "absent"
            : "unknown";
        return `• ${a.name} (${a.id}, ${a.role}) — ${label} [${a.status}]`;
      });
      const present = agents.filter((a) => presentStatuses.has(a.status)).length;
      const absent = agents.length - present;
      return {
        text:
          `Roll call — ${agents.length} on the roster (${present} present/ready, ${absent} absent/unknown):\n` +
          `${lines.join("\n")}\n(answered locally)`,
      };
    }
    case "math.simple": {
      const fromRaw = trySimpleArithmeticReply(ctx.rawText ?? "");
      if (fromRaw != null) return { text: fromRaw };
      const fromSlot = trySimpleArithmeticReply(slots.expr ?? slots.name ?? slots.extra ?? "");
      if (fromSlot != null) return { text: fromSlot };
      return { text: "Say a simple expression, e.g. seventeen times 19." };
    }
    case "playful.echo": {
      const fromSlot = (slots.name ?? slots.extra ?? "").trim();
      const fromRaw =
        ctx.rawText?.match(
          /(?:repeat after me|echo(?:\s+this)?|say exactly|parrot)\s*[:\-]?\s*(.+)/i
        )?.[1] ?? "";
      const phrase = (fromRaw.trim() || fromSlot)
        .replace(/^["'`]+|["'`]+$/g, "")
        .replace(/[?.!,;:]+$/g, "")
        .trim();
      if (!phrase) {
        return { text: 'Say a phrase, e.g. repeat after me: hello team.' };
      }
      return { text: phrase };
    }
    case "playful.count": {
      const MAX_COUNT = 300;
      const startRaw = (slots.name ?? "").trim();
      const endRaw = (slots.count ?? slots.extra ?? "").trim();
      let start = /^\d+$/.test(startRaw) ? Number(startRaw) : 1;
      let end = /^\d+$/.test(endRaw) ? Number(endRaw) : NaN;
      // "count to N" only fills count; start stays 1
      if (!/^\d+$/.test(startRaw) && /^\d+$/.test(endRaw)) {
        start = 1;
        end = Number(endRaw);
      }
      if (!Number.isFinite(end) || end < 1) {
        return { text: "Say a range, e.g. count from 1 to 20 (max 300)." };
      }
      if (start < 1) start = 1;
      if (end < start) {
        const tmp = start;
        start = end;
        end = tmp;
      }
      const span = end - start + 1;
      if (span > MAX_COUNT) {
        return {
          text: `That's ${span} numbers — max is ${MAX_COUNT}. Try a smaller range (answered locally).`,
        };
      }
      const nums: string[] = [];
      for (let n = start; n <= end; n++) nums.push(String(n));
      // Chunk lines of ~25 so huge replies stay readable without streaming infra.
      const chunk = 25;
      const lines: string[] = [];
      for (let i = 0; i < nums.length; i += chunk) {
        lines.push(nums.slice(i, i + chunk).join(" "));
      }
      return {
        text: `Counting ${start}–${end}:\n${lines.join("\n")}\n(answered locally)`,
      };
    }
    case "agents.open": {
      const name = slots.name ?? "";
      const hit = findAgentByName(name);
      if (!hit) {
        return {
          text: name
            ? `No registry agent matched "${name}". Opening agents page.`
            : "Say which agent to open, e.g. open agent Mira.",
          clientActions: [{ type: "navigate", path: "/agents" }],
        };
      }
      return {
        text: `Opening ${hit.name}.`,
        clientActions: [
          { type: "navigate_agent", agentId: hit.id, path: `/agents/${hit.id}` },
        ],
      };
    }
    case "client.pro_create":
      return {
        text: "Opening Pro roster to create a custom agent.",
        clientActions: [{ type: "pro_create" }, { type: "navigate", path: "/settings/pro" }],
      };
    case "agents.create": {
      const countRaw = (slots.count ?? "").trim();
      const countFromSlot = countRaw && /^\d+$/.test(countRaw) ? Number(countRaw) : NaN;
      const roleHint = (slots.role ?? slots.name ?? "").trim().toLowerCase();
      const roleIsCount = /^\d+$/.test(roleHint);
      const count = Number.isFinite(countFromSlot)
        ? countFromSlot
        : roleIsCount
          ? Number(roleHint)
          : intentId === "agents.create.batch"
            ? 4
            : 1;
      const role =
        !roleIsCount && roleHint && !["agent", "agents", "any", "name", "names"].includes(roleHint)
          ? roleHint
          : (slots.extra ?? "").trim().toLowerCase() || undefined;
      const displayName = (slots.displayName ?? "").trim() || undefined;
      try {
        const { created } = createAgents({
          count: Math.min(Math.max(count, 1), 12),
          role,
          name: displayName,
        });
        if (!created.length) {
          return { text: "Could not create agents (nothing written)." };
        }
        const listing = created.map((a) => `${a.name} (${a.id}, ${a.role})`).join("; ");
        const label =
          created.length === 1
            ? `Created ${created[0].role} agent **${created[0].name}** (id ${created[0].id}).`
            : `Created ${created.length} agents: ${listing}.`;
        return {
          text: `${label} They are on the roster for Agent assignments and group chat.`,
          clientActions: [{ type: "refresh_agents" }, { type: "navigate", path: "/agents" }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown error";
        return { text: `Create failed: ${msg}` };
      }
    }
    case "client.pro_delete": {
      const name = slots.name?.trim();
      return {
        text: name
          ? `If "${name}" is a custom Pro agent (c-*), remove it in Pro settings. Registry agents cannot be deleted from chat.`
          : "Say which custom agent to remove, e.g. delete agent MyBot.",
        clientActions: name ? [{ type: "pro_delete", name }] : undefined,
      };
    }
    case "client.nav": {
      const row = rowById(intentId);
      const navPath = row?.path ?? "/";
      return {
        text: `Opening ${navPath}.`,
        clientActions: [{ type: "navigate", path: navPath }],
      };
    }
    case "client.panic":
      return {
        text: "Panic will pause desk activity. Confirm when prompted.",
        clientActions: [{ type: "panic" }],
      };
    case "meeting.status": {
      const session = getGroupSession().session;
      return {
        text: session === "open"
          ? "Group council session is open."
          : "Group council session is closed.",
      };
    }
    case "meeting.start":
      setGroupSession("open");
      return { text: "Council session is now open." };
    case "meeting.end":
      setGroupSession("closed");
      return { text: "Council session is closed." };
    case "set.list": {
      const sets = listProSets();
      const active = loadState().activeProSetId ?? "software";
      const lines = sets.map((s) => `${s.id} (${s.name})`).join("; ");
      return { text: `Pro sets: ${lines}. Active: ${active}.` };
    }
    case "set.switch": {
      const setId = (slots.name ?? slots.extra ?? "").trim().toLowerCase();
      const sets = listProSets();
      const hit = sets.find((s) => s.id.toLowerCase() === setId || s.name.toLowerCase() === setId);
      if (!hit) {
        return { text: setId ? `Unknown set "${setId}".` : "Say switch to software set (or another set id)." };
      }
      const state = loadState();
      state.activeProSetId = hit.id;
      saveState(state);
      const custom = state.customProAgentIds ?? [];
      const members = proSetMemberIds(hit.id, custom);
      return { text: `Active set is now ${hit.name} (${hit.id}). Members: ${members.join(", ")}.` };
    }
    case "board.list": {
      const board = getBoardState();
      const topic = board.topic?.trim();
      const roster = board.boardIds.length
        ? `Board agents: ${board.boardIds.join(", ")}.`
        : "Board is empty.";
      return {
        text: topic ? `${roster} Decision: ${topic}` : roster,
      };
    }
    case "research.movie": {
      const query = (slots.name || slots.extra || "").trim();
      if (!query) {
        return { text: "Say what movie to find, e.g. find me a movie Inception." };
      }
      const agentId = ctx.threadKey.startsWith("agent:")
        ? ctx.threadKey.slice("agent:".length)
        : "research";
      const result = await deskResearchMovie(query, agentId);
      if (!result.ok || !result.text) {
        return { text: result.error ?? "Movie research failed (Desk offline or no results)." };
      }
      return { text: result.text, source: "browser" };
    }
    case "research.song": {
      const query = (slots.name || slots.extra || "").trim();
      if (!query) {
        return { text: "Say what song to find, e.g. find me a song Bohemian Rhapsody." };
      }
      const agentId = ctx.threadKey.startsWith("agent:")
        ? ctx.threadKey.slice("agent:".length)
        : "research";
      const result = await deskResearchSong(query, agentId);
      if (!result.ok || !result.text) {
        return { text: result.error ?? "Song research failed (Desk offline or no results)." };
      }
      return { text: result.text, source: "browser" };
    }
    case "ops.diagnose":
    case "ops.restart_asi":
    case "ops.suggest_reboot": {
      const op = handler as OpsCapability;
      if (!isOpsCapability(op)) {
        return { text: `Unknown ops capability ${handler}.` };
      }
      const gate = assertOpsAllowed(op, { afterConfirm: ctx.afterOpsConfirm === true });
      if (!gate.ok) {
        return { text: gate.message ?? "Permission denied (fail closed)." };
      }
      if (op === "ops.diagnose") {
        return { text: await runOpsDiagnose() };
      }
      if (op === "ops.restart_asi") {
        return { text: scheduleAsiProcessRestart() };
      }
      return { text: runOpsSuggestReboot(getLocalFailStreak()) };
    }
    case "confirm.yes":
      return { text: "Nothing pending to confirm." };
    case "confirm.no":
      return { text: "Nothing pending to cancel." };
    default:
      return { text: `No handler for ${handler}.` };
  }
}
