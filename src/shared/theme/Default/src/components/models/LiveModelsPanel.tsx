import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { ModelCard } from '@asi-api';
import { api } from '@asi-api';
import { StatusPill } from '../settings/SettingsUI';
import { useModelScan } from '../../hooks/useModelScan';
import { useSelectedModelPool } from '../../hooks/useSelectedModelPool';
import { ModelBrowseFilterBar } from './ModelBrowseFilterBar';
import { ModelDownloadActions } from './ModelDownloadActions';
import { passesScanBrowseFilters, type BrowseFilterId } from '../../utils/modelBrowseFilters';
import {
  catalogModelFromCard,
  catalogReferenceEntries,
  isCatalogSatisfiedByScan,
} from '../../utils/modelScanBridge';
import { modelBackendLabel } from '../../utils/modelBackend';
import { scanStatusLines } from '../../utils/modelScanStatus';
import { modelSkillPills, passesSkillRoleFilters } from '../../utils/modelSkillPills';
import { modelParamsRam } from '../../utils/modelParamsRam';
import type { AssignmentRoleFilter } from '../../utils/assignmentModelOptions';
import type { CatalogModel } from '../../data/modelCatalog';
import { asiApiUnreachableMessage } from '@virtual-computer/integration/deskStatusMessage';
import { isAmsRouterRecipeId } from '../../utils/amsHf';

function SkillPills({ card }: { card: ModelCard | CatalogModel }) {
  const pills = modelSkillPills(card);
  if (pills.length === 0) {
    return (
      <span className="mt-1 block text-[11px] text-faint">Skills: N/A</span>
    );
  }
  return (
    <span className="mt-1 inline-flex flex-wrap items-center gap-1" title="Inferred skills from id / name / tags">
      {pills.map((p) => (
        <span
          key={p}
          className="inline-block rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-ink"
        >
          {p}
        </span>
      ))}
    </span>
  );
}

function ParamsRamLine({ card }: { card: ModelCard | CatalogModel }) {
  const { params, ramImpact, paramsKnown, ramKnown } = modelParamsRam(card);
  const paramsDisp = paramsKnown ? params : '?';
  const ramDisp = ramKnown || ramImpact.includes('cloud') ? ramImpact : '?—estimate N/A';
  return (
    <p
      className="mt-1 text-[11px] text-muted"
      title="Params from Ollama details / catalog / name; RAM is a Q4-class planning estimate — not measured"
    >
      <span className="text-faint">Params</span> {paramsDisp}
      <span className="mx-1.5 text-faint">·</span>
      <span className="text-faint">RAM</span> {ramDisp}
    </p>
  );
}

