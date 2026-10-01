/**
 * Companion art — modules/Companion Agent/<skin> via /companion/<skin>.
 * Prefer GIF (1080×1920 masters); fall back numbered alias GIF, then PNG + CSS bob.
 * Load only the active skin + active state URL (no pack preload).
 */

export const COMPANION_SKINS = [
  'squari',
  'drakko',
  'mochi',
  'paperclip-x',
  'capsule',
  'nekowire',
  'pixel-knight',
] as const;

export type CompanionSkinId = (typeof COMPANION_SKINS)[number];

export const COMPANION_SKIN_LABELS: Record<CompanionSkinId, string> = {
  squari: 'Squari',
  drakko: 'Drakko',
  mochi: 'Mochi',
  'paperclip-x': 'Paperclip X',
  capsule: 'Capsule',
  nekowire: 'Nekowire',
  'pixel-knight': 'Pixel Knight',
};

/** Active default for this build/test — still switchable in Modules. */
export const DEFAULT_COMPANION_SKIN: CompanionSkinId = 'drakko';

export type CompanionStateId =
  | 'idle'
  | 'click_chat'
  | 'working'
  | 'typing'
  | 'humming'
  | 'jump'
  | 'look_down'
  | 'urgent_ask';

/** @deprecated Prefer CompanionStateId */
export type SquariStateId = CompanionStateId;

/** Numbered alias filenames under gifs/ (01…08). */
const STATE_ALIAS: Record<CompanionStateId, string> = {
  idle: '01-idle',
  click_chat: '02-click-chat',
  working: '03-working',
  typing: '04-typing',
  humming: '05-humming',
  jump: '06-jump',
  look_down: '07-look-down',
  urgent_ask: '08-urgent-ask',
};

export function isCompanionSkinId(raw: string | null | undefined): raw is CompanionSkinId {
  return !!raw && (COMPANION_SKINS as readonly string[]).includes(raw);
}

function skinBase(skin: CompanionSkinId): string {
  return `/companion/${skin}`;
}

/** Primary large transparent bobbing GIF (canonical master). */
export function companionGifUrl(skin: CompanionSkinId, state: CompanionStateId): string {
  return `${skinBase(skin)}/gifs/${state}-1080x1920.gif`;
}

/** Numbered alias GIF (same animation, smaller name). */
export function companionGifAliasUrl(skin: CompanionSkinId, state: CompanionStateId): string {
  return `${skinBase(skin)}/gifs/${STATE_ALIAS[state]}.gif`;
}

/** Transparent still — pair with CSS bob when GIF unavailable. */
export function companionPngUrl(skin: CompanionSkinId, state: CompanionStateId): string {
  return `${skinBase(skin)}/references/${state}-1080x1920.png`;
}

export type CompanionSpriteKind = 'gif' | 'png';

export type CompanionSpriteSource = {
  url: string;
  kind: CompanionSpriteKind;
  /** When kind is gif and this fails, try next candidates in order. */
  fallbacks: string[];
};

/**
 * Prefer GIF master → numbered alias → PNG still.
 * Callers should set img.src to `url` and onError walk `fallbacks`, then treat as PNG + bob.
 */
export function companionSpriteSource(
  skin: CompanionSkinId,
  state: CompanionStateId
): CompanionSpriteSource {
  const gif = companionGifUrl(skin, state);
  const alias = companionGifAliasUrl(skin, state);
  const png = companionPngUrl(skin, state);
  return {
    url: gif,
    kind: 'gif',
    fallbacks: [alias, png],
  };
}

/** @deprecated Use companionSpriteSource — kept for older imports. */
export function squariSpriteUrl(state: CompanionStateId, preferLoop = false): string {
  void preferLoop;
  return companionGifUrl(DEFAULT_COMPANION_SKIN, state);
}

/**
 * Display sizes — masters are 1080×1920 (9:16).
 * BR overlay scales generously (~26% md / ~17% sm); lock ~30%.
 */
export const COMPANION_HITBOX = {
  sm: { w: 180, h: 320 },
  md: { w: 280, h: 498 },
  /** Lock / full-bleed-ish corner scale from 1080×1920 masters. */
  lock: { w: 320, h: 569 },
} as const;

/** @deprecated Use COMPANION_HITBOX */
export const SQUARI_HITBOX = {
  md: COMPANION_HITBOX.md,
  sm: COMPANION_HITBOX.sm,
} as const;
