import { useCallback, useEffect, useRef, useState } from 'react';
import { createId, nowTime } from '../utils/time';
import type { ChatItem, ChatReply, HandoffState } from '../types/chat';

export function useChatThread(initial: ChatItem[], reply: ChatReply) {
  const [items, setItems] = useState<ChatItem[]>(initial);
  const [typing, setTyping] = useState<string | null>(null);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const append = useCallback((item: ChatItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const updateHandoff = useCallback((id: string, state: HandoffState) => {
    setItems((prev) =>
    prev.map((i) => i.kind === 'handoff' && i.id === id ? { ...i, state } : i)
    );
  }, []);

  const send = useCallback(
    (text: string) => {
      append({ kind: 'message', id: createId(), author: 'user', text, time: nowTime() });
      setTyping(reply.author);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setTyping(null);
        append({
          kind: 'message',
          id: createId(),
          author: reply.author,
          model: reply.model,
          text: reply.text,
          time: nowTime()
        });
      }, 1000);
    },
    [append, reply]
  );

  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    setTyping(null);
    setItems(initial);
  }, [initial]);

  return { items, typing, send, append, updateHandoff, reset };
}