function ModelRow({
  card,
  selected,
  local,
  recipeOnly,
  providerFreeTier,
  checked,
  inSavedPool,
  poolSaving,
  onToggleCheck,
  onAddToPool,
  onAddPending,
  onSelect,
  onOpen,
  onPulled,
}: {
  card: ModelCard | CatalogModel;
  selected: boolean;
  local: boolean;
  /** Catalog/AMS recipe — not on disk yet. */
  recipeOnly?: boolean;
  providerFreeTier?: boolean;
  checked?: boolean;
  /** Already in the persisted assignment pool (not merely draft-checked). */
  inSavedPool?: boolean;
  poolSaving?: boolean;
  onToggleCheck?: () => void;
  /** One-shot: save this model into the assignment pool. */
  onAddToPool?: () => void;
  /** Add recipe id to pool as pending (not a generate target until GGUF). */
  onAddPending?: () => void;
  onSelect: () => void;
  onOpen: () => void;
  onPulled?: () => void;
}) {
  const isCard = 'meta' in card;
  const name = card.name;
  const meta = isCard ? card.meta : card.note;
  const modelId = card.id;
  const isRouterRecipe = isAmsRouterRecipeId(modelId);
  const badge =
    isCard && card.kind === 'api'
      ? 'API listed'
      : isCard && card.kind === 'scanned'
        ? card.source === 'ams' || card.tags?.includes('ams')
          ? card.tags?.includes('onnx') || String(card.id).startsWith('ams-onnx:')
            ? 'ONNX on disk'
            : 'AMS installed'
          : 'Scanned'
        : local
          ? 'Scanned'
          : isCard && (card.source === 'ams' || card.tags?.includes('ams') || card.tags?.includes('recipe'))
            ? 'AMS recipe'
            : !isCard && (card as CatalogModel).provider === 'AMS'
              ? 'AMS recipe'
              : 'HF / Ollama recipe';
  const isOnnxInstalled =
    isCard &&
    card.kind === 'scanned' &&
    (card.tags?.includes('onnx') || String(card.id).startsWith('ams-onnx:'));
  const backend = isCard ? modelBackendLabel(card) : null;
  const checkable = local && typeof onToggleCheck === 'function';
  const inPool = !!checked;
  const alreadyInList = !!inSavedPool;
  const canAddToList = local && typeof onAddToPool === 'function';
  const catalogModel = isCard ? catalogModelFromCard(card) : (card as CatalogModel);

  return (
    <li className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-[13px]">
      {checkable && (
        <label
          className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 ring-1 transition-colors ${
            inPool
              ? 'bg-accent/15 text-accent-ink ring-accent/40'
              : 'bg-bg text-muted ring-line hover:text-ink hover:ring-accent/30'
          }`}
        >
          <input
            type="checkbox"
            checked={inPool}
            onChange={onToggleCheck}
            className="h-4 w-4 shrink-0 cursor-pointer rounded border border-line bg-bg accent-[rgb(var(--accent))]"
            aria-label={`Add ${name} to assignment pool`}
          />
          <span className="text-[11px] font-semibold tracking-wide">{inPool ? 'In pool' : 'Pool'}</span>
        </label>
      )}
      <div className="min-w-0 flex-1 basis-[12rem]">
        <button type="button" onClick={onOpen} className="max-w-full text-left">
          <p className="break-words font-medium text-ink hover:underline">
            {name}
            {selected && (
              <span className="ml-2 inline-block rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                Desk default
              </span>
            )}
            {recipeOnly && alreadyInList && (
              <span className="ml-2 inline-block rounded bg-warn/10 px-1.5 py-0.5 text-[10px] font-semibold text-warn">
                Pending / recipe
              </span>
            )}
          </p>
        </button>
        <p className="mt-0.5 truncate text-[12px] text-muted">{meta}</p>
        <span className="mt-1 inline-flex flex-wrap items-center gap-1">
          <span className="inline-block rounded bg-overlay/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-muted">
            {badge}
          </span>
          {isCard && !card.paid && (
            <span className="inline-block rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
              Free
            </span>
          )}
          {isCard && card.paid && providerFreeTier && (
            <span className="inline-block rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
              Provider free tier
            </span>
          )}
        </span>
        <SkillPills card={card} />
        <ParamsRamLine card={card} />
      </div>
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
        {backend && (
          <StatusPill tone={backend.lane === 'local' ? 'success' : 'muted'}>{backend.label}</StatusPill>
        )}
        {local ? (
          <>
            <button
              type="button"
              onClick={onSelect}
              title={
                isOnnxInstalled
                  ? 'ONNX on disk — add to pool / desk default. Reference router :7821 does not load ONNX yet (Ollama/llama.cpp only).'
                  : 'One-shot: set as desk default (separate from assignment pool)'
              }
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ring-1 transition-colors ${
                selected
                  ? 'bg-success/10 text-success ring-success/30'
                  : 'text-muted ring-line hover:bg-overlay/[0.04] hover:text-ink'
              }`}
            >
              {selected ? 'Desk default' : 'Select'}
            </button>
            {canAddToList && (
              <button
                type="button"
                disabled={alreadyInList || !!poolSaving}
                onClick={onAddToPool}
                title={
                  alreadyInList
                    ? 'Already in the saved assignment pool'
                    : 'Add this model to the saved pool used by Agent assignments and chat'
                }
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ring-1 transition-colors disabled:opacity-50 ${
                  alreadyInList
                    ? 'bg-accent/10 text-accent-ink ring-accent/30'
                    : 'text-muted ring-line hover:bg-overlay/[0.04] hover:text-ink'
                }`}
              >
                {alreadyInList ? 'In model list' : 'Add to model list'}
              </button>
            )}
          </>
        ) : recipeOnly ? (
          <>
            <button
              type="button"
              disabled
              title={
                isRouterRecipe
                  ? 'Need matching .gguf or .onnx under models/ams/ before Select — Download from Hugging Face, place file, then Scan'
                  : 'Need matching weights on disk before Select / Pool / Desk default — Download, place into models/ams/, then Scan'
              }
              className="cursor-not-allowed rounded-lg px-3 py-1.5 text-[12px] font-medium text-faint ring-1 ring-line opacity-70"
            >
              Select when installed
            </button>
            {typeof onAddPending === 'function' && (
              <button
                type="button"
                disabled={alreadyInList || !!poolSaving}
                onClick={onAddPending}
                title="Add this recipe id to the Browse pool as pending — not a generate target until weights are scanned"
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ring-1 transition-colors disabled:opacity-50 ${
                  alreadyInList
                    ? 'bg-warn/10 text-warn ring-warn/30'
                    : 'text-muted ring-line hover:bg-overlay/[0.04] hover:text-ink'
                }`}
              >
                {alreadyInList ? 'Pending in pool' : 'Add as pending'}
              </button>
            )}
            <ModelDownloadActions model={catalogModel} onPulled={onPulled} />
          </>
        ) : (
          <ModelDownloadActions model={catalogModel} onPulled={onPulled} />
        )}
      </div>
    </li>
  );
}

