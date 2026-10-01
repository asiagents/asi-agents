/** Heuristic: agent message text that likely needs a permissions gate decision. */
const APPROVAL_HINT =
  /\b(need(s)? your approval|awaiting approval|permission to|approve (this|before)|standing rule|gate blocked|ask(s)? first|before I (run|execute|spend|install)|shell access|spend cap)\b/i;

export function messageImpliesApproval(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return APPROVAL_HINT.test(t);
}
