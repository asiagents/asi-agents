import type { Language } from '../types/settings';

const strings = {
  greeting: { en: 'Good to see you', hinglish: 'Namaste' },
  homeSub: { en: "Here's your desk today.", hinglish: 'Aaj ka desk ek nazar mein.' },
  openChat: { en: 'Open Chief chat', hinglish: 'Chief se baat karo' },
  message: { en: 'Message', hinglish: 'Message likho —' },
  unlock: { en: 'Unlock', hinglish: 'Unlock karo' },
  panic: { en: 'Panic', hinglish: 'Panic' }
};

export type StringKey = keyof typeof strings;

export function t(lang: Language, key: StringKey): string {
  return strings[key][lang];
}