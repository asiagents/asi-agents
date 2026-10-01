import type { DeskMode } from '../types/settings';
import { themeAssetUrl } from '../utils/themeAssets';

export interface ModeOption {
  id: DeskMode;
  label: string;
  short: string;
  caption: string;
  blurb: string;
  image: string;
  /** Per-mode accent, used only on the mode tiles so each mode reads as its own thing. */
  accent: string;
  tint: string;
}

export const modeOptions: ModeOption[] = [
{
  id: 'super',
  label: 'Super Agent',
  short: 'Super',
  caption: 'One thread, one Chief',
  blurb: 'Talk to Chief in a single thread. Specialists step in only through handoffs you can see.',
  image: themeAssetUrl('e2b650a4-4c63-42fc-b52f-60d2a4fb8025.jpg') ?? '',
  accent: '#7c6cf0',
  tint: 'rgba(124,108,240,0.10)'
},
{
  id: 'multi',
  label: 'Multi Agents',
  short: 'Multi',
  caption: 'A council that decides with you',
  blurb: 'Group decisions, live agents working, meeting room, and the Office floor.',
  image: themeAssetUrl('49af1521-77d1-40aa-b6fa-a459c12e742b.jpg') ?? '',
  accent: '#0d9488',
  tint: 'rgba(13,148,136,0.10)'
},
{
  id: 'pro',
  label: 'Pro Agents',
  short: 'Pro',
  caption: 'Specialists, skills first',
  blurb: 'Each agent leads with its skills. They still join Group and the Office.',
  image: themeAssetUrl('b104522c-28b3-4dd2-9e09-1631b970a2e0.jpg') ?? '',
  accent: '#d97706',
  tint: 'rgba(217,119,6,0.10)'
}];