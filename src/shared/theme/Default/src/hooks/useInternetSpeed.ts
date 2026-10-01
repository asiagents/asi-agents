import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@asi-api';

const STORAGE_KEY = 'asi-agents-internet-speed-v1';
const MIN_INTERVAL_MS = 3 * 60 * 60 * 1000;

export type InternetSpeedState = {
  downloadMbps: number | null;
  checkedAt: string | null;
  loading: boolean;
  error: string | null;
  /** Run test if cache is stale (respects 3h throttle). */
  ensureFresh: () => void;
};

type Cache = { downloadMbps: number | null; checkedAt: string };

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cache;
    if (!parsed || typeof parsed.checkedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(c: Cache) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* quota / private mode */
  }
}

function cacheStale(c: Cache | null): boolean {
  if (!c) return true;
  const at = Date.parse(c.checkedAt);
  if (Number.isNaN(at)) return true;
  return Date.now() - at >= MIN_INTERVAL_MS;
}

export function useInternetSpeed(): InternetSpeedState {
  const [downloadMbps, setDownloadMbps] = useState<number | null>(() => readCache()?.downloadMbps ?? null);
  const [checkedAt, setCheckedAt] = useState<string | null>(() => readCache()?.checkedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  const run = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    setError(null);
    try {
      const r = await api.networkSpeed();
      const next: Cache = {
        downloadMbps: r.downloadMbps,
        checkedAt: r.checkedAt,
      };
      writeCache(next);
      setDownloadMbps(next.downloadMbps);
      setCheckedAt(next.checkedAt);
      if (r.downloadMbps == null && r.notes?.length) {
        setError(r.notes[0] ?? 'Speed test unavailable');
      }
    } catch {
      setError('Speed test offline');
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, []);

  const ensureFresh = useCallback(() => {
    const c = readCache();
    if (c && !cacheStale(c)) {
      setDownloadMbps(c.downloadMbps);
      setCheckedAt(c.checkedAt);
      return;
    }
    void run();
  }, [run]);

  useEffect(() => {
    const c = readCache();
    if (c) {
      setDownloadMbps(c.downloadMbps);
      setCheckedAt(c.checkedAt);
    }
  }, []);

  return { downloadMbps, checkedAt, loading, error, ensureFresh };
}
