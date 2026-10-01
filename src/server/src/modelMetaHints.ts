/**
 * Parameter / RAM / skill-tag heuristics for scanned local models.
 * Ollama Q4-style estimates are rough planning hints — not measured load.
 */

/** Rough system RAM when loaded for common Ollama Q4_K_* quants (weights + modest KV). */
export function estimateRamHintFromParams(paramsLabel: string | null | undefined): string | undefined {
  const bill = parseParamsBillions(paramsLabel);
  if (bill == null) return undefined;
  if (bill < 0.15) return "~0.5–1 GB";
  if (bill < 0.5) return "~1–2 GB";
  if (bill < 1.2) return "~1–2 GB";
  if (bill < 2.5) return "~2–3 GB";
  if (bill < 4.5) return "~3–5 GB";
  if (bill < 8) return "~5–7 GB";
  if (bill < 14) return "~8–12 GB";
  if (bill < 20) return "~12–16 GB";
  if (bill < 36) return "~20–28 GB";
  if (bill < 75) return "~40–48 GB";
  return "~48+ GB";
}

/** Prefer on-disk blob size × ~1.2 for Q4 load overhead when Ollama reports `size`. */
export function estimateRamHintFromSizeBytes(sizeBytes: number | null | undefined): string | undefined {
  if (sizeBytes == null || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return undefined;
  const gb = (sizeBytes / 1024 ** 3) * 1.2;
  if (gb < 0.15) return "~0.2 GB";
  if (gb < 1) return `~${Math.max(0.3, Math.round(gb * 10) / 10)} GB`;
  if (gb < 10) return `~${Math.round(gb * 10) / 10} GB`;
  return `~${Math.round(gb)} GB`;
}

export function parseParamsBillions(label: string | null | undefined): number | null {
  if (!label) return null;
  const s = label.trim();
  if (!s || s === "—" || s === "?") return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*([bBmM])\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return m[2].toLowerCase() === "m" ? n / 1000 : n;
}

/** Pull a compact size token from ids like `qwen2.5-coder:1.5b` or details.parameter_size. */
export function inferParamsLabel(
  idOrName: string,
  explicit?: string | null
): string | undefined {
  if (explicit && explicit.trim() && explicit.trim() !== "—") {
    const t = explicit.trim();
    const m = t.match(/(\d+(?:\.\d+)?)\s*([bBmM])\b/);
    if (m) return `${m[1]}${m[2].toUpperCase()}`;
    return t;
  }
  const hay = idOrName;
  const m = hay.match(/(\d+(?:\.\d+)?)\s*([bBmM])\b/i);
  if (!m) return undefined;
  return `${m[1]}${m[2].toUpperCase()}`;
}

/** Skill / capability tags inferred from Ollama name + family (thin tags enriched). */
export function inferSkillTags(idOrName: string, family?: string | null): string[] {
  const hay = `${idOrName} ${family ?? ""}`.toLowerCase();
  const tags: string[] = [];
  if (/embed|nomic-embed|mxbai-embed|bge-|e5-|minilm/i.test(hay)) tags.push("embed");
  if (/llava|vision|moondream|pixtral|bakllava|vl-|llama3\.2-vision|qwen2-vl|minicpm-v/i.test(hay)) {
    tags.push("vision");
  }
  if (/code|coder|codellama|starcoder|deepseek-coder|qwen.*coder|codestral/i.test(hay)) {
    tags.push("coding");
  }
  if (/micro|hybrid|agentchat|router|ams-micro|ams-hybrid/i.test(hay)) tags.push("agentic");
  if (/whisper|tts|bark|speech|audio|musicgen|lyria/i.test(hay)) tags.push("audio");
  if (/tool|function.?call|hermes/i.test(hay)) tags.push("tools");
  if (/r1|reason|o1|o3|qwq/i.test(hay)) tags.push("reasoning");
  if (tags.length === 0 && !tags.includes("embed") && !tags.includes("audio")) tags.push("chat");
  else if (
    !tags.includes("embed") &&
    !tags.includes("audio") &&
    !tags.includes("chat") &&
    (tags.includes("vision") || tags.includes("coding") || tags.includes("tools") || tags.includes("reasoning"))
  ) {
    tags.push("chat");
  }
  return tags;
}
