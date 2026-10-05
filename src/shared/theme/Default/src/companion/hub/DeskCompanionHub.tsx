/**
 * Fullscreen desk companion hub — character column + tabbed toolkit.
 */
import React, { useState } from 'react';
import {
  ListTodoIcon,
  MessageSquareIcon,
  PlusIcon,
  Settings2Icon,
  XIcon,
} from 'lucide-react';
import type { CompanionSkinId, CompanionStateId } from '../assets';
import { COMPANION_SKIN_LABELS } from '../assets';
import {
  HUB_TABS,
  HUB_TAB_LABELS,
  readHubTab,
  writeHubTab,
  type HubTabId,
} from '../deskPrefs';
import type { CompanionTask } from '../stateMachine';
import {
  CountdownTool,
  FocusTimerTool,
  StickyNoteTool,
  WifiTool,
  WorldClockTool,
} from './DeskTools';

function statusGlyph(status: string): string {
  if (status === 'blocked') return '!';
  if (status === 'ongoing') return '›';
  return '·';
}

export type DeskCompanionHubProps = {
  skin: CompanionSkinId;
  state: CompanionStateId;
  statusLine: string;
  spriteImg: React.ReactNode;
  useBob: boolean;
  box: { w: number; h: number };
  hubCloseRef: React.RefObject<HTMLButtonElement | null>;
  tasks: CompanionTask[];
  todoDraft: string;
  setTodoDraft: (v: string) => void;
  addingTodo: boolean;
  addError: string | null;
  busyId: string | null;
  onClose: () => void;
  onOpenChat: () => void;
  onOpenModules: () => void;
  onOpenTodosPage: (todoId?: string) => void;
  onAssignTodo: (e?: React.FormEvent) => void;
  onToggleComplete: (task: CompanionTask) => void;
};

