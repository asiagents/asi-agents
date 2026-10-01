import React, { useState } from 'react';
import { WidgetCard } from './WidgetCard';
import { WidgetBody } from './WidgetBody';
import { useSettings } from '../../contexts/SettingsContext';
import { widgetCatalog } from '../../data/widgets';
import { canNudgeSpan, moveWidget, nudgeWidgetSpan, removeWidget, shiftWidget } from '../../utils/widgets';
import type { WidgetInstance } from '../../types/settings';

type WidgetTarget = 'home' | 'lock';

/** Dense widget grid. Span = user cols×rows (1–4 × 1–3). Drag to reorder while editing. */
export function WidgetGrid({
  editing,
  target = 'home',
  emptyMessage,
  compact,
}: {
  editing: boolean;
  target?: WidgetTarget;
  emptyMessage?: string;
  compact?: boolean;
}) {
  const { s, set } = useSettings();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const widgets = target === 'lock' ? s.lockWidgets : s.widgets;
  const apply = (next: WidgetInstance[]) => {
    if (target === 'lock') set('lockWidgets', next);
    else set('widgets', next);
  };

  if (widgets.length === 0) {
    return (
      <p className="rounded-card bg-surface/80 p-8 text-center text-sm text-muted ring-1 ring-line backdrop-blur-sm">
        {emptyMessage ??
          (target === 'lock'
            ? 'No widgets on this lock layout yet.'
            : 'No widgets yet. Tap Edit, then Add widget.')}
      </p>
    );
  }

  return (
    <div
      className={`grid grid-flow-dense gap-4 ${
        compact
          ? 'auto-rows-[140px] grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
          : 'auto-rows-[176px] grid-cols-2 md:grid-cols-4 xl:grid-cols-6'
      }`}
    >
      {widgets.map((w) => {
        const meta = widgetCatalog.find((m) => m.type === w.type)!;
        const clear = w.type === 'neural-brain';
        return (
          <WidgetCard
            key={w.id}
            id={w.id}
            title={meta.label}
            cols={w.cols}
            rows={w.rows}
            editing={editing}
            chrome={clear ? 'clear' : 'default'}
            canWiden={canNudgeSpan(w, 'cols', 1)}
            canNarrow={canNudgeSpan(w, 'cols', -1)}
            canTaller={canNudgeSpan(w, 'rows', 1)}
            canShorter={canNudgeSpan(w, 'rows', -1)}
            dragOver={editing && overId === w.id && dragId !== w.id}
            onRemove={() => apply(removeWidget(widgets, w.id))}
            onNudgeCols={(d) => apply(nudgeWidgetSpan(widgets, w.id, 'cols', d))}
            onNudgeRows={(d) => apply(nudgeWidgetSpan(widgets, w.id, 'rows', d))}
            onShift={(d) => apply(shiftWidget(widgets, w.id, d))}
            onDragStart={() => setDragId(w.id)}
            onDragEnter={() => setOverId(w.id)}
            onDrop={() => {
              if (dragId) apply(moveWidget(widgets, dragId, w.id));
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
          >
            <WidgetBody widget={w} />
          </WidgetCard>
        );
      })}
    </div>
  );
}
