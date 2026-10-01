import type { NavigateFunction } from "react-router-dom";

export type ClientAction =
  | { type: "navigate"; path: string }
  | { type: "panic" }
  | { type: "pro_create" }
  | { type: "pro_delete"; name?: string }
  | { type: "navigate_agent"; agentId?: string; path: string }
  | { type: "set_display_name"; name: string }
  | { type: "refresh_agents" };

export function parseClientActions(raw?: string): ClientAction[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as ClientAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type ExecutorDeps = {
  navigate: NavigateFunction;
  requestPanic?: () => void;
  openProCreate?: () => void;
  removeCustomByName?: (name: string) => void;
  setDisplayName?: (name: string) => void;
  refreshAgents?: () => void;
};

export function executeClientActions(actions: ClientAction[], deps: ExecutorDeps): void {
  for (const action of actions) {
    switch (action.type) {
      case "navigate":
      case "navigate_agent":
        deps.navigate(action.path);
        break;
      case "panic":
        deps.requestPanic?.();
        break;
      case "pro_create":
        deps.openProCreate?.();
        break;
      case "pro_delete":
        if (action.name?.trim()) deps.removeCustomByName?.(action.name.trim());
        break;
      case "set_display_name":
        if (action.name?.trim()) deps.setDisplayName?.(action.name.trim());
        break;
      case "refresh_agents":
        deps.refreshAgents?.();
        break;
      default:
        break;
    }
  }
}
