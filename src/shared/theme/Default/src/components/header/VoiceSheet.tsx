import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { XIcon } from 'lucide-react';
import { Toggle } from '../Toggle';
import { useSettings } from '../../contexts/SettingsContext';
import { voices } from '../../data/voices';

/** Quick audio sheet from the header speaker (long-press). Full controls live in Settings → Voice. */
export function VoiceSheet({ onClose }: {onClose: () => void;}) {
  const { s, set } = useSettings();
  const available = voices.filter((v) => s.voiceProviders[v.provider]);
  const muted = s.muteMode === 'muted';

  return (
    <motion.div
      role="dialog"
      aria-label="Voice"
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      className="absolute right-0 top-11 z-50 w-72 rounded-card bg-surface p-4 shadow-xl ring-1 ring-line">
      
      <div className="flex items-center">
        <h2 className="text-sm font-semibold text-ink">Voice</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-overlay/[0.05] hover:text-ink">
          <XIcon size={14} aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => set('muteMode', muted ? 'unmuted' : 'muted')}
        className={`mt-3 w-full rounded-lg py-2 text-[13px] font-medium transition-colors duration-150 ${
        muted ? 'bg-accent-strong text-white hover:bg-accent-2' : 'text-ink ring-1 ring-line hover:bg-overlay/[0.05]'}`
        }>
        
        {muted ? 'Unmute' : 'Mute all'}
      </button>
      <div className="mt-3 space-y-3 text-[13px]">
        <Row label="Agent speech (TTS)"><Toggle label="TTS" checked={s.tts} onChange={(v) => set('tts', v)} /></Row>
        <Row label="Your mic (STT)"><Toggle label="STT" checked={s.stt} onChange={(v) => set('stt', v)} /></Row>
        <Row label="Speak handoffs & approvals"><Toggle label="Speak handoffs" checked={s.speakHandoffs} onChange={(v) => set('speakHandoffs', v)} /></Row>
        <label className="block">
          <span className="text-muted">Volume · {s.volume}</span>
          <input type="range" min={0} max={100} value={s.volume} onChange={(e) => set('volume', Number(e.target.value))} className="mt-1 w-full accent-[rgb(var(--accent))]" />
        </label>
        <label className="block">
          <span className="text-muted">Default voice</span>
          <select
            value={s.defaultVoice}
            onChange={(e) => set('defaultVoice', e.target.value)}
            className="mt-1 w-full rounded-lg bg-bg px-2.5 py-1.5 text-ink ring-1 ring-line">
            
            {available.map((v) =>
            <option key={v.id} value={v.id}>{v.name}</option>
            )}
          </select>
        </label>
      </div>
      <Link to="/settings/voice" onClick={onClose} className="mt-3 inline-block text-[12px] font-medium text-accent-ink hover:underline">
        Per-agent voices & providers
      </Link>
    </motion.div>);

}

function Row({ label, children }: {label: string;children: React.ReactNode;}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-ink">{label}</span>
      {children}
    </div>);

}