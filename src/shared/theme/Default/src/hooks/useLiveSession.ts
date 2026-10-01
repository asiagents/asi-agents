import { useEffect, useState } from 'react';
import { liveLines } from '../data/chatThreads';

const SEED = 3;

export function useLiveSession(running: boolean) {
  const [step, setStep] = useState(SEED);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setStep((s) => s + 1), 2600);
    return () => window.clearInterval(t);
  }, [running]);

  const lineCount = liveLines.length;
  const speaking =
    running && lineCount > 0 ? liveLines[step % lineCount].agentId : null;
  const count = lineCount > 0 ? Math.min(step, 5) : 0;
  const transcript = Array.from({ length: count }, (_, i) => {
    const n = step - count + i;
    return { key: n, ...liveLines[n % lineCount] };
  });

  return { speaking, transcript };
}