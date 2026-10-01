/**
 * Reference ASI SLM router — bind 127.0.0.1:7821 only.
 * Contract: models/router/README.md
 * Forwards POST /v1/chat/completions to Ollama or OpenAI-compat local; fails closed (502) when none answer.
 * Does not load AMS ONNX from models/ams/ — those files mark AMS "installed" for Select/UI only until an ONNX hop ships.
 */
import http from "node:http";

const HOST = process.env.ASI_ROUTER_HOST ?? "127.0.0.1";
const PORT = Number(process.env.ASI_ROUTER_PORT ?? "7821");
const OLLAMA = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const LLAMA_CPP = (process.env.LLAMA_CPP_HOST ?? process.env.OPENAI_BASE_URL ?? "").replace(
  /\/$/,
  ""
);

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function pickModel(body) {
  if (body?.model && String(body.model).trim()) return String(body.model).trim();
  return process.env.ASI_CHAT_MODEL?.trim() || "llama3.2";
}

function messagesToOllamaPrompt(messages) {
  const parts = [];
  for (const m of messages ?? []) {
    const role = m?.role ?? "user";
    const content = String(m?.content ?? "").trim();
    if (!content) continue;
    parts.push(`${role}: ${content}`);
  }
  parts.push("assistant:");
  return parts.join("\n\n");
}

async function forwardOllama(model, messages) {
  const prompt = messagesToOllamaPrompt(messages);
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = data.response?.trim();
  if (!text) return null;
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    model,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
  };
}

async function forwardLlamaCpp(model, messages, maxTokens) {
  if (!LLAMA_CPP) return null;
  const res = await fetch(`${LLAMA_CPP}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      max_tokens: maxTokens ?? 512,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) return null;
  return res.json();
}

async function handleChatCompletions(body) {
  const model = pickModel(body);
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const maxTokens = body?.max_tokens ?? 512;

  let payload = await forwardLlamaCpp(model, messages, maxTokens);
  if (!payload?.choices?.[0]?.message?.content) {
    payload = await forwardOllama(model, messages);
  }
  return payload;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "asi-router", port: PORT });
    }
    if (req.method === "GET" && url.pathname === "/v1/models") {
      return json(res, 200, { object: "list", data: [] });
    }
    if (req.method === "POST" && url.pathname === "/admin/unload") {
      return json(res, 501, { error: "unload_not_implemented", detail: "Reference router has no loaded weights." });
    }
    if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      const body = await readJson(req);
      const payload = await handleChatCompletions(body);
      if (!payload?.choices?.[0]?.message?.content) {
        return json(res, 502, {
          error: "upstream_unavailable",
          detail: "No Ollama or llama.cpp/OpenAI-compat backend answered.",
        });
      }
      return json(res, 200, payload);
    }
    json(res, 404, { error: "not_found" });
  } catch (e) {
    json(res, 500, { error: "internal", detail: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`asi-router (reference) http://${HOST}:${PORT}`);
});
