import { nowTime } from './time';
import type { HardwareInfo, NetState } from '../types/settings';

interface NavigatorExtras {
  deviceMemory?: number;
  connection?: {type?: string;};
}

/** Server payload from GET /api/hardware (usage fields optional for older servers). */
export type ServerHardwareSnapshot = {
  vramGb: number | null;
  ramGb: number;
  cpuThreads?: number | null;
  cpuPercent?: number | null;
  ramUsedGb?: number | null;
  ramUsedPct?: number | null;
  vramUsedGb?: number | null;
  vramUsedPct?: number | null;
  gpuPercent?: number | null;
};

/** Reads what the browser actually exposes. Values the browser hides stay null — never invented. */
export function readHardware(): HardwareInfo {
  const nav = navigator as Navigator & NavigatorExtras;
  let gpu: string | null = null;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    }
  } catch {
    gpu = null;
  }
  return {
    cores: nav.hardwareConcurrency || null,
    memoryGb: nav.deviceMemory ?? null,
    vramGb: null,
    gpu,
    cpuPercent: null,
    ramUsedGb: null,
    ramUsedPct: null,
    vramUsedGb: null,
    vramUsedPct: null,
    gpuPercent: null,
    scannedAt: nowTime()
  };
}

/** Merge OS probe from GET /api/hardware with browser-exposed CPU/GPU fields. */
export function applyServerHardware(
  browser: HardwareInfo,
  server: ServerHardwareSnapshot
): HardwareInfo {
  return {
    ...browser,
    cores: server.cpuThreads ?? browser.cores,
    memoryGb: server.ramGb,
    vramGb: server.vramGb,
    cpuPercent: server.cpuPercent ?? null,
    ramUsedGb: server.ramUsedGb ?? null,
    ramUsedPct: server.ramUsedPct ?? null,
    vramUsedGb: server.vramUsedGb ?? null,
    vramUsedPct: server.vramUsedPct ?? null,
    gpuPercent: server.gpuPercent ?? null,
    scannedAt: nowTime()
  };
}

export function readConnection(): Omit<NetState, 'lastChecked'> {
  const nav = navigator as Navigator & NavigatorExtras;
  const type = nav.connection?.type;
  return {
    status: navigator.onLine ? 'ok' : 'down',
    connType: type === 'wifi' ? 'wifi' : type === 'ethernet' ? 'ethernet' : 'unknown',
    productName: null,
    linkSpeedMbps: null,
    localIp: null,
    publicIp: null,
    isp: null,
    gateway: null,
    dns: [],
    city: null,
    region: null,
    country: null,
    notes: ['Browser-only probe; open Test now for OS/public details via /api/network.'],
  };
}

export function shortGpu(gpu: string | null): string {
  if (!gpu) return 'Not exposed';
  return gpu.replace(/ANGLE \(|\)|Direct3D11|vs_\d_\d|ps_\d_\d/g, '').split(',').slice(0, 2).join(' ').trim().slice(0, 36);
}