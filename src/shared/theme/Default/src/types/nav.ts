import type { LucideIcon } from 'lucide-react';

export type NavId =
  | 'home'
  | 'chat'
  | 'inbox'
  | 'group'
  | 'desk'
  | 'files'
  | 'settings'
  | 'tasks'
  | 'office'
  | 'agents'
  | 'board'
  | 'arcade';

export interface NavEntry {
  id: string;
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  match: string[];
  /** True when this entry was added manually in Settings → Navigation. */
  custom?: boolean;
}

/** Where a custom link appears. */
export type CustomNavSurface = 'bottom' | 'left';

/** User-defined menu item (label + path/URL). */
export type CustomNavLink = {
  id: string;
  label: string;
  to: string;
  surfaces: CustomNavSurface[];
};

/** Catalog NavId or custom-* id in the ordered bottom-menu list. */
export type NavSlotId = NavId | string;

export function isCustomNavId(id: string): boolean {
  return id.startsWith('custom-');
}
