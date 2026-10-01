import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withChiefIds } from "./withChief.js";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "../../..");

export interface BoardsDefaultsFile {
  defaultBoardIds: string[];
}

function defaultsPath(): string {
  const fromEnv = process.env.ASI_BOARDS_DEFAULTS?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(repoRoot, "config", "boards.defaults.json");
}

function readJsonFile(p: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

const FALLBACK_DEFAULT_BOARD = withChiefIds(["chief", "research", "coder", "design"]);

/** Non-empty default board roster — always includes Chief. */
export function loadDefaultBoardIds(): string[] {
  const raw = readJsonFile(defaultsPath());
  if (!raw || typeof raw !== "object") return [...FALLBACK_DEFAULT_BOARD];
  const ids = (raw as BoardsDefaultsFile).defaultBoardIds;
  if (!Array.isArray(ids) || ids.length === 0) return [...FALLBACK_DEFAULT_BOARD];
  return withChiefIds(ids.map((id) => String(id)).filter(Boolean));
}

export function normalizeBoardIds(ids: readonly string[] | undefined | null, fallback?: string[]): string[] {
  const base = ids?.length ? ids : fallback ?? loadDefaultBoardIds();
  return withChiefIds(base.map((id) => String(id)).filter(Boolean));
}
