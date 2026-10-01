import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DESK_SETUP_STEPS,
  asiApiUnreachableMessage,
  classifyDeskUiFailure,
  deskUiHeadline,
} from "../integration/deskStatusMessage";
import { deskHasVnc, deskStatusLine, summarizeDesks, type DeskRow } from "../integration/deskSummary";
import { fetchDeskStatusWithAutostart } from "../integration/ensureDeskClient";

type DeskStatus = {
  live: boolean;
  url: string;
  consoleUrl: string;
  launchHint: string;
  externalRepoPath: string;
  state?: "live" | "not_running" | "http_error";
  kind?: string;
  error?: string;
  setupMessage?: string;
  setupSteps?: string[];
  httpStatus?: number;
  probeOk?: boolean;
  dockerAvailable?: boolean;
  dockerMessage?: string;
  deskCount?: number;
  runningCount?: number;
  hibernatedCount?: number;
  stoppedCount?: number;
  headlessCount?: number;
  visibleCount?: number;
  desks?: unknown;
};

type TabInfo = { index: number; url?: string; title?: string; active?: boolean };

type PendingConfirm = {
  message: string;
  kind?: string;
  sessionId: string;
  tool: string;
  args: Record<string, unknown>;
};

type ResearchHit = { title: string; url: string; source?: string };

const DEFAULT_HINT =
  "Desk optional — set ASI_DESK_REPO, then: python daemon/desk_daemon.py";
const DEFAULT_REPO = "";
const ADV_KEY = "asi.desk.showAgentBrowserTools";

