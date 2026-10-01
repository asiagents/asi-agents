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

function chiefModel(meta?: ApiMessage["meta"]): ModelId | undefined {
  const id = meta?.primary?.trim();
  if (!id) return undefined;
  return id as ModelId;
}

function mapApiMessage(m: ApiMessage): ChatItem {
  if (m.role === "handoff") {
    return {
      kind: "handoff",
      id: m.id,
      from: "chief",
      to: "chief",
      model: chiefModel(m.meta) ?? "micro",
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
    author: m.role === "user" ? "user" : "chief",
    text: m.text,
    time: formatAt(m.at),
    model: m.role === "chief" ? chiefModel(m.meta) ?? "micro" : undefined,
    meta: mapServerMessageMeta(m.meta),
  };
}

/** Chief `/chat/chief` — POST then refetch thread so replies always land in the feed. */
export function useChiefThread(enabled: boolean) {
  const { runFromMeta } = useIntentClient();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const timer = useRef<number>();

  const loadThread = useCallback(async () => {
    try {
      const t = await api.chiefThread();
      setItems(t.messages.map(mapApiMessage));
      setOffline(false);
    } catch {
      // Failed fetch must not clear existing thread history.
      setOffline(true);
    }
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let retryTimer: number | undefined;

    const apply = (t: Awaited<ReturnType<typeof api.chiefThread>>) => {
      if (cancelled) return;
      setItems(t.messages.map(mapApiMessage));
      setOffline(false);
    };

    api
      .chiefThread()
      .then(apply)
      .catch(() => {
        if (cancelled) return;
        setOffline(true);
        retryTimer = window.setTimeout(() => {
          if (cancelled) return;
          api.chiefThread().then(apply).catch(() => undefined);
        }, 1500);
      });
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [enabled]);

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
      if (!enabled) return;
      const optimisticId = createId();
      append({
        kind: "message",
        id: optimisticId,
        author: "user",
        text,
        time: nowTime(),
      });
      setTyping("chief");
      try {
        const { messages } = await api.chiefChat(text, modelId);
        const lastChief = [...messages].reverse().find((m) => m.role === "chief");
        runFromMeta(
          (lastChief?.meta as { clientActions?: string } | undefined)?.clientActions
        );
        await loadThread();
      } catch (e) {
        const detail =
          e instanceof Error && e.message && !e.message.startsWith("Chief chat failed (")
            ? e.message
            : "Could not reach the API — run npm run dev from the repo root (API on :3445).";
        const generateFailed =
          e instanceof Error &&
          (e.message.includes("generate") || e.message.includes("Cloud generate") || e.message.includes("No generate backend"));
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
    [append, enabled, loadThread, runFromMeta]
  );

  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    setTyping(null);
    if (!enabled) {
      setItems([]);
      return;
    }
    loadThread().catch(() => setOffline(true));
  }, [enabled, loadThread]);

  const clear = useCallback(async () => {
    if (!enabled) throw new Error("Clear unavailable");
    await api.clearChiefThread();
    setItems([]);
    setTyping(null);
    setOffline(false);
  }, [enabled]);

  return { items, typing, send, append, updateHandoff, reset, clear, offline };
}
