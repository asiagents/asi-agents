import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { api } from '@asi-api';
import { Toggle } from '../Toggle';
import { StatusPill } from '../settings/SettingsUI';
import { useSelectedModelPool } from '../../hooks/useSelectedModelPool';
import { modelLabel } from '../../utils/modelScanBridge';
import { readJson, STORAGE_KEYS, writeJson } from '../../utils/storage';

type CascadePrefs = { enabled: boolean; order: string[] };

function normalizeOrder(ids: string[], pool: string[]): string[] {
  const poolSet = new Set(pool);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if (!id || !poolSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of pool) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sameOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

/**
 * Honest Cascade: ordered failover from Browse Models pool (primary → secondary → …).
 * Not Micro → Hybrid → escalate staging — that router is not shipped.
 */
export function CascadeStages({ onGoBrowse }: { onGoBrowse?: () => void }) {
  const { ids: poolIds, ready: poolReady } = useSelectedModelPool();
  const poolKey = poolIds.join('\0');

  const [enabled, setEnabled] = useState(false);
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedEnabled, setSavedEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .modelsCascade()
      .then((prefs) => {
        if (cancelled) return;
        const order = normalizeOrder(prefs.order ?? [], poolIds);
        const nextEnabled = prefs.enabled === true;
        setEnabled(nextEnabled);
        setSavedEnabled(nextEnabled);
        setSavedOrder(order);
        setDraftOrder(order);
        writeJson(STORAGE_KEYS.modelCascade, { enabled: nextEnabled, order });
      })
      .catch(() => {
        if (cancelled) return;
        const raw = readJson<Partial<CascadePrefs>>(STORAGE_KEYS.modelCascade, {
          enabled: false,
          order: [],
        });
        const order = normalizeOrder(Array.isArray(raw.order) ? raw.order.map(String) : [], poolIds);
        const nextEnabled = raw.enabled === true;
        setEnabled(nextEnabled);
        setSavedEnabled(nextEnabled);
        setSavedOrder(order);
        setDraftOrder(order);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [poolKey, poolIds]);

  useEffect(() => {
    if (!ready || !poolReady) return;
    setDraftOrder((prev) => normalizeOrder(prev, poolIds));
    setSavedOrder((prev) => normalizeOrder(prev, poolIds));
  }, [poolIds, poolReady, ready]);

  const dirty = useMemo(
    () => enabled !== savedEnabled || !sameOrder(draftOrder, savedOrder),
    [draftOrder, enabled, savedEnabled, savedOrder]
  );

  const move = useCallback((index: number, dir: -1 | 1) => {
    setDraftOrder((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    const order = normalizeOrder(draftOrder, poolIds);
    setSaving(true);
    try {
      const prefs = await api.patchModelsCascade({ enabled, order });
      const nextOrder = normalizeOrder(prefs.order ?? order, poolIds);
      const nextEnabled = prefs.enabled === true;
      setEnabled(nextEnabled);
      setSavedEnabled(nextEnabled);
      setSavedOrder(nextOrder);
      setDraftOrder(nextOrder);
      writeJson(STORAGE_KEYS.modelCascade, { enabled: nextEnabled, order: nextOrder });
    } catch {
      writeJson(STORAGE_KEYS.modelCascade, { enabled, order });
      setSavedEnabled(enabled);
      setSavedOrder(order);
      setDraftOrder(order);
    } finally {
      setSaving(false);
    }
  }, [draftOrder, enabled, poolIds]);

  const discard = useCallback(() => {
    setEnabled(savedEnabled);
    setDraftOrder(savedOrder);
  }, [savedEnabled, savedOrder]);

  if (!ready || !poolReady) {
    return (
      <div className="rounded-card bg-surface px-5 py-8 ring-1 ring-line">
        <p className="text-[13px] text-muted">Loading cascade preferences…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-card bg-surface px-5 py-5 ring-1 ring-line">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <h2 className="text-[15px] font-semibold text-ink">Cascade — ordered failover</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Reorder your Browse Models pool as a fallback chain. When enabled, generate tries the
              agent&apos;s primary, then this list, then the agent secondary (duplicates skipped). This
              is not Micro → Hybrid → escalate staging — that router is not shipped.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {enabled ? (
              <StatusPill tone="success">On</StatusPill>
            ) : (
              <StatusPill tone="muted">Off</StatusPill>
            )}
            <Toggle label="Enable cascade failover" checked={enabled} onChange={setEnabled} />
          </div>
        </div>

        {poolIds.length === 0 ? (
          <div className="mt-5 rounded-lg bg-bg px-4 py-4 ring-1 ring-line">
            <p className="text-[13px] text-muted">
              No models in the assignment pool yet. Multi-select models under Browse Models, save the
              pool, then return here to set failover order.
            </p>
            {onGoBrowse && (
              <button
                type="button"
                onClick={onGoBrowse}
                className="mt-3 text-[12px] font-medium text-accent-ink hover:underline"
              >
                Open Browse Models
              </button>
            )}
          </div>
        ) : (
          <ol
            className="mt-5 divide-y divide-line rounded-lg bg-bg ring-1 ring-line"
            aria-label="Failover order"
          >
            {draftOrder.map((id, index) => (
              <li key={id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-7 shrink-0 text-center text-[12px] font-medium text-faint">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{modelLabel(id)}</div>
                  <div className="truncate text-[11px] text-muted">{id}</div>
                </div>
                {index === 0 && <StatusPill tone="success">1st failover</StatusPill>}
                {index === 1 && draftOrder.length > 1 && <StatusPill tone="muted">2nd</StatusPill>}
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    aria-label={`Move ${modelLabel(id)} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded p-1 text-muted hover:bg-overlay/10 hover:text-ink disabled:opacity-30"
                  >
                    <ChevronUpIcon size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${modelLabel(id)} down`}
                    disabled={index === draftOrder.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded p-1 text-muted hover:bg-overlay/10 hover:text-ink disabled:opacity-30"
                  >
                    <ChevronDownIcon size={14} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!dirty || saving || (enabled && poolIds.length === 0)}
            onClick={() => void save()}
            className="rounded-lg bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save cascade'}
          </button>
          {dirty && (
            <button
              type="button"
              disabled={saving}
              onClick={discard}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted ring-1 ring-line hover:text-ink disabled:opacity-50"
            >
              Discard
            </button>
          )}
          {!dirty && savedEnabled && (
            <span className="text-[12px] text-success">Saved — used by generate when enabled.</span>
          )}
        </div>
      </div>
    </div>
  );
}
