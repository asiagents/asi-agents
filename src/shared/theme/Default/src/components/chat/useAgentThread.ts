import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ChatMessage as ApiMessage } from "@asi-api";
import type { ChatItem, HandoffState } from "../../types/chat";
import type { ModelId } from "../../types/models";
import { mapServerMessageMeta } from "../../utils/chatMeta";
import { useIntentClient } from "../../intent/useIntentClient";
import { createId, nowTime } from "../../utils/time";

function formatAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return nowTime();
  }
}

function threadModel(meta?: ApiMessage["meta"]): ModelId | undefined {
  const id = meta?.primary?.trim();
  if (!id) return undefined;
  return id as ModelId;
}

function mapApiMessage(m: ApiMessage, agentId: string): ChatItem {
  if (m.role === "handoff") {
    return {
      kind: "handoff",
      id: m.id,
      from: agentId,
      to: agentId,
      model: threadModel(m.meta) ?? "micro",
      reason: m.meta?.reason ?? m.text,
      time: formatAt(m.at),
      state: "done",
    };
  }
  if (m.role === "system") {
    return {
      kind: "system",
      id: m.id,
      text: m.text,
      time: formatAt(m.at),
      tone: "neutral",
    };
  }
  return {
    kind: "message",
    id: m.id,
    author: m.role === "user" ? "user" : m.meta?.agentId ?? agentId,
    text: m.text,
    time: formatAt(m.at),
    model: m.role === "agent" || m.role === "chief" ? threadModel(m.meta) ?? "micro" : undefined,
    meta: mapServerMessageMeta(m.meta),
  };
}

/** Registry agent `/chat/:agentId` — POST then refetch thread. */
export function useAgentThread(agentId: string, enabled: boolean) {
  const { runFromMeta } = useIntentClient();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const timer = useRef<number>();

  const loadThread = useCallback(async () => {
    try {
      const t = await api.agentThread(agentId);
      setItems(t.messages.map((m) => mapApiMessage(m, agentId)));
      setOffline(false);
    } catch {
      // Failed fetch must not clear existing thread history.
      setOffline(true);
    }
  }, [agentId]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!enabled || !agentId) return;
    let cancelled = false;
    let retryTimer: number | undefined;

    const apply = (t: Awaited<ReturnType<typeof api.agentThread>>) => {
      if (cancelled) return;
      setItems(t.messages.map((m) => mapApiMessage(m, agentId)));
      setOffline(false);
    };

    const load = () =>
      api
        .agentThread(agentId)
        .then(apply)
        .catch(() => {
          if (cancelled) return;
          setOffline(true);
          // One delayed retry — covers API still booting / brief proxy blips.
          retryTimer = window.setTimeout(() => {
            if (cancelled) return;
            api.agentThread(agentId).then(apply).catch(() => undefined);
          }, 1500);
        });

    load();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [enabled, agentId]);

  const append = useCallback((item: ChatItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const updateHandoff = useCallback((id: string, state: HandoffState) => {
    setItems((prev) =>
      prev.map((i) => (i.kind === "handoff" && i.id === id ? { ...i, state } : i))
    );
  }, []);

  const send = useCallback(
    async (text: string, modelId?: string) => {
      if (!enabled || !agentId) return;
      const optimisticId = createId();
      append({
        kind: "message",
        id: optimisticId,
        author: "user",
        text,
        time: nowTime(),
      });
      setTyping(agentId);
      try {
        const { messages } = await api.agentChat(agentId, text, modelId);
        const lastAgent = [...messages].reverse().find((m) => m.role === "agent");
        runFromMeta(lastAgent?.meta?.clientActions);
        await loadThread();
      } catch (e) {
        const detail =
          e instanceof Error && e.message && !e.message.startsWith("Agent chat failed (")
            ? e.message
            : "Could not reach the agent chat API — run npm run dev from the repo root (API on :3445).";
        const generateFailed =
          e instanceof Error &&
          (e.message.includes("generate") ||
            e.message.includes("Cloud generate") ||
            e.message.includes("No generate backend"));
        if (!generateFailed) setOffline(true);
        setItems((prev) => prev.filter((i) => i.id !== optimisticId));
        append({
          kind: "system",
          id: createId(),
          time: nowTime(),
          tone: "danger",
          text: detail,
        });
      } finally {
        setTyping(null);
      }
    },
    [agentId, append, enabled, loadThread, runFromMeta]
  );

  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    setTyping(null);
    if (!enabled || !agentId) {
      setItems([]);
      return;
    }
    loadThread().catch(() => setOffline(true));
  }, [agentId, enabled, loadThread]);

  const clear = useCallback(async () => {
    if (!enabled || !agentId) throw new Error("Clear unavailable");
    await api.clearAgentThread(agentId);
    setItems([]);
    setTyping(null);
    setOffline(false);
  }, [agentId, enabled]);

  return { items, typing, send, append, updateHandoff, reset, clear, offline, reload: loadThread };
}
