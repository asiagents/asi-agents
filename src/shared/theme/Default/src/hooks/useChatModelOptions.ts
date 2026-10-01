import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type ModelCard } from '@asi-api';
import { models as staticModels } from '../data/models';
import { usePrefs } from '../contexts/PrefsContext';
import type { ModelId } from '../types/models';
import { isNonChatAssignableModel } from '../utils/assignmentModelOptions';

export type ModelHealth = 'live' | 'offline' | 'needs_key';

export type ChatModelOption = {
  id: ModelId;
  name: string;
  note: string;
  health: ModelHealth;
  group: 'router' | 'local' | 'cloud';
  selectable: boolean;
};

type State = {
  loading: boolean;
  routerLive: boolean;
  scanned: ModelCard[];
  apiCards: ModelCard[];
};

const empty: State = { loading: true, routerLive: false, scanned: [], apiCards: [] };

function hasConfiguredCloudKey(status: Record<string, { configured?: boolean }>): boolean {
  return Object.values(status).some((s) => s.configured);
}

/** Live-backed chat model list — no decorative Local/Online lanes. */
export function useChatModelOptions() {
  const { providerKeyStatus } = usePrefs();
  const [state, setState] = useState<State>(empty);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    let routerLive = false;
    let scanned: ModelCard[] = [];
    let apiCards: ModelCard[] = [];
    try {
      const health = await api.health();
      routerLive = health.router?.status === 'live';
    } catch {
      routerLive = false;
    }
    const payload = await api.scanModels();
    if (payload.ok) {
      for (const m of payload.models) {
        if (m.kind === 'api') apiCards.push(m);
        else if (m.kind === 'scanned') scanned.push(m);
      }
      if (!routerLive && payload.meta?.routerReady) {
        /* artifacts on disk ≠ live probe */
      }
    }
    setState({ loading: false, routerLive, scanned, apiCards });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cloudKeyReady = hasConfiguredCloudKey(providerKeyStatus);

  const options = useMemo((): ChatModelOption[] => {
    const out: ChatModelOption[] = [];
    const routerSlots = ['micro', 'hybrid', 'agentchat'] as const;
    for (const id of routerSlots) {
      const meta = staticModels.find((m) => m.id === id)!;
      const live = state.routerLive;
      out.push({
        id,
        name: meta.name,
        note: live
          ? 'SLM router @ :7821 — classifier / small completions when wired'
          : 'Router offline — npm run start:router (or set ASI_ROUTER_URL)',
        health: live ? 'live' : 'offline',
        group: 'router',
        selectable: live,
      });
    }

    for (const card of state.scanned) {
      const id = card.id as ModelId;
      if (isNonChatAssignableModel(id, card.name, card.tags ?? [])) continue;
      const ultraJunk = id === 'ultra' || /ultra/i.test(card.name);
      if (ultraJunk && card.source !== 'drop-in') continue;
      out.push({
        id,
        name: card.name,
        note: card.meta,
        health: 'live',
        group: 'local',
        selectable: true,
      });
    }

    const cloudUi = ['chat1b', 'chat3b', 'cloud'] as const;
    for (const id of cloudUi) {
      const meta = staticModels.find((m) => m.id === id)!;
      out.push({
        id,
        name: meta.name,
        note: cloudKeyReady
          ? meta.note
          : 'Needs an API key — Settings → Connections',
        health: cloudKeyReady ? 'live' : 'needs_key',
        group: 'cloud',
        selectable: cloudKeyReady,
      });
    }

    for (const card of state.apiCards) {
      if (isNonChatAssignableModel(card.id, card.name, card.tags ?? [])) continue;
      out.push({
        id: card.id as ModelId,
        name: card.name,
        note: card.meta,
        health: 'live',
        group: 'cloud',
        selectable: true,
      });
    }

    return out;
  }, [state.routerLive, state.scanned, state.apiCards, cloudKeyReady]);

  const defaultSelectable = useMemo(
    () => options.find((o) => o.selectable)?.id ?? ('micro' as ModelId),
    [options]
  );

  return { options, loading: state.loading, refresh, routerLive: state.routerLive, cloudKeyReady, defaultSelectable };
}
