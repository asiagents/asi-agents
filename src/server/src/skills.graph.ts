import type { Express } from "express";
import { loadAgents } from "./agents.js";
import { readAllSkills, type AmsSkillEntry } from "./skills.catalog.js";
import { listAllAgentAmsSkills } from "./store.js";

export type SkillGraphNodeKind = "skill" | "group" | "agent";

export type SkillGraphNode = {
  id: string;
  kind: SkillGraphNodeKind;
  label: string;
  group?: string;
  description?: string;
};

export type SkillGraphEdgeKind = "group" | "agent";

export type SkillGraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: SkillGraphEdgeKind;
};

export type SkillsGraphResponse = {
  shipped: true;
  studio: false;
  note: string;
  label: string;
  catalogTotal: number;
  nodes: SkillGraphNode[];
  edges: SkillGraphEdge[];
};

/**
 * Simple AMS skill graph: catalog skill nodes, group hubs, edges from groups + agent picks.
 * Not Paperclip Studio — visual map only.
 */
export function buildSkillsGraph(): SkillsGraphResponse {
  const { label, skills } = readAllSkills();
  const nodes: SkillGraphNode[] = [];
  const edges: SkillGraphEdge[] = [];
  const seenEdge = new Set<string>();

  const addEdge = (from: string, to: string, kind: SkillGraphEdgeKind) => {
    const id = `${kind}:${from}->${to}`;
    if (seenEdge.has(id)) return;
    seenEdge.add(id);
    edges.push({ id, from, to, kind });
  };

  const groups = new Map<string, AmsSkillEntry[]>();
  for (const s of skills) {
    nodes.push({
      id: `skill:${s.id}`,
      kind: "skill",
      label: s.name,
      group: s.group,
      description: s.description,
    });
    const list = groups.get(s.group) ?? [];
    list.push(s);
    groups.set(s.group, list);
  }

  for (const [group, members] of groups) {
    const gid = `group:${group}`;
    nodes.push({ id: gid, kind: "group", label: group, group });
    for (const s of members) {
      addEdge(gid, `skill:${s.id}`, "group");
    }
  }

  const picks = listAllAgentAmsSkills();
  const roster = loadAgents().agents;
  const agentSkillIds = new Map<string, Set<string>>();

  for (const a of roster) {
    const set = new Set<string>();
    for (const id of picks[a.id] ?? []) set.add(id);
    for (const id of a.skills ?? []) set.add(id);
    if (set.size) agentSkillIds.set(a.id, set);
  }

  for (const [agentId, skillIds] of agentSkillIds) {
    const agent = roster.find((a) => a.id === agentId);
    const label = agent?.name?.trim() || agentId;
    nodes.push({ id: `agent:${agentId}`, kind: "agent", label, description: agent?.role });
    for (const skillId of skillIds) {
      if (!skills.some((s) => s.id === skillId)) continue;
      addEdge(`agent:${agentId}`, `skill:${skillId}`, "agent");
    }
  }

  return {
    shipped: true,
    studio: false,
    note: "Simple AMS skill graph — catalog nodes, group hubs, agent-pick edges. Not full Paperclip Studio.",
    label,
    catalogTotal: skills.length,
    nodes,
    edges,
  };
}

export function mountSkillsGraphRoutes(app: Express): void {
  app.get("/api/skills/graph", (_req, res) => {
    res.json(buildSkillsGraph());
  });
}
