import {
  AppWindowIcon,
  BellIcon,
  BookOpenIcon,
  BoxesIcon,
  Building2Icon,
  CableIcon,
  ClipboardListIcon,
  CpuIcon,
  GaugeIcon,
  KeyboardIcon,
  LayersIcon,
  LayoutGridIcon,
  LockIcon,
  MicIcon,
  NavigationIcon,
  PaletteIcon,
  PuzzleIcon,
  Settings2Icon,
  ShieldCheckIcon,
  ShieldIcon,
  SparklesIcon,
  Trash2Icon,
  WifiIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type SettingsPageId =
  | 'hub'
  | 'models'
  | 'connections'
  | 'modules'
  | 'general'
  | 'permissions'
  | 'audits'
  | 'logs'
  | 'theme'
  | 'voice'
  | 'pro'
  | 'skills'
  | 'company'
  | 'lessons'
  | 'hardware'
  | 'network'
  | 'widgets'
  | 'navigation'
  | 'performance'
  | 'lock'
  | 'safety'
  | 'notifications'
  | 'shortcuts';

export type SettingsPage = {
  id: SettingsPageId;
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** When true, shown in sidebar but omitted from the hub block grid. */
  hubOnly?: boolean;
};

/**
 * Settings sidebar order (strict priority first):
 * Settings hub → Models → Providers and APIs → Modules → App settings (General) →
 * Permissions → Audits → Logs and Recycle Bin → everything else.
 */
export const settingsPages: SettingsPage[] = [
  {
    id: 'hub',
    to: '/settings',
    label: 'Settings',
    description: 'Visual hub — jump to any settings area',
    icon: Settings2Icon,
    hubOnly: true,
  },
  {
    id: 'models',
    to: '/settings/models',
    label: 'Models',
    description: 'Browse live scans, downloads, suggestions, and API settings',
    icon: BoxesIcon,
  },
  {
    id: 'connections',
    to: '/settings/connections',
    label: 'Providers and APIs',
    description: 'Providers, API keys, runtimes, email, calendar, and cloud APIs',
    icon: CableIcon,
  },
  {
    id: 'modules',
    to: '/settings/modules',
    label: 'Modules',
    description: 'Companion characters (Squari), Desk, Arcade, AMS, Postgres — off by default',
    icon: PuzzleIcon,
  },
  {
    id: 'general',
    to: '/settings/general',
    label: 'App settings (General)',
    description: 'Mode, app name, your name, language, location',
    icon: AppWindowIcon,
  },
  {
    id: 'permissions',
    to: '/settings/permissions',
    label: 'Permissions',
    description: 'Spend, shell, and skill gates · standing rules',
    icon: ShieldCheckIcon,
  },
  {
    id: 'audits',
    to: '/settings/audits',
    label: 'Audits',
    description: 'Findings, fail-closed patterns, learn → Lessons / Chief',
    icon: ClipboardListIcon,
  },
  {
    id: 'logs',
    to: '/settings/logs',
    label: 'Logs and Recycle Bin',
    description: 'Soft-deleted chats, agents, and logs · retention',
    icon: Trash2Icon,
  },
  {
    id: 'theme',
    to: '/settings/theme',
    label: 'Theme',
    description: 'Light, dark, accent, surfaces',
    icon: PaletteIcon,
  },
  {
    id: 'voice',
    to: '/settings/voice',
    label: 'Voice',
    description: 'Mute, TTS, STT, dictionary, warm-cache, privacy',
    icon: MicIcon,
  },
  {
    id: 'pro',
    to: '/settings/pro',
    label: 'Pro agents',
    description: '12 category sets, shared skills pool, build your own',
    icon: SparklesIcon,
  },
  {
    id: 'skills',
    to: '/settings/skills',
    label: 'AMS skills',
    description: 'Browse full catalog, edit desk-agent picks and custom sets',
    icon: LayersIcon,
  },
  {
    id: 'company',
    to: '/settings/company',
    label: 'Company / Training',
    description: 'About Us briefing, training, cron, adapters, skill graph',
    icon: Building2Icon,
  },
  {
    id: 'lessons',
    to: '/settings/lessons',
    label: 'Lessons',
    description: 'Things the team learned — reports, training briefs, takeaways',
    icon: BookOpenIcon,
  },
  {
    id: 'hardware',
    to: '/settings/hardware',
    label: 'Hardware',
    description: 'Scan, RAM / GPU tracking, footer strip',
    icon: CpuIcon,
  },
  {
    id: 'network',
    to: '/settings/network',
    label: 'Net check',
    description: 'How often to test the connection',
    icon: WifiIcon,
  },
  {
    id: 'widgets',
    to: '/settings/widgets',
    label: 'Widgets',
    description: 'What appears on Home',
    icon: LayoutGridIcon,
  },
  {
    id: 'navigation',
    to: '/settings/navigation',
    label: 'Bottom menu',
    description: 'Add, remove, and reorder menu items',
    icon: NavigationIcon,
  },
  {
    id: 'performance',
    to: '/settings/performance',
    label: 'Performance',
    description: 'Live agent visuals and low-end mode',
    icon: GaugeIcon,
  },
  {
    id: 'lock',
    to: '/settings/lock',
    label: 'Lock screen',
    description: 'Live lock canvas, widgets, password · snapshots',
    icon: LockIcon,
  },
  {
    id: 'safety',
    to: '/settings/safety',
    label: 'Safety',
    description: 'Fail closed, draft-first, Panic, red alerts, control log',
    icon: ShieldIcon,
  },
  {
    id: 'notifications',
    to: '/settings/notifications',
    label: 'Notifications',
    description: 'What pings you, in-app and OS',
    icon: BellIcon,
  },
  {
    id: 'shortcuts',
    to: '/settings/shortcuts',
    label: 'Shortcuts',
    description: 'Keyboard shortcuts',
    icon: KeyboardIcon,
  },
];

/** Blocks available on the Settings hub (everything except the hub entry itself). */
export const settingsHubBlocks = settingsPages.filter((p) => !p.hubOnly);

export const settingsHubBlockIds = settingsHubBlocks.map((p) => p.id);
