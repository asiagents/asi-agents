import React from 'react';
import { BoxIcon, CpuIcon, LayersIcon, ServerIcon } from 'lucide-react';
import { StatusPill } from '../../components/settings/SettingsUI';

const runtimeCards = [
  {
    id: 'ams-local',
    name: 'AMS local',
    icon: CpuIcon,
    body: 'On-device AMS Micro / Hybrid via the local runtime lane. Wired through Local models — not a separate connector API.',
    status: 'shipped' as const,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    icon: ServerIcon,
    body: 'Detected when the Ollama probe on :3445 succeeds. No separate enable card yet — use Models scan.',
    status: 'partial' as const,
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp',
    icon: BoxIcon,
    body: 'GGUF paths from env / custom models. Stub card — no dedicated Connections toggle.',
    status: 'stub' as const,
  },
  {
    id: 'byo-runtime',
    name: 'BYO agent runtime',
    icon: LayersIcon,
    body: 'Claude Code / Codex-style adapters are not shipped. See Company ops → BYO adapters.',
    status: 'stub' as const,
  },
];

/** Cursor-style Runtimes section — honest stubs; no fake live connectors. */
export function ConnectionsRuntimes() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {runtimeCards.map((card) => (
        <section key={card.id} className="rounded-card bg-surface p-4 ring-1 ring-line" aria-labelledby={`rt-${card.id}`}>
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-ink">
              <card.icon size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id={`rt-${card.id}`} className="text-sm font-semibold text-ink">
                  {card.name}
                </h3>
                <StatusPill tone={card.status === 'shipped' ? 'success' : 'warn'}>
                  {card.status === 'shipped' ? 'Shipped' : card.status === 'partial' ? 'Partial' : 'Stub'}
                </StatusPill>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{card.body}</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
