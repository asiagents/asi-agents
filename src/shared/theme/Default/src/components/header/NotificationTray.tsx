import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BellIcon, BellOffIcon, CheckCheckIcon, CircleCheckIcon, MailIcon, ShieldAlertIcon, SirenIcon, WifiOffIcon } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { useSettings } from '../../contexts/SettingsContext';
import type { NotificationKind } from '../../types/notifications';

const kindIcon: Record<NotificationKind, {icon: typeof BellIcon;cls: string;}> = {
  approval: { icon: ShieldAlertIcon, cls: 'bg-warn/10 text-warn' },
  agentDone: { icon: CircleCheckIcon, cls: 'bg-success/10 text-success' },
  redAlert: { icon: SirenIcon, cls: 'bg-danger/10 text-danger' },
  router: { icon: WifiOffIcon, cls: 'bg-overlay/[0.06] text-muted' },
  mail: { icon: MailIcon, cls: 'bg-accent/10 text-accent-ink' }
};

/** Header bell + tray. "Silence toasts" only affects pop-ups — not audio (Mute all) and not agents (Panic). */
export function NotificationTray() {
  const { items, unread, markAllRead, markRead, clear } = useNotifications();
  const { s, set } = useSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const quiet = s.notify.quiet;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const Icon = quiet ? BellOffIcon : BellIcon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className="relative grid h-8 w-8 place-items-center rounded-full text-muted ring-1 ring-line transition-colors duration-150 hover:text-ink">
        
        <Icon size={15} aria-hidden="true" />
        {unread > 0 &&
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent-strong px-1 text-[10px] font-semibold text-white">{unread}</span>
        }
      </button>
      <AnimatePresence>
        {open &&
        <motion.div
          role="dialog"
          aria-label="Notifications"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
          className="absolute right-0 top-11 z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl bg-surface shadow-xl ring-1 ring-line">
          
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Notifications</h2>
              <button
              type="button"
              onClick={markAllRead}
              disabled={!unread}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted transition-colors duration-150 hover:text-ink disabled:opacity-40">
              
                <CheckCheckIcon size={13} aria-hidden="true" /> Mark read
              </button>
            </div>
            {items.length === 0 ?
          <p className="px-4 py-8 text-center text-[13px] text-muted">You're all caught up.</p> :

          <ul className="max-h-[360px] overflow-y-auto">
                {items.map((n) => {
              const k = kindIcon[n.kind];
              return (
                <li key={n.id}>
                      <button
                    type="button"
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                      if (n.to) navigate(n.to);
                    }}
                    className="flex w-full gap-3 border-b border-line px-4 py-3 text-left transition-colors duration-150 last:border-0 hover:bg-overlay/[0.04]">
                    
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${k.cls}`}>
                          <k.icon size={15} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[13px] leading-snug text-ink ${n.read ? '' : 'font-semibold'}`}>{n.title}</span>
                          {n.detail && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{n.detail}</span>}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[11px] tabular-nums text-faint">{n.time}</span>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" />}
                        </span>
                      </button>
                    </li>);

            })}
              </ul>
          }
            <div className="flex items-center gap-3 border-t border-line bg-bg px-4 py-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
                <input
                type="checkbox"
                checked={quiet}
                onChange={(e) => set('notify', { ...s.notify, quiet: e.target.checked })}
                className="h-3.5 w-3.5 accent-[rgb(var(--accent))]" />
              
                Silence notification pop-ups
              </label>
              <button type="button" onClick={clear} className="ml-auto text-[12px] text-muted hover:text-ink">Clear</button>
            </div>
            <p className="bg-bg px-4 pb-2.5 text-[11px] text-faint">Doesn't mute audio or pause agents — that's Mute all and Panic.</p>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}