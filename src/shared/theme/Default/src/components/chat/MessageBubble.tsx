import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2Icon, VolumeXIcon } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { speak } from '../../utils/speech';
import { AgentAvatar } from '../AgentAvatar';
import { ModelChip } from '../ModelChip';
import { getAgent } from '../../utils/lookup';
import { formatAgentDisplayName } from '../../utils/agentDisplay';
import type { ChatMessage } from '../../types/chat';
import {
  formatCostTraceLines,
  formatDecisionTraceChip,
  formatDecisionTraceDetail,
  formatMessageMetaLine,
  formatSourceChipLabel,
} from '../../utils/chatMeta';
import { messageImpliesApproval } from '../../utils/approvalHint';
import { MessageApprovalStrip } from '../permissions/MessageApprovalStrip';
import { stripModelReasoning } from '../../utils/stripModelReasoning';

const enter = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
};

/** Collapse long research / agent bodies by default so the feed stays scannable. */
const COLLAPSE_CHARS = 900;

/** Plain-text only — strip control chars; never treat content as HTML. */
function sanitizePlain(raw: string | undefined | null): string {
  if (raw == null) return '';
  return String(raw)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n');
}

/** Assistant bubbles: also drop leaked CoT / think tags (old persisted dumps too). */
function safeMessageText(raw: string | undefined | null, opts?: { stripCot?: boolean }): string {
  const plain = sanitizePlain(raw);
  return opts?.stripCot === false ? plain : stripModelReasoning(plain);
}

function CollapsibleBody({
  text,
  className,
  stripCot = true,
}: {
  text: string;
  className?: string;
  stripCot?: boolean;
}) {
  const safe = safeMessageText(text, { stripCot });
  const long = safe.length > COLLAPSE_CHARS;
  const [open, setOpen] = useState(false);
  if (!safe) {
    return <div className={className}>(empty reply)</div>;
  }
  const shown = !long || open ? safe : `${safe.slice(0, COLLAPSE_CHARS).trimEnd()}…`;
  return (
    <div className={className}>
      <div className="whitespace-pre-wrap">{shown}</div>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 text-[12px] font-medium text-accent-ink underline-offset-2 hover:underline"
          aria-expanded={open}
        >
          {open ? 'Collapse details' : 'Show full message'}
        </button>
      ) : null}
    </div>
  );
}

function ReplayButton({ text }: { text: string }) {
  const { s } = useSettings();
  const off = !s.tts || s.muteMode === 'muted';
  return (
    <button
      type="button"
      disabled={off}
      onClick={() => speak(text, { muteMode: s.muteMode, tts: s.tts, volume: s.volume, lang: s.sttLocale })}
      aria-label={off ? 'Replay unavailable — audio muted' : 'Replay this message aloud'}
      title={off ? 'Audio is muted' : 'Replay (Local TTS)'}
      className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint transition-colors duration-150 hover:bg-overlay/[0.05] hover:text-ink disabled:opacity-40">
      {off ? <VolumeXIcon size={13} aria-hidden="true" /> : <Volume2Icon size={13} aria-hidden="true" />}
    </button>
  );
}

/** Friendly source label — never raw intent ids. */
function SourceChip({ label }: { label: string }) {
  return (
    <span className="mt-0.5 inline-block text-[8px] font-normal leading-snug text-[#9ca3af]">{label}</span>
  );
}

