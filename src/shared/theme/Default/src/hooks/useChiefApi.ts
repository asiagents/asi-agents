import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ChatMessage as ApiMessage } from "@asi-api";
import type { ChatItem, HandoffState } from "../types/chat";
import { createId, nowTime } from "../utils/time";

function formatAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return nowTime();
  }
}

function mapApiMessage(m: ApiMessage): ChatItem {
  if (m.role === "handoff") {
    return {
      kind: "handoff",
      id: m.id,
      from: "chief",
      to: "chief",
      model: "micro",
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
    model: m.role === "chief" ? "micro" : undefined,
  };
}

/** Live Chief thread via product API (:3445 proxied in dev). */
export function useChiefApi(enabled: boolean) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api
      .chiefThread()
      .then((t) => {
        if (!cancelled) {
          setItems(t.messages.map(mapApiMessage));
          setOffline(false);
        }
      })
      .catch(() => {
        if (!cancelled) setOffline(true);
      });
    return () => {
      cancelled = true;
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
        const newMsgs = await api.chiefChat(text, modelId);
        setOffline(false);
        setItems((prev) => {
          const withoutOptimistic = prev.filter((i) => i.id !== optimisticId);
          const ids = new Set(withoutOptimistic.map((i) => i.id));
          const added = newMsgs.messages.map(mapApiMessage).filter((m) => !ids.has(m.id));
          return [...withoutOptimistic, ...added];
        });
      } catch {
        setOffline(true);
        append({
          kind: "system",
          id: createId(),
          time: nowTime(),
          tone: "danger",
          text: "Could not reach the API — run npm run dev from the repo root (API on :3445).",
        });
      } finally {
        setTyping(null);
      }
    },
    [append, enabled]
  );

  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    setTyping(null);
    if (!enabled) {
      setItems([]);
      return;
    }
    api
      .chiefThread()
      .then((t) => setItems(t.messages.map(mapApiMessage)))
      .catch(() => setOffline(true));
  }, [enabled]);

  return { items, typing, send, append, updateHandoff, reset, offline };
}
