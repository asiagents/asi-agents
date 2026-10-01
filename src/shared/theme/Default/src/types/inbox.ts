export interface ActivityEntry {
  id: string;
  time: string;
  actor: string;
  agentId?: string;
  text: string;
  tone: 'neutral' | 'success' | 'warn' | 'danger';
}

export interface Email {
  id: string;
  from: string;
  address: string;
  subject: string;
  time: string;
  unread: boolean;
  body: string;
  suggest: string;
}