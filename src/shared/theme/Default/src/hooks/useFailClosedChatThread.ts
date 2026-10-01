import { useCallback, useState } from 'react';
import { createId, nowTime } from '../utils/time';
import type { ChatItem, HandoffState } from '../types/chat';

/** Threads with no live API — no canned assistant replies. */
export function useFailClosedChatThread() {
  const [items, setItems] = useState<ChatItem[]>([]);

  const append = useCallback((item: ChatItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      append({ kind: 'message', id: createId(), author: 'user', text: trimmed, time: nowTime() });
      append({
        kind: 'system',
        id: createId(),
        time: nowTime(),
        tone: 'danger',
        text: 'This thread is not connected to the chat API — no reply was generated.',
      });
    },
    [append]
  );

  const updateHandoff = useCallback((id: string, state: HandoffState) => {
    setItems((prev) =>
      prev.map((i) => (i.kind === 'handoff' && i.id === id ? { ...i, state } : i))
    );
  }, []);

  const reset = useCallback(() => setItems([]), []);

  const clear = useCallback(async () => {
    throw new Error("Clear unavailable — thread not connected to the chat API");
  }, []);

  return { items, typing: null as string | null, send, append, updateHandoff, reset, clear };
}
