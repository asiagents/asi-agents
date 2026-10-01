/**
 * Local knowledge graph — first useful slice.
 * Entities: agents, skills, tasks, lessons. Edges: has_skill, assigned_to, learned_by, reports_to.
 * JSON file store under data/knowledge-graph.json + GET/POST query endpoints.
 * Not Neo4j — module-friendly local graph API.
 */
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgents } from "./agents.js";
import { listLessons } from "./lessons.js";
import { readAllSkills } from "./skills.catalog.js";
import { getAgentAmsSkillIds, listTasks } from "./store.js";
import { isChiefId } from "./withChief.js";

export type KgNodeKind = "agent" | "skill" | "task" | "lesson";

export type KgNode = {
  id: string;
  kind: KgNodeKind;
  label: string;
  props?: Record<string, string | number | boolean | null>;
};

export type KgEdgeKind = "has_skill" | "assigned_to" | "learned_by" | "reports_to" | "related";

export type KgEdge = {
  id: string;
  from: string;
  to: string;
  kind: KgEdgeKind;
};

export type KnowledgeGraphSnapshot = {
  shipped: true;
  engine: "local-json";
  note: string;
  moduleId: "knowledge-graph";
  updatedAt: string;
  nodes: KgNode[];
  edges: KgEdge[];
  counts: Record<KgNodeKind | "edges", number>;
};

type PersistedKg = {
  version: 1;
  /** Extra user/manual nodes beyond live projections. */
  extraNodes: KgNode[];
  extraEdges: KgEdge[];
  updatedAt: string;
};

function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../..");
}

function kgPath(): string {
  return path.join(repoRoot(), "data", "knowledge-graph.json");
}

function emptyPersisted(): PersistedKg {
  return { version: 1, extraNodes: [], extraEdges: [], updatedAt: new Date().toISOString() };
}

function readPersisted(): PersistedKg {
  try {
    const raw = fs.readFileSync(kgPath(), "utf8");
    const j = JSON.parse(raw) as Partial<PersistedKg>;
    return {
      version: 1,
      extraNodes: Array.isArray(j.extraNodes) ? (j.extraNodes as KgNode[]) : [],
      extraEdges: Array.isArray(j.extraEdges) ? (j.extraEdges as KgEdge[]) : [],
      updatedAt: typeof j.updatedAt === "string" ? j.updatedAt : new Date().toISOString(),
    };
  } catch {
    return emptyPersisted();
  }
}

