import React from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MinusIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react';
import type { WidgetColSpan, WidgetRowSpan } from '../../types/settings';

interface WidgetCardProps {
  id: string;
  title: string;
  cols: WidgetColSpan;
  rows: WidgetRowSpan;
  editing: boolean;
  canWiden: boolean;
  canNarrow: boolean;
  canTaller: boolean;
  canShorter: boolean;
  dragOver: boolean;
  /** Clear chrome for dramatic transparent widgets (e.g. neural brain). */
  chrome?: 'default' | 'clear';
  onRemove: () => void;
  onNudgeCols: (dir: -1 | 1) => void;
  onNudgeRows: (dir: -1 | 1) => void;
  onShift: (dir: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  children: React.ReactNode;
}

const ctl = 'grid h-7 w-7 place-items-center rounded-full bg-surface text-ink shadow ring-1 ring-line transition-colors duration-150 hover:bg-raised disabled:opacity-30';

export function WidgetCard({
  id,
  title,
  cols,
  rows,
  editing,
  canWiden,
  canNarrow,
  canTaller,
  canShorter,
  dragOver,
  chrome = 'default',
  onRemove,
  onNudgeCols,
  onNudgeRows,
  onShift,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
  children,
}: WidgetCardProps) {
  const clear = chrome === 'clear';
  return (
    <section
      aria-label={title}
      data-widget={id}
      data-span={`${cols}x${rows}`}
      draggable={editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => editing && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      style={{
        gridColumn: `span ${cols} / span ${cols}`,
        gridRow: `span ${rows} / span ${rows}`,
      }}
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-[22px] transition-[box-shadow,transform] duration-150 ${
        clear ? 'bg-transparent p-2 ring-0' : 'bg-surface p-4 ring-1'
      } ${
        editing ? 'cursor-grab ring-accent/40' : clear ? '' : 'ring-line'
      } ${dragOver ? 'ring-2 ring-accent' : ''}`}
    >
      <div className={`mb-2 flex items-center gap-2 ${clear && !editing ? 'sr-only' : ''}`}>
        <h2 className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted">{title}</h2>
        {editing && (
          <span className="shrink-0 rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted ring-1 ring-line">
            {cols}×{rows}
          </span>
        )}
      </div>
      <div className={`flex min-h-0 flex-1 flex-col ${editing ? 'pointer-events-none select-none opacity-70' : ''}`}>
        {children}
      </div>
      {editing && (
        <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1">
          <button type="button" onClick={() => onShift(-1)} aria-label={`Move ${title} earlier`} className={ctl}>
            <ArrowLeftIcon size={13} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onShift(1)} aria-label={`Move ${title} later`} className={ctl}>
            <ArrowRightIcon size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!canNarrow}
            onClick={() => onNudgeCols(-1)}
            aria-label={`Narrow ${title}`}
            className={ctl}
          >
            <MinusIcon size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!canWiden}
            onClick={() => onNudgeCols(1)}
            aria-label={`Widen ${title}`}
            className={ctl}
          >
            <PlusIcon size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!canShorter}
            onClick={() => onNudgeRows(-1)}
            aria-label={`Shorten ${title}`}
            className={ctl}
          >
            <ChevronUpIcon size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!canTaller}
            onClick={() => onNudgeRows(1)}
            aria-label={`Make ${title} taller`}
            className={ctl}
          >
            <ChevronDownIcon size={13} aria-hidden="true" />
          </button>
          <button type="button" onClick={onRemove} aria-label={`Remove ${title}`} className={`${ctl} text-danger`}>
            <XIcon size={13} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
