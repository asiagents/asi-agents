import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function dataDir(): string {
  const base =
    process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "ASI Agents")
      : path.join(os.homedir(), ".local", "share", "asi-agents");
  fs.mkdirSync(base, { recursive: true });
  return base;
}

export function servicesJsonPath(): string {
  return path.join(dataDir(), "services.json");
}

export function statePath(name: string): string {
  return path.join(dataDir(), name);
}