/** Expandable decision + cost/latency stages under the metrics line. */
function TurnTracePanel({ item }: { item: ChatMessage }) {
  const meta = item.meta;
  const [open, setOpen] = useState(false);
  if (!meta) return null;
  const decisionChip = formatDecisionTraceChip(meta);
  const decisionDetail = formatDecisionTraceDetail(meta);
  const costLines = formatCostTraceLines(meta);
  if (!decisionChip && !costLines.length) return null;

  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-left text-[8px] font-normal leading-snug text-[#9ca3af] underline-offset-2 hover:underline"
        aria-expanded={open}
      >
        {decisionChip ? `trace · ${decisionChip}` : 'cost / latency'}
        {costLines.length && !decisionChip ? ` · ${costLines.length} stage${costLines.length === 1 ? '' : 's'}` : ''}
        {open ? ' ▾' : ' ▸'}
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5 font-mono text-[8px] leading-snug text-[#9ca3af]">
          {decisionDetail ? <p>{decisionDetail}</p> : null}
          {costLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MessageMetrics({ item }: { item: ChatMessage }) {
  const line = item.meta ? formatMessageMetaLine(item.meta) : null;
  const sourceLabel = item.meta ? formatSourceChipLabel(item.meta) : null;
  const hasTrace = Boolean(
    item.meta && (formatDecisionTraceChip(item.meta) || formatCostTraceLines(item.meta).length)
  );
  if (!line && !sourceLabel && !hasTrace) return null;
  return (
    <div className="mt-1">
      {(sourceLabel || line) && (
        <p className="text-[8px] font-normal leading-snug text-[#9ca3af]">
          {sourceLabel ? <SourceChip label={sourceLabel} /> : null}
          {sourceLabel && line ? <span> · </span> : null}
          {line}
          <span> · {item.time}</span>
        </p>
      )}
      {!sourceLabel && !line ? (
        <p className="text-[8px] font-normal leading-snug text-[#9ca3af]">{item.time}</p>
      ) : null}
      <TurnTracePanel item={item} />
    </div>
  );
}

export function MessageBubble({ item }: { item: ChatMessage }) {
  if (item.final) {
    const agent = item.author !== 'user' ? getAgent(item.author) : undefined;
    const displayName =
      item.author === 'user'
        ? 'You'
        : agent
          ? formatAgentDisplayName(agent)
          : item.author;
    return (
      <motion.div {...enter} className="flex justify-center" role="article" aria-label="Final answer">
        <div className="w-full max-w-[90%] rounded-xl border border-accent/35 bg-accent/[0.08] px-4 py-3.5 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent-strong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Final
            </span>
            <span className="text-[13px] font-medium text-ink">{displayName}</span>
            {item.model && <ModelChip id={item.model} size="xs" />}
            <span className="text-[11px] text-faint">{item.time}</span>
          </div>
          <CollapsibleBody
            text={item.text}
            className="text-[15px] leading-relaxed text-ink"
          />
        </div>
      </motion.div>
    );
  }

  if (item.author === 'user') {
    const sourceLabel = item.meta ? formatSourceChipLabel(item.meta) : null;
    const decisionChip = item.meta ? formatDecisionTraceChip(item.meta) : null;
    const safe = safeMessageText(item.text, { stripCot: false });
    return (
      <motion.div {...enter} className="flex justify-end">
        <div className="max-w-[80%]">
          <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent-strong px-4 py-2.5 text-[16px] leading-relaxed text-white">
            {safe || '(empty)'}
          </div>
          {sourceLabel || decisionChip ? (
            <p className="mt-0.5 text-right text-[8px] text-[#9ca3af]">
              {sourceLabel ? <SourceChip label={sourceLabel} /> : null}
              {sourceLabel && decisionChip ? ' · ' : null}
              {decisionChip}
            </p>
          ) : null}
          <div className="mt-1 text-right text-[11px] text-faint">You · {item.time}</div>
        </div>
      </motion.div>
    );
  }

  const agent = getAgent(item.author);
  const displayName = agent ? formatAgentDisplayName(agent) : item.author;
  const safe = safeMessageText(item.text);
  const needsPerm = messageImpliesApproval(safe);
  const hasUsageMeta = Boolean(
    item.meta &&
      (formatMessageMetaLine(item.meta) ||
        formatSourceChipLabel(item.meta) ||
        formatDecisionTraceChip(item.meta) ||
        formatCostTraceLines(item.meta).length)
  );

  return (
    <motion.div {...enter} className="flex gap-3">
      {agent ? (
        <AgentAvatar agent={agent} size="sm" />
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#1f2433] text-[11px] font-semibold text-[#c9cfdb]">
          {displayName.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 max-w-[85%]">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-ink">{displayName}</span>
          {!hasUsageMeta && item.model && <ModelChip id={item.model} size="xs" />}
          {!hasUsageMeta && <span className="text-[11px] text-faint">{item.time}</span>}
        </div>
        <div className="flex items-end gap-1.5">
          <CollapsibleBody
            text={safe}
            className="rounded-2xl rounded-tl-md bg-surface px-4 py-2.5 text-[16px] leading-relaxed text-black ring-1 ring-line"
          />
          <ReplayButton text={`${displayName} says: ${safe}`} />
        </div>
        <MessageMetrics item={item} />
        {needsPerm && <MessageApprovalStrip />}
      </div>
    </motion.div>
  );
}
