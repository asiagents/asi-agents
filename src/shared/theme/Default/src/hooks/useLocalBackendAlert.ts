import { useEffect, useMemo, useRef } from 'react';
import type { ModelCard, ModelsScanMeta } from '@asi-api';
import { useModelScan } from './useModelScan';
import { useNotifications } from '../contexts/NotificationContext';
import { alertFromScanMeta, type LocalBackendAlert } from '../utils/localBackendAlert';

type Options = {
  /** Fire tray + toast when alert appears or kind changes. Default false. */
  toast?: boolean;
};

/**
 * Probe-driven local backend alert (Ollama / llama.cpp / models API).
 * Mount once with `toast: true` (AppShell) to notify; Chat/Group/Home use the banner without re-toasting.
 */
export function useLocalBackendAlert(options: Options = {}): {
  alert: LocalBackendAlert | null;
  loading: boolean;
  unreachable: boolean;
  scanMeta: ModelsScanMeta | null;
  scannedAt: string | null;
  models: ModelCard[];
  runScan: () => Promise<void>;
} {
  const { toast = false } = options;
  const { scanMeta, unreachable, loading, scannedAt, runScan, models } = useModelScan();
  const { notify } = useNotifications();
  const alert = useMemo(
    () => (loading && !scanMeta && !unreachable ? null : alertFromScanMeta(scanMeta, unreachable)),
    [loading, scanMeta, unreachable]
  );
  const lastToastId = useRef<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    if (!alert) {
      lastToastId.current = null;
      return;
    }
    if (lastToastId.current === alert.id) return;
    lastToastId.current = alert.id;
    const tip = alert.suggestions[0];
    notify({
      kind: 'router',
      title: alert.title,
      detail: tip ? `${alert.detail} — ${tip}` : alert.detail,
      to: '/settings/models',
    });
  }, [alert, notify, toast]);

  return { alert, loading, unreachable, scanMeta, scannedAt, models, runScan };
}
