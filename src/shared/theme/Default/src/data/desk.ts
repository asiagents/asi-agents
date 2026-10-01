import type { PermissionRequest, PermissionRule } from '../types/settings';

export const permissionRequests: PermissionRequest[] = [];

export const permissionRules: PermissionRule[] = [
{ id: 'r1', category: 'spend', label: 'Cloud model calls', detail: 'Any call that leaves this device and costs money', policy: 'ask' },
{ id: 'r2', category: 'spend', label: 'Off-device escalation', detail: 'Handoffs to Chat 1B or Chat 3B', policy: 'ask' },
{ id: 'r3', category: 'shell', label: 'Read-only commands', detail: 'Listing files, reading logs in the Virtual Computer', policy: 'ask' },
{ id: 'r4', category: 'shell', label: 'Commands that write or delete', detail: 'Anything that changes files', policy: 'never' },
{ id: 'r5', category: 'skill', label: 'Install new skills', detail: 'Adding abilities to any agent', policy: 'ask' },
{ id: 'r6', category: 'skill', label: 'Web browsing', detail: 'Fetching pages from the internet', policy: 'ask' },
{ id: 'r7', category: 'skill', label: 'Calendar read', detail: 'Seeing your schedule', policy: 'always' },
{ id: 'ops.diagnose', category: 'ops', label: 'Diagnose backends from chat', detail: 'Re-probe Ollama / models and return a fix checklist (no shell)', policy: 'ask' },
{ id: 'ops.restart_asi', category: 'ops', label: 'Restart ASI server from chat', detail: 'Exit the product process for a supervisor — never reboots the PC; still needs chat confirm', policy: 'ask' },
{ id: 'ops.suggest_reboot', category: 'ops', label: 'Suggest PC reboot from chat', detail: 'Suggest restarting this PC after repeated failures — never forces a reboot', policy: 'ask' }];

/** Desk health checks — DeskHealth probes GET /api/desk/status live (no seeded rows). */
export const deskHealth: { id: string; label: string; detail: string; state: 'ok' | 'blocked' }[] = [];

/** Terminal lines for the watch surface — empty until real captures exist. */
export const deskTerminal: string[] = [];