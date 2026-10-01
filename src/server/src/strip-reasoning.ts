/**
 * Strip leaked chain-of-thought / planning blocks from model replies before persist/display.
 * Targets Qwen-style reasoning tags and clear Chinese step-plan preambles.
 */

const T = "think";
const TAG_NAMES = [T, `${T}ing`, "reasoning", "redacted_reasoning"];
const TAG_ALT = TAG_NAMES.join("|");

const THINK_BLOCK = new RegExp(
  `<\\s*(?:${TAG_ALT})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*(?:${TAG_ALT})\\s*>`,
  "gi"
);

const THINK_OPEN_ONLY = new RegExp(`<\\s*(?:${TAG_ALT})\\b[^>]*>[\\s\\S]*$`, "gi");

const THINK_CLOSE = new RegExp(`<\\s*\\/\\s*(?:${TAG_ALT})\\s*>`, "gi");

/** Chinese (and common EN) CoT headers that Qwen-abliterated models dump before the real answer. */
const COT_HEADER =
  /^(?:分步骤思考|逐步思考|思考过程|让我思考|让我一步步|一步步分析|分析如下|思考)[:：]?\s*|^(?:Reasoning:|Chain of thought:|Let me think(?: step by step)?)\s*[:：]?\s*/i;

const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g;

function cjkRatio(text: string): number {
  const compact = text.replace(/\s+/g, "");
  if (!compact.length) return 0;
  const cjk = (compact.match(CJK_RE) || []).length;
  return cjk / compact.length;
}

function isMostlyCjk(line: string): boolean {
  return cjkRatio(line) >= 0.35;
}

/** Substantial Latin prose (likely the English answer), not a short token. */
function isMostlyLatinAnswer(line: string): boolean {
  const latin = (line.match(/[A-Za-z\u00C0-\u024F]/g) || []).length;
  if (latin < 12) return false;
  return cjkRatio(line) < 0.2;
}

function looksLikeChinesePlanLine(line: string): boolean {
  if (COT_HEADER.test(line) || isMostlyCjk(line)) return true;
  // Numbered step with CJK body: "1. 分析问题"
  return /^(?:\d+[\.\)、]|[-*•])\s*.*[\u3400-\u9fff]/.test(line);
}

/**
 * When a reply opens with Chinese planning / CoT and later switches to English,
 * keep only the English portion (first primarily-Latin line onward).
 */
function preferEnglishAfterChineseCot(s: string): string {
  const lines = s.split("\n");
  let sawChinesePlan = false;
  let latinStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    if (isMostlyLatinAnswer(line)) {
      latinStart = i;
      break;
    }
    if (looksLikeChinesePlanLine(line)) {
      sawChinesePlan = true;
    }
  }

  if (sawChinesePlan && latinStart >= 0) {
    return lines.slice(latinStart).join("\n").trim();
  }
  return s;
}

/**
 * Remove internal reasoning leaks; keep the user-facing answer.
 * Prefer applying on the generate response path so chat history stays clean.
 */
export function stripModelReasoning(raw: string): string {
  if (!raw) return raw;
  let s = raw.replace(/\r\n/g, "\n");

  // Complete think / reasoning blocks
  s = s.replace(THINK_BLOCK, "");

  // Orphan closer: keep only text after the last closing tag
  const closes = [...s.matchAll(THINK_CLOSE)];
  if (closes.length > 0) {
    const last = closes[closes.length - 1]!;
    s = s.slice((last.index ?? 0) + last[0].length);
  }

  // Orphan opener with no closer — drop the unfinished dump
  s = s.replace(THINK_OPEN_ONLY, "");

  s = s.trim();

  // Leading Chinese / EN step-plan that is clearly pre-answer CoT
  if (COT_HEADER.test(s)) {
    s = s.replace(COT_HEADER, "").trim();
    // If a blank line separates planning from the answer, keep the last segment
    const parts = s.split(/\n\s*\n/);
    if (parts.length >= 2) {
      const tail = parts[parts.length - 1]!.trim();
      // Prefer a tail that looks like a normal reply (not more numbered planning only)
      if (tail && !/^(?:\d+[\.\)、]|[-*•])\s/.test(tail.split("\n")[0] ?? "")) {
        s = tail;
      }
    }
  }

  // Chinese planning dump → English answer without think tags
  s = preferEnglishAfterChineseCot(s);

  // Drop residual lone tag fragments
  const frag = new RegExp(`<\\/?${T}\\b[^>]*>`, "gi");
  s = s.replace(frag, "").trim();

  return s;
}
