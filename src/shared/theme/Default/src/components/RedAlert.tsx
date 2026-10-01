import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SirenIcon } from 'lucide-react';
import { AgentAvatar } from './AgentAvatar';
import { useDesk } from '../contexts/DeskContext';
import { useSettings } from '../contexts/SettingsContext';
import { getAgent } from '../utils/lookup';

const kindLabel = { permission: 'Urgent permission', intrusion: 'Intrusion attempt', injection: 'Prompt injection' };

/**
 * Red alert — for urgent permission / intrusion / injection. Distinct from Panic (which pauses agents).
 * It can only be dismissed with Approve / Deny / Acknowledge.
 */
export function RedAlert() {
  const { redAlert, resolveRedAlert } = useDesk();
  const { s } = useSettings();
  const firstBtn = useRef<HTMLButtonElement>(null);
  const page = s.redAlertStyle === 'page';

  useEffect(() => {
    if (redAlert) firstBtn.current?.focus();
  }, [redAlert]);

  const agent = redAlert ? getAgent(redAlert.agentId) : undefined;

  const actions = redAlert &&
  <div className="flex flex-wrap gap-2">
      {redAlert.kind === 'permission' ?
    <>
          <button ref={firstBtn} type="button" onClick={() => resolveRedAlert('deny')} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#991b1b] transition-colors duration-150 hover:bg-[#fee2e2]">Deny</button>
          <button type="button" onClick={() => resolveRedAlert('approve')} className="rounded-lg px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/60 transition-colors duration-150 hover:bg-white/10">Approve once</button>
        </> :

    <button ref={firstBtn} type="button" onClick={() => resolveRedAlert('acknowledge')} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#991b1b] transition-colors duration-150 hover:bg-[#fee2e2]">Acknowledge</button>
    }
    </div>;


  return (
    <AnimatePresence>
      {redAlert && (
      page ?
      <motion.div
        key="page"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="red-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] grid place-items-center bg-[#b91c1c] p-6 text-white">
        
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#fecaca]">
                <SirenIcon size={18} aria-hidden="true" /> Red alert · {kindLabel[redAlert.kind]} · {redAlert.time}
              </div>
              <h1 id="red-title" className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">{redAlert.title}</h1>
              <p className="mt-3 text-base leading-relaxed text-[#fee2e2]">{redAlert.detail}</p>
              {agent &&
          <div className="mt-5 flex items-center gap-3 text-sm text-[#fee2e2]">
                  <AgentAvatar agent={agent} size="md" /> Raised about {agent.name} · logged to your control log
                </div>
          }
              <div className="mt-8">{actions}</div>
            </div>
          </motion.div> :

      <motion.div
        key="popup"
        role="alertdialog"
        aria-labelledby="red-title"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="fixed right-4 top-[62px] z-[60] w-[min(420px,calc(100vw-32px))] rounded-card bg-[#b91c1c] p-5 text-white shadow-2xl">
        
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#fecaca]">
              <SirenIcon size={15} aria-hidden="true" /> {kindLabel[redAlert.kind]}
            </div>
            <h2 id="red-title" className="mt-2 text-lg font-semibold leading-snug">{redAlert.title}</h2>
            <p className="mt-1.5 text-sm text-[#fee2e2]">{redAlert.detail}</p>
            <div className="mt-4">{actions}</div>
          </motion.div>)
      }
    </AnimatePresence>);

}