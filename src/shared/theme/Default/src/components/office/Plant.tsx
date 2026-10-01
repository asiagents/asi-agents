import React from 'react';

type Variant = 'fern' | 'monstera' | 'cactus';

/** Potted plant for the Office floor's greenery toggle. Decorative only. */
export function Plant({ variant = 'fern', size = 44, className = '' }: {variant?: Variant;size?: number;className?: string;}) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <g className="plant-sway">
        {variant === 'fern' &&
        <>
            <path d="M24 30 C18 22 10 20 6 14 C14 15 20 20 24 30Z" fill="#22a06b" />
            <path d="M24 30 C30 22 38 20 42 14 C34 15 28 20 24 30Z" fill="#16a34a" />
            <path d="M24 30 C22 20 22 10 24 4 C26 10 26 20 24 30Z" fill="#15803d" />
            <path d="M24 30 C16 26 10 28 5 25 C12 23 19 25 24 30Z" fill="#4ade80" />
            <path d="M24 30 C32 26 38 28 43 25 C36 23 29 25 24 30Z" fill="#22c55e" />
          </>
        }
        {variant === 'monstera' &&
        <>
            <ellipse cx="15" cy="17" rx="10" ry="8" fill="#16a34a" transform="rotate(-25 15 17)" />
            <ellipse cx="33" cy="15" rx="10" ry="8" fill="#15803d" transform="rotate(25 33 15)" />
            <ellipse cx="24" cy="10" rx="8" ry="7" fill="#22a06b" />
            <path d="M24 31 L15 17 M24 31 L33 15 M24 31 L24 10" stroke="#166534" strokeWidth="1.5" />
          </>
        }
        {variant === 'cactus' &&
        <>
            <rect x="20" y="8" width="8" height="24" rx="4" fill="#16a34a" />
            <rect x="11" y="15" width="6" height="11" rx="3" fill="#22a06b" />
            <rect x="31" y="12" width="6" height="12" rx="3" fill="#22a06b" />
            <rect x="15" y="22" width="6" height="4" fill="#22a06b" />
            <rect x="27" y="20" width="6" height="4" fill="#22a06b" />
            <circle cx="24" cy="7" r="2.5" fill="#f472b6" />
          </>
        }
      </g>
      <path d="M13 30 H35 L32 45 H16 Z" fill="#c2703d" />
      <rect x="11" y="28" width="26" height="5" rx="1.5" fill="#d9844a" />
    </svg>);

}