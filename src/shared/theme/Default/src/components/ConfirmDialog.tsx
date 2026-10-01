import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'danger' | 'accent';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, body, confirmLabel, tone = 'accent', onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open &&
      <motion.div
        className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}>
        
          <motion.div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-body"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-card bg-surface p-5 shadow-xl ring-1 ring-line">
          
            <h2 id="confirm-title" className="text-[15px] font-semibold text-ink">{title}</h2>
            <p id="confirm-body" className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05]">
              
                Cancel
              </button>
              <button
              type="button"
              onClick={onConfirm}
              className={`rounded-lg px-3.5 py-2 text-[13px] font-medium text-white transition-colors duration-150 ${
              tone === 'danger' ? 'bg-[#dc2626] hover:bg-[#b91c1c]' : 'bg-accent-strong hover:bg-accent-2'}`
              }>
              
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}