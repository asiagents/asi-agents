import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@asi-api';
import { readJson, STORAGE_KEYS, writeJson } from '../utils/storage';

function normalizeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * Browse Models multi-select pool for Agent assignments.
 * Distinct from desk default `selectedModelId` — allows many ids.
 *
 * Checkboxes edit a local draft; **Save selection** writes `selectedModelPool`
 * via `/api/models/selection` (and localStorage). Agents / chat read `ids` (saved).
 */
export function useSelectedModelPool() {
  const cached = () => normalizeIds(readJson<string[]>(STORAGE_KEYS.selectedModelPool, []));
  const [savedIds, setSavedIds] = useState<string[]>(cached);
  const [draftIds, setDraftIds] = useState<string[]>(cached);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .modelsSelection()
      .then((sel) => {
        if (cancelled) return;
        const next = normalizeIds(sel.selectedModelIds ?? []);
        setSavedIds(next);
        setDraftIds(next);
        writeJson(STORAGE_KEYS.selectedModelPool, next);
      })
      .catch(() => {
        /* keep local cache */
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => !sameIds(draftIds, savedIds), [draftIds, savedIds]);

  const toggle = useCallback((id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setDraftIds((prev) =>
      prev.includes(trimmed) ? prev.filter((x) => x !== trimmed) : [...prev, trimmed]
    );
  }, []);

  const persistSaved = useCallback(async (nextRaw: string[]) => {
    const next = normalizeIds(nextRaw);
    setSaving(true);
    setSavedIds(next);
    setDraftIds(next);
    writeJson(STORAGE_KEYS.selectedModelPool, next);
    try {
      await api.patchModelsSelection({ selectedModelIds: next });
    } catch {
      /* offline — local cache remains */
    } finally {
      setSaving(false);
    }
    return next;
  }, []);

  /** Persist current draft as the lasting assignment pool. Returns saved ids. */
  const save = useCallback(async () => {
    return persistSaved(draftIds);
  }, [draftIds, persistSaved]);

  /** Clear saved pool and draft (unsave). */
  const clear = useCallback(async () => {
    return persistSaved([]);
  }, [persistSaved]);

  /** Revert unchecked/checked draft back to last saved pool. */
  const discardDraft = useCallback(() => {
    setDraftIds(savedIds);
  }, [savedIds]);

  const has = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  /**
   * Persist one model into the saved pool immediately (same as check + Save for that id).
   * Preserves other unsaved draft toggles; only guarantees `id` is in both saved + draft.
   */
  const addOne = useCallback(
    async (id: string) => {
      const trimmed = id.trim();
      if (!trimmed) return savedIds;
      if (savedIds.includes(trimmed)) return savedIds;
      const next = normalizeIds([...savedIds, trimmed]);
      setSaving(true);
      setSavedIds(next);
      setDraftIds((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
      writeJson(STORAGE_KEYS.selectedModelPool, next);
      try {
        await api.patchModelsSelection({ selectedModelIds: next });
      } catch {
        /* offline — local cache remains */
      } finally {
        setSaving(false);
      }
      return next;
    },
    [savedIds]
  );

  return {
    /** Saved pool — Agent assignments & chat model picker. */
    ids: savedIds,
    /** Browse checkbox draft (may be unsaved). */
    draftIds,
    savedIds,
    ready,
    dirty,
    saving,
    toggle,
    save,
    clear,
    discardDraft,
    has,
    addOne,
    /** @deprecated Prefer save(); kept for rare callers that set both. */
    persist: persistSaved,
  };
}
