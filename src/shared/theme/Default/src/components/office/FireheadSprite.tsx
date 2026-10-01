import React from 'react';

export interface FireheadSpriteProps {
  id?: string;
  name?: string;
  role?: string;
  status?: 'active' | 'working' | 'idle' | 'waiting' | 'offline' | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  speaking?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'h-7 w-7',
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
  xl: 'h-28 w-28',
};

// Map role to specific flame color palette
export function getRoleFlameColor(role = '', id = ''): {
  id: string;
  main: string;
  inner: string;
  glow: string;
  eye: string;
  label: string;
} {
  const r = (role || '').toLowerCase();
  const i = (id || '').toLowerCase();

  if (r.includes('chief') || r.includes('lead') || r.includes('head') || i.includes('chief')) {
    return {
      id: 'cyan',
      main: '#00f3ff',
      inner: '#0066ff',
      glow: 'rgba(0, 243, 255, 0.6)',
      eye: '#38bdf8',
      label: 'Cyan Flame (Chief)',
    };
  }
  if (r.includes('code') || r.includes('dev') || r.includes('engineer') || i.includes('code')) {
    return {
      id: 'amber',
      main: '#ff9900',
      inner: '#ff0055',
      glow: 'rgba(255, 153, 0, 0.6)',
      eye: '#fbbf24',
      label: 'Amber Flame (Code)',
    };
  }
  if (r.includes('research') || r.includes('ai') || r.includes('science') || i.includes('research')) {
    return {
      id: 'violet',
      main: '#b066ff',
      inner: '#6366f1',
      glow: 'rgba(176, 102, 255, 0.6)',
      eye: '#c084fc',
      label: 'Violet Flame (Research)',
    };
  }
  if (r.includes('design') || r.includes('art') || r.includes('ui') || i.includes('art')) {
    return {
      id: 'pink',
      main: '#ff3b9a',
      inner: '#9333ea',
      glow: 'rgba(255, 59, 154, 0.6)',
      eye: '#f472b6',
      label: 'Pink Flame (Design)',
    };
  }
  if (r.includes('security') || r.includes('guard') || r.includes('shield') || i.includes('sec')) {
    return {
      id: 'crimson',
      main: '#ff3344',
      inner: '#990011',
      glow: 'rgba(255, 51, 68, 0.6)',
      eye: '#f87171',
      label: 'Crimson Flame (Security)',
    };
  }
  // Default Ops / Data / General
  return {
    id: 'emerald',
    main: '#00e676',
    inner: '#00897b',
    glow: 'rgba(0, 230, 118, 0.6)',
    eye: '#34d399',
    label: 'Emerald Flame (Ops)',
  };
}

