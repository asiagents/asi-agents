import React, { useMemo } from 'react';
import { CalendarDaysIcon } from 'lucide-react';
import { PageHeader, PageScroll } from '../components/PageScroll';
import { calendarEmptyTodayHint, calendarSetupHint } from '../data/calendar';
import { useCalendar } from '../hooks/useCalendar';
import { PlanningSetupEmpty } from './PlanningSetupEmpty';

export function Calendar() {
  const { status, events, loading, refresh } = useCalendar();
  const empty = events.length === 0;
  const live = status?.live === true;

  const hint = useMemo(() => {
    if (live) {
      return {
        ...calendarEmptyTodayHint,
        lead: status?.message?.trim() || calendarEmptyTodayHint.lead,
      };
    }
    if (!status?.message) return calendarSetupHint;
    return {
      ...calendarSetupHint,
      lead: status.message,
    };
  }, [live, status?.message]);

  const description =
    loading ?
      "Today's schedule · loading…" :
      empty ?
        live ?
          "Today's schedule · Google Calendar · nothing today" :
          status?.configured ?
            "Today's schedule · finish Google sign-in in Settings" :
            "Today's schedule · connect Google Calendar in Settings" :
        `${events.length} event${events.length === 1 ? '' : 's'} today`;

  return (
    <PageScroll width="max-w-2xl">
      <PageHeader title="Calendar" description={description} />

      {loading ?
        <p className="text-[13px] text-muted">Checking calendar connector…</p> :
        empty ?
          <div className="space-y-3">
            <PlanningSetupEmpty hint={hint} icon={CalendarDaysIcon} />
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-[13px] font-medium text-accent-ink hover:underline"
            >
              Refresh calendar
            </button>
          </div> :
          <ol className="space-y-2 rounded-card bg-surface p-4 ring-1 ring-line">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 text-[13px]">
                <span className="w-11 shrink-0 tabular-nums text-muted">
                  {e.time}
                  {e.end ? `–${e.end}` : ''}
                </span>
                <span
                  className={`h-auto w-0.5 shrink-0 rounded-full ${e.pending ? 'bg-warn' : 'bg-accent'}`}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block truncate text-ink">{e.title}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {e.pending ? 'Held · needs your OK' : e.place}
                  </span>
                </span>
              </li>
            ))}
          </ol>
      }
    </PageScroll>
  );
}
