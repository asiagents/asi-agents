import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MicIcon, MicOffIcon, Volume1Icon, Volume2Icon, VolumeXIcon } from 'lucide-react';
import { VoiceSheet } from './VoiceSheet';
import { useSettings } from '../../contexts/SettingsContext';
import { stopSpeaking } from '../../utils/speech';
import type { MuteMode } from '../../types/settings';

const nextMode: Record<MuteMode, MuteMode> = { unmuted: 'agents', agents: 'muted', muted: 'unmuted' };
const modeLabel: Record<MuteMode, string> = { unmuted: 'Unmuted', agents: 'Agents only', muted: 'Muted all' };

const btn = 'grid h-8 w-8 place-items-center rounded-full ring-1 ring-line transition-colors duration-150';

export function AudioControls() {
  const { s, set } = useSettings();
  const [sheet, setSheet] = useState(false);
  const pressTimer = useRef<number>();
  const longPressed = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sheet) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setSheet(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [sheet]);

  const cycle = () => {
    const m = nextMode[s.muteMode];
    if (m === 'muted') stopSpeaking();
    set('muteMode', m);
  };

  const SpeakerIcon = s.muteMode === 'muted' ? VolumeXIcon : s.muteMode === 'agents' ? Volume1Icon : Volume2Icon;
  const micOff = s.micMuted || !s.stt || s.muteMode === 'muted';

  return (
    <div ref={wrapRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => set('micMuted', !s.micMuted)}
        aria-pressed={!micOff}
        aria-label={micOff ? 'Mic muted — tap to enable' : 'Mic on — tap to mute'}
        title={micOff ? 'Mic muted' : 'Mic on'}
        className={`${btn} ${micOff ? 'text-muted hover:text-ink' : 'bg-accent/10 text-accent-ink'}`}>
        
        {micOff ? <MicOffIcon size={15} aria-hidden="true" /> : <MicIcon size={15} aria-hidden="true" />}
      </button>
      <button
        type="button"
        onPointerDown={() => {
          longPressed.current = false;
          pressTimer.current = window.setTimeout(() => {
            longPressed.current = true;
            setSheet(true);
          }, 500);
        }}
        onPointerUp={() => window.clearTimeout(pressTimer.current)}
        onPointerLeave={() => window.clearTimeout(pressTimer.current)}
        onClick={() => {
          if (longPressed.current) return;
          cycle();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setSheet(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSheet(true);
          }
        }}
        aria-label={`Audio: ${modeLabel[s.muteMode]}. Tap to change, long-press for voice settings`}
        title={`${modeLabel[s.muteMode]} · long-press for Voice`}
        className={`${btn} ${s.muteMode === 'muted' ? 'text-danger' : s.muteMode === 'agents' ? 'text-warn' : 'text-muted hover:text-ink'}`}>
        
        <SpeakerIcon size={15} aria-hidden="true" />
      </button>
      <AnimatePresence>{sheet && <VoiceSheet onClose={() => setSheet(false)} />}</AnimatePresence>
    </div>);

}