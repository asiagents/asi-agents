import { useCallback, useMemo, useState } from 'react';
import { modelCatalog, type CatalogModel } from '../data/modelCatalog';
import { readJson, STORAGE_KEYS, writeJson } from '../utils/storage';

export function useRecommendedModels() {
  const [ids, setIds] = useState<string[]>(() => readJson<string[]>(STORAGE_KEYS.recommendedModels, []));

  const persist = useCallback((next: string[]) => {
    setIds(next);
    writeJson(STORAGE_KEYS.recommendedModels, next);
  }, []);

  const models = useMemo(
    () => ids.map((id) => modelCatalog.find((m) => m.id === id)).filter((m): m is CatalogModel => !!m),
    [ids]
  );

  const add = useCallback(
    (id: string) => {
      if (ids.includes(id)) return;
      persist([...ids, id]);
    },
    [ids, persist]
  );

  const remove = useCallback(
    (id: string) => {
      persist(ids.filter((x) => x !== id));
    },
    [ids, persist]
  );

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { models, add, remove, has };
}
