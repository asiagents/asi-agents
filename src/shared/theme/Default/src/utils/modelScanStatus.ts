import type { ModelsScanMeta } from '@asi-api';

export type ScanStatusLine = { label: string; detail: string; tone: 'ok' | 'warn' | 'muted' };

export type ModelAvailabilityCounts = {
  /** Ollama tags + llama.cpp + custom GGUF + AMS installed GGUF/ONNX (not catalog recipes). */
  local: number;
  /** Cloud API / OpenRouter models listed with configured keys. */
  online: number;
};

/**
 * Honest runnable/local + API listed counts from scan probes.
 * Excludes AMS recipe-only catalog rows (no weights).
 */
export function availabilityCountsFromScanMeta(
  meta: ModelsScanMeta | null | undefined
): ModelAvailabilityCounts | null {
  if (!meta?.probes) return null;
  const { ollama, llamacpp, customGguf, api, ams } = meta.probes;
  const local =
    (ollama.count ?? 0) +
    (llamacpp.count ?? 0) +
    (customGguf ?? 0) +
    (ams?.installedGguf ?? 0) +
    (ams?.installedOnnx ?? 0);
  return { local, online: api.totalCount ?? 0 };
}

/** Actionable probe summary from GET /api/models meta (honest — no fake rows). */
export function scanStatusLines(meta: ModelsScanMeta | null | undefined): ScanStatusLine[] {
  if (!meta?.probes) return [];

  const lines: ScanStatusLine[] = [];
  const { ollama, llamacpp, customGguf, api } = meta.probes;

  if (meta.routerLive) {
    lines.push({
      label: 'Router',
      detail: 'Live @ :7821',
      tone: 'ok',
    });
  } else if (meta.routerReady) {
    lines.push({
      label: 'Router',
      detail: 'Off (artifacts on disk) — npm run start:router',
      tone: 'warn',
    });
  } else {
    lines.push({
      label: 'Router',
      detail: 'Off — no models/router artifacts',
      tone: 'muted',
    });
  }

  if (ollama.count > 0) {
    lines.push({
      label: 'Ollama',
      detail: `${ollama.count} tag(s) @ ${ollama.host}`,
      tone: 'ok',
    });
  } else if (ollama.reachable) {
    lines.push({
      label: 'Ollama',
      detail: `Running @ ${ollama.host} — no models pulled`,
      tone: 'warn',
    });
  } else {
    lines.push({
      label: 'Ollama',
      detail: `Not reachable @ ${ollama.host}${ollama.error ? ` (${ollama.error})` : ''}`,
      tone: 'warn',
    });
  }

  if (!llamacpp.configured) {
    lines.push({
      label: 'llama.cpp',
      detail: 'Not configured',
      tone: 'muted',
    });
  } else if (llamacpp.count > 0) {
    lines.push({
      label: 'llama.cpp',
      detail: `${llamacpp.count} model(s) @ ${llamacpp.base}`,
      tone: 'ok',
    });
  } else if (llamacpp.reachable) {
    lines.push({
      label: 'llama.cpp',
      detail: `Up @ ${llamacpp.base} — no models`,
      tone: 'warn',
    });
  } else {
    lines.push({
      label: 'llama.cpp',
      detail: `Unreachable @ ${llamacpp.base}${llamacpp.error ? ` (${llamacpp.error})` : ''}`,
      tone: 'warn',
    });
  }

  if (customGguf > 0) {
    lines.push({
      label: 'GGUF',
      detail: `${customGguf} file(s) in models/custom`,
      tone: 'ok',
    });
  } else {
    lines.push({
      label: 'GGUF',
      detail: 'No .gguf in models/custom',
      tone: 'muted',
    });
  }

  const ams = meta.probes.ams;
  if (ams) {
    const weights = (ams.installedGguf ?? 0) + (ams.installedOnnx ?? 0);
    if (weights > 0) {
      const bits = [
        ams.installedGguf > 0 ? `${ams.installedGguf} GGUF` : null,
        (ams.installedOnnx ?? 0) > 0 ? `${ams.installedOnnx} ONNX` : null,
      ].filter(Boolean);
      lines.push({
        label: 'AMS',
        detail: `${bits.join(' + ')} in models/ams · ${ams.catalogShown} recipe(s) still missing`,
        tone: 'ok',
      });
    } else if (ams.catalogShown > 0) {
      lines.push({
        label: 'AMS',
        detail: `${ams.catalogShown} recipe(s) in models/ams — no weights on disk`,
        tone: 'muted',
      });
    } else if (ams.catalogTotal > 0) {
      lines.push({
        label: 'AMS',
        detail: 'Catalog present — weights matched under models/ams or custom',
        tone: 'ok',
      });
    }
  }

  if (api.configuredProviderIds.length > 0) {
    const listed = api.totalCount;
    const ids = api.configuredProviderIds.join(', ');
    lines.push({
      label: 'API keys',
      detail: listed > 0 ? `${listed} model(s) for ${ids}` : `Keys for ${ids} — list empty or failed`,
      tone: listed > 0 ? 'ok' : 'warn',
    });
  } else {
    lines.push({
      label: 'API keys',
      detail: 'None configured',
      tone: 'muted',
    });
  }

  return lines;
}
