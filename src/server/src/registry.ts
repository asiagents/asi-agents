import fs from "node:fs";
import { probeDesk } from "@asi-agents/virtual-computer/probe";
import { servicesJsonPath } from "./paths.js";
import type { ServiceEntry } from "./types.js";

const WELL_KNOWN: Omit<ServiceEntry, "status" | "lastSeen">[] = [
  {
    id: "asi-agents",
    name: "ASI Agents API",
    baseUrl: "http://127.0.0.1:3445",
    healthPath: "/health",
    kind: "app",
    controls: { restart: true },
  },
  {
    id: "asi-router",
    name: "SLM Router",
    baseUrl: "http://127.0.0.1:7821",
    healthPath: "/health",
    kind: "router",
    controls: { restart: true, clearRam: true },
  },
  {
    id: "ollama",
    name: "Ollama",
    baseUrl: "http://127.0.0.1:11434",
    healthPath: "/api/tags",
    kind: "runtime",
    controls: { restart: true, clearRam: true },
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    baseUrl: "http://127.0.0.1:1234",
    healthPath: "/v1/models",
    kind: "runtime",
  },
  {
    id: "asi-desk",
    name: "Virtual Computer",
    baseUrl: "http://127.0.0.1:3456",
    healthPath: "/api/v1/desks",
    kind: "desktop",
    controls: { restart: true, start: true },
  },
];

async function probe(entry: Omit<ServiceEntry, "status" | "lastSeen">): Promise<ServiceEntry> {
  if (entry.id === "asi-desk") {
    const desk = await probeDesk();
    return {
      ...entry,
      status: desk.live ? "live" : "off",
      lastSeen: desk.live ? new Date().toISOString() : undefined,
    };
  }
  const url = `${entry.baseUrl}${entry.healthPath}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    const status = res.ok ? "live" : "off";
    return { ...entry, status, lastSeen: status === "live" ? new Date().toISOString() : undefined };
  } catch {
    return { ...entry, status: "off" };
  }
}

function readFileServices(): ServiceEntry[] {
  const p = servicesJsonPath();
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as { services?: ServiceEntry[] };
    return raw.services ?? [];
  } catch {
    return [];
  }
}

function writeFileServices(services: ServiceEntry[]): void {
  const p = servicesJsonPath();
  fs.writeFileSync(p, JSON.stringify({ services }, null, 2), "utf8");
}

export async function buildRegistry(): Promise<ServiceEntry[]> {
  const fileRows = readFileServices();
  const probed = await Promise.all(WELL_KNOWN.map((e) => probe(e)));
  const byId = new Map<string, ServiceEntry>();
  for (const row of fileRows) byId.set(row.id, row);
  for (const row of probed) {
    const prev = byId.get(row.id);
    byId.set(row.id, { ...prev, ...row });
  }
  const merged = Array.from(byId.values());
  writeFileServices(merged);
  return merged;
}
