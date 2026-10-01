import React from 'react';
import { motion } from 'framer-motion';
import { Volume2Icon } from 'lucide-react';
import { FireheadSprite } from './FireheadSprite';
import { ModelChip } from '../ModelChip';
import type { ModelId } from '../../types/models';

export interface MeetingSeatProps {
  id: string;
  name: string;
  role: string;
  status: string;
  modelLabel?: ModelId | string | null;
  speaking?: boolean;
  seatIndex?: number;
  onClick?: () => void;
}

const statusDot: Record<string, string> = {
  active: 'bg-success',
  working: 'bg-success',
  idle: 'bg-faint',
  waiting: 'bg-warn',
  offline: 'bg-danger',
};

export function MeetingSeat({
  id,
  name,
  role,
  status,
  modelLabel,
  speaking = false,
  seatIndex = 1,
  onClick,
}: MeetingSeatProps) {
  const offline = status === 'offline';

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col items-center rounded-2xl p-3 transition-all duration-200 cursor-pointer ${
        speaking ? 'bg-accent/15 ring-2 ring-accent scale-105 shadow-xl' : 'bg-surface/80 ring-1 ring-line hover:bg-surface hover:ring-accent/40'
      }`}
    >
      {/* Seat Number Tag */}
      <span className="absolute left-2.5 top-2.5 rounded-full bg-bg px-2 py-0.5 text-[9px] font-mono font-semibold text-faint ring-1 ring-line">
        Seat #{seatIndex}
      </span>

      {/* Speaking Indicator Glow Ring */}
      {speaking && (
        <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-accent-strong px-2 py-0.5 text-[9px] font-semibold text-white animate-pulse">
          <Volume2Icon size={10} />
          Speaking
        </span>
      )}

      {/* Pixar Firehead Character Avatar */}
      <div className="relative my-2 flex items-center justify-center p-1">
        <FireheadSprite
          id={id}
          name={name}
          role={role}
          status={status}
          speaking={speaking}
          size="lg"
        />

        {/* Status Dot Ring */}
        <span
          className={`absolute bottom-0 right-1 h-3.5 w-3.5 rounded-full ring-2 ring-surface ${
            statusDot[status] ?? 'bg-faint'
          }`}
          title={`Status: ${status}`}
        />
      </div>

      {/* Agent Info & Role Tag */}
      <div className="mt-1 text-center">
        <h4 className="text-[13px] font-semibold text-ink group-hover:text-accent-ink transition-colors">
          {name}
        </h4>
        <p className="text-[11px] font-medium text-muted line-clamp-1">{role}</p>
      </div>

      {/* Model Tag */}
      {modelLabel && (
        <div className="mt-2">
          <ModelChip id={modelLabel as ModelId} size="xs" />
        </div>
      )}
    </div>
  );
}
