export { SquariCompanion, TaskMascot } from './SquariCompanion';
export {
  isSquariEnabled,
  isSquariVisibleOnLock,
  setSquariEnabled,
  setSquariOnLock,
  isMascotEnabled,
  setMascotEnabled,
  readCompanionSettings,
  setCompanionLookAt,
  setCompanionCelebrationJump,
  setCompanionSize,
  setCompanionSkin,
  emitCompanionTyping,
  rememberLastChatThread,
  isCompanionTestBed,
  COMPANION_TOGGLE_EVENT,
  COMPANION_TYPING_EVENT,
  COMPANION_SETTINGS_EVENT,
} from './settings';
export type { CompanionSettings, CompanionSize, CompanionSkinId } from './settings';
export {
  COMPANION_SKINS,
  COMPANION_SKIN_LABELS,
  DEFAULT_COMPANION_SKIN,
  COMPANION_HITBOX,
  companionSpriteSource,
  companionGifUrl,
  companionPngUrl,
} from './assets';
export type { CompanionStateId, SquariStateId } from './assets';
