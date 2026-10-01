import React from 'react';
import { StarIcon, XIcon } from 'lucide-react';
import { useRecommendedModels } from '../../hooks/useRecommendedModels';
import type { CatalogModel } from '../../data/modelCatalog';

export function RecommendedModelsPanel({ onOpen }: {onOpen: (m: CatalogModel) => void;}) {
  const { models, remove } = useRecommendedModels();

  return (
    <section aria-labelledby="recommended-models" className="mb-4 rounded-card bg-surface p-3 ring-1 ring-line">
      <h2 id="recommended-models" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <StarIcon size={16} className="text-warn" aria-hidden="true" /> Recommended
      </h2>
      {models.length === 0 ?
      <p className="mt-2 rounded-lg bg-bg px-3 py-3 text-center text-[13px] text-muted">
        No pins yet.
      </p> :

      <ul className="mt-2 divide-y divide-line rounded-lg ring-1 ring-line">
          {models.map((m) =>
        <li key={m.id} className="flex items-center gap-3 px-3 py-2">
              <button type="button" onClick={() => onOpen(m)} className="min-w-0 flex-1 text-left">
                <span className="block text-[13px] font-medium text-ink">{m.name}</span>
                <span className="block text-[11px] text-muted">{m.provider} · {m.params}</span>
              </button>
              <button type="button" onClick={() => remove(m.id)} aria-label={`Remove ${m.name} from recommended`} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger">
                <XIcon size={14} aria-hidden="true" />
              </button>
            </li>
        )}
        </ul>
      }
    </section>);

}