export function FireheadSprite({
  id = 'agent',
  name = 'Agent',
  role = 'Specialist',
  status = 'idle',
  size = 'md',
  speaking = false,
  className = '',
}: FireheadSpriteProps) {
  const isWorking = status === 'working' || status === 'active';
  const isWaiting = status === 'waiting';
  const isOffline = status === 'offline';
  const color = getRoleFlameColor(role, id);

  const flameAnimClass = isOffline
    ? 'opacity-30 grayscale'
    : isWorking
    ? 'flame-flicker'
    : 'flame-breathe';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${sizeClasses[size]} ${className}`}
      title={`${name} (${role}) · Status: ${status}`}
    >
      {/* Speaking Soundwave Ripple Rings */}
      {speaking && !isOffline && (
        <>
          <span
            className="absolute inset-0 rounded-full border-2 speaking-ripple"
            style={{ borderColor: color.main }}
          />
          <span
            className="absolute inset-[-4px] rounded-full border border-dashed opacity-60 animate-ping"
            style={{ borderColor: color.inner }}
          />
        </>
      )}

      {/* Main Firehead Character Render */}
      <svg
        viewBox="0 0 100 110"
        className="h-full w-full overflow-visible drop-shadow-md"
        aria-label={`Pixar Firehead Robot - ${name}`}
      >
        <defs>
          {/* Flame Gradient */}
          <radialGradient id={`flameGrad-${id}`} cx="50%" cy="80%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor={isOffline ? '#6b7385' : color.main} />
            <stop offset="85%" stopColor={isOffline ? '#374151' : color.inner} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Robot Metallic Shell Gradient */}
          <linearGradient id={`casingGrad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isOffline ? '#374151' : '#2a3142'} />
            <stop offset="50%" stopColor={isOffline ? '#1f2937' : '#1e2330'} />
            <stop offset="100%" stopColor={isOffline ? '#111827' : '#141722'} />
          </linearGradient>

          {/* Screen Visor Gradient */}
          <linearGradient id={`visorGrad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0b0d13" />
            <stop offset="100%" stopColor="#141824" />
          </linearGradient>

          {/* Eye Glow */}
          <filter id={`eyeGlow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Flame Glow Backdrop */}
        {!isOffline && (
          <circle
            cx="50"
            cy="28"
            r="26"
            fill={color.glow}
            className="opacity-40 blur-md transition-opacity duration-300"
          />
        )}

        {/* --- FLAME HEAD TOP (Pixar Stylized Fire Hair) --- */}
        <g className={`transition-all duration-300 transform-origin-bottom ${flameAnimClass}`} style={{ color: color.main }}>
          {/* Outer Flame Wings */}
          <path
            d="M 50 2 C 34 16, 26 28, 30 42 C 36 50, 44 48, 50 45 C 56 48, 64 50, 70 42 C 74 28, 66 16, 50 2 Z"
            fill={`url(#flameGrad-${id})`}
          />
          {/* Mid Flame Tongue */}
          <path
            d="M 50 8 C 42 20, 36 28, 42 38 C 46 43, 54 43, 58 38 C 64 28, 58 20, 50 8 Z"
            fill={isOffline ? '#9ca3af' : '#ffffff'}
            opacity={isOffline ? 0.3 : 0.75}
          />
          {/* Core Flame Tip Spark */}
          <path
            d="M 50 12 C 46 20, 44 25, 48 30 C 50 32, 52 32, 52 30 C 56 25, 54 20, 50 12 Z"
            fill="#ffffff"
            opacity={isOffline ? 0.2 : 0.95}
          />
        </g>

        {/* --- ROBOT HEAD CASING --- */}
        {/* Antennae / Ear Bolts */}
        <rect x="18" y="60" width="8" height="12" rx="3" fill="#353d52" />
        <rect x="74" y="60" width="8" height="12" rx="3" fill="#353d52" />
        <circle cx="22" cy="66" r="2.5" fill={isOffline ? '#6b7385' : color.main} />
        <circle cx="78" cy="66" r="2.5" fill={isOffline ? '#6b7385' : color.main} />

        {/* Metallic Head Shell */}
        <rect
          x="22"
          y="44"
          width="56"
          height="46"
          rx="18"
          fill={`url(#casingGrad-${id})`}
          stroke={isOffline ? '#4b5563' : '#3a445d'}
          strokeWidth="2"
        />

        {/* Head Shell Top Highlight Rim */}
        <path
          d="M 30 46 C 42 43, 58 43, 70 46"
          stroke="#4f5975"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* --- VISOR SCREEN (Dark Glass Face) --- */}
        <rect
          x="28"
          y="52"
          width="44"
          height="30"
          rx="10"
          fill={`url(#visorGrad-${id})`}
          stroke="#2a3142"
          strokeWidth="1.5"
        />

        {/* --- EXPRESSIVE LED EYES --- */}
        {isOffline ? (
          /* Offline: Closed X_X eyes */
          <g stroke="#6b7385" strokeWidth="2" strokeLinecap="round">
            <line x1="37" y1="62" x2="43" y2="68" />
            <line x1="43" y1="62" x2="37" y2="68" />
            <line x1="57" y1="62" x2="63" y2="68" />
            <line x1="63" y1="62" x2="57" y2="68" />
          </g>
        ) : isWorking ? (
          /* Working: Excited glowing pill eyes with eye shine */
          <g filter={`url(#eyeGlow-${id})`}>
            <ellipse cx="40" cy="65" rx="5" ry="7" fill={color.eye} />
            <ellipse cx="60" cy="65" rx="5" ry="7" fill={color.eye} />
            <circle cx="41.5" cy="63" r="2" fill="#ffffff" />
            <circle cx="61.5" cy="63" r="2" fill="#ffffff" />
          </g>
        ) : isWaiting ? (
          /* Waiting: Inquisitive raised eyes */
          <g filter={`url(#eyeGlow-${id})`}>
            <circle cx="40" cy="63" r="5" fill="#fbbf24" />
            <circle cx="60" cy="67" r="5" fill="#fbbf24" />
            <circle cx="41.5" cy="61.5" r="1.5" fill="#ffffff" />
            <circle cx="61.5" cy="65.5" r="1.5" fill="#ffffff" />
          </g>
        ) : (
          /* Idle: Friendly glowing round eyes */
          <g filter={`url(#eyeGlow-${id})`}>
            <circle cx="40" cy="65" r="5" fill={color.eye} />
            <circle cx="60" cy="65" r="5" fill={color.eye} />
            <circle cx="41.5" cy="63.5" r="1.8" fill="#ffffff" />
            <circle cx="61.5" cy="63.5" r="1.8" fill="#ffffff" />
          </g>
        )}

        {/* Cute Subtle Mouth Display Line */}
        {!isOffline && (
          <path
            d={isWorking ? 'M 44 75 Q 50 79 56 75' : 'M 45 76 L 55 76'}
            stroke={color.eye}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
        )}
      </svg>
    </div>
  );
}
