import { useEffect, useState } from 'react';

interface PerfMemory {
  usedJSHeapSize: number;
}

/** App memory in MB when the browser exposes it (Chromium). Null otherwise — never estimated. */
export function useAppMemory(enabled: boolean): number | null {
  const [mb, setMb] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) {
      setMb(null);
      return;
    }
    const read = () => {
      const mem = (performance as Performance & {memory?: PerfMemory;}).memory;
      setMb(mem ? Math.round(mem.usedJSHeapSize / 1_048_576) : null);
    };
    read();
    const id = window.setInterval(read, 5000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return mb;
}