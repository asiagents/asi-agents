import type { WidgetColSpan, WidgetInstance, WidgetMeta, WidgetRowSpan, WidgetSize } from '../types/settings';

export const WIDGET_COL_MIN = 1 as const;
export const WIDGET_COL_MAX = 4 as const;
export const WIDGET_ROW_MIN = 1 as const;
export const WIDGET_ROW_MAX = 3 as const;

/** Preset S/M/L → default grid span. Users can stretch beyond these in Edit. */
export const SIZE_SPAN: Record<WidgetSize, { cols: WidgetColSpan; rows: WidgetRowSpan }> = {
  S: { cols: 1, rows: 1 },
  M: { cols: 2, rows: 1 },
  L: { cols: 2, rows: 2 },
};

export function densityFromSpan(cols: number, rows: number): WidgetSize {
  const cells = Math.max(1, cols) * Math.max(1, rows);
  if (cells <= 1) return 'S';
  if (rows === 1 && cols <= 2) return 'M';
  if (cells <= 2) return 'M';
  return 'L';
}

export function spanFromSize(size: WidgetSize): { cols: WidgetColSpan; rows: WidgetRowSpan } {
  return SIZE_SPAN[size] ?? SIZE_SPAN.M;
}

export const widgetCatalog: WidgetMeta[] = [
  { type: 'agents', label: 'Agent status', description: 'Who is working, idle, or offline', sizes: ['M', 'L'], defaultSize: 'L', maxCols: 4, maxRows: 3 },
  { type: 'run-activity', label: 'Run activity', description: 'Recent generates / chat runs by day or agent', sizes: ['M', 'L'], defaultSize: 'M', maxCols: 4, maxRows: 3 },
  { type: 'tasks-status', label: 'Tasks by status', description: 'Pending, ongoing, and completed tasks', sizes: ['M', 'L'], defaultSize: 'M', maxCols: 4, maxRows: 2 },
  { type: 'task-outcomes', label: 'Success + fail', description: 'Completed tasks, blocked, and fail-closed chat', sizes: ['M', 'L'], defaultSize: 'M', maxCols: 4, maxRows: 2 },
  { type: 'todos', label: 'To-dos', description: 'Assign to Chief / auto / agent / Personal · categories', sizes: ['M', 'L'], defaultSize: 'M', maxCols: 4, maxRows: 3 },
  { type: 'spend', label: 'Spend leaderboard', description: 'Cloud spend per agent', sizes: ['M', 'L'], defaultSize: 'M', maxCols: 4, maxRows: 3 },
  { type: 'net', label: 'Net check', description: 'Connection status', sizes: ['S', 'M'], defaultSize: 'S', maxCols: 3, maxRows: 2 },
  { type: 'weather', label: 'Weather', description: 'Location, °C / °F', sizes: ['S', 'M'], defaultSize: 'M', maxCols: 3, maxRows: 2 },
  { type: 'time', label: 'Time', description: 'Local + Home/Away + world clocks', sizes: ['S', 'M', 'L'], defaultSize: 'M', maxCols: 4, maxRows: 3 },
  { type: 'hardware', label: 'Hardware', description: 'Live CPU / RAM / VRAM usage from /api/hardware', sizes: ['S', 'M'], defaultSize: 'M', maxCols: 3, maxRows: 2 },
  { type: 'vd', label: 'Virtual desktop', description: 'Latest snapshot', sizes: ['M', 'L'], defaultSize: 'L', maxCols: 4, maxRows: 3 },
  { type: 'calendar', label: 'Calendar', description: "Today's schedule", sizes: ['M', 'L'], defaultSize: 'M', maxCols: 4, maxRows: 3 },
  { type: 'approvals', label: 'Approvals', description: 'Waiting in chat', sizes: ['S', 'M'], defaultSize: 'S', maxCols: 3, maxRows: 2 },
  { type: 'panic', label: 'Panic', description: 'Stop all agents (opt-in on Home)', sizes: ['S'], defaultSize: 'S', maxCols: 2, maxRows: 1 },
  { type: 'model', label: 'Model status', description: 'Saved Browse pool (top 5)', sizes: ['S', 'M'], defaultSize: 'S', maxCols: 3, maxRows: 2 },
  { type: 'nextup', label: 'Next up', description: 'The next thing to decide', sizes: ['S', 'M'], defaultSize: 'M', maxCols: 3, maxRows: 2 },
  {
    type: 'neural-brain',
    label: 'Neural brain',
    description: 'Transparent node graph — Home and Lock',
    sizes: ['M', 'L'],
    defaultSize: 'L',
    maxCols: 4,
    maxRows: 3,
  },
];

function withSpan(id: string, type: WidgetMeta['type'], size: WidgetSize): WidgetInstance {
  const { cols, rows } = spanFromSize(size);
  return { id, type, size, cols, rows };
}

/** Panic card is opt-in — add via Edit layout / Settings → Widgets. Header Panic stays. */
export const defaultWidgets: WidgetInstance[] = [
  withSpan('w-agents', 'agents', 'L'),
  withSpan('w-run-activity', 'run-activity', 'M'),
  withSpan('w-tasks-status', 'tasks-status', 'M'),
  withSpan('w-task-outcomes', 'task-outcomes', 'M'),
  withSpan('w-nextup', 'nextup', 'M'),
  withSpan('w-time', 'time', 'M'),
  withSpan('w-net', 'net', 'S'),
  withSpan('w-todos', 'todos', 'M'),
  withSpan('w-approvals', 'approvals', 'S'),
  withSpan('w-weather', 'weather', 'M'),
  withSpan('w-vd', 'vd', 'L'),
  withSpan('w-calendar', 'calendar', 'M'),
  withSpan('w-spend', 'spend', 'M'),
  withSpan('w-hardware', 'hardware', 'M'),
  withSpan('w-model', 'model', 'S'),
];