export function DeskCompanionHub({
  skin,
  state,
  statusLine,
  spriteImg,
  useBob,
  box,
  hubCloseRef,
  tasks,
  todoDraft,
  setTodoDraft,
  addingTodo,
  addError,
  busyId,
  onClose,
  onOpenChat,
  onOpenModules,
  onOpenTodosPage,
  onAssignTodo,
  onToggleComplete,
}: DeskCompanionHubProps) {
  const skinLabel = COMPANION_SKIN_LABELS[skin];
  const [tab, setTab] = useState<HubTabId>(() => readHubTab());
  const ongoing = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const selectTab = (id: HubTabId) => {
    setTab(id);
    writeHubTab(id);
  };

  return (
    <div
      className="asi-squari-hub pointer-events-auto fixed inset-0 z-[70] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`${skinLabel} desk companion`}
      data-squari-state={state}
      data-companion={skin}
    >
      <div
        className="asi-squari-hub-backdrop absolute inset-0 bg-ink/55 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="asi-squari-hub-panel relative z-[1] m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-surface/95 shadow-2xl ring-1 ring-line sm:m-4 md:m-6"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
        }}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 px-3 pb-2 pt-1 sm:px-5 sm:pt-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-faint">Desk companion</p>
            <h2 className="truncate text-xl font-semibold text-ink sm:text-2xl">{skinLabel}</h2>
            <p className="mt-0.5 text-[13px] text-muted">{statusLine}</p>
          </div>
          <button
            ref={hubCloseRef}
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-ink ring-1 ring-line transition-colors hover:bg-overlay/10"
            onClick={onClose}
            aria-label="Close desk companion"
            title="Close"
          >
            <XIcon size={18} aria-hidden="true" />
          </button>
        </header>

        <div
          className="flex shrink-0 gap-1 overflow-x-auto px-3 pb-2 sm:px-5"
          role="tablist"
          aria-label="Desk tools"
        >
          {HUB_TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                tab === id
                  ? 'bg-accent/15 text-accent-ink ring-1 ring-accent/30'
                  : 'bg-raised/60 text-muted ring-1 ring-line hover:bg-overlay/10 hover:text-ink'
              }`}
              onClick={() => selectTab(id)}
            >
              {HUB_TAB_LABELS[id]}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-3 pb-3 sm:px-5 sm:pb-4 lg:grid-cols-[minmax(140px,220px)_minmax(0,1fr)] lg:overflow-hidden">
          <div className="flex flex-col items-center justify-end gap-3 lg:min-h-0">
            <div
              className={`relative mx-auto ${state === 'jump' ? 'asi-squari--jump' : ''} ${useBob ? 'asi-squari--bob' : ''}`}
              style={{ width: Math.min(box.w * 1.15, 220), height: Math.min(box.h * 1.15, 440) }}
            >
              {spriteImg}
            </div>
            <div className="flex w-full max-w-[240px] flex-wrap justify-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent/12 px-3 py-2 text-[12px] font-semibold text-accent-ink ring-1 ring-accent/25 hover:bg-accent/20"
                onClick={onOpenChat}
              >
                <MessageSquareIcon size={14} aria-hidden="true" />
                Open chat
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-raised px-3 py-2 text-[12px] font-semibold text-ink ring-1 ring-line hover:bg-overlay/10"
                onClick={onOpenModules}
              >
                <Settings2Icon size={14} aria-hidden="true" />
                Skins
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto" role="tabpanel">
            {tab === 'todos' ? (
              <section className="rounded-2xl bg-raised/50 p-3 ring-1 ring-line sm:p-4" aria-label="Assign to-dos">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                    <ListTodoIcon size={15} aria-hidden="true" />
                    To-dos
                  </h3>
                  <button
                    type="button"
                    className="text-[12px] font-medium text-accent-ink hover:underline"
                    onClick={() => onOpenTodosPage()}
                  >
                    Full list
                  </button>
                </div>
                <form className="mb-3 flex gap-2" onSubmit={onAssignTodo}>
                  <label htmlFor="squari-hub-todo" className="sr-only">
                    Assign a to-do
                  </label>
                  <input
                    id="squari-hub-todo"
                    value={todoDraft}
                    onChange={(e) => setTodoDraft(e.target.value)}
                    placeholder="Assign a to-do…"
                    className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 text-[13px] text-ink ring-1 ring-line placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <button
                    type="submit"
                    disabled={!todoDraft.trim() || addingTodo}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-accent-strong px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
                  >
                    <PlusIcon size={15} aria-hidden="true" />
                    Add
                  </button>
                </form>
                {addError ? <p className="mb-2 text-[12px] text-danger">{addError}</p> : null}

                {ongoing.length === 0 && done.length === 0 ? (
                  <p className="rounded-xl bg-surface/70 px-3 py-4 text-[13px] text-muted ring-1 ring-line">
                    No to-dos yet — add one above.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {ongoing.length > 0 ? (
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                          Ongoing · {ongoing.length}
                        </p>
                        <ul className="max-h-48 space-y-1 overflow-y-auto sm:max-h-56">
                          {ongoing.map((t) => (
                            <li key={t.id} className="asi-squari-todo-row flex items-start gap-2 rounded-xl px-2 py-2">
                              <input
                                type="checkbox"
                                checked={false}
                                disabled={busyId === t.id}
                                aria-label={`Mark complete: ${t.text}`}
                                className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
                                onChange={() => onToggleComplete(t)}
                              />
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => onOpenTodosPage(t.id)}
                              >
                                <span className="flex items-start gap-1.5">
                                  <span
                                    className="mt-0.5 shrink-0 text-[13px] font-semibold text-faint"
                                    aria-hidden="true"
                                  >
                                    {statusGlyph(t.status)}
                                  </span>
                                  <span className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">
                                    {t.text}
                                  </span>
                                </span>
                                <span className="mt-1 block pl-4 text-[10px] uppercase tracking-wide text-faint">
                                  {t.status === 'blocked'
                                    ? 'Blocked'
                                    : t.status === 'ongoing'
                                      ? 'In progress'
                                      : 'Open'}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {done.length > 0 ? (
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                          Completed · {done.length}
                        </p>
                        <ul className="max-h-36 space-y-1 overflow-y-auto">
                          {done.slice(0, 8).map((t) => (
                            <li
                              key={t.id}
                              className="asi-squari-todo-row flex items-start gap-2 rounded-xl px-2 py-1.5 opacity-80"
                            >
                              <input
                                type="checkbox"
                                checked
                                disabled={busyId === t.id}
                                aria-label={`Reopen: ${t.text}`}
                                className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
                                onChange={() => onToggleComplete(t)}
                              />
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => onOpenTodosPage(t.id)}
                              >
                                <span className="line-clamp-2 text-[12px] leading-snug text-muted line-through">
                                  {t.text}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            ) : null}

            {tab === 'countdown' ? <CountdownTool /> : null}
            {tab === 'clocks' ? <WorldClockTool /> : null}
            {tab === 'wifi' ? <WifiTool /> : null}
            {tab === 'note' ? <StickyNoteTool /> : null}
            {tab === 'focus' ? <FocusTimerTool /> : null}

            <div className="flex flex-wrap gap-2 pb-1">
              <button
                type="button"
                className="rounded-xl bg-surface px-3 py-2 text-[12px] font-semibold text-ink ring-1 ring-line hover:bg-overlay/10"
                onClick={onClose}
              >
                Collapse to corner
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
