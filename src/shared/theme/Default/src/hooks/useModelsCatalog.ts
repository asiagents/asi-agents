import { useCallback, useEffect, useState } from 'react';
import { api, type ModelsCatalogResponse } from '@asi-api';
import type { BrowseFilterId } from '../utils/modelBrowseFilters';

const PAGE = 50;

export type CapabilityFilter =
  | 'vision'
  | 'documents'
  | 'pdf'
  | 'spreadsheet'
  | 'tools'
  | 'code'
  | 'reasoning'
  | 'embed';

type State = {
  payload: ModelsCatalogResponse | null;
  loading: boolean;
  error: string | null;
  q: string;
  caps: CapabilityFilter[];
  browse: BrowseFilterId[];
  offset: number;
};

const emptyPayload: ModelsCatalogResponse = {
  source: 'curated',
  label: 'Curated reference',
  fetchedAt: '',
  total: 0,
  limit: 0,
  models: [],
};

export function useModelsCatalog() {
  const [state, setState] = useState<State>({
    payload: null,
    loading: true,
    error: null,
    q: '',
    caps: [],
    browse: [],
    offset: 0,
  });

  const load = useCallback(async (q: string, caps: CapabilityFilter[], browse: BrowseFilterId[], offset: number) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const payload = await api.modelsCatalog({
        q: q.trim() || undefined,
        capabilities: caps.length ? caps : undefined,
        browse: browse.length ? browse : undefined,
        offset,
        limit: PAGE,
      });
      setState((prev) => ({ ...prev, payload, loading: false, q, caps, browse, offset }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'catalog unreachable';
      setState((prev) => ({
        ...prev,
        payload: { ...emptyPayload, error: msg },
        loading: false,
        error: msg,
        q,
        caps,
        browse,
        offset,
      }));
    }
  }, []);

  useEffect(() => {
    void load(state.q, state.caps, state.browse, state.offset);
  }, [load, state.q, state.caps, state.browse, state.offset]);

  const setQuery = useCallback((q: string) => {
    setState((prev) => ({ ...prev, q, offset: 0 }));
  }, []);

  const toggleCap = useCallback((cap: CapabilityFilter) => {
    setState((prev) => {
      const caps = prev.caps.includes(cap) ? prev.caps.filter((c) => c !== cap) : [...prev.caps, cap];
      return { ...prev, caps, offset: 0 };
    });
  }, []);

  const toggleBrowse = useCallback((id: BrowseFilterId) => {
    setState((prev) => {
      const browse = prev.browse.includes(id) ? prev.browse.filter((b) => b !== id) : [...prev.browse, id];
      return { ...prev, browse, offset: 0 };
    });
  }, []);

  const nextPage = useCallback(() => {
    setState((prev) => ({ ...prev, offset: prev.offset + PAGE }));
  }, []);

  const prevPage = useCallback(() => {
    setState((prev) => ({ ...prev, offset: Math.max(0, prev.offset - PAGE) }));
  }, []);

  const refresh = useCallback(() => {
    void load(state.q, state.caps, state.browse, state.offset);
  }, [load, state.q, state.caps, state.browse, state.offset]);

  const payload = state.payload ?? emptyPayload;
  const hasMore = state.offset + payload.models.length < payload.total;

  return {
    ...state,
    payload,
    hasMore,
    pageSize: PAGE,
    setQuery,
    toggleCap,
    toggleBrowse,
    browse: state.browse,
    nextPage,
    prevPage,
    refresh,
  };
}
