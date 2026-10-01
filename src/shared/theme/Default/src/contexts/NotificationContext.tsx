import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSettings } from './SettingsContext';
import { notificationSeed } from '../data/notifications';
import { createId, nowTime } from '../utils/time';
import type { AppNotification, NotificationKind } from '../types/notifications';

interface NotifyInput {
  kind: NotificationKind;
  title: string;
  detail?: string;
  to?: string;
}

interface NotificationValue {
  items: AppNotification[];
  unread: number;
  notify: (n: NotifyInput) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clear: () => void;
}

const NotificationContext = createContext<NotificationValue | null>(null);

/**
 * In-app notifications. Everything collects in the tray; toasts respect Settings → Notifications
 * (per-kind toggles + "Silence toasts"). OS notifications only fire if the browser granted permission.
 */
export function NotificationProvider({ children }: {children: React.ReactNode;}) {
  const { s } = useSettings();
  const [items, setItems] = useState<AppNotification[]>(notificationSeed);

  const notify = useCallback(
    (n: NotifyInput) => {
      setItems((prev) => [{ ...n, id: createId(), time: nowTime(), read: false }, ...prev].slice(0, 40));
      const allowed = s.notify[n.kind];
      if (!allowed) return;
      if (!s.notify.quiet) {
        if (n.kind === 'redAlert' || n.kind === 'router') toast.error(n.title, { description: n.detail });else
        toast(n.title, { description: n.detail });
      }
      if (s.notify.os && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(n.title, { body: n.detail });
        } catch {

          /* some browsers need a service worker — ignore */}
      }
    },
    [s.notify]
  );


  const markAllRead = useCallback(() => setItems((p) => p.map((i) => ({ ...i, read: true }))), []);
  const markRead = useCallback((id: string) => setItems((p) => p.map((i) => i.id === id ? { ...i, read: true } : i)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, unread: items.filter((i) => !i.read).length, notify, markAllRead, markRead, clear }),
    [items, notify, markAllRead, markRead, clear]
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}