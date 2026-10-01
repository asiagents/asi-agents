import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDesk } from '../contexts/DeskContext';
import { useSettings } from '../contexts/SettingsContext';

export function useShortcuts() {
  const navigate = useNavigate();
  const { requestPanic } = useDesk();
  const { s, set } = useSettings();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'k' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
        return;
      }
      if (!e.shiftKey) return;
      if (k === 'p') {
        e.preventDefault();
        requestPanic();
      } else if (k === 'm') {
        e.preventDefault();
        set('muteMode', s.muteMode === 'muted' ? 'unmuted' : 'muted');
      } else if (k === 'n') {
        e.preventDefault();
        navigate('/chat/chief');
      } else if (k === 'l') {
        e.preventDefault();
        set('locked', true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, requestPanic, s.muteMode, set]);
}