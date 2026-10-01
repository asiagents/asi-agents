import { useCallback, useEffect, useState } from 'react';
import { api } from '@asi-api';

export type PendingPermissionsState = {
  /** Live pending count; null when API unreachable (fail closed). */
  pendingCount: number | null;
  offline: boolean;
  refresh: () => Promise<void>;
};

const POLL_MS = 60_000;

export function usePendingPermissions(): PendingPermissionsState {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await api.permissions();
      const pending = (r.items ?? []).filter((p) => p.status === 'pending').length;
      setPendingCount(pending);
      setOffline(false);
    } catch {
      setPendingCount(null);
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { pendingCount, offline, refresh };
}
