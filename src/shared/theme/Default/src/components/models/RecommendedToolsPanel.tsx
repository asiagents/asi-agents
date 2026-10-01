import React, { useEffect, useState } from 'react';
import { ExternalLinkIcon, WrenchIcon } from 'lucide-react';
import { api, type RecommendedTool } from '@asi-api';
import { SettingsSection } from '../settings/SettingsUI';

export function RecommendedToolsPanel() {
  const [label, setLabel] = useState('');
  const [tools, setTools] = useState<RecommendedTool[]>([]);

  useEffect(() => {
    api
      .recommendedTools()
      .then((res) => {
        setLabel(res.label);
        setTools(res.tools);
      })
      .catch(() => setTools([]));
  }, []);

  if (tools.length === 0) return null;

  return (
    <SettingsSection title="Recommended tools" stacked description={label || 'Runtimes and parsers for docs, OCR, and local inference'}>
      <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
        {tools.map((t) => (
          <li key={t.id} className="flex flex-wrap gap-3 p-4">
            <WrenchIcon size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">{t.name}</div>
              <div className="text-[11px] capitalize text-muted">{t.category}</div>
              <p className="mt-1 text-[12px] text-muted">{t.summary}</p>
              {t.command && (
                <code className="mt-2 block rounded bg-bg px-2 py-1 text-[11px] text-ink ring-1 ring-line">{t.command}</code>
              )}
              {t.verifyCommand && (
                <p className="mt-1 text-[11px] text-faint">Verify: <code>{t.verifyCommand}</code></p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {t.installUrl && (
                <a
                  href={t.installUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-ink hover:underline"
                >
                  Install <ExternalLinkIcon size={12} aria-hidden="true" />
                </a>
              )}
              {t.docsUrl && (
                <a
                  href={t.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink"
                >
                  Docs <ExternalLinkIcon size={12} aria-hidden="true" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}
