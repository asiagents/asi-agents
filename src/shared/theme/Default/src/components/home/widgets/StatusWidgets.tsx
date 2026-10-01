import { useAgents } from '../../../contexts/AgentsContext';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, ShieldAlertIcon, SparklesIcon } from 'lucide-react';
import { AgentAvatar, statusDot } from '../../AgentAvatar';
import { ModelChip } from '../../ModelChip';
import { LocalBackendAlertBanner } from '../../LocalBackendAlertBanner';
import { primaryThreads } from '../../../data/chatThreads';
import { useDesk } from '../../../contexts/DeskContext';
import { useProfile } from '../../../contexts/ProfileContext';
import { useAgentTokenUsage } from '../../../hooks/useAgentTokenUsage';
import { useLocalBackendAlert } from '../../../hooks/useLocalBackendAlert';
import { useSelectedModelPool } from '../../../hooks/useSelectedModelPool';
import { availabilityCountsFromScanMeta } from '../../../utils/modelScanStatus';
import { getModel } from '../../../utils/lookup';
import { modelParamsRam } from '../../../utils/modelParamsRam';
import { api } from '@asi-api';
import type { ModelId } from '../../../types/models';
import type { WidgetSize } from '../../../types/settings';

export function AgentsWidget({ size }: {size: WidgetSize;}) {
  const agents = useAgents();
  const { pausedAt } = useDesk();
  const { slice } = useProfile();
  const favSet = new Set(slice.favoriteAgentIds);
  const ordered = [...agents].sort((a, b) => {
    const af = favSet.has(a.id) ? 0 : 1;
    const bf = favSet.has(b.id) ? 0 : 1;
    return af - bf;
  });
  const working = agents.filter((a) => a.status === 'active' || a.status === 'waiting').length;
  const idle = agents.filter((a) => a.status === 'idle').length;
  const offline = agents.filter((a) => a.status === 'offline').length;
  const shown = size === 'L' ? ordered : ordered.slice(0, 6);

  if (agents.length === 0) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-sm font-medium text-ink">No agents yet</p>
        <p className="mt-1 text-[12px] text-muted">Roster loads from the on-disk registry. Open Agents to add or scan.</p>
        <Link to="/agents" className="mt-3 text-[12px] font-medium text-accent-ink hover:underline">Open Agents →</Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-baseline gap-4">
        <span className="text-3xl font-semibold tabular-nums text-ink">{pausedAt ? 0 : working}</span>
        <span className="text-[13px] text-muted">{pausedAt ? 'paused' : 'working'} · {idle} idle · <span className="text-danger">{offline} offline</span></span>
      </div>
      <ul className={`mt-3 grid min-h-0 flex-1 content-start gap-2 ${size === 'L' ? 'grid-cols-4' : 'grid-cols-6'}`}>
        {shown.map((a) =>
        <li key={a.id}>
            <Link to={`/chat/${a.id}`} className="flex flex-col items-center gap-1 rounded-lg p-1 transition-colors duration-150 hover:bg-overlay/[0.04]" title={`${a.name} · ${a.currentTask}`}>
              <AgentAvatar agent={a} size={size === 'L' ? 'lg' : 'md'} />
              {size === 'L' &&
            <span className="flex max-w-full items-center gap-1 text-[11px] text-ink">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[a.status]}`} aria-hidden="true" />
                  <span className="truncate">{a.name}</span>
                </span>
            }
            </Link>
          </li>
        )}
      </ul>
    </>);

}

export function ApprovalsWidget({ size }: {size: WidgetSize;}) {
  const { approvals } = useDesk();
  const open = approvals.filter((a) => a.state === 'open');
  return (
    <>
      <div className="flex items-center gap-2">
        <span className={`text-3xl font-semibold tabular-nums ${open.length ? 'text-warn' : 'text-ink'}`}>{open.length}</span>
        <ShieldAlertIcon size={18} className={open.length ? 'text-warn' : 'text-faint'} aria-hidden="true" />
      </div>
      <p className="text-[12px] text-muted">{open.length ? 'waiting inline in chat' : 'Nothing to approve'}</p>
      {size === 'M' &&
      <ul className="mt-2 space-y-1">
          {open.slice(0, 2).map((a) =>
        <li key={a.id}>
              <Link to={`/chat/${a.threadId}`} className="block truncate text-[13px] text-ink hover:text-accent-ink">{a.title}</Link>
            </li>
        )}
        </ul>
      }
      {open[0] && size === 'S' &&
      <Link to={`/chat/${open[0].threadId}`} className="mt-auto text-[12px] font-medium text-accent-ink hover:underline">Review</Link>
      }
    </>);

}

export function NextUpWidget({ size }: {size: WidgetSize;}) {
  const { approvals } = useDesk();
  const first = approvals.find((a) => a.state === 'open');
  const fallback = primaryThreads[0].nextUp;
  const label = first ? first.title : fallback?.label ?? 'Nothing queued';
  const detail = first ? 'Approval in chat' : fallback?.detail ?? '';
  const to = first ? `/chat/${first.threadId}` : fallback?.to ?? '/';

  return (
    <Link to={to} className="-m-1 flex flex-1 flex-col rounded-xl p-1 transition-colors duration-150 hover:bg-accent/[0.05]">
      <SparklesIcon size={16} className="text-accent-ink" aria-hidden="true" />
      <p className={`mt-2 font-semibold leading-snug text-ink ${size === 'S' ? 'line-clamp-3 text-[13px]' : 'line-clamp-2 text-[15px]'}`}>{label}</p>
      {size === 'M' && <p className="mt-0.5 text-[12px] text-muted">{detail}</p>}
      <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-medium text-accent-ink">
        Open <ArrowRightIcon size={12} aria-hidden="true" />
      </span>
    </Link>);

}

/** Honest status from /health (:3445) + SLM router probe (:7821) + scan API-key probes. */
function modelStatusParts(args: {
  serverHealth: 'live' | 'offline' | 'error' | 'checking';
  routerStatus: 'live' | 'off' | 'unknown';
  routerOffline: boolean;
  localOn: boolean;
  unreachable: boolean;
  cloudKeyIds: string[];
  /** True when model scan probes returned usable meta (Local/Online counts). */
  scanOk: boolean;
}): { label: string; cls: string; dot: string } {
  const { serverHealth, routerStatus, routerOffline, localOn, unreachable, cloudKeyIds, scanOk } = args;
  if (serverHealth === 'checking' && !scanOk) {
    return { label: 'Checking…', cls: 'text-muted', dot: 'bg-warn' };
  }
  // Scans proving :3445 answers outrank a flaky /health — never contradict Local/Online counts.
  if (!scanOk && (serverHealth === 'offline' || unreachable)) {
    return { label: 'Server offline', cls: 'text-danger', dot: 'bg-danger' };
  }
  if (!scanOk && serverHealth === 'error') {
    return { label: 'Server error', cls: 'text-danger', dot: 'bg-danger' };
  }

  const slmLive = !routerOffline && localOn && routerStatus === 'live';
  const cloudPart =
    cloudKeyIds.length > 0
      ? cloudKeyIds.includes('openrouter')
        ? 'OpenRouter keys ready'
        : 'Cloud keys ready'
      : 'Server :3445 up';
  const routerPart = slmLive ? 'SLM router :7821 live' : 'SLM router :7821 off';
  return {
    label: `${cloudPart} · ${routerPart}`,
    cls: slmLive ? 'text-success' : 'text-warn',
    dot: slmLive ? 'bg-success' : 'bg-warn',
  };
}

export function ModelWidget() {
  const { routerOffline, localOn } = useDesk();
  const { alert: localBackendAlert, scanMeta, unreachable, loading, scannedAt, models } = useLocalBackendAlert();
  const { ids: preselectedIds, ready: poolReady } = useSelectedModelPool();
  const counts = availabilityCountsFromScanMeta(scanMeta);
  const [serverHealth, setServerHealth] = useState<'live' | 'offline' | 'error' | 'checking'>('checking');
  const [routerStatus, setRouterStatus] = useState<'live' | 'off' | 'unknown'>('unknown');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      setServerHealth('checking');
      const t0 = performance.now();
      try {
        const h = (await api.health()) as {
          ok?: boolean;
          router?: { status?: string };
        };
        const ms = Math.round(performance.now() - t0);
        if (cancelled) return;
        setLatencyMs(ms);
        if (h?.ok === false) setServerHealth('error');
        else setServerHealth('live');
        setRouterStatus(h?.router?.status === 'live' ? 'live' : 'off');
      } catch {
        if (!cancelled) {
          setLatencyMs(null);
          setServerHealth('offline');
          setRouterStatus('unknown');
        }
      }
    };
    void ping();
    const id = window.setInterval(ping, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const cloudKeyIds = scanMeta?.probes?.api?.configuredProviderIds ?? [];
  const scanOk = Boolean(scanMeta?.probes) && !unreachable;
  const { label: statusLabel, cls: statusCls, dot } = modelStatusParts({
    serverHealth,
    routerStatus,
    routerOffline,
    localOn,
    unreachable,
    cloudKeyIds,
    scanOk,
  });

  const preselected = poolReady ? preselectedIds.length : null;
  const topPool = poolReady ? preselectedIds.slice(0, 5) : [];
  const moreCount = poolReady ? Math.max(0, preselectedIds.length - topPool.length) : 0;
  const countsLine = loading
    ? 'Scanning…'
    : counts
      ? `Local ${counts.local} · Online ${counts.online}`
      : 'Local — · Online —';

  const byId = useMemo(() => {
    const map = new Map<string, (typeof models)[number]>();
    for (const m of models ?? []) map.set(m.id, m);
    return map;
  }, [models]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
        <span className={`text-[13px] font-semibold ${statusCls}`}>{statusLabel}</span>
      </div>
      {routerOffline || !localOn ? (
        <ModelChip id="offline" size="xs" />
      ) : poolReady && topPool.length > 0 ? (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          <li className="flex gap-2 text-[10px] font-medium uppercase tracking-wide text-faint">
            <span className="min-w-0 flex-1">Model</span>
            <span className="w-14 shrink-0 text-right">Usage</span>
            <span className="w-24 shrink-0 text-right">RAM</span>
          </li>
          {topPool.map((id) => {
            const card = byId.get(id);
            const info = getModel(id as ModelId);
            const paramsRam = modelParamsRam(
              card ?? {
                id,
                name: info.name,
                source: 'pool',
                meta: info.note ?? '',
                tags: info.tier === 'cloud' ? ['api'] : [],
                paid: false,
                kind: info.tier === 'cloud' ? 'api' : 'catalog',
                params: undefined,
                ramHint: undefined,
              }
            );
            const usage = paramsRam.paramsKnown ? paramsRam.params : '—';
            const ram =
              paramsRam.ramKnown || paramsRam.ramImpact.includes('cloud')
                ? paramsRam.ramImpact
                : '—';
            return (
              <li key={id} className="flex items-baseline gap-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate font-medium text-ink" title={info.name}>
                  {info.name}
                </span>
                <span className="w-14 shrink-0 text-right tabular-nums text-muted" title="Params / size">
                  {usage}
                </span>
                <span
                  className="w-24 shrink-0 truncate text-right text-[11px] text-muted"
                  title={ram}
                >
                  {ram}
                </span>
              </li>
            );
          })}
          {moreCount > 0 ? (
            <li className="text-[11px] text-muted">+{moreCount} more in saved pool</li>
          ) : null}
        </ul>
      ) : poolReady ? (
        <p className="text-[12px] text-muted">No saved Browse pool yet — open Models → Browse, check models, Save.</p>
      ) : (
        <p className="text-[12px] text-muted">Loading saved pool…</p>
      )}
      <p className="shrink-0 text-[12px] text-muted">
        {latencyMs != null ? `${latencyMs} ms · ` : ''}
        {countsLine}
        {scannedAt ? ` · ${scannedAt}` : ''}
      </p>
      <LocalBackendAlertBanner alert={localBackendAlert} compact />
      <p className="shrink-0 text-[12px] text-muted">
        {preselected == null ? (
          'Saved pool …'
        ) : preselected === 0 ? (
          <>
            Saved pool 0 ·{' '}
            <Link to="/settings/models" className="font-medium text-accent-ink hover:underline">
              Browse
            </Link>
          </>
        ) : (
          <>
            Saved pool {preselected}
            {moreCount > 0 ? ' · showing top 5' : ''} ·{' '}
            <Link to="/settings/models" className="font-medium text-accent-ink hover:underline">
              Models
            </Link>
          </>
        )}
      </p>
      <p className="shrink-0 text-[11px] text-faint">
        {unreachable
          ? 'Models API unreachable — fail-closed.'
          : 'Usage = params when known · RAM from modelParamsRam / scan (planning estimate).'}
      </p>
    </div>
  );
}

export function SpendWidget({ size }: {size: WidgetSize;}) {
  const agents = useAgents();
  const { rows: tokenRows, loading: tokensLoading } = useAgentTokenUsage();
  const ranked = [...agents]
    .sort((a, b) => {
      const tb = tokenRows[b.id];
      const ta = tokenRows[a.id];
      if (tb != null || ta != null) return (tb ?? -1) - (ta ?? -1);
      return b.cloudUsed - a.cloudUsed;
    })
    .slice(0, size === 'L' ? 8 : 4);
  const totalSpend = agents.reduce((s, a) => s + a.cloudUsed, 0);
  const tokenVals = Object.values(tokenRows).filter((v): v is number => v != null);
  const totalTokens = tokenVals.length ? tokenVals.reduce((s, n) => s + n, 0) : null;

  return (
    <>
      <p className="text-[13px] text-muted">
        <span className="text-xl font-semibold tabular-nums text-ink">${totalSpend.toFixed(2)}</span> cloud
        {totalTokens != null ? (
          <>
            {' · '}
            <span className="font-semibold tabular-nums text-ink">{totalTokens.toLocaleString()}</span> tokens
          </>
        ) : (
          <span className="text-faint"> · tokens —</span>
        )}
      </p>
      <div className="mt-1 flex text-[10px] font-medium uppercase tracking-wide text-faint">
        <span className="flex-1">Agent</span>
        <span className="w-16 text-right">Spend</span>
        <span className="w-16 text-right">Tokens</span>
      </div>
      <ol className="mt-1 space-y-1.5">
        {ranked.map((a) => {
          const tok = tokenRows[a.id];
          return (
            <li key={a.id} className="flex items-center gap-2 text-[13px]">
              <AgentAvatar agent={a} size="xs" />
              <span className="min-w-0 flex-1 truncate text-ink">{a.name}</span>
              <span className="w-16 text-right tabular-nums text-muted">${a.cloudUsed.toFixed(2)}</span>
              <span className="w-16 text-right tabular-nums text-muted">
                {tokensLoading ? '…' : tok != null ? tok.toLocaleString() : '—'}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-faint">Tokens from chat meta only — empty until real usage exists.</p>
    </>
  );
}