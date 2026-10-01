import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';

/** /lock — engages the real lock screen, then parks on Home underneath it (unlock lands on Home). */
export function Lock() {
  const { set } = useSettings();
  const navigate = useNavigate();
  useEffect(() => {
    set('locked', true);
    navigate('/', { replace: true });
  }, [set, navigate]);
  return null;
}