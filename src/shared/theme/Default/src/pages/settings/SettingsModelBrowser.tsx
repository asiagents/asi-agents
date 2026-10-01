import React, { useState } from 'react';
import { ModelDetail } from '../../components/models/ModelDetail';
import { ModelSuggestions } from '../../components/models/ModelSuggestions';
import { RecommendedModelsPanel } from '../../components/models/RecommendedModelsPanel';
import { LiveModelsPanel } from '../../components/models/LiveModelsPanel';
import { ModelCapabilitiesCatalogPanel } from '../../components/models/ModelCapabilitiesCatalogPanel';
import { AgentModelAssignmentsPanel } from '../../components/models/AgentModelAssignmentsPanel';
import { ModelsCloudApiPanel } from '../../components/models/ModelsCloudApiPanel';
import { LocalModelDownloadsPanel } from '../../components/models/LocalModelDownloadsPanel';
import { RecommendedToolsPanel } from '../../components/models/RecommendedToolsPanel';
import { CascadeStages } from '../../components/models/CascadeStages';
import { useDesk } from '../../contexts/DeskContext';
import type { CatalogModel } from '../../data/modelCatalog';
import type { DeskMode } from '../../types/settings';

type PageTab = 'models' | 'assignments';
type ModelsSubTab = 'browse' | 'downloads' | 'suggest' | 'api' | 'cascade';
type BrowseTab = 'ours' | 'catalog';

/** Order: Browse Models → Downloads → Suggestions → API Settings → Cascade (last). */
const subTabs: { id: ModelsSubTab; label: string }[] = [
  { id: 'browse', label: 'Browse Models' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'suggest', label: 'Suggestions' },
  { id: 'api', label: 'API Settings' },
  { id: 'cascade', label: 'Cascade' },
];

/** Models: live API scan + agent assignments (Chief first). */
export function SettingsModelBrowser() {
  const { mode } = useDesk();
  const [pageTab, setPageTab] = useState<PageTab>('models');
  const [subTab, setSubTab] = useState<ModelsSubTab>('browse');
  const [browseTab, setBrowseTab] = useState<BrowseTab>('ours');
  const [open, setOpen] = useState<CatalogModel | null>(null);
  const [suggestMode, setSuggestMode] = useState<DeskMode>(mode);
  const [assignModelIds, setAssignModelIds] = useState<string[]>([]);
  const [assignKey, setAssignKey] = useState(0);

  const primaryTabClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
      active ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'
    }`;

  return (
    <div>
      <div role="tablist" aria-label="Models settings" className="mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === 'models'}
          onClick={() => {
            setPageTab('models');
            setOpen(null);
          }}
          className={primaryTabClass(pageTab === 'models')}
        >
          Models
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === 'assignments'}
          onClick={() => {
            setAssignModelIds([]);
            setPageTab('assignments');
            setOpen(null);
          }}
          className={primaryTabClass(pageTab === 'assignments')}
        >
          Agent assignments
        </button>
      </div>

      {pageTab === 'assignments' && (
        <AgentModelAssignmentsPanel
          key={assignKey}
          initialModelIds={assignModelIds.length ? assignModelIds : undefined}
          onGoBrowse={() => {
            setPageTab('models');
            setSubTab('browse');
            setBrowseTab('ours');
            setOpen(null);
          }}
        />
      )}

      {pageTab === 'models' && (
        <>
          <div
            role="tablist"
            aria-label="Models view"
            className="mb-5 inline-flex flex-wrap rounded-full bg-surface p-1 ring-1 ring-line"
          >
            {subTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={subTab === t.id}
                onClick={() => {
                  setSubTab(t.id);
                  setOpen(null);
                }}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                  subTab === t.id ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {subTab === 'browse' &&
            (open ? (
              <ModelDetail model={open} onBack={() => setOpen(null)} />
            ) : (
              <>
                <div
                  role="tablist"
                  aria-label="Browse models source"
                  className="mb-4 inline-flex rounded-full bg-surface p-1 ring-1 ring-line"
                >
                  {(
                    [
                      { id: 'ours' as BrowseTab, label: 'On device' },
                      { id: 'catalog' as BrowseTab, label: 'Catalog' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={browseTab === t.id}
                      onClick={() => setBrowseTab(t.id)}
                      className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                        browseTab === t.id ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {browseTab === 'ours' ? (
                  <>
                    <LiveModelsPanel
                      onOpen={setOpen}
                      onAssignModels={(ids) => {
                        setAssignModelIds(ids);
                        setAssignKey((k) => k + 1);
                        setPageTab('assignments');
                        setOpen(null);
                      }}
                    />
                    <div className="mt-4">
                      <RecommendedModelsPanel onOpen={setOpen} />
                    </div>
                  </>
                ) : (
                  <ModelCapabilitiesCatalogPanel />
                )}
              </>
            ))}

          {subTab === 'downloads' && (
            <div className="space-y-8">
              <RecommendedToolsPanel />
              <LocalModelDownloadsPanel />
            </div>
          )}

          {subTab === 'suggest' && (
            <ModelSuggestions mode={suggestMode} onModeChange={setSuggestMode} />
          )}

          {subTab === 'api' && <ModelsCloudApiPanel />}

          {subTab === 'cascade' && (
            <CascadeStages
              onGoBrowse={() => {
                setSubTab('browse');
                setBrowseTab('ours');
                setOpen(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
