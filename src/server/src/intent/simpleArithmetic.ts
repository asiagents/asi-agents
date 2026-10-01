/**
 * Deterministic local arithmetic for short "what is N op M" turns.
 * Returns just the number — no LLM waffle.
 */

const ONES: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const OP_WORDS: Record<string, "+" | "-" | "*" | "/"> = {
  plus: "+",
  add: "+",
  added: "+",
  minus: "-",
  subtract: "-",
  subtracted: "-",
  less: "-",
  times: "*",
  time: "*", // common typo / speech: "seventeen time 19"
  multiply: "*",
  multiplied: "*",
  into: "*",
  x: "*",
  divided: "/",
  divide: "/",
  over: "/",
};

const WRAPPER_PREFIX =
  /^(?:(?:whats?|calculate|compute|solve|eval(?:uate)?|how\s+much\s+is|aofr|of)\s+)+/i;

const TRAILING_JUNK =
  /\b(?:show\s+steps?|end\s+with|final\s*=|how\s+bad|cant?\s+it\s+be|just\s+a\s+number|please|pls|thanks?|thx).*$/i;

const CONCEPTUAL =
  /^(?:why|explain|describe|prove|compare|is\s+the\s+claim|when\s+dealing)\b/i;

type Tok =
  | { kind: "num"; value: number }
  | { kind: "op"; value: "+" | "-" | "*" | "/" };

function parseWordNumber(tokens: string[], start: number): { value: number; next: number } | null {
  const t0 = tokens[start];
  if (!t0) return null;

  if (/^\d+(?:\.\d+)?$/.test(t0)) {
    return { value: Number(t0), next: start + 1 };
  }

  if (t0 === "a" || t0 === "an") {
    return { value: 1, next: start + 1 };
  }

  if (ONES[t0] != null) {
    let value = ONES[t0]!;
    let i = start + 1;
    if (tokens[i] === "hundred") {
      value *= 100;
      i++;
      const rest = parseWordNumber(tokens, i);
      if (rest && rest.value < 100) {
        value += rest.value;
        i = rest.next;
      }
    }
    return { value, next: i };
  }

  if (TENS[t0] != null) {
    let value = TENS[t0]!;
    let i = start + 1;
    if (tokens[i] && ONES[tokens[i]!] != null && ONES[tokens[i]!]! < 10) {
      value += ONES[tokens[i]!]!;
      i++;
    }
    if (tokens[i] === "hundred") {
      value *= 100;
      i++;
      const rest = parseWordNumber(tokens, i);
      if (rest && rest.value < 100) {
        value += rest.value;
        i = rest.next;
      }
    }
    return { value, next: i };
  }

  if (t0 === "hundred") {
    return { value: 100, next: start + 1 };
  }

  // hyphenated: twenty-three → already split; "twentythree" rare — skip
  const hy = /^([a-z]+)-([a-z]+)$/.exec(t0);
  if (hy) {
    const a = TENS[hy[1]!];
    const b = ONES[hy[2]!];
    if (a != null && b != null && b < 10) {
      return { value: a + b, next: start + 1 };
    }
  }

  return null;
}

function tokenizeMath(text: string): Tok[] | null {
  let s = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/what's/g, "whats")
    .replace(/what\s+is/g, "whats")
    .replace(/['']/g, "")
    .replace(/×|·|∗/g, "*")
    .replace(/÷/g, "/")
    .replace(/(\d)\s*[xX]\s*(\d)/g, "$1 * $2")
    .replace(/(\d)x(\d)/gi, "$1 * $2")
    .replace(/\bmultiplied\s+by\b/g, "times")
    .replace(/\bdivided\s+by\b/g, "divided")
    .replace(/[^\p{L}\p{N}\s+\-*/.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  s = s.replace(WRAPPER_PREFIX, "").trim();
  s = s.replace(TRAILING_JUNK, "").trim();
  // Drop leftover ask-words
  s = s
    .replace(/\b(whats?|please|pls|kindly|the|a|an|is|equals?|=|final)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return null;

  const rawTokens = s.split(" ").filter(Boolean);
  const out: Tok[] = [];
  let i = 0;
  let expectNum = true;

  while (i < rawTokens.length) {
    const t = rawTokens[i]!;

    if (expectNum) {
      // unary minus
      if ((t === "-" || t === "minus") && i + 1 < rawTokens.length) {
        const n = parseWordNumber(rawTokens, i + 1);
        if (n) {
          out.push({ kind: "num", value: -n.value });
          i = n.next;
          expectNum = false;
          continue;
        }
      }
      const n = parseWordNumber(rawTokens, i);
      if (!n) {
        // skip stray non-math filler once
        if (/^(and|to|by|of|from)$/.test(t)) {
          i++;
          continue;
        }
        return null;
      }
      out.push({ kind: "num", value: n.value });
      i = n.next;
      expectNum = false;
      continue;
    }

    // operator
    if (t === "+" || t === "-" || t === "*" || t === "/") {
      out.push({ kind: "op", value: t });
      i++;
      expectNum = true;
      continue;
    }
    const op = OP_WORDS[t];
    if (op) {
      out.push({ kind: "op", value: op });
      i++;
      expectNum = true;
      continue;
    }
    // "plus twenty three" already handled; stray words end the expression
    break;
  }

  if (out.length < 3) return null;
  if (out[0]!.kind !== "num") return null;
  // Must be num (op num)+
  for (let j = 0; j < out.length; j++) {
    const want = j % 2 === 0 ? "num" : "op";
    if (out[j]!.kind !== want) return null;
  }
  if (out[out.length - 1]!.kind !== "num") return null;
  return out;
}

function evalTokens(toks: Tok[]): number | null {
  // First pass: * /
  const stack: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    if (t.kind === "op" && (t.value === "*" || t.value === "/")) {
      const left = stack.pop();
      const right = toks[++i];
      if (!left || left.kind !== "num" || !right || right.kind !== "num") return null;
      if (t.value === "/" && right.value === 0) return null;
      const v = t.value === "*" ? left.value * right.value : left.value / right.value;
      stack.push({ kind: "num", value: v });
      continue;
    }
    stack.push(t);
  }
  // Second pass: + -
  let acc = stack[0];
  if (!acc || acc.kind !== "num") return null;
  let result = acc.value;
  for (let i = 1; i < stack.length; i += 2) {
    const op = stack[i];
    const n = stack[i + 1];
    if (!op || op.kind !== "op" || !n || n.kind !== "num") return null;
    if (op.value === "+") result += n.value;
    else if (op.value === "-") result -= n.value;
    else return null;
  }
  return result;
}

function formatAnswer(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  // Trim float noise but keep useful decimals
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded);
}

/**
 * If the utterance is simple arithmetic, return the answer string (just the number).
 * Otherwise null → fall through to fan-out / LLM.
 */
export function trySimpleArithmeticReply(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 280) return null;
  if (CONCEPTUAL.test(trimmed)) return null;

  // Must look arithmetic-ish (digit/op/word-number + operator cue)
  const lower = trimmed.toLowerCase();
  const hasOpCue =
    /[+\-*/×÷]/.test(trimmed) ||
    /\b(times|time|plus|minus|multipl|divid|over)\b/.test(lower) ||
    /\d\s*[xX]\s*\d/.test(trimmed) ||
    /\d[xX]\d/.test(trimmed);
  if (!hasOpCue) return null;

  const toks = tokenizeMath(trimmed);
  if (!toks) return null;
  const value = evalTokens(toks);
  if (value == null || !Number.isFinite(value)) return null;
  return formatAnswer(value);
}
