import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSettings } from './SettingsContext';
import { useDesk } from './DeskContext';
import { defaultDeskAgents, framesFor } from '../data/snapshots';
import { getAgent } from '../utils/lookup';
import { createId, nowTime } from '../utils/time';
import { normalizeDesks } from '@virtual-computer/integration/deskSummary';
import { fetchDeskStatusWithAutostart } from '@virtual-computer/integration/ensureDeskClient';

export interface Snapshot {
  id: string;
  time: string;
  frame: number;
}

interface SnapshotValue {
  snapshots: Record<string, Snapshot[]>;
  takeNow: () => void;
  lastTaken: string | null;
  /** Agents that currently have a virtual desk assigned (local + daemon). */
  deskAgents: string[];
  assignDesk: (agentId: string) => void;
  unassignDesk: (agentId: string) => void;
}

const SnapshotContext = createContext<SnapshotValue | null>(null);

/** Virtual desks per agent + timed snapshots. Interval 1–30 min; keeps the last N per agent and rotates out the oldest. */
export function SnapshotProvider({ children }: { children: React.ReactNode }) {
  const { s } = useSettings();
  const { pausedAt, deskModule, log } = useDesk();
  const [deskAgents, setDeskAgents] = useState<string[]>(defaultDeskAgents);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>(() =>
    Object.fromEntries(defaultDeskAgents.map((id) => [id, []]))
  );
  const [lastTaken, setLastTaken] = useState<string | null>(null);

  // Merge daemon desk agentIds into local assign list so agent cards stay honest.
  useEffect(() => {
    if (!deskModule) return;
    let cancelled = false;
    const load = () => {
      fetchDeskStatusWithAutostart()
        .then(async (r) => {
          if (!r.ok || cancelled) return;
          const j = (await r.json().catch(() => ({}))) as { live?: boolean; desks?: unknown };
          if (!j.live) return;
          const ids = normalizeDesks(j.desks)
            .map((d) => String(d.agentId || '').trim())
            .filter(Boolean);
          if (ids.length === 0) return;
          setDeskAgents((prev) => {
            const next = [...prev];
            for (const id of ids) {
              if (!next.includes(id)) next.push(id);
            }
            return next;
          });
          setSnapshots((prev) => {
            const copy = { ...prev };
            for (const id of ids) {
              if (!copy[id]) copy[id] = [];
            }
            return copy;
          });
        })
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [deskModule]);

  const takeNow = useCallback(() => {
    setSnapshots((prev) => {
      const next: Record<string, Snapshot[]> = { ...prev };
      deskAgents.forEach((id) => {
        const list = prev[id] ?? [];
        const offline = getAgent(id)?.status === 'offline';
        const frames = framesFor(id).length;
        const frame = offline ? 0 : ((list[list.length - 1]?.frame ?? 0) + 1) % frames;
        next[id] = [...list, { id: createId(), time: nowTime(), frame }].slice(-s.snapshotKeep);
      });
      return next;
    });
    setLastTaken(nowTime());
  }, [s.snapshotKeep, deskAgents]);

  const assignDesk = useCallback(
    (agentId: string) => {
      setDeskAgents((prev) => (prev.includes(agentId) ? prev : [...prev, agentId]));
      setSnapshots((prev) =>
        prev[agentId] ? prev : { ...prev, [agentId]: [{ id: createId(), time: nowTime(), frame: 0 }] }
      );
      log({
        actor: 'You',
        agentId,
        text: `Assigned a virtual desk to ${getAgent(agentId)?.name ?? agentId}`,
        tone: 'neutral',
      });
    },
    [log]
  );

  const unassignDesk = useCallback(
    (agentId: string) => {
      setDeskAgents((prev) => prev.filter((id) => id !== agentId));
      log({
        actor: 'You',
        agentId,
        text: `Removed virtual desk from ${getAgent(agentId)?.name ?? agentId} (snapshots kept)`,
        tone: 'neutral',
      });
    },
    [log]
  );

  useEffect(() => {
    setSnapshots((prev) =>
      Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v.slice(-s.snapshotKeep)]))
    );
  }, [s.snapshotKeep]);

  useEffect(() => {
    if (pausedAt || !deskModule) return;
    const id = window.setInterval(takeNow, Math.max(1, Math.min(30, s.snapshotMin)) * 60_000);
    return () => window.clearInterval(id);
  }, [s.snapshotMin, pausedAt, deskModule, takeNow]);

  const value = useMemo(
    () => ({ snapshots, takeNow, lastTaken, deskAgents, assignDesk, unassignDesk }),
    [snapshots, takeNow, lastTaken, deskAgents, assignDesk, unassignDesk]
  );
  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}

export function useSnapshots(): SnapshotValue {
  const ctx = useContext(SnapshotContext);
  if (!ctx) throw new Error('useSnapshots must be used inside SnapshotProvider');
  return ctx;
}
