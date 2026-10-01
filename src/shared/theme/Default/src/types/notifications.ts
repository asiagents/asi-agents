export type NotificationKind = 'approval' | 'agentDone' | 'redAlert' | 'router' | 'mail';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail?: string;
  to?: string;
  time: string;
  read: boolean;
}