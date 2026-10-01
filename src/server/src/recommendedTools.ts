import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "../../..");
const TOOLS_PATH = path.join(repoRoot, "config", "recommended-tools.json");

export interface RecommendedTool {
  id: string;
  name: string;
  category: string;
  summary: string;
  installUrl?: string;
  docsUrl?: string;
  command?: string;
  verifyCommand?: string;
}

export interface RecommendedToolsResponse {
  label: string;
  tools: RecommendedTool[];
}

export function listRecommendedTools(): RecommendedToolsResponse {
  try {
    const raw = fs.readFileSync(TOOLS_PATH, "utf8");
    const parsed = JSON.parse(raw) as { label?: string; tools?: RecommendedTool[] };
    const tools = Array.isArray(parsed.tools) ? parsed.tools.filter((t) => t.id && t.name) : [];
    return { label: parsed.label ?? "Recommended tools", tools };
  } catch {
    return { label: "Recommended tools", tools: [] };
  }
}
