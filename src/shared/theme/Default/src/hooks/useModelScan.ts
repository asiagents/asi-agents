import { useCallback, useEffect, useState } from 'react';
import { api, type ModelCard, type ModelsScanMeta } from '@asi-api';
import { nowTime } from '../utils/time';
import { isCatalogReference, isScannedModel } from '../utils/modelScanBridge';

type ScanState = {
  models: ModelCard[];
  scanMeta: ModelsScanMeta | null;
  /** Artifacts on disk under models/router/ — not process liveness. */
  routerReady: boolean;
  /** True only when health/probe says :7821 is live. */
  routerLive: boolean;
  scannedAt: string | null;
  loading: boolean;
  unreachable: boolean;
  selectedModelId: string | null;
};

const empty: ScanState = {
  models: [],
  scanMeta: null,
  routerReady: false,
  routerLive: false,
  scannedAt: null,
  loading: true,
  unreachable: false,
  selectedModelId: null,
};

/** Live GET /api/models scan — fail-closed empty when unreachable. */
export function useModelScan() {
  const [scan, setScan] = useState<ScanState>(empty);

  const runScan = useCallback(async () => {
    setScan((prev) => ({ ...prev, loading: true }));
    const payload = await api.scanModels();
    let selectedModelId: string | null = null;
    if (payload.ok) {
      try {
        const sel = await api.modelsSelection();
        selectedModelId = sel.selectedModelId;
      } catch {
        /* selection optional */
      }
    }
    const meta = payload.ok ? payload.meta ?? null : null;
    setScan({
      models: payload.models,
      scanMeta: meta,
      routerReady: Boolean(meta?.routerReady),
      routerLive: Boolean(meta?.routerLive),
      scannedAt: nowTime(),
      loading: false,
      unreachable: !payload.ok,
      selectedModelId,
    });
  }, []);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  useEffect(() => {
    if (!scan.unreachable) return;
    const id = window.setInterval(() => void runScan(), 15_000);
    return () => window.clearInterval(id);
  }, [scan.unreachable, runScan]);

  const scanned = scan.models.filter(isScannedModel);
  const catalogFromScan = scan.models.filter(isCatalogReference);

  const selectModel = useCallback(async (modelId: string) => {
    try {
      const { selectedModelId } = await api.patchModelsSelection({ selectedModelId: modelId });
      setScan((prev) => ({ ...prev, selectedModelId }));
    } catch {
      /* offline — keep local highlight only */
      setScan((prev) => ({ ...prev, selectedModelId: modelId }));
    }
  }, []);

  return { ...scan, scanned, catalogFromScan, runScan, selectModel };
}
