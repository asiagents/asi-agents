import type { ActivityEntry, Email } from '../types/inbox';

/** Fail-closed: no demo mail for nav badges. Live unread comes from server when wired. */
export const emails: Email[] = [];

/** Seed activity feed — starts empty; Desk fills from live events. */
export const activityLog: ActivityEntry[] = [];

export const inboxSetupHint = {
  title: 'Inbox is empty until email is connected',
  lead: 'No fake messages. Connect IMAP or Gmail on the server, then refresh — Approvals still work on the other tab.',
  steps: [
    'Easiest: Settings → Connections → Email → Add email profile (Gmail app password or IMAP). POP3 is coming later — use IMAP.',
    'Or set ASI_IMAP_HOST, ASI_IMAP_USER, and ASI_IMAP_PASS on :3445 (optional ASI_IMAP_PORT / ASI_IMAP_SECURE / ASI_IMAP_MAILBOX).',
    'Gmail OAuth: Configure under Connections (Client ID + secret, Secret saved + last4) or ASI_GMAIL_*; Sign in with Google appears when gmailOAuthReady is true. Does not request Drive.',
  ],
  links: [
    { to: '/settings/connections#email', label: 'Open Email settings' },
  ],
} as const;