function ProbeStatusList({ meta }: { meta: ReturnType<typeof useModelScan>['scanMeta'] }) {
  const lines = scanStatusLines(meta);
  if (lines.length === 0) return null;
  const toneClass = (tone: 'ok' | 'warn' | 'muted') =>
    tone === 'ok' ? 'text-success' : tone === 'warn' ? 'text-warn' : 'text-muted';

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-bg px-3 py-2 text-[12px] ring-1 ring-line">
      {lines.map((line) => (
        <li key={line.label} className="flex gap-x-1.5">
          <span className="font-medium text-ink">{line.label}</span>
          <span className={toneClass(line.tone)}>{line.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** Full-width stacked block — never use SettingsSection side-title grid here. */
function FullWidthSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full min-w-0 border-b border-line py-5 first:pt-0 last:border-0">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <div className="mt-3 w-full min-w-0">{children}</div>
    </section>
  );
}

/** Models tab — live scan + HF/Ollama download recipes (no fictional showcase rows). */
export function LiveModelsPanel({
  onOpen,
  onAssignModels,
}: {
  onOpen: (m: CatalogModel) => void;
  /** Jump to Agent assignments with the current pool. */
  onAssignModels?: (modelIds: string[]) => void;
}) {
  const {
    scanned,
    catalogFromScan,
    scanMeta,
    scannedAt,
    loading,
    unreachable,
    routerReady,
    routerLive,
    runScan,
    selectedModelId,
    selectModel,
  } = useModelScan();
  const {
    ids: savedPoolIds,
    draftIds,
    dirty: poolDirty,
    saving: poolSaving,
    toggle: togglePool,
    save: savePool,
    clear: clearPool,
    discardDraft,
    addOne: addOneToPool,
  } = useSelectedModelPool();
  const [browseFilters, setBrowseFilters] = useState<BrowseFilterId[]>([]);
  const [skillFilters, setSkillFilters] = useState<AssignmentRoleFilter[]>([]);
  const [freeTierProviders, setFreeTierProviders] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    api
      .providers()
      .then((res) => {
        const ids = new Set(
          res.providers.filter((p) => p.supportsFreeTier).map((p) => p.id)
        );
        setFreeTierProviders(ids);
      })
      .catch(() => {
        /* optional metadata */
      });
  }, []);

  const browseActive = useMemo(() => new Set(browseFilters), [browseFilters]);
  const skillActive = useMemo(() => new Set(skillFilters), [skillFilters]);
  const toggleBrowse = (id: BrowseFilterId) => {
    setBrowseFilters((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };
  const toggleSkill = (id: AssignmentRoleFilter) => {
    setSkillFilters((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const filteredScanned = useMemo(
    () =>
      scanned.filter(
        (m) => passesScanBrowseFilters(m, browseActive) && passesSkillRoleFilters(m, skillActive)
      ),
    [scanned, browseActive, skillActive]
  );

  const catalogOnly = catalogReferenceEntries()
    .filter((m) => !isCatalogSatisfiedByScan(m, scanned))
    .filter((m) => passesSkillRoleFilters(m, skillActive));
  const amsRecipes = catalogFromScan
    .filter(
      (m) =>
        (m.source === 'ams' || m.tags.includes('ams') || m.id.startsWith('ams-')) &&
        m.id !== 'agent-chat-50-100m' &&
        m.id !== 'ultra-gate-1m'
    )
    .filter((m) => passesSkillRoleFilters(m, skillActive));
  const amsInstalled = scanned
    .filter(
      (m) =>
        m.source === 'ams' ||
        m.id.startsWith('ams-gguf:') ||
        m.id.startsWith('ams-onnx:') ||
        (m.tags.includes('ams') && m.kind === 'scanned')
    )
    .filter((m) => passesSkillRoleFilters(m, skillActive));
  /** Hide HF/Ollama recipes only when user filters to API-only (not when “Free only” alone). */
  const showDownloads = !(browseActive.has('api') && !browseActive.has('local'));
  const showAmsSection =
    showDownloads &&
    (amsRecipes.length > 0 || amsInstalled.length > 0 || (scanMeta?.probes.ams?.catalogTotal ?? 0) > 0);
  const anyFilters = browseFilters.length > 0 || skillFilters.length > 0;
  const filterBlocksAll =
    scanned.length > 0 && filteredScanned.length === 0 && anyFilters;
  const apiScanned = scanned.filter((m) => m.kind === 'api');
  const paidApiScanned = apiScanned.filter((m) => m.paid);
  const freeApiScanned = apiScanned.filter((m) => !m.paid);
  const freeHidesApi =
    filterBlocksAll &&
    browseActive.has('free') &&
    paidApiScanned.length > 0 &&
    freeApiScanned.length === 0;
  const freeHidesPaidApi =
    filterBlocksAll && browseActive.has('free') && paidApiScanned.length > 0 && freeApiScanned.length > 0;
  const showEmptyPanel = !loading && filteredScanned.length === 0;

  const openCard = (card: ModelCard) => onOpen(catalogModelFromCard(card));
  const canBulkAssign = typeof onAssignModels === 'function';

  const emptyHint = unreachable
    ? 'Start the ASI server, then Scan now.'
    : freeHidesApi
      ? `${paidApiScanned.length} paid cloud model(s) hidden by Free only.`
      : freeHidesPaidApi
        ? `Free only hiding ${paidApiScanned.length} paid model(s).`
        : filterBlocksAll
          ? 'Clear filters or Scan now.'
          : null;

  return (
    <div className="w-full min-w-0 space-y-3">
      <FullWidthSection title="On this device">
        <div className="w-full min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
            {unreachable ? (
              <StatusPill tone="warn">API offline</StatusPill>
            ) : routerLive ? (
              <StatusPill tone="success">Router live (:7821)</StatusPill>
            ) : (
              <StatusPill tone="warn">
                {routerReady
                  ? 'Router off — npm run start:router'
                  : 'Router off — no artifacts'}
              </StatusPill>
            )}
            <span>Last scan: {scannedAt ?? '—'}</span>
            {unreachable && <span className="text-warn">{asiApiUnreachableMessage()}</span>}
          </div>

          {!loading && !unreachable && <ProbeStatusList meta={scanMeta} />}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void runScan()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-60"
            >
              <RefreshCwIcon size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              {loading ? 'Scanning…' : 'Scan now'}
            </button>
            <ModelBrowseFilterBar
              active={browseFilters}
              onToggle={toggleBrowse}
              skillActive={skillFilters}
              onToggleSkill={toggleSkill}
            />
          </div>

          {filteredScanned.length > 0 && (
            <p className="text-[12px] text-muted">
              Multi-select with <strong className="font-medium text-ink">Pool</strong> checkboxes, then{' '}
              <strong className="font-medium text-ink">Save selection</strong> — or use{' '}
              <strong className="font-medium text-ink">Add to model list</strong> on a single row.
              {' '}
              <span className="text-faint">Set Desk Default</span> is a separate one-shot for the desk only.
              {savedPoolIds.length > 0 && !poolDirty && (
                <span className="ml-1 text-success">Saved {savedPoolIds.length} models.</span>
              )}
            </p>
          )}

          {loading && scanned.length === 0 && (
            <p className="rounded-card bg-surface px-4 py-4 text-center text-[13px] text-muted ring-1 ring-line">
              Loading models…
            </p>
          )}

          {showEmptyPanel && (
            <div className="rounded-card bg-surface px-4 py-4 text-center ring-1 ring-line">
              <p className="text-sm font-medium text-ink">
                {unreachable
                  ? 'Cannot scan without the API'
                  : filterBlocksAll
                    ? 'No models match filters'
                    : 'Nothing scanned yet'}
              </p>
              {emptyHint && <p className="mt-1 text-[12px] text-muted">{emptyHint}</p>}
            </div>
          )}

          {filteredScanned.length > 0 && (
            <ul className="w-full min-w-0 max-w-full divide-y divide-line overflow-hidden rounded-card bg-surface ring-1 ring-line">
              {filteredScanned.map((m) => (
                <ModelRow
                  key={m.id}
                  card={m}
                  local
                  providerFreeTier={m.provider ? freeTierProviders.has(m.provider) : false}
                  selected={selectedModelId === m.id}
                  checked={draftIds.includes(m.id)}
                  inSavedPool={savedPoolIds.includes(m.id)}
                  poolSaving={poolSaving}
                  onToggleCheck={() => togglePool(m.id)}
                  onAddToPool={() => {
                    void addOneToPool(m.id).then((ids) => {
                      toast(
                        ids.includes(m.id)
                          ? `Added ${m.name} to model list`
                          : `Could not add ${m.name}`
                      );
                    });
                  }}
                  onSelect={() => void selectModel(m.id)}
                  onOpen={() => openCard(m)}
                />
              ))}
            </ul>
          )}

          {(draftIds.length > 0 || savedPoolIds.length > 0) && (
            <div className="sticky bottom-24 z-20 flex w-full min-w-0 flex-wrap items-center gap-2 rounded-card bg-surface/95 px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-1 ring-accent/30 backdrop-blur-md">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">
                  {draftIds.length} selected
                  {poolDirty ? (
                    <span className="ml-2 text-[12px] font-normal text-warn">Unsaved</span>
                  ) : savedPoolIds.length > 0 ? (
                    <span className="ml-2 text-[12px] font-normal text-success">
                      Saved {savedPoolIds.length} models
                    </span>
                  ) : null}
                </p>
                <p className="text-[12px] text-muted">
                  Save to use on Agent assignments &amp; chat agent model picker
                </p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {poolDirty && savedPoolIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => discardDraft()}
                    disabled={poolSaving}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted ring-1 ring-line hover:text-ink disabled:opacity-50"
                  >
                    Revert
                  </button>
                )}
                {(draftIds.length > 0 || savedPoolIds.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      void clearPool().then(() => {
                        toast('Cleared saved model pool');
                      });
                    }}
                    disabled={poolSaving}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted ring-1 ring-line hover:text-ink disabled:opacity-50"
                  >
                    Clear saved
                  </button>
                )}
                <button
                  type="button"
                  disabled={poolSaving || !poolDirty}
                  onClick={() => {
                    void savePool().then((ids) => {
                      toast(ids.length === 0 ? 'Cleared saved model pool' : `Saved ${ids.length} models`);
                    });
                  }}
                  className="rounded-lg bg-accent-strong px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-2 disabled:opacity-50"
                >
                  {poolSaving ? 'Saving…' : 'Save selection'}
                </button>
                {canBulkAssign && (
                  <button
                    type="button"
                    disabled={poolSaving || (savedPoolIds.length === 0 && !poolDirty)}
                    onClick={() => {
                      const go = (ids: string[]) => {
                        if (ids.length === 0) {
                          toast('Select and save models first');
                          return;
                        }
                        onAssignModels?.(ids);
                      };
                      if (poolDirty) {
                        void savePool().then((ids) => {
                          toast(ids.length === 0 ? 'Cleared saved model pool' : `Saved ${ids.length} models`);
                          go(ids);
                        });
                      } else {
                        go(savedPoolIds);
                      }
                    }}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-accent-ink ring-1 ring-accent/40 hover:bg-accent/10 disabled:opacity-50"
                  >
                    {poolDirty ? 'Save & assign…' : 'Assign to agents…'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </FullWidthSection>

      {showAmsSection && (
        <FullWidthSection title="ASI AMS models">
          <p className="mb-2 text-[12px] text-muted">
            Product router / agent models from <code className="text-[11px]">models/ams/catalog.json</code>
            {' '}(display names: ASI AMS Micro 70M / Hybrid 120M).{' '}
            <strong className="font-medium text-ink">AMS recipe</strong> = no matching weights yet — use{' '}
            <strong className="font-medium text-ink">Download from Hugging Face</strong>, place a{' '}
            <code className="text-[11px]">.gguf</code> or <code className="text-[11px]">.onnx</code> in{' '}
            <code className="text-[11px]">models/ams/</code>, then Scan;{' '}
            <strong className="font-medium text-ink">AMS installed / ONNX on disk</strong> = Select / Pool enabled
            (honest format badge — never claims GGUF for ONNX). Reference router (:7821) is Ollama/llama.cpp only —
            ONNX is ready for a future hop. Recipe rows can{' '}
            <strong className="font-medium text-ink">Add as pending</strong>. Updates:{' '}
            <a
              href="https://huggingface.co/vvarghese"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent-ink hover:underline"
            >
              huggingface.co/vvarghese
            </a>
            . Size/RAM hints are Q4 planning estimates — see{' '}
            <code className="text-[11px]">models/ams/README.md</code>.
          </p>
          {(scanMeta?.probes.ams || amsInstalled.length > 0 || amsRecipes.length > 0) && (
            <p className="mb-2 text-[12px] text-faint">
              {amsInstalled.length} installed · {amsRecipes.length} recipe(s) missing
              {scanMeta?.probes.ams
                ? ` · catalog ${scanMeta.probes.ams.catalogTotal} · ${scanMeta.probes.ams.installedGguf} .gguf · ${scanMeta.probes.ams.installedOnnx ?? 0} .onnx in models/ams`
                : ''}
            </p>
          )}
          {amsInstalled.length > 0 && (
            <ul className="mb-3 w-full divide-y divide-line rounded-card bg-surface ring-1 ring-line">
              {amsInstalled.map((m) => (
                <ModelRow
                  key={`ams-inst-${m.id}`}
                  card={m}
                  local
                  selected={selectedModelId === m.id}
                  checked={draftIds.includes(m.id)}
                  inSavedPool={savedPoolIds.includes(m.id)}
                  poolSaving={poolSaving}
                  onToggleCheck={() => togglePool(m.id)}
                  onAddToPool={() => {
                    void addOneToPool(m.id).then((ids) => {
                      toast(
                        ids.includes(m.id)
                          ? `Added ${m.name} to model list`
                          : `Could not add ${m.name}`
                      );
                    });
                  }}
                  onSelect={() => void selectModel(m.id)}
                  onOpen={() => openCard(m)}
                />
              ))}
            </ul>
          )}
          {amsRecipes.length > 0 ? (
            <ul className="w-full divide-y divide-line rounded-card bg-surface ring-1 ring-line">
              {amsRecipes.map((m) => (
                <ModelRow
                  key={`ams-${m.id}`}
                  card={m}
                  local={false}
                  recipeOnly
                  selected={false}
                  inSavedPool={savedPoolIds.includes(m.id)}
                  poolSaving={poolSaving}
                  onAddPending={() => {
                    void addOneToPool(m.id).then((ids) => {
                      toast(
                        ids.includes(m.id)
                          ? `Added ${m.name} as pending recipe — install weights + Scan before using as router`
                          : `Could not add ${m.name}`
                      );
                    });
                  }}
                  onSelect={() => {}}
                  onOpen={() => openCard(m)}
                  onPulled={() => void runScan()}
                />
              ))}
            </ul>
          ) : amsInstalled.length === 0 ? (
            <p className="rounded-card bg-surface px-4 py-3 text-[12px] text-muted ring-1 ring-line">
              No AMS recipes or weights found. Check <code className="text-[11px]">models/ams/catalog.json</code>.
            </p>
          ) : (
            <p className="text-[12px] text-success">All catalog recipes have matching weights on disk.</p>
          )}
        </FullWidthSection>
      )}

      {showDownloads && catalogOnly.length > 0 && (
        <FullWidthSection title="Recommended downloads">
          <ul className="w-full divide-y divide-line rounded-card bg-surface ring-1 ring-line">
            {catalogOnly.map((m) => (
              <ModelRow
                key={`cat-${m.id}`}
                card={m}
                local={false}
                selected={false}
                onSelect={() => {}}
                onOpen={() => onOpen(m)}
                onPulled={() => void runScan()}
              />
            ))}
          </ul>
        </FullWidthSection>
      )}
    </div>
  );
}
