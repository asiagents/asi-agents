/**
 * Proxy Ollama `POST /api/pull` with streamed progress.
 * Local desk helper — does not invent tags; caller supplies the pull name.
 */

export type OllamaPullProgress = {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  error?: string;
};

function ollamaHost(): string {
  let raw = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").trim().replace(/\/$/, "");
  if (raw && !/^https?:\/\//i.test(raw)) {
    raw = `http://${raw}`;
  }
  return raw;
}

/** Safe Ollama model tag: letters, digits, `.` `_` `-` `/` `:` */
export function normalizeOllamaPullTag(raw: unknown): string | null {
  const tag = String(raw ?? "").trim();
  if (!tag || tag.length > 200) return null;
  if (!/^[\w./:-]+$/i.test(tag)) return null;
  return tag;
}

/**
 * Stream Ollama pull NDJSON lines. Calls `onProgress` for each status object.
 * Resolves when pull finishes; rejects on HTTP / Ollama errors.
 */
export async function pullOllamaModel(
  tag: string,
  onProgress?: (p: OllamaPullProgress) => void
): Promise<{ ok: true; tag: string; host: string }> {
  const name = normalizeOllamaPullTag(tag);
  if (!name) {
    throw Object.assign(new Error("invalid ollama tag"), { status: 400 });
  }

  const host = ollamaHost();
  const url = `${host}/api/pull`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, stream: true }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ollama unreachable";
    throw Object.assign(new Error(`Ollama at ${host} unreachable: ${msg}`), { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(
      new Error(`Ollama pull HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`),
      { status: 502 }
    );
  }

  if (!res.body) {
    throw Object.assign(new Error("Ollama pull returned empty body"), { status: 502 });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let lastError: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: OllamaPullProgress;
      try {
        parsed = JSON.parse(trimmed) as OllamaPullProgress;
      } catch {
        continue;
      }
      if (parsed.error) {
        lastError = String(parsed.error);
        onProgress?.(parsed);
        throw Object.assign(new Error(lastError), { status: 502 });
      }
      onProgress?.(parsed);
    }
  }

  if (buf.trim()) {
    try {
      const parsed = JSON.parse(buf.trim()) as OllamaPullProgress;
      if (parsed.error) {
        throw Object.assign(new Error(String(parsed.error)), { status: 502 });
      }
      onProgress?.(parsed);
    } catch (e) {
      if (e && typeof e === "object" && "status" in e) throw e;
    }
  }

  return { ok: true, tag: name, host };
}

export function getOllamaHost(): string {
  return ollamaHost();
}
