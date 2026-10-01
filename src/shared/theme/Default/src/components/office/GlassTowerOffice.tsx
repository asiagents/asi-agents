import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CoffeeIcon, MonitorIcon, UsersIcon, SparklesIcon, MoonIcon, SunIcon, ClockIcon, SproutIcon } from 'lucide-react';
import { SquareHeadRobot } from './SquareHeadRobot';
import { ModelChip } from '../ModelChip';
import { useAgentsMeta } from '../../contexts/AgentsContext';
import { useDesk } from '../../contexts/DeskContext';
import { useLiveSession } from '../../hooks/useLiveSession';
import { useSettings } from '../../contexts/SettingsContext';
import { getAgent } from '../../utils/lookup';
import type { ModelId } from '../../types/models';
import type { Agent } from '../../types/agents';

type ColorTheme = 'cyan' | 'amber' | 'violet' | 'pink' | 'crimson' | 'emerald';
type ActivityState = 'working' | 'thinking' | 'sleeping' | 'drinking' | 'speaking' | 'idle' | 'offline';

interface TowerAgentSlot {
  slotId: string;
  floor: 1 | 2 | 3;
  name: string;
  role: string;
  activityState: ActivityState;
  colorTheme: ColorTheme;
  currentTask: string;
  modelId: ModelId;
  agentObj: Agent;
}

const colorThemes: ColorTheme[] = ['cyan', 'amber', 'violet', 'pink', 'crimson', 'emerald'];

function colorForAgent(agent: Agent, index: number): ColorTheme {
  const tag = `${agent.roleTag} ${agent.role}`.toLowerCase();
  if (agent.isChief || tag.includes('chief') || tag.includes('lead')) return 'cyan';
  if (tag.includes('code') || tag.includes('dev') || tag.includes('engineer')) return 'amber';
  if (tag.includes('research') || tag.includes('architect')) return 'violet';
  if (tag.includes('design') || tag.includes('ux')) return 'pink';
  if (tag.includes('security') || tag.includes('guard')) return 'crimson';
  if (tag.includes('ops') || tag.includes('data')) return 'emerald';
  return colorThemes[index % colorThemes.length];
}

function floorForIndex(index: number, isChief: boolean): 1 | 2 | 3 {
  if (isChief || index < 4) return 3;
  if (index < 10) return 2;
  return 1;
}

function activityForAgent(agent: Agent, isSpeaking: boolean): ActivityState {
  if (agent.status === 'offline') return 'offline';
  if (isSpeaking) return 'speaking';
  if (agent.status === 'active' || agent.status === 'working') return 'working';
  if (agent.status === 'waiting') return 'thinking';
  if (agent.status === 'idle') return 'idle';
  return 'working';
}

