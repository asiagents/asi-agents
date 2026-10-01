import { useCallback, useEffect, useState } from "react";
import { api, type GroupMessage } from "@asi-api";
import type { ChatItem } from "../types/chat";
import type { ModelId } from "../types/models";
import { getAgent } from "../utils/lookup";
import { mapServerMessageMeta } from "../utils/chatMeta";
import { createId, nowTime } from "../utils/time";

function formatAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return nowTime();
  }
}

function mapGroupMessage(m: GroupMessage): ChatItem {
  if (m.decide && !m.final) {
    return {
      kind: "system",
      id: m.id,
      text: m.text,
      time: formatAt(m.at),
      tone: "neutral",
    };
  }
  const who = m.who.trim().toLowerCase();
  if (who === "system" && !m.final) {
    return {
      kind: "system",
      id: m.id,
      text: m.text,
      time: formatAt(m.at),
      tone: "neutral",
    };
  }
  const author = who === "user" ? "user" : m.who;
  const agent = who !== "user" ? getAgent(m.who) : undefined;
  const model = (agent?.primary ?? (who === "chief" ? "micro" : undefined)) as ModelId | undefined;
  const isFailClosed =
    who !== "user" &&
    /fail closed|blocked \(fail closed\)|no generate backend answered/i.test(m.text);
  return {
    kind: "message",
    id: m.id,
    author,
    text: m.text,
    time: formatAt(m.at),
    model: isFailClosed ? ("offline" as ModelId) : model,
    final: m.final === true ? true : undefined,
    meta: mapServerMessageMeta(m.meta),
  };
}

/** Group council — hydrate from GET messages; send triggers POST generate (LLM round). */
export function useGroupThread(enabled: boolean, groupId?: string | null) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const loadThread = useCallback(async () => {
    try {
      const { messages } = await api.groupMessages(groupId || undefined);
      setItems(messages.map(mapGroupMessage));
      setOffline(false);
    } catch {
      // Failed fetch must not clear existing thread history.
      setOffline(true);
    }
  }, [groupId]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setTyping(null);
      return;
    }
    let cancelled = false;
    api
      .groupMessages(groupId || undefined)
      .then(({ messages }) => {
        if (!cancelled) {
          setItems(messages.map(mapGroupMessage));
          setOffline(false);
        }
      })
      .catch(() => {
        // Offline / failed fetch must not wipe visible history.
        if (!cancelled) setOffline(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, groupId]);

  const append = useCallback((item: ChatItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!enabled) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      setTyping("chief");
      try {
        // Optimistic user bubble while the council round runs
        append({
          kind: "message",
          id: createId(),
          author: "user",
          text: trimmed,
          time: nowTime(),
        });
        const res = await api.groupGenerate({
          text: trimmed,
          groupId: groupId || undefined,
        });
        const mapped = res.messages.map(mapGroupMessage);
        const failed = (res.results ?? []).filter((r) => !r.ok);
        if (failed.length > 0 && failed.length === (res.results?.length ?? 0)) {
          mapped.push({
            kind: "system",
            id: createId(),
            time: nowTime(),
            tone: "danger",
            text: `All council members failed closed (${failed.map((f) => f.name).join(", ")}). Check Ollama / OpenRouter / AMS models.`,
          });
        }
        setItems(mapped);
        setOffline(false);
      } catch (err) {
        const expired =
          err instanceof Error &&
          ((err as Error & { sessionExpired?: boolean }).sessionExpired === true ||
            /session.?time|session_expired|time limit/i.test(err.message));
        if (expired) {
          append({
            kind: "system",
            id: createId(),
            time: nowTime(),
            tone: "danger",
            text:
              err instanceof Error && err.message
                ? err.message
                : "Session time limit reached — generate blocked (fail closed).",
          });
          setOffline(false);
          return;
        }
        setOffline(true);
        append({
          kind: "system",
          id: createId(),
          time: nowTime(),
          tone: "danger",
          text: "Could not reach the council API — run npm run start (built UI+API) or npm run dev from the repo root (API on :3445).",
        });
      } finally {
        setTyping(null);
      }
    },
    [append, enabled, groupId]
  );

  const decide = useCallback(
    async (action: "approve" | "ask" | "reject" | "reopen", text?: string) => {
      if (!enabled) throw new Error("session closed");
      const payload = text?.trim();
      const res = await api.groupDecide(action, {
        ...(payload ? { text: payload } : {}),
        groupId: groupId || undefined,
      });
      // "ask" should also invite another council round when text is present
      if (action === "ask" && payload) {
        setTyping("chief");
        try {
          const gen = await api.groupGenerate({
            groupId: groupId || undefined,
          });
          setItems(gen.messages.map(mapGroupMessage));
        } catch {
          await loadThread();
        } finally {
          setTyping(null);
        }
      } else {
        await loadThread();
      }
      return res;
    },
    [enabled, groupId, loadThread]
  );

  const conclude = useCallback(
    async (opts?: { verdict?: string; shortlist?: string[]; draftOnly?: boolean }) => {
      if (!enabled) throw new Error("session closed");
      if (!opts?.draftOnly) setTyping("chief");
      try {
        const res = await api.groupConclude({
          groupId: groupId || undefined,
          verdict: opts?.verdict,
          shortlist: opts?.shortlist,
          draftOnly: opts?.draftOnly,
        });
        if (!opts?.draftOnly) {
          setItems(res.messages.map(mapGroupMessage));
          setOffline(false);
        }
        return res;
      } catch (err) {
        setOffline(true);
        throw err;
      } finally {
        if (!opts?.draftOnly) setTyping(null);
      }
    },
    [enabled, groupId]
  );

  const reset = useCallback(() => {
    setTyping(null);
    if (!enabled) {
      setItems([]);
      return;
    }
    loadThread().catch(() => {
      setOffline(true);
    });
  }, [enabled, loadThread]);

  const clear = useCallback(async () => {
    if (!enabled) throw new Error("Clear unavailable");
    await api.clearGroupMessages(groupId || undefined);
    setItems([]);
    setTyping(null);
    setOffline(false);
  }, [enabled, groupId]);

  return { items, typing, send, append, reset, clear, offline, decide, conclude, reload: loadThread };
}
