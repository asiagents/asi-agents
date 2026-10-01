import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CpuIcon,
  FolderIcon,
  ListTodoIcon,
  MonitorIcon,
  PuzzleIcon,
  Settings2Icon,
  ShieldCheckIcon,
  XIcon } from
'lucide-react';
import { ModelChip } from '../ModelChip';
import { Toggle } from '../Toggle';
import { DeskPanel } from '../desk/DeskPanel';
import { useChatModelOptions, type ChatModelOption, type ModelHealth } from '../../hooks/useChatModelOptions';
import { useSelectedModelPool } from '../../hooks/useSelectedModelPool';
import { usePendingPermissions } from '../../hooks/usePendingPermissions';
import { PermissionsAsideStrip } from '../permissions/PermissionsAsideStrip';
import { AgentAmsSkillsPanel } from '../agents/AgentAmsSkillsPanel';
import { usePrefs } from '../../contexts/PrefsContext';
import { useDesk } from '../../contexts/DeskContext';
import type { Agent } from '../../types/agents';
import type { ModelId } from '../../types/models';

type SectionId = 'todo' | 'model' | 'memory' | 'skills' | 'desk' | 'folders' | 'permissions' | 'settings';

interface AgentPanelProps {
  agent: Agent;
  model: ModelId;
  onModelChange: (m: ModelId) => void;
  className?: string;
  id?: string;
  onClose?: () => void;
  /** Compact strip when the desktop rail is collapsed. */
  collapsed?: boolean;
  onExpand?: () => void;
}

const gateText = { free: 'Free', ask: 'Asks first', blocked: 'Blocked' };
const gateColor = { free: 'text-muted', ask: 'text-warn', blocked: 'text-danger' };