async function deskFetch(path: string, init?: RequestInit) {
  const r = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

function deskLabel(d: DeskRow, index: number): string {
  return String(d.deskId || d.agentId || `Desk ${index + 1}`);
}

function deskMeta(d: DeskRow): string {
  const bits = [d.status, d.mode, d.runtime].filter(Boolean).map(String);
  return bits.join(" · ") || "—";
}

/** Product Desk surface — list + live preview by default; agent browser tools collapsed. */
export function VirtualComputerPanel({ deskLive }: { deskLive?: boolean }) {
  const [status, setStatus] = useState<DeskStatus | null>(null);
  const [statusApiError, setStatusApiError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(() => {
    try {
      return window.localStorage.getItem(ADV_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState("research");
  const [threadId, setThreadId] = useState("desk-ui");
  const [urlInput, setUrlInput] = useState("https://example.com");
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [snapshotRefs, setSnapshotRefs] = useState<{ ref: string; role?: string; name?: string }[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [researchQ, setResearchQ] = useState("");
  const [citations, setCitations] = useState<ResearchHit[]>([]);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchDeskStatusWithAutostart()
        .then(async (r) => {
          const j = (await r.json()) as DeskStatus;
          if (!r.ok) {
            if (!cancelled) {
              setStatusApiError(j.error ?? j.setupMessage ?? `Desk status API returned ${r.status}.`);
              setStatus(j);
            }
            return;
          }
          if (!cancelled) {
            setStatusApiError(null);
            setStatus(j);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatusApiError(asiApiUnreachableMessage());
            setStatus(null);
          }
        });
    };

    load();
    const id = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const live = deskLive ?? status?.live ?? false;
  const consoleUrl = status?.consoleUrl ?? "http://127.0.0.1:3456/?embed=1";
  const hint = status?.launchHint ?? DEFAULT_HINT;
  const repo = status?.externalRepoPath ?? DEFAULT_REPO;
  const steps = status?.setupSteps?.length ? status.setupSteps : [...DESK_SETUP_STEPS];
  const desks = useMemo(() => (live ? summarizeDesks(status?.desks).desks : []), [live, status?.desks]);
  const summary = useMemo(() => {
    const fromList = summarizeDesks(live ? status?.desks : []);
    return {
      desks: fromList.desks,
      deskCount: status?.deskCount ?? fromList.deskCount,
      runningCount: status?.runningCount ?? fromList.runningCount,
      hibernatedCount: status?.hibernatedCount ?? fromList.hibernatedCount,
      stoppedCount: status?.stoppedCount ?? fromList.stoppedCount,
      headlessCount: status?.headlessCount ?? fromList.headlessCount,
      visibleCount: status?.visibleCount ?? fromList.visibleCount,
    };
  }, [live, status]);
  const {
    runningCount,
    hibernatedCount,
    stoppedCount,
    headlessCount,
    visibleCount,
    deskCount,
  } = summary;
  const hasVnc = desks.some(deskHasVnc);
  const statusChip = live ? deskStatusLine(summary) : null;
  const failureKind = classifyDeskUiFailure({
    apiUnreachable: Boolean(statusApiError),
    live: status?.live,
    dockerAvailable: status?.dockerAvailable,
    state: status?.state,
  });
  const dockerNote =
    status?.live && status.dockerAvailable === false
      ? status.dockerMessage ??
        "Docker is optional — local desks still work. Start Docker only for container previews."
      : null;
  const offlineDetail =
    statusApiError ??
    status?.error ??
    status?.setupMessage ??
    "ASI Agents Desk is offline. Start the Desk daemon to see live previews.";

  const setAdvancedOpen = (open: boolean) => {
    setShowAdvanced(open);
    try {
      window.localStorage.setItem(ADV_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const runTool = async (tool: string, args: Record<string, unknown> = {}, sid = sessionId) => {
    if (!sid) {
      pushLog("No session — create one first.");
      return null;
    }
    setBusy(true);
    try {
      const { status: st, body } = await deskFetch(`/api/desk/browser/sessions/${sid}/tools`, {
        method: "POST",
        body: JSON.stringify({ tool, args }),
      });
      if (body?.offline) {
        pushLog(`OFFLINE: ${body.error || "desk down"}`);
        return body;
      }
      if (body?.needsConfirm) {
        setPending({
          message: String(body.message || "Confirm required"),
          kind: body.kind,
          sessionId: sid,
          tool,
          args,
        });
        pushLog(`CONFIRM: ${tool} — ${body.message}`);
        return body;
      }
      if (!body?.ok) {
        pushLog(`FAIL ${tool} (${st}): ${body?.error || "error"}`);
      } else {
        pushLog(`OK ${tool}`);
      }
      if (tool === "snapshot" && Array.isArray(body?.refs)) {
        setSnapshotRefs(body.refs.slice(0, 40));
      }
      if (Array.isArray(body?.tabs)) setTabs(body.tabs);
      return body;
    } finally {
      setBusy(false);
    }
  };

  const createSession = async () => {
    setBusy(true);
    try {
      const { body } = await deskFetch("/api/desk/browser/sessions", {
        method: "POST",
        body: JSON.stringify({ agentId, threadId }),
      });
      if (body?.offline || !body?.ok) {
        pushLog(`Session failed: ${body?.error || "offline"}`);
        setSessionId(null);
        return;
      }
      setSessionId(body.sessionId);
      setTabs(body.tabs || []);
      pushLog(`Session ${body.sessionId} (${body.mode || "cdp"})`);
    } finally {
      setBusy(false);
    }
  };

  const approvePending = async (decision: "approve" | "reject" | "ask_more") => {
    if (!pending) return;
    if (decision === "reject") {
      setPending(null);
      pushLog("Rejected pending confirm");
      return;
    }
    if (decision === "ask_more") {
      pushLog("Ask more — agent should clarify with user");
      setPending(null);
      return;
    }
    const args = { ...pending.args, confirmSensitive: true, confirmed: true };
    setPending(null);
    await runTool(pending.tool, args, pending.sessionId);
  };

  const doResearch = async (kind: "movie" | "song") => {
    if (!researchQ.trim()) return;
    setBusy(true);
    try {
      const { body } = await deskFetch(`/api/desk/research/${kind}`, {
        method: "POST",
        body: JSON.stringify({ query: researchQ, agentId, threadId: `${threadId}:${kind}` }),
      });
      if (body?.offline) {
        pushLog(`Research offline: ${body.error}`);
        setCitations([]);
        return;
      }
      const cites = (body?.citations || []) as ResearchHit[];
      setCitations(cites);
      pushLog(
        body?.ok
          ? `Research ${kind}: ${cites.length} links${body.stubPath ? " (stub path)" : ""}`
          : `Research failed: ${body?.error}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-card bg-surface ring-1 ring-line">
      {/* Default product strip — status counts, not lab chrome */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <span className="text-[13px] font-semibold text-ink">ASI Agents Desk</span>
        {live && statusChip ? (
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success ring-1 ring-success/25">
            {statusChip}
          </span>
        ) : (
          <span className="rounded-full bg-overlay/[0.05] px-2.5 py-1 text-[11px] font-medium text-muted ring-1 ring-line">
            Offline
          </span>
        )}
        {live && dockerNote ? (
          <span className="text-[11px] text-muted" title={dockerNote}>
            Docker optional
          </span>
        ) : null}
      </div>

      {/* Live preview — console when VNC; status cards when headless (no blank iframe) */}
      <div className="min-h-[min(280px,40vh)] bg-[#0b0d13]">
        {live ? (
          hasVnc || desks.length === 0 ? (
            <iframe
              title="ASI Agents Desk"
              src={consoleUrl}
              className="h-[min(280px,40vh)] w-full border-0 bg-[#0b0d13]"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          ) : (
            <div className="flex h-[min(280px,40vh)] flex-col gap-2 overflow-y-auto p-3">
              <p className="text-[11px] font-medium text-[#93c5fd]">
                headless — no VNC stream · {deskStatusLine(summary)}
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {desks.map((d, i) => (
                  <li
                    key={String(d.deskId || d.agentId || i)}
                    className="rounded-lg border border-white/10 bg-[#12151c] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          String(d.status).toLowerCase() === "running" ? "bg-[#34d399]" : "bg-[#6b7385]"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate font-mono text-[12px] text-[#e8eaf0]">{deskLabel(d, i)}</span>
                      <span className="ml-auto text-[10px] text-[#9aa3b5]">{deskMeta(d)}</span>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-snug text-[#6b7385]">
                      {typeof d.note === "string" && d.note
                        ? d.note
                        : "Local Playwright — agents drive via browser API (no noVNC). Use Advanced → Snapshot/screenshot."}
                    </p>
                  </li>
                ))}
              </ul>
              <a
                href={consoleUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-auto text-[11px] font-medium text-[#93c5fd] hover:underline"
              >
                Open Desk console →
              </a>
            </div>
          )
        ) : (
          <div className="flex min-h-[min(280px,40vh)] flex-col items-center justify-center px-6 py-10 text-center">
            <p className="text-[15px] font-semibold text-[#e8eaf0]">{deskUiHeadline(failureKind)}</p>
            <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-[#9aa3b5]">{offlineDetail}</p>
            {statusApiError ? (
              <p className="mt-3 max-w-md text-[11px] text-[#6b7385]">
                Open ASI Agents on this machine and restart the app API if needed.
              </p>
            ) : (
              <>
                <p className="mt-4 text-[12px] text-[#9aa3b5]">
                  Desk runtime:{" "}
                  <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-[#c5cad6]">{repo}</code>
                </p>
                <pre className="mt-3 max-w-full overflow-x-auto rounded-lg border border-white/10 bg-[#12151c] px-4 py-3 text-left font-mono text-[11px] leading-relaxed text-[#c5cad6]">
                  {hint}
                </pre>
                <ol className="mt-4 max-w-lg list-decimal space-y-1 pl-5 text-left text-[11px] leading-relaxed text-[#9aa3b5]">
                  {steps.map((step) => (
                    <li key={step}>
                      <code className="font-mono text-[11px] text-[#c5cad6]">{step}</code>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </div>

      {/* Desks list — default product view */}
      <div className="border-t border-line px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-faint">Desks</h3>
          {live ? (
            <span className="text-[11px] text-muted">
              {runningCount} running · {headlessCount} headless
              {visibleCount > 0 ? ` · ${visibleCount} visible` : ""}
            </span>
          ) : null}
        </div>
        {!live ? (
          <p className="text-[13px] text-muted">No desks while Desk is offline.</p>
        ) : desks.length === 0 ? (
          <p className="text-[13px] text-muted">Daemon is live — waiting for desks to appear.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg ring-1 ring-line">
            {desks.map((d, i) => (
              <li key={String(d.deskId || d.agentId || i)} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    String(d.status).toLowerCase() === "running" ? "bg-success" : "bg-faint"
                  }`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{deskLabel(d, i)}</span>
                <span className="text-[11px] text-muted">{deskMeta(d)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Agent browser tools — advanced / collapsed by default */}
      <details
        className="border-t border-line bg-bg/30"
        open={showAdvanced}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer select-none px-4 py-3 text-[12px] font-medium text-muted hover:text-ink">
          Advanced · Agent browser tools
          <span className="ml-2 font-normal text-faint">Sessions, research stubs, probe notes</span>
        </summary>
        <div className="space-y-3 border-t border-line px-4 py-3">
          <p className="text-[11px] text-faint">
            Developer controls for CDP sessions. Panic stays in the ASI Agents header — not duplicated here.
            Also under Settings → Modules → Virtual Computer.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-24 rounded-md bg-surface px-2 py-1 text-[12px] ring-1 ring-line"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              aria-label="agentId"
              title="agentId"
            />
            <input
              className="w-28 rounded-md bg-surface px-2 py-1 text-[12px] ring-1 ring-line"
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              aria-label="threadId"
              title="threadId"
            />
            <button
              type="button"
              disabled={!live || busy}
              onClick={createSession}
              className="rounded-full bg-accent-strong px-3 py-1 text-[12px] font-medium text-white disabled:opacity-40"
            >
              New session
            </button>
            {sessionId && (
              <span className="max-w-[180px] truncate font-mono text-[11px] text-muted" title={sessionId}>
                {sessionId}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[200px] flex-1 rounded-md bg-surface px-2 py-1.5 text-[13px] ring-1 ring-line"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              aria-label="URL"
              placeholder="https://example.com"
            />
            <button
              type="button"
              disabled={!live || !sessionId || busy}
              onClick={() => runTool("open", { url: urlInput })}
              className="rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-line disabled:opacity-40"
            >
              Open
            </button>
            <button
              type="button"
              disabled={!live || !sessionId || busy}
              onClick={() => runTool("snapshot")}
              className="rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-line disabled:opacity-40"
            >
              Snapshot
            </button>
            <button
              type="button"
              disabled={!live || !sessionId || busy}
              onClick={() => runTool("read")}
              className="rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-line disabled:opacity-40"
            >
              Read
            </button>
          </div>

          {tabs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tabs.map((t) => (
                <button
                  key={t.index}
                  type="button"
                  disabled={busy}
                  onClick={() => runTool("tabs", { action: "switch", index: t.index })}
                  className={`max-w-[160px] truncate rounded-md px-2 py-1 text-[11px] ring-1 ${
                    t.active ? "bg-accent-strong/20 ring-accent-strong text-ink" : "ring-line text-muted"
                  }`}
                  title={t.url}
                >
                  {t.title || t.url || `Tab ${t.index}`}
                </button>
              ))}
            </div>
          )}

          {pending && (
            <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2">
              <p className="text-[13px] text-ink">{pending.message}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => approvePending("approve")}
                  className="rounded-full bg-accent-strong px-3 py-1 text-[12px] font-medium text-white"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => approvePending("ask_more")}
                  className="rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-line"
                >
                  Ask more
                </button>
                <button
                  type="button"
                  onClick={() => approvePending("reject")}
                  className="rounded-full bg-danger/80 px-3 py-1 text-[12px] font-medium text-white"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {snapshotRefs.length > 0 && (
            <div className="max-h-28 overflow-y-auto rounded-md bg-surface p-2 ring-1 ring-line">
              <p className="mb-1 text-[11px] text-faint">a11y refs (click to activate)</p>
              <div className="flex flex-wrap gap-1">
                {snapshotRefs.map((r) => (
                  <button
                    key={r.ref}
                    type="button"
                    disabled={busy}
                    onClick={() => runTool("click", { ref: r.ref })}
                    className="rounded px-1.5 py-0.5 font-mono text-[10px] text-muted ring-1 ring-line hover:text-ink"
                    title={`${r.role || ""} ${r.name || ""}`}
                  >
                    {r.ref}:{r.name || r.role || "?"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <input
              className="min-w-[180px] flex-1 rounded-md bg-surface px-2 py-1.5 text-[13px] ring-1 ring-line"
              value={researchQ}
              onChange={(e) => setResearchQ(e.target.value)}
              placeholder="Find movie or song…"
              aria-label="Research query"
            />
            <button
              type="button"
              disabled={!live || busy}
              onClick={() => doResearch("movie")}
              className="rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-line disabled:opacity-40"
            >
              Movie
            </button>
            <button
              type="button"
              disabled={!live || busy}
              onClick={() => doResearch("song")}
              className="rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-line disabled:opacity-40"
            >
              Song
            </button>
          </div>
          {citations.length > 0 && (
            <ul className="space-y-1 text-[12px] text-muted">
              {citations.map((c) => (
                <li key={c.url}>
                  <a className="text-accent-ink hover:underline" href={c.url} target="_blank" rel="noreferrer">
                    {c.title}
                  </a>{" "}
                  <span className="text-faint">({c.source})</span>
                </li>
              ))}
            </ul>
          )}

          {log.length > 0 && (
            <pre className="max-h-24 overflow-y-auto rounded-md bg-[#12151c] p-2 font-mono text-[10px] text-[#9aa3b5]">
              {log.join("\n")}
            </pre>
          )}

          <p className="border-t border-line pt-3 text-[11px] text-faint">
            Local desk defaults to open loopback (no VNC password). Agents use CDP / Playwright; human watch uses
            the preview above when available.
            {live && status?.url ? (
              <span className="ml-1 font-mono">Probe: {status.url}</span>
            ) : status?.state ? (
              <span className="ml-1">Status: {status.state.replace("_", " ")}</span>
            ) : null}
          </p>
        </div>
      </details>
    </div>
  );
}
