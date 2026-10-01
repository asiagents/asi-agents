import { useCallback, useEffect, useState } from 'react';
import { api, type CalendarEventItem, type CalendarStatus } from '@asi-api';
import type { CalendarEvent } from '../data/calendar';

const OFFLINE_STATUS: CalendarStatus = {
  configured: false,
  enabled: false,
  connector: null,
  accountLabel: null,
  live: false,
  syncReady: false,
  message: 'Calendar API offline — is :3445 up?',
};

function mapEvent(e: CalendarEventItem): CalendarEvent {
  return {
    id: e.id,
    time: e.time,
    end: e.end ?? '',
    title: e.title,
    place: e.place ?? '',
    pending: e.pending,
  };
}

export function useCalendar() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [st, ev] = await Promise.all([api.calendarStatus(), api.calendarEvents()]);
      const message =
        ev.message && (st.live || ev.events.length === 0) ? ev.message : st.message;
      setStatus({ ...st, message });
      setEvents((ev.events ?? []).map(mapEvent));
    } catch {
      setStatus(OFFLINE_STATUS);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, events, loading, refresh };
}
