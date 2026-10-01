import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentsMeta } from "../contexts/AgentsContext";
import { useDesk } from "../contexts/DeskContext";
import { usePro } from "../contexts/ProContext";
import { useSettings } from "../contexts/SettingsContext";
import { executeClientActions, parseClientActions } from "./executeClientActions";

/** Run clientActions from the latest assistant message meta after a chat POST. */
export function useIntentClient() {
  const navigate = useNavigate();
  const desk = useDesk();
  const pro = usePro();
  const { set } = useSettings();
  const { refresh: refreshAgents } = useAgentsMeta();

  const runFromMeta = useCallback(
    (clientActionsJson?: string) => {
      const actions = parseClientActions(clientActionsJson);
      if (!actions.length) return;
      executeClientActions(actions, {
        navigate,
        requestPanic: desk?.requestPanic,
        openProCreate: () => navigate("/settings/pro"),
        removeCustomByName: (name) => {
          const q = name.toLowerCase();
          const hit = pro.customAgents.find(
            (a) => a.name.toLowerCase() === q || a.id.toLowerCase() === q
          );
          if (hit) pro.removeCustomAgent(hit.id);
        },
        setDisplayName: (name) => set("displayName", name),
        refreshAgents: () => {
          void refreshAgents();
        },
      });
    },
    [navigate, desk, pro, set, refreshAgents]
  );

  return { runFromMeta };
}
