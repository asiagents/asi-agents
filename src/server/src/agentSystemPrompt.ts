/**
 * Shared system-prompt builder: injects displayName, role, roleTag, and AMS/registry skills
 * so generate/chat backends understand who is speaking. Fail-closed offline is unchanged —
 * this only shapes the prompt when a model is actually called.
 */
import { loadAgents, type RegistryAgent } from "./agents.js";
import { findProAgent } from "./proAgents.js";
import { agentReplyPolicy, councilReplyPolicy } from "./reply-policy.js";
import { withTrainingContext } from "./agentTraining.js";
import { getAgentAmsSkillIds, getAgentDisplayName, getAgentRoleLabel, getUserPrefs } from "./store.js";
import { isChiefId } from "./withChief.js";
import { CHIEF_DEFAULT_SKILLS } from "./chiefBuiltin.js";

function englishOnlyFromPrefs(): boolean {
  return getUserPrefs().englishOnlyReplies !== false;
}

export type AgentPromptKind =
  | "chief"
  | "specialist"
  | "pro"
  | "council-chair"
  | "council-member"
  | "board-stance";

function uniqueSkills(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Merge registry skills + AMS catalog picks for an agent id. */
export function resolveAgentSkillIds(agentId: string, registrySkills: string[] = []): string[] {
  const ams = getAgentAmsSkillIds(agentId);
  const merged = uniqueSkills([...registrySkills, ...ams]);
  if (merged.length) return merged;
  if (isChiefId(agentId)) return [...CHIEF_DEFAULT_SKILLS];
  return [];
}

function identityLine(opts: {
  displayName: string;
  role: string;
  roleTag?: string | null;
  agentId: string;
}): string {
  const tag = opts.roleTag?.trim();
  const tagPart = tag ? ` Role tag: ${tag}.` : "";
  return (
    `You are ${opts.displayName} (agent id: ${opts.agentId}). ` +
    `Your role: ${opts.role}.${tagPart}`
  );
}

function skillsLine(skills: string[]): string {
  if (!skills.length) return "Skills: general assistance (none assigned).";
  return `Skills (AMS/registry): ${skills.slice(0, 32).join(", ")}.`;
}

const CHIEF_EXTRA =
  "You are the on-device chief of staff for ASI Agents. Stay in product voice: helpful, concise. " +
  "You are not any other persona, character, school architect, HEX identity, or roleplay card. " +
  "Do not invent a new name for yourself or the user — real renames happen via app settings / local intents. " +
  "When the user asks to create agents (one or many), or says any names are fine, " +
  "the app creates them via local intents / POST /api/agents — do NOT write marketing bios, prompt cards, or fake profiles. " +
  "If create already ran, confirm briefly with ids/names only; never roleplay as a substitute for creating agents. " +
  "Refuse destructive local file/system wipe requests; stay in staff role (triage, schedule, hand off).";

/**
 * Build the system prompt for Chief / specialists / Pro / council generate paths.
 */
export function buildAgentSystemPrompt(opts: {
  agentId: string;
  kind: AgentPromptKind;
  name?: string;
  role?: string;
  roleTag?: string | null;
  skills?: string[];
  extra?: string;
}): string {
  const id = opts.agentId.trim() || "chief";
  const registry = loadAgents().agents.find((a) => a.id === id);
  const pro = !registry ? findProAgent(id) : null;

  const displayName =
    getAgentDisplayName(id)?.trim() ||
    opts.name?.trim() ||
    registry?.name?.trim() ||
    pro?.name?.trim() ||
    (isChiefId(id) ? "Chief" : id);

  const role =
    (isChiefId(id) ? registry?.role || "Chief of staff" : null) ||
    opts.role?.trim() ||
    registry?.role?.trim() ||
    pro?.role?.trim() ||
    "Specialist";

  const roleTag =
    opts.roleTag ??
    (isChiefId(id)
      ? getAgentRoleLabel(id) ?? registry?.roleTag ?? "chief"
      : registry?.roleTag ?? null);

  const skills = resolveAgentSkillIds(
    id,
    opts.skills ?? registry?.skills ?? pro?.skills ?? []
  );

  const identity = identityLine({ displayName, role, roleTag, agentId: id });
  const skillsText = skillsLine(skills);
  const policyOpts = { englishOnly: englishOnlyFromPrefs() };

  let body: string;
  switch (opts.kind) {
    case "chief":
      body = `${identity} ${skillsText} ${CHIEF_EXTRA} ${agentReplyPolicy(opts.extra, policyOpts)}`;
      break;
    case "specialist":
      body =
        `${identity} ${skillsText} ` +
        `Stay in character as ${displayName} — never claim to be Chief or another agent. ` +
        "When the user asks you to write, continue, or expand (including long answers or installments), " +
        "deliver the content directly. Do not re-ask who you are or what the topic is if they already stated it. " +
        agentReplyPolicy(opts.extra, policyOpts);
      break;
    case "pro":
      body =
        `${identity} ${skillsText} ` +
        `You are a Pro specialist. Stay in character as ${displayName} — never claim to be Chief or another agent. ` +
        "When the user asks you to write, continue, or expand, deliver the content directly. " +
        agentReplyPolicy(opts.extra, policyOpts);
      break;
    case "council-chair":
      body =
        `${identity} ${skillsText} ` +
        "You chair a multi-agent council on ASI Agents. " +
        "Facilitate debate: acknowledge other specialists briefly, then give your own concise recommendation. " +
        "Stay on the user's ask; do not invent fake tool runs. " +
        councilReplyPolicy(opts.extra, policyOpts);
      break;
    case "council-member":
      body =
        `${identity} ${skillsText} ` +
        "Debate from your role's angle. Be concrete; disagree when useful; do not speak for other agents. " +
        councilReplyPolicy(opts.extra, policyOpts);
      break;
    case "board-stance":
      body =
        `${identity} ${skillsText} ` +
        "Form YOUR own stance on the user's decision — do not invent other agents' views. " +
        "Reply with exactly two lines in this format (nothing else):\n" +
        "STANCE: for|info|against\n" +
        "REASON: <one short sentence, max ~40 words>\n" +
        'Use "for" if you support the decision, "against" if you oppose it, "info" if you need more information before deciding. ' +
        councilReplyPolicy(opts.extra ?? "Be concrete from your role; disagree when useful.", policyOpts);
      break;
    default:
      body = `${identity} ${skillsText} ${agentReplyPolicy(opts.extra, policyOpts)}`;
  }

  return withTrainingContext(body.trim(), id);
}

/** Convenience: resolve RegistryAgent → specialist/chief prompt. */
export function systemPromptForRegistryAgent(
  agent: RegistryAgent,
  kind?: AgentPromptKind
): string {
  const k: AgentPromptKind =
    kind ?? (isChiefId(agent.id) ? "chief" : "specialist");
  return buildAgentSystemPrompt({
    agentId: agent.id,
    kind: k,
    name: agent.name,
    role: agent.role,
    roleTag: agent.roleTag,
    skills: agent.skills,
  });
}
