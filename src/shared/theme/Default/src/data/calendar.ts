export type CalendarEvent = {
  id: string;
  time: string;
  end: string;
  title: string;
  place: string;
  pending?: boolean;
};

export const calendarSetupHint = {
  title: 'Calendar is empty until a provider is connected',
  lead: 'No demo meetings are shown. Configure OAuth secrets, then Connect Google or Microsoft.',
  steps: [
    'Settings → Connections → Calendar → Configure (Client ID + secret) or set ASI_GOOGLE_CALENDAR_* / ASI_MICROSOFT_*.',
    'Google redirect: http://127.0.0.1:3445/api/calendar/oauth/google/callback. Microsoft: …/microsoft/callback.',
    'Connect appears only when oauthConfigured / microsoftOAuthConfigured is true (fail-closed).',
    'Optional: ASI_UI_ORIGIN so OAuth returns to this UI (dev default http://127.0.0.1:5173).',
  ],
  links: [
    { to: '/settings/connections#calendar', label: 'Open Calendar settings' },
  ],
} as const;

export const calendarEmptyTodayHint = {
  title: 'No events today',
  lead: 'Google Calendar is connected. Nothing is scheduled on the primary calendar for today — this list never invents meetings.',
  steps: [
    'Add an event in Google Calendar for today, then refresh this page.',
    'Only the primary calendar is read, and only for the current local day.',
  ],
  links: [
    { to: '/settings/connections#calendar', label: 'Calendar connection' },
  ],
} as const;
