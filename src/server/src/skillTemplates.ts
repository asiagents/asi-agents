import type { Express } from "express";
import { createAgents } from "./agents.js";

/**
 * Lightweight skill / agent pack templates (name-set presets).
 * Not a full Skill Studio — creates registry agents from curated name packs.
 */
export type SkillTemplate = {
  id: string;
  label: string;
  description: string;
  /** Max agents created on apply (subset of pack). */
  defaultCount: number;
  agents: { name: string; role: string }[];
};

export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    id: "coding",
    label: "Coding Roles",
    description: "Engineering title pack — creates idle registry agents (not full Studio).",
    defaultCount: 4,
    agents: [
      { name: "Staff Engineer", role: "Deep systems" },
      { name: "Tech Lead", role: "Delivery lead" },
      { name: "Backend Dev", role: "APIs & data" },
      { name: "Frontend Dev", role: "UI craft" },
      { name: "SRE", role: "Reliability" },
      { name: "QA Lead", role: "Quality gate" },
    ],
  },
  {
    id: "employee",
    label: "Employee Titles",
    description: "Workplace roles as a quick roster pack.",
    defaultCount: 4,
    agents: [
      { name: "PM", role: "Product manager" },
      { name: "Analyst", role: "Insights" },
      { name: "Coordinator", role: "Ops glue" },
      { name: "Ops Manager", role: "Run the desk" },
      { name: "Executive Asst", role: "Calendar & triage" },
      { name: "Specialist", role: "Domain focus" },
    ],
  },
  {
    id: "scifi",
    label: "Sci-Fi Crew",
    description: "Fictional space-ops callsigns as display names.",
    defaultCount: 4,
    agents: [
      { name: "Nova", role: "Nav lead" },
      { name: "Orbit", role: "Comms" },
      { name: "Quasar", role: "Sensors" },
      { name: "Halo", role: "Shields" },
      { name: "Drift", role: "Pilot" },
      { name: "Cipher", role: "Cryptanalyst" },
    ],
  },
  {
    id: "research",
    label: "Research Desk",
    description: "Small research / writing pack.",
    defaultCount: 3,
    agents: [
      { name: "Archivist", role: "Source keeper" },
      { name: "Brief Writer", role: "Memos & digests" },
      { name: "Fact Checker", role: "Claims review" },
      { name: "Scout", role: "Horizon scan" },
    ],
  },
];

export function mountSkillTemplateRoutes(app: Express): void {
  app.get("/api/skill-templates", (_req, res) => {
    res.json({
      templates: SKILL_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description,
        defaultCount: t.defaultCount,
        agentCount: t.agents.length,
        agents: t.agents,
      })),
      studio: false,
      note: "Preset agent packs from name sets — not Skill Studio / visual skill graph.",
    });
  });

  app.post("/api/skill-templates/:id/apply", (req, res) => {
    const id = String(req.params.id ?? "").trim();
    const tpl = SKILL_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return res.status(404).json({ error: "unknown template" });
    const rawCount = req.body?.count != null ? Number(req.body.count) : tpl.defaultCount;
    const count = Math.max(1, Math.min(tpl.agents.length, Number.isFinite(rawCount) ? Math.floor(rawCount) : tpl.defaultCount));
    const slice = tpl.agents.slice(0, count);
    const result = createAgents({
      agents: slice.map((a) => ({ name: a.name, role: a.role })),
    });
    res.status(201).json({
      templateId: tpl.id,
      created: result.created,
      agents: result.agents,
      studio: false,
      note: "Created registry agents from a name-pack template. Full Skill Studio is not shipped.",
    });
  });
}
