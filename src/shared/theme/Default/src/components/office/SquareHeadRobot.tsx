import React from 'react';

export interface SquareHeadRobotProps {
  id?: string;
  name?: string;
  role?: string;
  activityState?: 'working' | 'thinking' | 'sleeping' | 'drinking' | 'speaking' | 'idle' | 'offline' | string;
  colorTheme?: 'cyan' | 'amber' | 'violet' | 'pink' | 'crimson' | 'emerald';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
  xl: 'w-28 h-28',
};

const themeColors: Record<string, { main: string; inner: string; eye: string; glow: string }> = {
  cyan: { main: '#00f3ff', inner: '#0066ff', eye: '#38bdf8', glow: 'rgba(0, 243, 255, 0.5)' },
  amber: { main: '#ff9900', inner: '#ff0055', eye: '#fbbf24', glow: 'rgba(255, 153, 0, 0.5)' },
  violet: { main: '#b066ff', inner: '#6366f1', eye: '#c084fc', glow: 'rgba(176, 102, 255, 0.5)' },
  pink: { main: '#ff3b9a', inner: '#9333ea', eye: '#f472b6', glow: 'rgba(255, 59, 154, 0.5)' },
  crimson: { main: '#ff3344', inner: '#990011', eye: '#f87171', glow: 'rgba(255, 51, 68, 0.5)' },
  emerald: { main: '#00e676', inner: '#00897b', eye: '#34d399', glow: 'rgba(0, 230, 118, 0.5)' },
};

