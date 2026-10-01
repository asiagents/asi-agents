import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2Icon, CircleSlashIcon, InfoIcon } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { HandoffBeat } from './HandoffBeat';
import { AgentAvatar } from '../AgentAvatar';
import { getAgent } from '../../utils/lookup';
import type { ChatItem, ChatSystem } from '../../types/chat';

interface ChatFeedProps {
  items: ChatItem[];
  typing: string | null;
  onHandoffDecision?: (id: string, approve: boolean) => void;
  after?: React.ReactNode;
}

export function ChatFeed({ items, typing, onHandoffDecision, after }: ChatFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length, typing, after]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6" role="log" aria-live="polite" tabIndex={-1}>
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {items.map((item) => {
          if (item.kind === 'message') return <MessageBubble key={item.id} item={item} />;
          if (item.kind === 'handoff')
          return <HandoffBeat key={item.id} item={item} onDecision={onHandoffDecision} />;
          return <SystemBeat key={item.id} item={item} />;
        })}
        {after}
        {typing && <TypingIndicator author={typing} />}
      </div>
    </div>);

}

function SystemBeat({ item }: {item: ChatSystem;}) {
  const tone =
  item.tone === 'success' ? 'text-success' : item.tone === 'danger' ? 'text-danger' : 'text-faint';
  const Icon = item.tone === 'success' ? CheckCircle2Icon : item.tone === 'danger' ? CircleSlashIcon : InfoIcon;
  const raw = String(item.text ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const long = raw.length > 220;
  const [open, setOpen] = useState(false);
  const shown = !long || open ? raw : `${raw.slice(0, 220).trimEnd()}…`;
  return (
    <div className={`flex items-start gap-3 text-[12px] ${tone}`}>
      <span className="mt-2 h-px flex-1 bg-line" />
      <span className="flex max-w-[85%] flex-col items-center gap-1 text-center">
        <span className="flex items-start gap-1.5">
          <Icon size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="whitespace-pre-wrap">{shown}</span>
        </span>
        {long ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] font-medium text-accent-ink underline-offset-2 hover:underline"
            aria-expanded={open}
          >
            {open ? 'Collapse details' : 'Show full'}
          </button>
        ) : null}
        <span className="text-faint">· {item.time}</span>
      </span>
      <span className="mt-2 h-px flex-1 bg-line" />
    </div>);

}


function TypingIndicator({ author }: {author: string;}) {
  const agent = getAgent(author);
  const name = agent?.name ?? author;
  return (
    <div className="flex items-center gap-3" aria-label={`${name} is typing`}>
      {agent ? (
        <AgentAvatar agent={agent} size="sm" />
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#1f2433] text-[11px] font-semibold text-[#c9cfdb]">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="flex gap-1 rounded-2xl rounded-tl-md bg-surface px-4 py-3 ring-1 ring-line">
        {[0, 1, 2].map((i) =>
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'linear' }} />

        )}
      </div>
    </div>);

}