export function AgentPanel({
  agent,
  model,
  onModelChange,
  className = '',
  id,
  onClose,
  collapsed = false,
  onExpand,
}: AgentPanelProps) {
  const { voice } = usePrefs();
  const { pendingCount, offline: permsOffline } = usePendingPermissions();
  const { todos, addTodo, toggleTodo, localOn } = useDesk();
  const [open, setOpen] = useState<SectionId[]>([]);
  const [speak, setSpeak] = useState(agent.id === 'narrator');
  const [handoffs, setHandoffs] = useState(true);
  const [todoText, setTodoText] = useState('');
  const offline = agent.status === 'offline';
  const { options, loading: modelsLoading, refresh: refreshModels } = useChatModelOptions();
  const { ids: poolIds, ready: poolReady } = useSelectedModelPool();
  const [showMoreModels, setShowMoreModels] = useState(false);

  /** Approved / assigned pool: Browse selectedModelPool + agent primary/secondary. */
  const approvedIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    const push = (raw: string | undefined | null) => {
      const id = String(raw ?? '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    };
    for (const pid of poolIds) push(pid);
    push(agent.primary);
    push(agent.secondary);
    return ids;
  }, [poolIds, agent.primary, agent.secondary]);

  const approvedOptions = useMemo(() => {
    if (approvedIds.length === 0) return [] as ChatModelOption[];
    const byId = new Map(options.map((o) => [String(o.id), o]));
    const out: ChatModelOption[] = [];
    for (const pid of approvedIds) {
      const hit = byId.get(pid);
      if (hit) {
        out.push(hit);
        continue;
      }
      // Pool / agent assignment not in live scan — still list so picks stay visible.
      const fromAgent = pid === String(agent.primary) || pid === String(agent.secondary);
      out.push({
        id: pid as ModelId,
        name: pid,
        note: fromAgent
          ? 'Assigned to this agent — not currently live on this desk'
          : 'In your Browse pool — not currently live on this desk',
        health: 'offline',
        group: 'local',
        selectable: false,
      });
    }
    return out;
  }, [options, approvedIds, agent.primary, agent.secondary]);

  const moreOptions = useMemo(() => {
    const approved = new Set(approvedIds);
    return options.filter((o) => !approved.has(String(o.id)));
  }, [options, approvedIds]);

  /** Approved / pool rows in the primary list (expand adds `moreOptions` below). */
  const poolOptions = approvedOptions;

  const openTodos = todos.filter((t) => !t.done);

  const toggle = (sectionId: SectionId) =>
  setOpen((prev) => prev.includes(sectionId) ? prev.filter((s) => s !== sectionId) : [...prev, sectionId]);

  const groups: { key: ChatModelOption['group']; label: string }[] = [
    { key: 'router', label: 'AMS router' },
    { key: 'local', label: 'On-device' },
    { key: 'cloud', label: 'Cloud' },
  ];

  if (collapsed) {
    return (
      <aside
        id={id}
        className={`flex w-11 shrink-0 flex-col items-center border-l border-line bg-surface py-3 ${className}`}
        aria-label={`${agent.name} details (collapsed)`}
      >
        <button
          type="button"
          onClick={onExpand}
          title="Show agent details"
          aria-label="Expand agent details"
          className="grid h-8 w-8 place-items-center rounded-full text-muted ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] hover:text-ink"
        >
          <ChevronLeftIcon size={16} aria-hidden="true" />
        </button>
      </aside>
    );
  }

  return (
    <aside id={id} className={`min-h-0 w-[min(360px,100%)] flex-col border-l border-line bg-surface lg:w-[320px] xl:w-[360px] ${className}`} aria-label={`${agent.name} details`}>
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
        <p className="mr-auto text-[13px] font-semibold text-ink">Agent details</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse panel"
            title="Collapse"
            className="grid h-7 w-7 place-items-center rounded-full text-faint transition-colors duration-150 hover:bg-overlay/[0.05] hover:text-ink"
          >
            <span className="hidden lg:inline"><ChevronRightIcon size={14} aria-hidden="true" /></span>
            <span className="lg:hidden"><XIcon size={14} aria-hidden="true" /></span>
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-24">
        <div className="pt-3">
          <PermissionsAsideStrip />
        </div>

        <Section id="todo" title="To-do" icon={ListTodoIcon} count={openTodos.length} open={open.includes('todo')} onToggle={toggle}>
          {todos.length === 0 ? (
            <p className="text-[12px] text-muted">No to-dos yet — synced with Tasks (Chief by default).</p>
          ) : (
            <ul className="space-y-1.5">
              {todos.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => toggleTodo(t.id)}
                      className="h-4 w-4 accent-[rgb(var(--accent))]"
                    />
                    <span className={`truncate ${t.done ? 'text-faint line-through' : 'text-ink'}`}>{t.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!todoText.trim()) return;
              addTodo(todoText.trim());
              setTodoText('');
            }}
          >
            <label htmlFor="agent-panel-todo" className="sr-only">Add a to-do</label>
            <input
              id="agent-panel-todo"
              value={todoText}
              onChange={(e) => setTodoText(e.target.value)}
              placeholder="Add a to-do"
              className="min-w-0 flex-1 rounded-lg bg-bg px-2.5 py-1 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60"
            />
            <button
              type="submit"
              disabled={!todoText.trim()}
              className="rounded-lg bg-accent-strong px-2.5 text-[12px] font-medium text-white disabled:opacity-40"
            >
              Add
            </button>
          </form>
          <Link to="/todos" className="mt-2 inline-block text-[12px] font-medium text-accent-ink hover:underline">
            Open to-dos
          </Link>
        </Section>

        <Section id="model" title="Agent model" icon={CpuIcon} open={open.includes('model')} onToggle={toggle}>
          {!localOn && (
            <p className="mb-2 text-[11px] text-warn">
              Local models are off in the header — turn Local on to use on-device backends.
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted">
              Approved / assignment pool by default. Expand for the full live scan.
            </p>
            <button
              type="button"
              onClick={() => void refreshModels()}
              className="shrink-0 text-[11px] font-medium text-accent-ink hover:underline"
            >
              Refresh
            </button>
          </div>
          {!poolReady || modelsLoading ? (
            <p className="mt-3 text-[12px] text-muted">Loading pool…</p>
          ) : approvedOptions.length === 0 ? (
            <p className="mt-3 text-[12px] text-muted">
              No approved pool yet — multi-select with <strong className="font-medium text-ink">Pool</strong> checkboxes
              on{' '}
              <Link to="/settings/models" className="font-medium text-accent-ink hover:underline">Browse models</Link>
              , then <strong className="font-medium text-ink">Save selection</strong>
              {moreOptions.length > 0 ? ', or expand below for live models.' : '.'}
            </p>
          ) : (
            groups.map((g) => {
              const rows = approvedOptions.filter((o) => o.group === g.key);
              if (!rows.length) return null;
              return (
                <div key={g.key} className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">{g.label}</p>
                  <ul className="mt-1.5 space-y-1.5" role="radiogroup" aria-label={g.label}>
                    {rows.map((opt) => {
                      const selected = opt.id === model;
                      const disabled = offline || !opt.selectable || (!localOn && opt.group !== 'cloud');
                      return (
                        <li key={opt.id}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={disabled}
                            onClick={() => onModelChange(opt.id)}
                            className={`flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left ring-1 transition-colors duration-150 disabled:opacity-50 ${
                              selected ? 'bg-accent/10 ring-accent/40' : 'ring-line hover:bg-overlay/[0.03]'
                            }`}
                          >
                            <span
                              className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ring-1 ${
                                selected ? 'ring-accent' : 'ring-faint'
                              }`}
                            >
                              {selected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <ModelChip id={opt.id} size="xs" />
                                <HealthPill health={opt.health} />
                              </div>
                              <p className="mt-1 text-[11px] leading-snug text-muted">{opt.note}</p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
          {approvedOptions.length > 0 && !approvedOptions.some((o) => o.id === model) && !showMoreModels && (
            <p className="mt-2 text-[11px] text-warn">
              Current model is not in your approved pool — expand below or add it on the Models page.
            </p>
          )}
          {moreOptions.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowMoreModels((v) => !v)}
                aria-expanded={showMoreModels}
                className="text-[12px] font-medium text-accent-ink hover:underline"
              >
                {showMoreModels
                  ? 'Show fewer models'
                  : `Show more models (${moreOptions.length})`}
              </button>
              {showMoreModels &&
                groups.map((g) => {
                  const rows = moreOptions.filter((o) => o.group === g.key);
                  if (!rows.length) return null;
                  return (
                    <div key={`more-${g.key}`} className="mt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                        More · {g.label}
                      </p>
                      <ul className="mt-1.5 space-y-1.5" role="radiogroup" aria-label={`More ${g.label}`}>
                        {rows.map((opt) => {
                          const selected = opt.id === model;
                          const disabled = offline || !opt.selectable || (!localOn && opt.group !== 'cloud');
                          return (
                            <li key={opt.id}>
                              <button
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={disabled}
                                onClick={() => onModelChange(opt.id)}
                                className={`flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left ring-1 transition-colors duration-150 disabled:opacity-50 ${
                                  selected ? 'bg-accent/10 ring-accent/40' : 'ring-line hover:bg-overlay/[0.03]'
                                }`}
                              >
                                <span
                                  className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ring-1 ${
                                    selected ? 'ring-accent' : 'ring-faint'
                                  }`}
                                >
                                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <ModelChip id={opt.id} size="xs" />
                                    <HealthPill health={opt.health} />
                                  </div>
                                  <p className="mt-1 text-[11px] leading-snug text-muted">{opt.note}</p>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
            </div>
          )}
          <p className="mt-2 text-[11px] text-faint">
            Manage pool on{' '}
            <Link to="/settings/models" className="font-medium text-accent-ink hover:underline">Models</Link>
          </p>
        </Section>

        <Section
          id="memory"
          title="Memory"
          icon={BookOpenIcon}
          count={agent.learnings.length}
          open={open.includes('memory')}
          onToggle={toggle}
        >
          {agent.learnings.length === 0 ? (
            <p className="text-[12px] text-muted">
              No memory yet. Train agents from{' '}
              <Link to="/settings/company" className="font-medium text-accent-ink hover:underline">
                Settings → Company / Training
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {agent.learnings.map((l) =>
              <li key={l} className="flex gap-2 text-[13px] leading-snug text-ink">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                  {l}
                </li>
              )}
            </ul>
          )}
        </Section>

        <Section
          id="skills"
          title="Skills"
          icon={PuzzleIcon}
          count={agent.skills.length}
          open={open.includes('skills')}
          onToggle={toggle}
        >
          {agent.skills.length > 0 && (
            <>
              <p className="text-[11px] font-medium text-muted">Registry skills</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {agent.skills.map((s) => (
                  <li
                    key={s.name}
                    title={`${s.enabled ? 'On' : 'Off'} · ${gateText[s.gate]}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset ${
                      s.enabled ? 'bg-accent/10 text-accent-ink ring-accent/25' : 'bg-overlay/[0.04] text-muted ring-line'
                    }`}
                  >
                    {s.name}
                    {s.gate !== 'free' && (
                      <span className={`text-[10px] ${gateColor[s.gate]}`}>
                        · {s.gate === 'ask' ? 'asks' : 'blocked'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className={agent.skills.length > 0 ? 'mt-3' : undefined}>
            <AgentAmsSkillsPanel agentId={agent.id} />
          </div>
          <Link to={`/agents/${agent.id}`} className="mt-2 inline-block text-[12px] font-medium text-accent-ink hover:underline">
            Manage skills
          </Link>
        </Section>

        <Section id="desk" title="What the agent sees" icon={MonitorIcon} open={open.includes('desk')} onToggle={toggle}>
          <DeskPanel bare />
        </Section>

        <Section id="folders" title="Folders" icon={FolderIcon} count={agent.folders.length} open={open.includes('folders')} onToggle={toggle}>
          {agent.folders.length === 0 ?
          <p className="text-[12px] text-muted">No folder access.</p> :

          <ul className="space-y-2">
              {agent.folders.map((f) =>
            <li key={f.name} className="flex items-center gap-2.5 text-[13px]">
                  <FolderIcon size={14} className="shrink-0 text-muted" aria-hidden="true" />
                  <span className="truncate text-ink">{f.name}</span>
                  <span className="text-[11px] text-faint">{f.items}</span>
                  <span className={`ml-auto shrink-0 rounded-full px-1.5 text-[10px] font-medium ${f.access === 'read' ? 'bg-overlay/[0.06] text-muted' : 'bg-warn/15 text-warn'}`}>
                    {f.access === 'read' ? 'Read' : 'Read/write'}
                  </span>
                </li>
            )}
            </ul>
          }
        </Section>

        <Section id="permissions" title="Permissions" icon={ShieldCheckIcon} open={open.includes('permissions')} onToggle={toggle}>
          {permsOffline ? (
            <p className="text-[12px] text-muted">Permissions API offline — no pending list.</p>
          ) : pendingCount != null && pendingCount > 0 ? (
            <p className="text-[13px] text-ink">
              <span className="font-semibold text-warn">{pendingCount}</span> pending ask{pendingCount > 1 ? 's' : ''} on the server.
            </p>
          ) : (
            <p className="text-[12px] text-muted">No pending asks from the live API.</p>
          )}
          <a
            href="/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[12px] font-medium text-accent-ink hover:underline"
          >
            Open permissions ↗
          </a>
        </Section>

        <Section id="settings" title="Agent settings" icon={Settings2Icon} open={open.includes('settings')} onToggle={toggle}>
          <div className="space-y-3">
            <Row label={`Read replies aloud (${voice === 'elevenlabs' ? 'ElevenLabs' : 'Local TTS'})`}>
              <Toggle label="Read replies aloud" checked={speak} onChange={setSpeak} />
            </Row>
            <Row label="Can hand off to other agents">
              <Toggle label="Allow handoffs" checked={handoffs} onChange={setHandoffs} />
            </Row>
          </div>
          <Link to={`/agents/${agent.id}`} className="mt-3 inline-block text-[12px] font-medium text-accent-ink hover:underline">Full profile</Link>
          <Link to="/settings/modules" className="mt-2 block text-[12px] font-medium text-accent-ink hover:underline">
            Companion characters
          </Link>
          <p className="mt-1 text-[11px] text-faint">Settings → Modules · Drakko default · switch skins anytime</p>
        </Section>
      </div>
    </aside>);

}

interface SectionProps {
  id: SectionId;
  title: string;
  icon: typeof CpuIcon;
  count?: number;
  open: boolean;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
}

function Section({ id, title, icon: Icon, count, open, onToggle, children }: SectionProps) {
  return (
    <section className="border-b border-line">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-overlay/[0.03]">
        
        <Icon size={15} className="text-muted" aria-hidden="true" />
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        {count !== undefined && <span className="text-[11px] text-faint">{count}</span>}
        <ChevronDownIcon
          size={15}
          className={`ml-auto text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true" />
        
      </button>
      <AnimatePresence initial={false}>
        {open &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden">
          
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        }
      </AnimatePresence>
    </section>);

}

function HealthPill({ health }: { health: ModelHealth }) {
  const label = health === 'live' ? 'Live' : health === 'needs_key' ? 'Needs key' : 'Offline';
  const tone =
    health === 'live' ? 'bg-success/10 text-success' : health === 'needs_key' ? 'bg-warn/10 text-warn' : 'bg-overlay/[0.06] text-muted';
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}>{label}</span>;
}

function Row({ label, children }: {label: string;children: React.ReactNode;}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-[13px] text-ink">{label}</span>
      {children}
    </div>);

}