export function SquareHeadRobot({
  id = 'robot',
  name = 'Agent',
  role = 'Specialist',
  activityState = 'working',
  colorTheme = 'cyan',
  size = 'md',
  className = '',
}: SquareHeadRobotProps) {
  const theme = themeColors[colorTheme] || themeColors.cyan;
  const isWorking = activityState === 'working';
  const isThinking = activityState === 'thinking';
  const isSleeping = activityState === 'sleeping';
  const isDrinking = activityState === 'drinking';
  const isSpeaking = activityState === 'speaking';
  const isOffline = activityState === 'offline';

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none ${sizeMap[size]} ${className}`}
      title={`${name} (${role}) · State: ${activityState}`}
    >
      {/* THINKING: Animated Floating Lightbulb */}
      {isThinking && (
        <div className="absolute -top-6 animate-bounce text-amber-400 font-bold text-xs flex items-center justify-center bg-amber-400/20 px-1.5 py-0.5 rounded-full ring-1 ring-amber-400/50 shadow-lg z-20">
          💡 <span className="ml-0.5 text-[9px] text-amber-300">Idea!</span>
        </div>
      )}

      {/* SLEEPING: Animated Drifting Zzz Embers */}
      {isSleeping && (
        <div className="absolute -top-5 right-0 flex flex-col items-end pointer-events-none z-20">
          <span className="animate-pulse text-indigo-400 font-bold text-xs">z</span>
          <span className="animate-ping text-indigo-300 font-bold text-[10px] -mr-1">Z</span>
          <span className="animate-bounce text-indigo-200 font-bold text-[8px] -mr-2">z</span>
        </div>
      )}

      {/* DRINKING: Animated Floating Steam Wave */}
      {isDrinking && (
        <div className="absolute -top-4 right-1 flex items-center gap-0.5 pointer-events-none z-20 text-[10px] text-emerald-300">
          ☕ <span className="animate-pulse text-[9px]">~♨~</span>
        </div>
      )}

      {/* SPEAKING: Soundwave Ripple Ring */}
      {isSpeaking && (
        <div
          className="absolute inset-[-4px] rounded-2xl border-2 border-dashed animate-spin pointer-events-none z-0 opacity-80"
          style={{ borderColor: theme.main }}
        />
      )}

      {/* SVG Pixar Square-Headed Cube Robot */}
      <svg
        viewBox="0 0 100 100"
        className={`h-full w-full overflow-visible drop-shadow-lg transition-transform duration-300 ${
          isSleeping ? 'rotate-12 translate-y-1' : isThinking ? '-rotate-6 -translate-y-1' : ''
        }`}
      >
        <defs>
          {/* Metallic Square Head Shading */}
          <linearGradient id={`sqCasing-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isOffline ? '#374151' : '#2d3548'} />
            <stop offset="50%" stopColor={isOffline ? '#1f2937' : '#1e2433'} />
            <stop offset="100%" stopColor={isOffline ? '#111827' : '#121520'} />
          </linearGradient>

          {/* Visor Screen Shading */}
          <linearGradient id={`sqVisor-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0a0c12" />
            <stop offset="100%" stopColor="#141926" />
          </linearGradient>

          {/* Eye Glow */}
          <filter id={`sqGlow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Backlight Glow */}
        {!isOffline && (
          <rect
            x="10"
            y="10"
            width="80"
            height="80"
            rx="20"
            fill={theme.glow}
            className="opacity-40 blur-md"
          />
        )}

        {/* Top Antenna / Light Node */}
        <line x1="50" y1="18" x2="50" y2="8" stroke="#4b5563" strokeWidth="3" />
        <circle
          cx="50"
          cy="6"
          r="4.5"
          fill={isOffline ? '#6b7385' : theme.main}
          className={isWorking ? 'animate-pulse' : ''}
        />

        {/* Ear Side Bolts */}
        <rect x="8" y="42" width="7" height="16" rx="3" fill="#353d52" />
        <rect x="85" y="42" width="7" height="16" rx="3" fill="#353d52" />
        <circle cx="11.5" cy="50" r="2" fill={isOffline ? '#6b7385' : theme.main} />
        <circle cx="88.5" cy="50" r="2" fill={isOffline ? '#6b7385' : theme.main} />

        {/* PIXAR SQUARE HEAD CASING */}
        <rect
          x="14"
          y="18"
          width="72"
          height="68"
          rx="16"
          fill={`url(#sqCasing-${id})`}
          stroke={isOffline ? '#4b5563' : '#3e4861'}
          strokeWidth="2.5"
        />

        {/* Casing Top Highlight Bevel */}
        <path
          d="M 22 22 L 78 22"
          stroke="#5a6685"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* VISOR SCREEN (Dark Glass Face) */}
        <rect
          x="22"
          y="28"
          width="56"
          height="46"
          rx="12"
          fill={`url(#sqVisor-${id})`}
          stroke="#262d3e"
          strokeWidth="2"
        />

        {/* --- EXPRESSIVE LED EYES BY STATE --- */}
        {isOffline ? (
          /* Offline: Off X_X eyes */
          <g stroke="#6b7385" strokeWidth="2.5" strokeLinecap="round">
            <line x1="33" y1="44" x2="41" y2="52" />
            <line x1="41" y1="44" x2="33" y2="52" />
            <line x1="59" y1="44" x2="67" y2="52" />
            <line x1="67" y1="44" x2="59" y2="52" />
          </g>
        ) : isSleeping ? (
          /* Sleeping: Closed contented curve eyes (- _ -) */
          <g stroke={theme.eye} strokeWidth="3" fill="none" strokeLinecap="round">
            <path d="M 32 50 Q 37 54 42 50" />
            <path d="M 58 50 Q 63 54 68 50" />
          </g>
        ) : isThinking ? (
          /* Thinking: Looking up inquisitive eyes */
          <g filter={`url(#sqGlow-${id})`}>
            <circle cx="37" cy="44" r="6" fill={theme.eye} />
            <circle cx="63" cy="44" r="6" fill={theme.eye} />
            <circle cx="39" cy="42" r="2.2" fill="#ffffff" />
            <circle cx="65" cy="42" r="2.2" fill="#ffffff" />
          </g>
        ) : isWorking ? (
          /* Working: Excited pill eyes with shine */
          <g filter={`url(#sqGlow-${id})`}>
            <ellipse cx="37" cy="48" rx="6" ry="8" fill={theme.eye} />
            <ellipse cx="63" cy="48" rx="6" ry="8" fill={theme.eye} />
            <circle cx="39" cy="45" r="2.5" fill="#ffffff" />
            <circle cx="65" cy="45" r="2.5" fill="#ffffff" />
          </g>
        ) : (
          /* Idle / Default: Friendly round eyes */
          <g filter={`url(#sqGlow-${id})`}>
            <circle cx="37" cy="48" r="6.5" fill={theme.eye} />
            <circle cx="63" cy="48" r="6.5" fill={theme.eye} />
            <circle cx="39.5" cy="46" r="2.2" fill="#ffffff" />
            <circle cx="65.5" cy="46" r="2.2" fill="#ffffff" />
          </g>
        )}

        {/* Cute Mouth Expression */}
        {!isOffline && !isSleeping && (
          <path
            d={
              isWorking
                ? 'M 42 63 Q 50 68 58 63'
                : isThinking
                ? 'M 44 65 Q 50 62 56 65'
                : 'M 43 64 L 57 64'
            }
            stroke={theme.eye}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </svg>
    </div>
  );
}
