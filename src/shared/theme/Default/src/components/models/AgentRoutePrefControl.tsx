import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@asi-api';
import { SettingsSection } from '../settings/SettingsUI';

const selectCls = 'mt-1 h-9 w-full max-w-md rounded-lg bg-bg px-2 text-[13px] text-ink ring-1 ring-line';

const ROUTE_KIND = [
  { value: 'local', label: 'Local first (router → llama.cpp/Ollama → cloud keys)' },
  { value: 'cloud', label: 'Cloud first (provider keys → local stack)' },
  { value: 'provider', label: 'Pinned provider:model (requires key)' },
] as const;

type RouteKind = (typeof ROUTE_KIND)[number]['value'];

function splitRoutePref(token: string | null | undefined): { kind: RouteKind; providerModel: string } {
  const t = (token ?? 'local').trim();
  if (t === 'cloud') return { kind: 'cloud', providerModel: '' };
  if (t === 'local' || !t) return { kind: 'local', providerModel: '' };
  if (t.includes(':')) return { kind: 'provider', providerModel: t };
  return { kind: 'local', providerModel: '' };
}

function routePrefLabel(token: string, source?: string): string {
  const base =
    token === 'local'
      ? 'Local first'
      : token === 'cloud'
        ? 'Cloud first'
        : `Provider ${token}`;
  if (!source || source === 'default') return `${base} (default)`;
  if (source === 'registry') return `${base} (registry default)`;
  return `${base} (saved override)`;
}

type Props = {
  agentId: string;
  agentName: string;
  /** Effective route from GET thread or resolved client-side. */
  initialRoutePref?: string;
  routeSource?: 'override' | 'registry' | 'default';
  compact?: boolean;
};

/** Persisted via PATCH /api/agents/:id/models `{ routePref }` or bulk GET/PUT /api/agents/routing. */
export function AgentRoutePrefControl({
  agentId,
  agentName,
  initialRoutePref = 'local',
  routeSource = 'default',
  compact = false,
}: Props) {
  const initial = splitRoutePref(initialRoutePref);
  const [kind, setKind] = useState<RouteKind>(initial.kind);
  const [providerModel, setProviderModel] = useState(initial.providerModel);
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToken, setSavedToken] = useState(initialRoutePref);

  useEffect(() => {
    let cancelled = false;
    api
      .providerKeys()
      .then(({ keys }) => {
        if (cancelled) return;
        setConfiguredProviders(Object.entries(keys).filter(([, v]) => v.configured).map(([id]) => id));
      })
      .catch(() => {
        /* offline — provider pin still editable as text */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const providerOptions = useMemo(() => {
    const opts: string[] = [];
    for (const pid of configuredProviders) {
      const upstream = pid === 'openrouter' ? 'openrouter/auto' : `${pid}:default`;
      opts.push(`${pid}:${upstream.split(':').slice(1).join(':') || 'model'}`);
    }
    return opts;
  }, [configuredProviders]);

  const persist = async (token: string | null) => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.patchAgentModels(agentId, { routePref: token });
      const effective = res.routePref ?? 'local';
      setSavedToken(effective);
      const split = splitRoutePref(effective);
      setKind(split.kind);
      setProviderModel(split.providerModel);
    } catch {
      setError('Could not save route — is the ASI server running?');
    } finally {
      setSaving(false);
    }
  };

  const onKindChange = (next: RouteKind) => {
    setKind(next);
    if (next === 'local') void persist('local');
    else if (next === 'cloud') void persist('cloud');
    else if (!providerModel && providerOptions[0]) {
      setProviderModel(providerOptions[0]);
      void persist(providerOptions[0]);
    }
  };

  const body = (
    <>
      <p className="text-[12px] text-muted">
        {routePrefLabel(savedToken, routeSource)} — applies to {agentName} chat via shared{' '}
        <code className="text-[11px]">resolveAgentRoute</code> on the server.
      </p>
      {error && <p className="mt-2 text-[13px] text-warn">{error}</p>}
      <label className="mt-3 block max-w-md">
        <span className="text-[12px] font-medium text-muted">Generate route</span>
        <select
          className={selectCls}
          value={kind}
          disabled={saving}
          onChange={(e) => onKindChange(e.target.value as RouteKind)}
        >
          {ROUTE_KIND.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {kind === 'provider' && (
        <label className="mt-3 block max-w-md">
          <span className="text-[12px] font-medium text-muted">Provider:model</span>
          {providerOptions.length > 0 ? (
            <select
              className={selectCls}
              value={providerModel}
              disabled={saving}
              onChange={(e) => {
                setProviderModel(e.target.value);
                void persist(e.target.value);
              }}
            >
              {providerOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={selectCls}
              value={providerModel}
              placeholder="openrouter:openrouter/auto"
              disabled={saving}
              onChange={(e) => setProviderModel(e.target.value)}
              onBlur={() => {
                const v = providerModel.trim();
                if (v.includes(':')) void persist(v);
                else setError('Use provider:model (e.g. groq:llama-3.1-8b-instant)');
              }}
            />
          )}
          {configuredProviders.length === 0 && (
            <p className="mt-1 text-[11px] text-faint">No provider keys yet — add keys under Settings → Connections.</p>
          )}
        </label>
      )}
    </>
  );

  if (compact) return <div className="space-y-1">{body}</div>;

  return (
    <SettingsSection
      title="Generate route"
      description="Local-first is default. Cloud-first or a pinned provider:model only works when keys or local backends are actually configured — no fake routes."
    >
      {body}
    </SettingsSection>
  );
}
