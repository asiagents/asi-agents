import { useEffect, useMemo, useRef, useState } from 'react';
import {
  deskStatusLine,
  summarizeDesks,
  type DeskRow,
  type DeskSummary,
} from '@virtual-computer/integration/deskSummary';
import { asiApiUnreachableMessage } from '@virtual-computer/integration/deskStatusMessage';
import { fetchDeskStatusWithAutostart } from '@virtual-computer/integration/ensureDeskClient';

export type DeskStatusPayload = {
  live?: boolean;
  desks?: unknown;
  deskCount?: number;
  runningCount?: number;
  hibernatedCount?: number;
  stoppedCount?: number;
  headlessCount?: number;
  visibleCount?: number;
  consoleUrl?: string;
  setupMessage?: string;
  error?: string;
  dockerAvailable?: boolean;
  dockerMessage?: string;
  state?: string;
  setupSteps?: string[];
};

export type UseDeskStatusResult = {
  loading: boolean;
  apiUnreachable: boolean;
  live: boolean;
  status: DeskStatusPayload | null;
  desks: DeskRow[];
  summary: DeskSummary;
  statusLine: string;
  error: string | null;
};

const EMPTY: DeskSummary = {
  desks: [],
  deskCount: 0,
  runningCount: 0,
  hibernatedCount: 0,
  stoppedCount: 0,
  headlessCount: 0,
  visibleCount: 0,
};

/** Poll GET /api/desk/status — lock + desk UI share the same honest daemon list. */
export function useDeskStatus(opts?: { enabled?: boolean; intervalMs?: number }): UseDeskStatusResult {
  const enabled = opts?.enabled !== false;
  const intervalMs = opts?.intervalMs ?? 5000;
  const [status, setStatus] = useState<DeskStatusPayload | null>(null);
  const [apiUnreachable, setApiUnreachable] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const hadLiveRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetchDeskStatusWithAutostart()
        .then(async (r) => {
          const j = (await r.json().catch(() => ({}))) as DeskStatusPayload;
          if (cancelled) return;
          // Any HTTP response from ASI means the API is reachable — only mark down on fetch throw.
          setApiUnreachable(false);
          if (!r.ok) {
            setStatus({
              live: false,
              desks: [],
              deskCount: 0,
              error: j.error ?? j.setupMessage ?? `Desk status API returned ${r.status}.`,
              setupMessage: j.setupMessage,
              setupSteps: j.setupSteps,
              state: j.state,
            });
            if (j.live !== true) hadLiveRef.current = false;
          } else {
            setStatus(j);
            hadLiveRef.current = j.live === true;
          }
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          // Keep last good live status — avoid flapping false "API down" on transient blips.
          if (hadLiveRef.current) {
            setApiUnreachable(false);
          } else {
            setApiUnreachable(true);
            setStatus({
              live: false,
              desks: [],
              deskCount: 0,
              error: asiApiUnreachableMessage(),
            });
          }
          setLoading(false);
        });
    };
    load();
    const id = window.setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, intervalMs]);

  const summary = useMemo(() => {
    if (!status?.live) return EMPTY;
    const fromList = summarizeDesks(status.desks);
/** Prefer client summarize when server omits count fields (null/undefined). */
    return {
      desks: fromList.desks,
      deskCount: status.deskCount ?? fromList.deskCount,
      runningCount: status.runningCount ?? fromList.runningCount,
      hibernatedCount: status.hibernatedCount ?? fromList.hibernatedCount,
      stoppedCount: status.stoppedCount ?? fromList.stoppedCount,
      headlessCount: status.headlessCount ?? fromList.headlessCount,
      visibleCount: status.visibleCount ?? fromList.visibleCount,
    };
  }, [status]);

  return {
    loading,
    apiUnreachable,
    live: status?.live === true,
    status,
    desks: summary.desks,
    summary,
    statusLine: deskStatusLine(summary),
    error: status?.error ?? (apiUnreachable ? asiApiUnreachableMessage() : null),
  };
}
