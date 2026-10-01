/** Pattern-matched local answers before LLM generate (DESIGN §18 v1 starter subset). */

export type InAppHandledTurn = {
  intentId: string;
  userText: string;
  replyText: string;
};

type IntentRule = {
  intentId: string;
  test: RegExp;
  reply: (text: string) => string;
};

const RULES: IntentRule[] = [
  {
    intentId: "local.time",
    test: /\b(what('s| is) the time|what time is it|current time)\b/i,
    reply: () => {
      const now = new Date();
      return `It's ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (answered locally — system clock).`;
    },
  },
  {
    intentId: "local.date",
    test: /\b(what('s| is) today|today('s| is) date|current date|what date is it)\b/i,
    reply: () => {
      const now = new Date();
      return `Today is ${now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} (answered locally).`;
    },
  },
  {
    intentId: "local.timezone",
    test: /\b(timezone|time zone|what zone am i in)\b/i,
    reply: () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return `Your timezone is ${tz || "unknown"} (answered locally).`;
    },
  },
  {
    intentId: "local.locale",
    test: /\b(what language|browser locale|my locale)\b/i,
    reply: () => {
      const lang = typeof navigator !== "undefined" ? navigator.language : "unknown";
      return `Browser locale: ${lang} (answered locally).`;
    },
  },
];

export function tryInAppIntent(text: string): InAppHandledTurn | null {
  const userText = text.trim();
  if (!userText) return null;
  for (const rule of RULES) {
    if (!rule.test.test(userText)) continue;
    return {
      intentId: rule.intentId,
      userText,
      replyText: rule.reply(userText),
    };
  }
  return null;
}
