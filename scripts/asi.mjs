#!/usr/bin/env node
/**
 * Thin ASI Agents CLI — health, agents list, train status.
 * Usage: npm run asi -- <command>
 */
const BASE = (process.env.ASI_API_URL ?? "http://127.0.0.1:3445").replace(/\/$/, "");

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function print(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function usage() {
  console.log(`asi — ASI Agents CLI (${BASE})

Usage:
  npm run asi -- health
  npm run asi -- agents
  npm run asi -- train
  npm run asi -- train status

Env:
  ASI_API_URL   default http://127.0.0.1:3445
`);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const cmd = (args[0] ?? "").toLowerCase();
  const sub = (args[1] ?? "").toLowerCase();

  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
    usage();
    process.exit(cmd ? 0 : 1);
  }

  try {
    if (cmd === "health") {
      print(await getJson("/health"));
      return;
    }
    if (cmd === "agents" || cmd === "agent") {
      const data = await getJson("/api/agents");
      const agents = Array.isArray(data.agents) ? data.agents : [];
      print({
        count: agents.length,
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          status: a.status,
          source: a.source,
        })),
        lastScanAt: data.lastScanAt ?? null,
      });
      return;
    }
    if (cmd === "train") {
      if (sub && sub !== "status") {
        console.error(`Unknown train subcommand: ${sub}`);
        process.exit(1);
      }
      const [fineTune, company] = await Promise.all([
        getJson("/api/train/status"),
        getJson("/api/agents/training"),
      ]);
      print({
        fineTune,
        companyTraining: {
          trainedCount: company.trainedCount ?? 0,
          lastTrainedAt: company.lastTrainedAt ?? null,
          hasBriefing: Boolean(company.briefing),
          agents: Array.isArray(company.agents)
            ? company.agents.map((a) => ({
                id: a.id,
                trainedAt: a.trainedAt,
                learningsCount: a.learningsCount,
              }))
            : [],
        },
      });
      return;
    }
    console.error(`Unknown command: ${cmd}`);
    usage();
    process.exit(1);
  } catch (e) {
    console.error(
      e instanceof Error
        ? `${e.message} — is the API running on ${BASE}?`
        : String(e)
    );
    process.exit(1);
  }
}

main();
