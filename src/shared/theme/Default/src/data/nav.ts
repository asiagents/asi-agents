import {
  Building2Icon,
  FolderIcon,
  HomeIcon,
  InboxIcon,
  LayoutGridIcon,
  LinkIcon,
  ListTodoIcon,
  MessageSquareIcon,
  MonitorIcon,
  Settings2Icon,
  SquareUserIcon,
  UsersIcon,
} from 'lucide-react';
import type { CustomNavLink, NavEntry, NavId, NavSlotId } from '../types/nav';
import { isCustomNavId } from '../types/nav';

/** Every item the bottom menu can hold, in the suggested order. */
export const navCatalog: NavEntry[] = [
  { id: 'home', to: '/', label: 'Home', description: 'Your home for this mode', icon: HomeIcon, match: ['/'] },
  { id: 'chat', to: '/chat/chief', label: 'Chat', description: 'Dedicated chat page', icon: MessageSquareIcon, match: ['/chat'] },
  { id: 'inbox', to: '/inbox', label: 'Inbox', description: 'Email, draft-first', icon: InboxIcon, match: ['/inbox'] },
  { id: 'group', to: '/group', label: 'Group', description: 'Council decisions', icon: UsersIcon, match: ['/group'] },
  { id: 'desk', to: '/desk', label: 'Desk', description: 'Virtual desks and snapshots', icon: MonitorIcon, match: ['/desk'] },
  {
    id: 'files',
    to: '/files',
    label: 'Files',
    description: 'Local file manager',
    icon: FolderIcon,
    match: ['/files'],
  },
  { id: 'agents', to: '/agents', label: 'Agents', description: 'Roster and profiles', icon: SquareUserIcon, match: ['/agents'] },
  { id: 'office', to: '/office', label: 'Office', description: 'Live floor and hierarchy', icon: Building2Icon, match: ['/office'] },
  { id: 'tasks', to: '/tasks', label: 'Task', description: 'Your to-dos', icon: ListTodoIcon, match: ['/tasks'] },
  {
    id: 'board',
    to: '/board',
    label: 'Board',
    description: 'Visualize where agents stand after they take sides',
    icon: LayoutGridIcon,
    match: ['/board'],
  },
  { id: 'settings', to: '/settings', label: 'Settings', description: 'Everything else', icon: Settings2Icon, match: ['/settings'] },
];

/**
 * Hidden from bottom menu and Settings → Navigation picker.
 * Office / Board routes still work via URL; Arcade deep links show "Games unavailable".
 */
export const hiddenNavIds: NavId[] = ['office', 'board'];

/** Footer/lower rail defaults. */
export const defaultNav: NavId[] = [
  'home',
  'chat',
  'agents',
  'board',
  'tasks',
  'group',
  'desk',
  'files',
  'settings',
];

/** Items that can never be removed from the bottom menu. */
export const lockedNav: NavId[] = ['home', 'chat', 'settings'];

/** Team surfaces. In Super Agent they drop out of the bottom menu. */
export const teamOnlyNav: NavId[] = ['group', 'office', 'board'];

const catalogIds = new Set(navCatalog.map((e) => e.id));

/** Resolve a catalog or custom slot into a renderable NavEntry. */
export function resolveNavEntry(id: string, customLinks: CustomNavLink[]): NavEntry | null {
  const catalog = navCatalog.find((n) => n.id === id);
  if (catalog) return catalog;
  const custom = customLinks.find((c) => c.id === id);
  if (!custom) return null;
  const path = custom.to.trim();
  const matchBase = path.startsWith('http') ? path : path.split('?')[0] || '/';
  return {
    id: custom.id,
    to: path,
    label: custom.label,
    description: path,
    icon: LinkIcon,
    match: [matchBase],
    custom: true,
  };
}

/**
 * Keep a stable ordered nav slot list: known catalog ids + existing custom-* links.
 * Always includes locked items (home, chat, settings). Filters hidden catalog ids.
 */
export function sanitizeNavItems(items: string[], customLinks: { id: string }[] = []): NavSlotId[] {
  const customIds = new Set(customLinks.map((l) => l.id).filter(isCustomNavId));
  const seen = new Set<string>();
  const out: NavSlotId[] = [];
  for (const raw of items) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    if (isCustomNavId(id)) {
      if (!customIds.has(id)) continue;
      seen.add(id);
      out.push(id);
      continue;
    }
    if (!catalogIds.has(id)) continue;
    if (hiddenNavIds.includes(id as NavId)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of lockedNav) {
    if (!seen.has(id)) {
      if (id === 'home') out.unshift(id);
      else if (id === 'chat') {
        const hi = out.indexOf('home');
        out.splice(hi >= 0 ? hi + 1 : 0, 0, id);
      } else out.push(id);
      seen.add(id);
    }
  }
  return out.length ? out : [...defaultNav];
}

/** The items actually rendered in the bottom menu for a mode. Chat is always present. */
export function visibleNav(
  items: NavSlotId[],
  isTeamMode: boolean,
  customLinks: CustomNavLink[] = []
): NavSlotId[] {
  const withoutHidden = items.filter((id) => {
    if (isCustomNavId(id)) {
      const link = customLinks.find((c) => c.id === id);
      return Boolean(link?.surfaces.includes('bottom'));
    }
    return !hiddenNavIds.includes(id as NavId);
  });
  const ids = isTeamMode
    ? withoutHidden
    : withoutHidden.filter((id) => isCustomNavId(id) || !teamOnlyNav.includes(id as NavId));
  if (ids.includes('chat')) return ids;
  if (!ids.length) return ['chat'];
  return [ids[0], 'chat', ...ids.slice(1)];
}
