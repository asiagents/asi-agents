import React from 'react';
import { motion } from 'framer-motion';
import { WifiOffIcon } from 'lucide-react';
import { deskTerminal } from '../../data/desk';

interface WatchSurfaceProps {
  watching: boolean;
  compact?: boolean;
}

export function WatchSurface({ watching, compact = false }: WatchSurfaceProps) {
  const lines = compact ? deskTerminal.slice(-3) : deskTerminal;
  return (
    <section aria-label="Watch surface" className="overflow-hidden rounded-card bg-[#0a0c11] ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
        </span>
        <span className="ml-1 truncate text-[11px] text-[#9aa3b5]">Terminal</span>
        <span className={`ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium ${watching ? 'text-[#34d399]' : 'text-[#9aa3b5]'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${watching ? 'bg-[#34d399]' : 'bg-[#6f7789]'}`} />
          {watching ? 'Watching' : 'Paused'}
        </span>
      </div>
      <div className={`font-mono ${compact ? 'p-3 text-[11px] leading-5' : 'min-h-[300px] p-5 text-[13px] leading-7'}`}>
        {lines.length === 0 ? (
          <div className="text-[#9aa3b5]">No terminal capture yet. Start the Virtual Computer desk to see live output.</div>
        ) : (
          lines.map((line) =>
            <div key={line} className={`truncate ${line.startsWith('$') ? 'text-[#e8eaf0]' : 'text-[#9aa3b5]'}`}>
              {line}
            </div>
          )
        )}
        {watching &&
        <motion.span
          className="inline-block h-3.5 w-1.5 translate-y-0.5 bg-[#bdb4ff]"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />

        }
      </div>
      {!watching &&
      <div className="flex items-start gap-2 border-t border-white/10 bg-[#f87171]/10 px-3 py-2.5 font-sans text-[12px] text-[#e8eaf0]">
        <WifiOffIcon size={14} className="mt-0.5 shrink-0 text-[#f87171]" aria-hidden="true" />
        <span>Desk watch is paused or offline. New actions stay blocked until a live session is available.</span>
      </div>}
    </section>);

}