export function GlassTowerOffice() {
  const { agents: roster, loading, error } = useAgentsMeta();
  const { agentModels, pausedAt } = useDesk();
  const { s, set } = useSettings();
  const { speaking, transcript } = useLiveSession(!pausedAt && s.liveVisuals);

  const hour = new Date().getHours();
  const dim = s.officeLight === 'dim' || (s.officeLight === 'auto' && (hour >= 19 || hour < 7));

  const liveRoster = loading ? [] : roster;
  const slotsWithAgents: TowerAgentSlot[] = liveRoster.map((agent, index) => ({
    slotId: agent.id,
    floor: floorForIndex(index, !!agent.isChief),
    name: agent.name,
    role: agent.role || agent.roleTag,
    activityState: activityForAgent(agent, speaking === agent.id),
    colorTheme: colorForAgent(agent, index),
    currentTask: agent.currentTask || 'Ready',
    modelId: (agentModels[agent.id] || agent.primary || 'ams-micro-70m') as ModelId,
    agentObj: agent,
  }));

  const floor3Slots = slotsWithAgents.filter((slot) => slot.floor === 3);
  const floor2Slots = slotsWithAgents.filter((slot) => slot.floor === 2);
  const floor1Slots = slotsWithAgents.filter((slot) => slot.floor === 1);
  const activeCount = liveRoster.filter((a) => a.status !== 'offline').length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* 3-FLOOR GLASS TOWER BUILDING STRUCTURE */}
      <div className="flex flex-col items-center">
        
        {s.officeSign && (
          <div className="relative mb-4 flex flex-col items-center select-none">
            <div className="h-4 w-4/5 rounded-t-xl bg-gradient-to-r from-accent/30 via-accent/80 to-accent/30 ring-1 ring-accent/50 shadow-[0_0_20px_rgba(124,108,240,0.5)]" />
            <div className="relative z-10 flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0b0e17] via-[#151928] to-[#0b0e17] px-8 py-3.5 ring-2 ring-accent/60 shadow-[0_0_30px_rgba(124,108,240,0.4)]">
              <span className="absolute inset-0 rounded-2xl bg-accent/10 blur-md animate-pulse" />
              <SparklesIcon size={20} className="mr-2 text-accent-ink animate-bounce" />
              <h1 className="text-xl md:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-accent-ink to-pink-400 drop-shadow-[0_0_12px_rgba(0,243,255,0.8)] font-mono">
                ASI AGENT CORP
              </h1>
              <span className="ml-3 rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-cyan-300 ring-1 ring-cyan-400/40">
                VIRTUAL TOWER
              </span>
            </div>
          </div>
        )}

        {s.officeToolbar && (
        <div className="mb-4 flex w-full max-w-4xl items-center justify-between rounded-xl bg-surface/80 px-4 py-2 ring-1 ring-line backdrop-blur-md">
          <div className="flex items-center gap-2 text-[12px] font-medium">
            <span className={`h-2.5 w-2.5 rounded-full ${pausedAt ? 'bg-danger' : 'bg-success animate-pulse'}`} />
            <span className={pausedAt ? 'text-danger' : 'text-success font-semibold'}>
              {pausedAt ? 'Building Offline' : `${activeCount} agent${activeCount === 1 ? '' : 's'} live`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Lighting Mode */}
            <div role="radiogroup" aria-label="Lighting" className="inline-flex rounded-full bg-bg p-0.5 ring-1 ring-line">
              {(
                [
                  { id: 'auto', label: 'Auto', icon: ClockIcon },
                  { id: 'bright', label: 'Bright', icon: SunIcon },
                  { id: 'dim', label: 'Dim', icon: MoonIcon },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => set('officeLight', o.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    s.officeLight === o.id
                      ? 'bg-surface text-ink ring-1 ring-line font-medium shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <o.icon size={12} /> {o.label}
                </button>
              ))}
            </div>

            {/* Greenery */}
            <button
              type="button"
              onClick={() => set('greenery', !s.greenery)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors ${
                s.greenery ? 'bg-[#16a34a] text-white ring-[#16a34a]' : 'bg-bg text-muted ring-line'
              }`}
            >
              <SproutIcon size={12} /> Plants {s.greenery ? 'on' : 'off'}
            </button>
          </div>
        </div>
        )}

        {liveRoster.length === 0 ? (
          <div className="w-full max-w-4xl rounded-3xl bg-surface p-10 text-center ring-1 ring-line">
            <p className="text-[15px] font-semibold text-ink">No agents on the floor</p>
            <p className="mt-2 text-[13px] text-muted">
              {loading ? 'Loading roster from GET /api/agents…' : error ?? 'Add agents to the registry, then scan from Agents.'}
            </p>
          </div>
        ) : (
        <div
          className={`w-full max-w-4xl overflow-hidden rounded-3xl ring-2 transition-all duration-300 shadow-2xl ${
            dim
              ? 'bg-[#0e111a] ring-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)]'
              : 'bg-gradient-to-b from-[#161a29] via-[#121623] to-[#0d101a] ring-accent/30 shadow-[0_0_50px_rgba(124,108,240,0.15)]'
          }`}
        >
          {floor3Slots.length > 0 && (
          <div className="relative border-b-4 border-accent/30 bg-gradient-to-r from-[#171d2e]/90 via-[#1e253b]/90 to-[#171d2e]/90 p-5 backdrop-blur-md">
            {/* Window Night Skyline View Backdrop */}
            <div className="absolute inset-x-0 top-0 h-1/3 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500 via-transparent to-transparent pointer-events-none" />

            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-mono font-bold text-cyan-300 ring-1 ring-cyan-500/40">
                <UsersIcon size={12} /> FLOOR 3 · EXECUTIVE BOARDROOM
              </span>
              <span className="text-[10px] font-mono text-faint">{floor3Slots.length} SEAT{floor3Slots.length === 1 ? '' : 'S'}</span>
            </div>

            {/* Boardroom Oval Glass Table Surface */}
            <div className="relative rounded-2xl bg-gradient-to-b from-[#1f283e] to-[#121726] p-4 ring-1 ring-cyan-500/30 shadow-xl">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {floor3Slots.map((slot) => (
                  <div
                    key={slot.slotId}
                    className={`flex flex-col items-center rounded-xl p-3 ring-1 transition-all duration-200 ${
                      slot.activityState === 'speaking'
                        ? 'bg-cyan-500/15 ring-2 ring-cyan-400 scale-105 shadow-lg'
                        : 'bg-[#161c2c] ring-line hover:ring-cyan-400/40'
                    }`}
                  >
                    <SquareHeadRobot
                      id={slot.slotId}
                      name={slot.name}
                      role={slot.role}
                      activityState={slot.activityState}
                      colorTheme={slot.colorTheme}
                      size="lg"
                    />
                    <div className="mt-2 text-center">
                      <p className="text-[12px] font-bold text-ink truncate max-w-[120px]">{slot.name}</p>
                      <p className="text-[10px] text-cyan-300 font-medium">{slot.role}</p>
                    </div>
                    <div className="mt-1.5">
                      <ModelChip id={slot.modelId as ModelId} size="xs" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}

          {floor2Slots.length > 0 && (
          <div className="relative border-b-4 border-accent/30 bg-gradient-to-r from-[#121623]/95 via-[#181d2e]/95 to-[#121623]/95 p-5 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-mono font-bold text-amber-300 ring-1 ring-amber-500/40">
                <MonitorIcon size={12} /> FLOOR 2 · WORKSTATION HUB
              </span>
              <span className="text-[10px] font-mono text-faint">{floor2Slots.length} DESK POD{floor2Slots.length === 1 ? '' : 'S'}</span>
            </div>

            {/* Workstation Desk Pods Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {floor2Slots.map((slot) => (
                <div
                  key={slot.slotId}
                  className={`group relative flex flex-col justify-between rounded-xl p-3 ring-1 transition-all duration-200 ${
                    slot.activityState === 'sleeping'
                      ? 'bg-[#151928] ring-indigo-500/30 opacity-80'
                      : slot.activityState === 'thinking'
                      ? 'bg-[#1a1f33] ring-amber-400/40'
                      : 'bg-[#171c2b] ring-line hover:ring-accent/50'
                  }`}
                >
                  {/* Status Banner */}
                  <div className="mb-2 flex items-center justify-between text-[10px]">
                    <span
                      className={`font-mono font-semibold uppercase tracking-wider ${
                        slot.activityState === 'working'
                          ? 'text-emerald-400'
                          : slot.activityState === 'thinking'
                          ? 'text-amber-400'
                          : slot.activityState === 'sleeping'
                          ? 'text-indigo-400'
                          : 'text-faint'
                      }`}
                    >
                      {slot.activityState}
                    </span>
                    <ModelChip id={slot.modelId as ModelId} size="xs" />
                  </div>

                  {/* Robot & Desk Workstation */}
                  <div className="my-1 flex items-center justify-center py-1">
                    <SquareHeadRobot
                      id={slot.slotId}
                      name={slot.name}
                      role={slot.role}
                      activityState={slot.activityState}
                      colorTheme={slot.colorTheme}
                      size="lg"
                    />
                  </div>

                  {/* Screen Monitor Simulation Lines */}
                  <div className="mt-2 rounded-md bg-[#0a0c12] p-1.5 ring-1 ring-white/10">
                    <div className="flex items-center justify-between text-[9px] text-faint mb-1 font-mono">
                      <span>{slot.role.slice(0, 12)}</span>
                      <span className="text-emerald-400">{slot.activityState === 'sleeping' ? 'Zzz' : 'RUN'}</span>
                    </div>
                    <div className="space-y-1">
                      {[0.8, 0.5, 0.7].map((w, idx) => (
                        <div key={idx} className="h-1 overflow-hidden rounded-full bg-[#1b2234]">
                          <div
                            className={`h-full rounded-full ${
                              slot.activityState === 'working'
                                ? 'type-line bg-emerald-400'
                                : slot.activityState === 'sleeping'
                                ? 'bg-indigo-500/50'
                                : 'bg-amber-400'
                            }`}
                            style={{ width: `${w * 100}%` }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Agent Label */}
                  <div className="mt-2 text-center">
                    <p className="text-[12px] font-bold text-ink truncate">{slot.name}</p>
                    <p className="text-[10px] text-muted truncate">{slot.currentTask}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {floor1Slots.length > 0 && (
          <div className="relative bg-gradient-to-r from-[#171d2b]/90 via-[#1b2234]/90 to-[#171d2b]/90 p-5 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-mono font-bold text-emerald-300 ring-1 ring-emerald-500/40">
                <CoffeeIcon size={12} /> FLOOR 1 · BREW & BYTE CAFETERIA & LOUNGE
              </span>
              <span className="text-[10px] font-mono text-faint">{floor1Slots.length} LOUNGE SPOT{floor1Slots.length === 1 ? '' : 'S'}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {floor1Slots.map((slot) => (
                <div
                  key={slot.slotId}
                  className="flex items-center gap-4 rounded-2xl bg-[#161c2b] p-4 ring-1 ring-emerald-500/30 shadow-lg"
                >
                  <SquareHeadRobot
                    id={slot.slotId}
                    name={slot.name}
                    role={slot.role}
                    activityState={slot.activityState}
                    colorTheme={slot.colorTheme}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[13px] font-bold text-ink truncate">{slot.name}</h4>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">
                        ☕ LOUNGING
                      </span>
                    </div>
                    <p className="text-[11px] text-muted">{slot.role}</p>
                    <p className="mt-1 text-[10px] text-emerald-400 font-mono italic truncate">{slot.currentTask}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
        )}
      </div>

      {/* --- SIDEBAR LIVE ACTIVITY FEED --- */}
      <section className="flex flex-col rounded-3xl bg-surface p-5 ring-1 ring-line shadow-xl">
        <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
          <h2 className="text-[15px] font-bold text-ink">Tower Feed</h2>
          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-mono font-bold text-accent-ink">
            LIVE LOG
          </span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto max-h-[620px] pr-1">
          <AnimatePresence initial={false}>
            {transcript.map((line) => {
              const a = getAgent(line.agentId);
              if (!a) return null;
              return (
                <motion.div
                  key={line.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl bg-bg p-3 ring-1 ring-line/60"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <SquareHeadRobot
                      id={a.id}
                      name={a.name}
                      role={a.role}
                      activityState={speaking === a.id ? 'speaking' : 'working'}
                      colorTheme="cyan"
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-ink truncate">{a.name}</p>
                      <p className="text-[10px] text-muted">{a.role || 'Specialist'}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-ink leading-snug pl-1 border-l-2 border-accent/50">{line.text}</p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
