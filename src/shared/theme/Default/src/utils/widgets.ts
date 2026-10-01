import {
  WIDGET_COL_MAX,
  WIDGET_COL_MIN,
  WIDGET_ROW_MAX,
  WIDGET_ROW_MIN,
  densityFromSpan,
  spanFromSize,
  widgetCatalog,
} from '../data/widgets';
import { createId } from './time';
import type {
  WidgetColSpan,
  WidgetInstance,
  WidgetRowSpan,
  WidgetType,
} from '../types/settings';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function metaFor(type: WidgetType) {
  return widgetCatalog.find((m) => m.type === type);
}

function maxColsFor(type: WidgetType): WidgetColSpan {
  return (metaFor(type)?.maxCols ?? WIDGET_COL_MAX) as WidgetColSpan;
}

function maxRowsFor(type: WidgetType): WidgetRowSpan {
  return (metaFor(type)?.maxRows ?? WIDGET_ROW_MAX) as WidgetRowSpan;
}

/** Migrate size-only widgets → cols/rows; keep size in sync with span. */
export function normalizeWidget(raw: Partial<WidgetInstance> & { id: string; type: WidgetType }): WidgetInstance {
  const meta = metaFor(raw.type);
  const fallback = spanFromSize(raw.size ?? meta?.defaultSize ?? 'M');
  const cols = clamp(
    Number(raw.cols ?? fallback.cols),
    WIDGET_COL_MIN,
    maxColsFor(raw.type),
  ) as WidgetColSpan;
  const rows = clamp(
    Number(raw.rows ?? fallback.rows),
    WIDGET_ROW_MIN,
    maxRowsFor(raw.type),
  ) as WidgetRowSpan;
  return {
    id: raw.id,
    type: raw.type,
    cols,
    rows,
    size: densityFromSpan(cols, rows),
  };
}

export function normalizeWidgets(list: unknown): WidgetInstance[] {
  if (!Array.isArray(list)) return [];
  const known = new Set(widgetCatalog.map((m) => m.type));
  return list
    .filter((w): w is Partial<WidgetInstance> & { id: string; type: WidgetType } =>
      !!w && typeof w === 'object' && typeof (w as WidgetInstance).id === 'string' && known.has((w as WidgetInstance).type),
    )
    .map(normalizeWidget);
}

export function addWidget(list: WidgetInstance[], type: WidgetType): WidgetInstance[] {
  const meta = metaFor(type);
  if (!meta) return list;
  const { cols, rows } = spanFromSize(meta.defaultSize);
  return [
    ...list,
    normalizeWidget({ id: `w-${createId()}`, type, size: meta.defaultSize, cols, rows }),
  ];
}

export function removeWidget(list: WidgetInstance[], id: string): WidgetInstance[] {
  return list.filter((w) => w.id !== id);
}

/** Quick cycle through catalog preset sizes (updates cols×rows). */
export function cycleSize(list: WidgetInstance[], id: string): WidgetInstance[] {
  return list.map((w) => {
    if (w.id !== id) return w;
    const sizes = metaFor(w.type)?.sizes ?? [w.size];
    const next = sizes[(sizes.indexOf(w.size) + 1) % sizes.length] ?? w.size;
    const { cols, rows } = spanFromSize(next);
    return normalizeWidget({ ...w, size: next, cols, rows });
  });
}

export function setWidgetSpan(
  list: WidgetInstance[],
  id: string,
  next: { cols?: number; rows?: number },
): WidgetInstance[] {
  return list.map((w) => {
    if (w.id !== id) return w;
    return normalizeWidget({
      ...w,
      cols: (next.cols ?? w.cols) as WidgetColSpan,
      rows: (next.rows ?? w.rows) as WidgetRowSpan,
    });
  });
}

export function nudgeWidgetSpan(
  list: WidgetInstance[],
  id: string,
  axis: 'cols' | 'rows',
  dir: -1 | 1,
): WidgetInstance[] {
  return list.map((w) => {
    if (w.id !== id) return w;
    if (axis === 'cols') {
      return normalizeWidget({ ...w, cols: (w.cols + dir) as WidgetColSpan });
    }
    return normalizeWidget({ ...w, rows: (w.rows + dir) as WidgetRowSpan });
  });
}

export function canNudgeSpan(w: WidgetInstance, axis: 'cols' | 'rows', dir: -1 | 1): boolean {
  if (axis === 'cols') {
    const next = w.cols + dir;
    return next >= WIDGET_COL_MIN && next <= maxColsFor(w.type);
  }
  const next = w.rows + dir;
  return next >= WIDGET_ROW_MIN && next <= maxRowsFor(w.type);
}

export function moveWidget(list: WidgetInstance[], dragId: string, targetId: string): WidgetInstance[] {
  if (dragId === targetId) return list;
  const drag = list.find((w) => w.id === dragId);
  if (!drag) return list;
  const rest = list.filter((w) => w.id !== dragId);
  const idx = rest.findIndex((w) => w.id === targetId);
  rest.splice(idx, 0, drag);
  return rest;
}

export function shiftWidget(list: WidgetInstance[], id: string, dir: -1 | 1): WidgetInstance[] {
  const i = list.findIndex((w) => w.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function formatSpan(w: Pick<WidgetInstance, 'cols' | 'rows'>): string {
  return `${w.cols}×${w.rows}`;
}
