import type { AppNotification } from '../types/notifications';

export const notificationSeed: AppNotification[] = [];

export const notificationKinds = [
{ kind: 'approval', label: 'Approvals waiting', detail: 'An agent needs your OK in chat.' },
{ kind: 'agentDone', label: 'Agent finished a task' },
{ kind: 'redAlert', label: 'Red alerts', detail: 'The red takeover always shows; this adds a toast.' },
{ kind: 'router', label: 'Local backend / router', detail: 'Ollama, llama.cpp, or router status changes.' },
{ kind: 'mail', label: 'New mail', detail: 'From your connected email accounts.' }] as
const;