import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, PencilIcon, RotateCcwIcon } from 'lucide-react';
import { PageScroll } from '../components/PageScroll';
import { WidgetGrid } from '../components/home/WidgetGrid';
import { AddWidgetList } from '../components/home/AddWidgetList';
import { SuperHero } from '../components/home/SuperHero';
import { ProHero } from '../components/home/ProHero';
import { useSettings } from '../contexts/SettingsContext';
import { useDesk } from '../contexts/DeskContext';
import { defaultWidgets } from '../data/widgets';

/** Home: mode-specific strip (Super/Pro) + widgets. No marketing header block. */
export function Home() {
  const { s, set } = useSettings();
  const { mode } = useDesk();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(() => searchParams.get('edit') === '1');
  useEffect(() => {
    if (searchParams.get('edit') === '1') setEditing(true);
  }, [searchParams]);
  const finishEditing = () => {
    setEditing(false);
    if (searchParams.get('edit')) {
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
  };
  return (
    <PageScroll>
      {mode === 'super' && <SuperHero />}
      {mode === 'pro' && <ProHero />}

      <div className="mb-3 flex items-center gap-2">
        <h2 className="mr-auto text-[15px] font-semibold text-ink">Widgets</h2>
        {editing ?
        <>
            <button type="button" onClick={() => set('widgets', defaultWidgets)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink">
              <RotateCcwIcon size={13} aria-hidden="true" /> Reset
            </button>
            <button type="button" onClick={finishEditing} className="inline-flex items-center gap-1.5 rounded-full bg-accent-strong px-4 py-1.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2">
              <CheckIcon size={14} aria-hidden="true" /> Done
            </button>
          </> :

        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
            <PencilIcon size={13} aria-hidden="true" /> Edit
          </button>
        }
      </div>

      <AnimatePresence initial={false}>
        {editing &&
        <motion.section
          aria-label="Add widget"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden">
          
            <div className="mb-6 rounded-card bg-bg pb-1">
              <AddWidgetList />
              <p className="mt-2 text-[12px] text-muted">
                Drag to reorder. Arrows move order; − / + change width; ↑ / ↓ change height (grid span W×H). Layout is saved on this device.
              </p>
            </div>
          </motion.section>
        }
      </AnimatePresence>

      <WidgetGrid editing={editing} />
    </PageScroll>);

}
