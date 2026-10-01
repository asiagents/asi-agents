/**
 * One-shot: create group "test mode", assign mixed free local + OpenRouter free models
 * to members, seed the Tesla naming prompt. Prefer hitting a live API (:3445).
 *
 * Usage (from repo root, with server running):
 *   npx --yes tsx scripts/seed-test-mode-group.ts
 *   # or: node --experimental-strip-types scripts/seed-test-mode-group.ts
 */
const BASE = process.env.ASI_API_BASE?.replace(/\/$/, "") || "http://127.0.0.1:3445";

const TESLA_PROMPT =
  "Please choose 10 names for an upcoming Tesla car. Debate options as a council — cover style, brand fit, and memorability — then converge on a shortlist of ten.";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status} ${JSON.stringify(body)}`);
  }
  return body as T;
}

type ModelCard = { id: string; paid?: boolean; source?: string; tags?: string[]; provider?: string; kind?: string };

function isAmsCatalogRecipe(m: ModelCard): boolean {
  if (m.kind === "catalog") return true;
  const tags = (m.tags ?? []).map((t) => t.toLowerCase());
  if (tags.includes("catalog")) return true;
  const id = m.id.toLowerCase();
  if (id === "micro" || id === "hybrid" || id === "agentchat" || id === "ultra") return true;
  if (id.startsWith("ams-") && !id.startsWith("ams-gguf:")) return true;
  return false;
}

function isLocalFree(m: ModelCard): boolean {
  if (m.paid === true) return false;
  if (isAmsCatalogRecipe(m)) return false;
  const id = m.id.toLowerCase();
  const tags = (m.tags ?? []).map((t) => t.toLowerCase());
  return (
    id.startsWith("ollama:") ||
    id.startsWith("llamacpp:") ||
    id.startsWith("custom-") ||
    id.startsWith("ams-gguf:") ||
    (m.kind === "scanned" && (tags.includes("local") || tags.includes("ollama")))
  );
}

function isOnlineFree(m: ModelCard): boolean {
  if (m.paid === true) return false;
  if (isAmsCatalogRecipe(m)) return false;
  const id = m.id.toLowerCase();
  return (
    id.startsWith("openrouter:") ||
    id.includes(":free") ||
    (m.provider === "openrouter" && m.paid === false) ||
    m.kind === "api"
  );
}

async function main() {
  console.log(`Seeding against ${BASE}`);

  const agentsRes = await json<{ agents: { id: string; name: string }[] }>("/api/agents");
  const agents = agentsRes.agents ?? [];
  if (!agents.length) throw new Error("GET /api/agents returned no agents");

  const memberIds = agents.map((a) => a.id);
  console.log(`Members (${memberIds.length}): ${agents.map((a) => a.name).join(", ")}`);

  const existing = await json<{ groups: { id: string; name: string }[]; activeGroupId: string }>(
    "/api/groups"
  );
  let group = existing.groups.find((g) => g.name.toLowerCase() === "test mode");
  if (!group) {
    const created = await json<{
      group: { id: string; name: string; memberIds: string[] };
    }>("/api/groups", {
      method: "POST",
      body: JSON.stringify({ name: "test mode", memberIds, activate: true }),
    });
    group = created.group;
    console.log(`Created group ${group.id} (${group.name})`);
  } else {
    await json(`/api/groups/${encodeURIComponent(group.id)}/activate`, { method: "POST" });
    await json(`/api/groups/${encodeURIComponent(group.id)}/members`, {
      method: "PUT",
      body: JSON.stringify({ memberIds }),
    });
    console.log(`Reusing group ${group.id} (${group.name})`);
  }

  await json(`/api/groups/${encodeURIComponent(group.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ session: "open" }),
  });

  const modelsRes = await json<{ models: ModelCard[] }>("/api/models");
  const models = modelsRes.models ?? [];
  const localFree = models
    .filter(isLocalFree)
    .sort((a, b) => {
      const ao = a.id.startsWith("ollama:") ? 0 : 1;
      const bo = b.id.startsWith("ollama:") ? 0 : 1;
      return ao - bo || a.id.localeCompare(b.id);
    });
  const onlineFree = models
    .filter(isOnlineFree)
    .filter((m) => m.id.includes(":free") || m.provider === "openrouter")
    .sort((a, b) => {
      const af = a.id.includes(":free") ? 0 : 1;
      const bf = b.id.includes(":free") ? 0 : 1;
      return af - bf || a.id.localeCompare(b.id);
    });

  console.log(`Free local models: ${localFree.length}; free online: ${onlineFree.length}`);

  const assignments: Record<string, { primary?: string; secondary?: string }> = {};
  const mixLog: string[] = [];
  const nonChief = memberIds.filter((id) => id !== "chief");
  const ordered = memberIds.includes("chief") ? ["chief", ...nonChief] : memberIds;

  for (let i = 0; i < ordered.length; i++) {
    const id = ordered[i]!;
    const useLocal = i % 2 === 0;
    const pool = useLocal
      ? localFree.length
        ? localFree
        : onlineFree
      : onlineFree.length
        ? onlineFree
        : localFree;
    if (!pool.length) {
      mixLog.push(`${id}: (no free models scanned — left unassigned)`);
      continue;
    }
    const primary = pool[i % pool.length]!.id;
    const altPool = useLocal
      ? onlineFree.length
        ? onlineFree
        : localFree
      : localFree.length
        ? localFree
        : onlineFree;
    const secondary =
      altPool.length > 0 ? altPool[(i + 1) % altPool.length]!.id : undefined;
    assignments[id] = { primary, ...(secondary && secondary !== primary ? { secondary } : {}) };
    const lane = useLocal && localFree.length ? "local" : "online-free";
    mixLog.push(`${id}: primary=${primary} (${lane})${secondary ? ` secondary=${secondary}` : ""}`);
  }

  // Ensure every voting member has a runnable primary — never AMS recipes / micro.
  const fallbackPrimary =
    localFree.find((m) => m.id.startsWith("ollama:"))?.id ??
    localFree[0]?.id ??
    onlineFree.find((m) => m.id.includes(":free"))?.id ??
    onlineFree[0]?.id ??
    null;
  for (const id of ordered) {
    if (!assignments[id]?.primary) {
      if (!fallbackPrimary) {
        mixLog.push(`${id}: (no runnable free model — left unassigned)`);
        continue;
      }
      assignments[id] = {
        ...(assignments[id] ?? {}),
        primary: fallbackPrimary,
      };
      mixLog.push(`${id}: primary=${fallbackPrimary} (fallback fill)`);
    }
  }

  if (Object.keys(assignments).length) {
    await json("/api/agents/model-assignments", {
      method: "PUT",
      body: JSON.stringify({ assignments }),
    });
    console.log("Model assignments:");
    for (const line of mixLog) console.log(`  ${line}`);
  } else {
    console.log("Skipped model assignments — no free local/online models from GET /api/models");
  }

  const msgs = await json<{ messages: { text: string; who: string }[] }>(
    `/api/groups/${encodeURIComponent(group.id)}/messages`
  );
  const already = (msgs.messages ?? []).some(
    (m) => m.who === "user" && m.text.includes("10 names for an upcoming Tesla")
  );
  if (!already) {
    await json(`/api/groups/${encodeURIComponent(group.id)}/decide`, {
      method: "POST",
      body: JSON.stringify({ action: "message", text: TESLA_PROMPT }),
    });
    console.log("Seeded Tesla naming prompt");
  } else {
    console.log("Tesla naming prompt already present — skipped");
  }

  const gen = await fetch(`${BASE}/api/groups/${encodeURIComponent(group.id)}/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const genBody = await gen.text();
  console.log(
    `POST generate → ${gen.status}${gen.ok ? " (council round)" : ""} ${genBody.slice(0, 200)}`
  );

  console.log("\nOpen: /group/" + group.id + "  (nav Group → test mode)");
  console.log(`API:  ${BASE}/api/groups/${group.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