function writePersisted(data: PersistedKg): void {
  const p = kgPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

function addEdge(
  edges: KgEdge[],
  seen: Set<string>,
  from: string,
  to: string,
  kind: KgEdgeKind
): void {
  const id = `${kind}:${from}->${to}`;
  if (seen.has(id)) return;
  seen.add(id);
  edges.push({ id, from, to, kind });
}

/** Project live agents/skills/tasks/lessons into a graph (+ optional extras). */
export function buildKnowledgeGraph(): KnowledgeGraphSnapshot {
  const nodes: KgNode[] = [];
  const edges: KgEdge[] = [];
  const seenEdge = new Set<string>();
  const nodeIds = new Set<string>();

  const pushNode = (n: KgNode) => {
    if (nodeIds.has(n.id)) return;
    nodeIds.add(n.id);
    nodes.push(n);
  };

  const { skills: catalog } = readAllSkills();
  for (const s of catalog) {
    pushNode({
      id: `skill:${s.id}`,
      kind: "skill",
      label: s.name,
      props: { catalogId: s.id, group: s.group },
    });
  }

  const agents = loadAgents().agents;
  for (const a of agents) {
    pushNode({
      id: `agent:${a.id}`,
      kind: "agent",
      label: a.name,
      props: {
        role: a.role,
        roleTag: a.roleTag ?? null,
        isChief: Boolean(a.isChief || isChiefId(a.id)),
        status: a.status,
      },
    });
    const skillIds = [...new Set([...(a.skills ?? []), ...getAgentAmsSkillIds(a.id)])];
    for (const sid of skillIds) {
      const to = `skill:${sid}`;
      if (!nodeIds.has(to)) {
        pushNode({ id: to, kind: "skill", label: sid, props: { catalogId: sid } });
      }
      addEdge(edges, seenEdge, `agent:${a.id}`, to, "has_skill");
    }
    const reports = a.reportsTo?.trim();
    if (reports) {
      addEdge(edges, seenEdge, `agent:${a.id}`, `agent:${reports}`, "reports_to");
    }
  }

  for (const t of listTasks()) {
    const tid = `task:${t.id}`;
    pushNode({
      id: tid,
      kind: "task",
      label: t.title || t.id,
      props: {
        status: t.status,
        assigneeId: t.agentId ?? null,
        priority: t.priority ?? null,
      },
    });
    if (t.agentId) {
      addEdge(edges, seenEdge, tid, `agent:${t.agentId}`, "assigned_to");
    }
  }

  for (const lesson of listLessons()) {
    const lid = `lesson:${lesson.id}`;
    pushNode({
      id: lid,
      kind: "lesson",
      label: lesson.title,
      props: {
        source: lesson.source,
        pinned: Boolean(lesson.pinned),
      },
    });
    const agentIds = Array.isArray(lesson.agentIds) ? lesson.agentIds : [];
    for (const agentId of agentIds) {
      const aid = String(agentId ?? "").trim();
      if (!aid) continue;
      addEdge(edges, seenEdge, lid, `agent:${aid}`, "learned_by");
    }
  }

  const persisted = readPersisted();
  for (const n of persisted.extraNodes) {
    if (n?.id && n.kind && n.label) pushNode(n);
  }
  for (const e of persisted.extraEdges) {
    if (e?.from && e?.to && e.kind) addEdge(edges, seenEdge, e.from, e.to, e.kind);
  }

  const counts: KnowledgeGraphSnapshot["counts"] = {
    agent: nodes.filter((n) => n.kind === "agent").length,
    skill: nodes.filter((n) => n.kind === "skill").length,
    task: nodes.filter((n) => n.kind === "task").length,
    lesson: nodes.filter((n) => n.kind === "lesson").length,
    edges: edges.length,
  };

  return {
    shipped: true,
    engine: "local-json",
    note:
      "Local knowledge graph (JSON). Live projection of agents, AMS skills, tasks, lessons + optional extras in data/knowledge-graph.json. Module-friendly; not Neo4j.",
    moduleId: "knowledge-graph",
    updatedAt: persisted.updatedAt,
    nodes,
    edges,
    counts,
  };
}

export type KgQueryResult = {
  q: string;
  matchedNodes: KgNode[];
  matchedEdges: KgEdge[];
  neighborNodes: KgNode[];
};

export function queryKnowledgeGraph(qRaw: string, limit = 40): KgQueryResult {
  const q = qRaw.trim().toLowerCase();
  const graph = buildKnowledgeGraph();
  if (!q) {
    return {
      q: qRaw,
      matchedNodes: graph.nodes.slice(0, limit),
      matchedEdges: graph.edges.slice(0, limit),
      neighborNodes: [],
    };
  }
  const matchedNodes = graph.nodes
    .filter((n) => {
      const hay = `${n.id} ${n.label} ${JSON.stringify(n.props ?? {})}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, limit);
  const matchedIds = new Set(matchedNodes.map((n) => n.id));
  const matchedEdges = graph.edges.filter(
    (e) => matchedIds.has(e.from) || matchedIds.has(e.to)
  );
  const neighborIds = new Set<string>();
  for (const e of matchedEdges) {
    neighborIds.add(e.from);
    neighborIds.add(e.to);
  }
  for (const id of matchedIds) neighborIds.delete(id);
  const neighborNodes = graph.nodes.filter((n) => neighborIds.has(n.id)).slice(0, limit);
  return { q: qRaw, matchedNodes, matchedEdges, neighborNodes };
}

export function mountKnowledgeGraphRoutes(app: Express): void {
  app.get("/api/kg", (_req, res) => {
    try {
      res.json(buildKnowledgeGraph());
    } catch (err) {
      const message = err instanceof Error ? err.message : "kg failed";
      res.status(500).json({ error: message, nodes: [], edges: [] });
    }
  });

  app.get("/api/kg/query", (req, res) => {
    try {
      const q = String(req.query.q ?? "");
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
      res.json(queryKnowledgeGraph(q, limit));
    } catch (err) {
      const message = err instanceof Error ? err.message : "kg query failed";
      res.status(500).json({ error: message, matchedNodes: [], matchedEdges: [], neighborNodes: [] });
    }
  });

  /** Add a manual entity (optional write path for module experiments). */
  app.post("/api/kg/nodes", (req, res) => {
    const kind = String(req.body?.kind ?? "").trim() as KgNodeKind;
    const label = String(req.body?.label ?? "").trim();
    const idRaw = String(req.body?.id ?? "").trim();
    if (!["agent", "skill", "task", "lesson"].includes(kind) || !label) {
      return res.status(400).json({ error: "kind (agent|skill|task|lesson) and label required" });
    }
    const id = idRaw || `${kind}:manual-${Date.now().toString(36)}`;
    const persisted = readPersisted();
    const node: KgNode = { id, kind, label, props: { manual: true } };
    persisted.extraNodes = [...persisted.extraNodes.filter((n) => n.id !== id), node];
    writePersisted(persisted);
    res.json({ node, graph: buildKnowledgeGraph() });
  });
}
