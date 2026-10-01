/** Shared reply rules appended to agent / council / Chief system prompts. */

const THINK_TAG = "<" + "think" + ">";

/** Match the user's language (when English-only pref is off). */
export const REPLY_LANGUAGE_MATCH_USER =
  "Answer in the same language the user is writing in. " +
  `Never expose internal chain-of-thought, step plans, or tags like ${THINK_TAG} — reply with the final answer only.`;

/** Prefer English final answers; block Chinese CoT / thinking tags (default). */
export const REPLY_ENGLISH_ONLY_RULE =
  "Reply in English only; do not include Chinese reasoning or thinking tags. " +
  `Never expose internal chain-of-thought, step plans, or tags like ${THINK_TAG} — reply with the final answer only.`;

/** @deprecated Use replyLanguageRule() — kept for callers that still import the constant. */
export const REPLY_LANGUAGE_RULE = REPLY_ENGLISH_ONLY_RULE;

export const REPLY_FACTUALITY_RULE =
  "Do not invent people, dates, titles, citations, or tool results. " +
  "If you are unsure, say so briefly — free or small models often hallucinate; never fake facts.";

export const COUNCIL_BRIEF_RULE =
  "Keep council replies concise (about 2–5 short sentences). Disagree when useful; stay in your role.";

export type ReplyPolicyOpts = {
  /** Default true — English-only final answers, no Chinese CoT. */
  englishOnly?: boolean;
};

export function replyLanguageRule(opts?: ReplyPolicyOpts): string {
  return opts?.englishOnly === false ? REPLY_LANGUAGE_MATCH_USER : REPLY_ENGLISH_ONLY_RULE;
}

export function agentReplyPolicy(extra?: string, opts?: ReplyPolicyOpts): string {
  return [replyLanguageRule(opts), REPLY_FACTUALITY_RULE, extra].filter(Boolean).join(" ");
}

export function councilReplyPolicy(extra?: string, opts?: ReplyPolicyOpts): string {
  return [replyLanguageRule(opts), REPLY_FACTUALITY_RULE, COUNCIL_BRIEF_RULE, extra]
    .filter(Boolean)
    .join(" ");
}
