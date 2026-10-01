import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { FireheadSprite } from './office/FireheadSprite';
import type { Agent, AgentStatus } from '../types/agents';

interface AgentAvatarProps {
  agent: Agent;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
}

const sizes = {
  xs: 'h-7 w-7 rounded-md',
  sm: 'h-9 w-9 rounded-[10px]',
  md: 'h-11 w-11 rounded-xl',
  lg: 'h-16 w-16 rounded-2xl',
  xl: 'h-24 w-24 rounded-2xl',
};

export const statusDot: Record<AgentStatus, string> = {
  active: 'bg-success',
  idle: 'bg-faint',
  waiting: 'bg-warn',
  offline: 'bg-danger',
};

export const statusLabel: Record<AgentStatus, string> = {
  active: 'Working',
  idle: 'Idle',
  waiting: 'Waiting on you',
  offline: 'Offline',
};

/**
 * Pixar Firehead Avatar loop renderer.
 * Motion is truth-linked (working = animate flame, idle = breathe flame, offline = dim).
 */
export function AgentLoop({
  agent,
  className = '',
  alt = '',
  working = false,
  size = 'md',
}: {
  agent: Agent;
  className?: string;
  alt?: string;
  working?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) {
  const { s } = useSettings();
  const [imgFailed, setImgFailed] = useState(false);
  const offline = agent.status === 'offline';
  const live = s.liveVisuals && !offline;
  const status = working ? 'working' : agent.status;

  // Use local PNG/JPG cube image if explicitly provided and valid
  if (agent.cube && !imgFailed && !agent.cube.startsWith('http')) {
    return (
      <img
        src={agent.cube}
        alt={alt || agent.name}
        onError={() => setImgFailed(true)}
        className={`h-full w-full object-cover ${offline ? 'opacity-60 grayscale' : ''} ${className}`}
      />
    );
  }

  // Primary: Pixar Firehead Animated Character
  return (
    <FireheadSprite
      id={agent.id}
      name={agent.name}
      role={agent.role || agent.roleTag}
      status={status}
      size={size}
      className={className}
    />
  );
}

export function AgentAvatar({ agent, size = 'sm', showStatus = false }: AgentAvatarProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <span className={`block overflow-hidden bg-[#1f2433] p-0.5 shadow-inner ${sizes[size]}`}>
        <AgentLoop agent={agent} size={size} />
      </span>
      {showStatus && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${
            statusDot[agent.status] ?? 'bg-faint'
          }`}
          aria-label={statusLabel[agent.status] ?? agent.status}
        />
      )}
    </span>
  );
}

export function UserAvatar() {
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised text-[11px] font-semibold text-ink ring-1 ring-line shadow-sm"
      aria-hidden="true"
    >
      MR
    </span>
  );
}