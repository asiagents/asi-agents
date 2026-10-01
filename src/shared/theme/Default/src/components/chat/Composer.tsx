import React, { useEffect, useRef, useState } from 'react';
import { MicIcon, MicOffIcon, SendIcon } from 'lucide-react';
import { api, type VoiceDictionaryEntry } from '@asi-api';
import { useSettings } from '../../contexts/SettingsContext';
import { applyHeardAs } from '../../utils/heardAs';
import { ModelDisclaimer } from './ModelDisclaimer';

interface ComposerProps {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((e: {results: ArrayLike<ArrayLike<{transcript: string;}>>;}) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type RecognitionCtor = new () => RecognitionLike;

function getRecognition(): RecognitionCtor | null {
  const w = window as unknown as {SpeechRecognition?: RecognitionCtor;webkitSpeechRecognition?: RecognitionCtor;};
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function Composer({ onSend, placeholder = 'Message Chief…', disabled = false }: ComposerProps) {
  const { s } = useSettings();
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);
  const dictRef = useRef<VoiceDictionaryEntry[]>([]);
  const micBlocked = !s.stt || s.micMuted || s.muteMode === 'muted';

  useEffect(() => () => recRef.current?.stop(), []);

  useEffect(() => {
    let cancelled = false;
    api
      .voiceDictionary()
      .then((r) => {
        if (!cancelled) dictRef.current = r.entries ?? [];
      })
      .catch(() => {
        /* keep empty — STT still works without correction */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
  };

  const toggleMic = () => {
    if (micBlocked || disabled) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = getRecognition();
    setListening(true);
    if (!Ctor) {
      window.setTimeout(() => setListening(false), 1600);
      return;
    }
    const rec = new Ctor();
    rec.lang = s.sttLocale;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const raw = Array.from(e.results).map((r) => r[0].transcript).join(' ');
      const text = applyHeardAs(raw, dictRef.current);
      setValue((v) => v ? `${v} ${text}` : text);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
  };

  return (
    <form
      className="border-t border-line px-3 py-3 md:px-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}>
      
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl bg-bg px-3 py-2 ring-1 ring-line focus-within:ring-accent/60">
          <label htmlFor="composer" className="sr-only">Message</label>
          <textarea
            id="composer"
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={listening ? 'Listening…' : placeholder}
            disabled={disabled}
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm text-ink outline-none placeholder:text-faint" />
          
          <button
            type="button"
            onClick={toggleMic}
            disabled={disabled}
            aria-pressed={listening}
            aria-label={micBlocked ? 'Microphone muted' : listening ? 'Stop listening' : 'Speak your message'}
            title={micBlocked ? 'Mic is muted — turn it on from the header or Settings → Voice' : 'Speak (browser speech-to-text; see Settings → Voice → Privacy)'}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-150 disabled:opacity-40 ${
            listening ? 'bg-danger/15 text-danger' : 'text-muted hover:bg-overlay/[0.05] hover:text-ink'}`
            }>
            
            {micBlocked ? <MicOffIcon size={16} aria-hidden="true" /> : <MicIcon size={16} aria-hidden="true" />}
          </button>
          <button
            type="submit"
            disabled={!value.trim() || disabled}
            aria-label="Send message"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-strong text-white transition-colors duration-150 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-40">
            
            <SendIcon size={15} aria-hidden="true" />
          </button>
        </div>
        <ModelDisclaimer className="mt-2 px-1" />
      </div>
    </form>);

}
