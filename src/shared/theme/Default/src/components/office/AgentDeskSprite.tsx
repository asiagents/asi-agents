import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MonitorIcon, SparklesIcon } from 'lucide-react';
import { FireheadSprite } from './FireheadSprite';
import { ModelChip } from '../ModelChip';
import { ConnectionGlyph } from '../ConnectionGlyph';
import type { ModelId } from '../../types/models';

export interface AgentDeskSpriteProps {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'working' | 'idle' | 'waiting' | 'offline' | string;
  modelLabel?: ModelId | string | null;
  speaking?: boolean;
  currentTask?: string;
  virtualDeskAvailable?: boolean;
  dim?: boolean;
  onClick?: () => void;
}

const statusDot: Record<string, string> = {
  active: 'bg-success',
  working: 'bg-success',
  idle: 'bg-faint',
  waiting: 'bg-warn',
  offline: 'bg-danger',
};

export function AgentDeskSprite({
  id,
  name,
  role,
  status,
  modelLabel,
  speaking = false,
  currentTask = 'Ready for tasks',
  virtualDeskAvailable = false,
  dim = false,
  onClick,
}: AgentDeskSpriteProps) {
  const offline = status === 'offline';
  const waiting = status === 'waiting';
  const busy = status === 'working' || status === 'active';

  const label = offline
    ? 'Offline'
    : speaking
    ? 'Speaking…'
    : waiting
    ? 'Waiting on you'
    : busy
    ? 'Working'
    : 'Idle';

  const labelCls = offline
    ? 'text-danger'
    : speaking
    ? 'text-accent-ink font-semibold'
    : waiting
    ? 'text-warn font-semibold'
    : busy
    ? 'text-success font-semibold'
    : 'text-muted';

  const content = (
    <div
      className={`group relative flex h-full flex-col rounded-xl p-3 ring-1 transition-all duration-200 hover:ring-accent/50 hover:shadow-lg ${
        dim ? 'bg-[#1d2231]' : 'bg-bg'
      } ${speaking ? 'ring-2 ring-accent bg-accent/5' : dim ? 'ring-white/10' : 'ring-line'}`}
    >
      {/* Pixar Workstation Desk Environment Surface */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-gradient-to-b from-[#1b202e] to-[#121520] p-2 ring-1 ring-white/10 shadow-inner flex flex-col items-center justify-between">
        
        {/* Background Desk Screen Backlight */}
        <div
          className={`absolute inset-x-0 top-0 h-1/2 opacity-30 transition-opacity duration-300 ${
            busy ? 'bg-accent blur-xl' : 'bg-transparent'
          }`}
        />

        {/* Top Status Badges */}
        <div className="z-10 flex w-full items-center justify-between">
          {/* Speaking Audio Indicator */}
          {busy && (
            <span
              className="flex items-center gap-1 rounded-full bg-[#0b0d13]/90 px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/10"
              aria-label={`${name} is active`}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${speaking ? 'bg-accent-ink' : 'bg-success'}`}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
              <span className="ml-1 text-[9px] uppercase tracking-wider">{speaking ? 'Voice' : 'Exec'}</span>
            </span>
          )}

          {/* Virtual Desk Available Tag */}
          {virtualDeskAvailable && (
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-ink ring-1 ring-accent/30"
              title="Virtual Desktop / Computer Enabled"
            >
              <MonitorIcon size={10} />
              VD
            </span>
          )}
        </div>

        {/* Center: Pixar Firehead Character Sprite */}
        <div className="relative z-10 my-auto flex items-center justify-center">
          <FireheadSprite
            id={id}
            name={name}
            role={role}
            status={status}
            speaking={speaking}
            size="lg"
          />
        </div>

        {/* Bottom Desk Workstation Surface & Miniature Code Monitor */}
        <div className="z-10 w-full rounded-md bg-[#090b10]/95 px-2.5 py-1.5 ring-1 ring-white/10 shadow-md">
          {offline ? (
            <div className="flex items-center justify-between text-[10px] text-danger">
              <span>System Offline</span>
              <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9px] text-faint">
                <span className="font-mono">{role.slice(0, 14)}</span>
                <span className="text-[8px] text-accent-ink">{busy ? 'RUNNING' : 'IDLE'}</span>
              </div>
              {[0.9, 0.6, 0.8].map((w, i) => (
                <div key={i} className="h-1 overflow-hidden rounded-full bg-[#1e2433]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      busy ? 'type-line bg-success' : 'bg-[#4b5563]'
                    }`}
                    style={{
                      width: `${w * 100}%`,
                      animationDelay: busy ? `${i * 0.3}s` : undefined,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desk Details Strip */}
      <div className="mt-2.5 flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${statusDot[status] ?? 'bg-faint'}`}
          aria-hidden="true"
        />
        <span className={`truncate text-[13px] font-semibold ${dim ? 'text-[#e8eaf0]' : 'text-ink'}`}>
          {name}
        </span>
        <span className={`ml-auto shrink-0 text-[11px] ${labelCls}`}>{label}</span>
      </div>

      <p className={`mb-2 mt-1 line-clamp-2 text-[11px] leading-tight ${offline ? 'text-danger/80' : 'text-muted'}`}>
        {currentTask}
      </p>

      {/* Model & System Connection Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-line/40 pt-2">
        {modelLabel ? (
          <ModelChip id={modelLabel as ModelId} size="xs" />
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-faint">
            <SparklesIcon size={10} /> Local Agent
          </span>
        )}
        <ConnectionGlyph id={modelLabel as ModelId} showLabel={false} />
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left focus:outline-none">
        {content}
      </button>
    );
  }

  return <Link to={`/chat/${id}`}>{content}</Link>;
}
