import { useCallback, useEffect, useState } from "react";
import { api } from "@asi-api";
import { asiApiUnreachableMessage } from "@virtual-computer/integration/deskStatusMessage";

type TabInfo = { index: number; url: string; title: string };

type PendingApproval = {
  message: string;
  onApprove: () => void;
  onReject: () => void;
};

export function BrowserPane({ agentId = "research" }: { agentId?: string }) {
  const [deskLive, setDeskLive] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [apiUnreachable, setApiUnreachable] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [url, setUrl] = useState("https://example.com");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingApproval | null>(null);

  const refreshStatus = useCallback(() => {
    api
      .browserStatus()
      .then((s) => {
        const live = s.ok === true && s.live !== false && s.deskLive !== false;
        setApiUnreachable(false);
        setDeskLive(live);
        setStatusError(live ? null : s.error ?? "Desk daemon offline on :3456");
      })
      .catch(() => {
        setDeskLive(false);
        setApiUnreachable(true);
        setStatusError(asiApiUnreachableMessage());
      });
  }, []);

  useEffect(() => {
    refreshStatus();
    const id = window.setInterval(refreshStatus, 8000);
    return () => window.clearInterval(id);
  }, [refreshStatus]);

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    const created = await api.browserCreateSession(agentId, `desk-ui:${agentId}`);
    if (!created.sessionId) {
      throw new Error(created.error ?? "Could not create browser session");
    }
    setSessionId(created.sessionId);
    if (created.tabs) setTabs(created.tabs);
    return created.sessionId;
  }, [agentId, sessionId]);

  const runTool = useCallback(
    async (tool: string, args?: Record<string, unknown>) => {
      setBusy(true);
      setLog(null);
      try {
        const sid = await ensureSession();
        const out = await api.browserTool(sid, tool, args);
        if (out.needsConfirm) {
          setPending({
            message: String(out.message ?? "This action needs your approval."),
            onApprove: () => {
              setPending(null);
              void runTool(tool, { ...args, confirmSensitive: true, confirmed: true });
            },
            onReject: () => {
              setPending(null);
              setLog("Rejected — nothing was sent.");
            },
          });
          return out;
        }
        if (!out.ok) {
          setLog(String(out.error ?? "Tool failed"));
          return out;
        }
        if (Array.isArray(out.tabs)) setTabs(out.tabs as TabInfo[]);
        if (typeof out.url === "string") setLog(`${tool} → ${out.url}`);
        else setLog(`${tool} ok`);
        return out;
      } catch (e) {
        setLog(e instanceof Error ? e.message : "Browser tool failed");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [ensureSession],
  );

  const onOpen = () => {
    void runTool("open", { url: url.trim() });
  };

  const onSnapshot = () => {
    void runTool("snapshot");
  };

  if (deskLive === false) {
    return (
      <div className="border-t border-line bg-[#0b0d13] px-4 py-6 text-center text-[13px] text-[#9aa3b5]">
        <p className="font-medium text-[#e8eaf0]">
          {apiUnreachable ? "ASI API unreachable" : "Desk offline"}
        </p>
        <p className="mt-2">{statusError}</p>
        {!apiUnreachable && (
          <p className="mt-2 text-[11px] text-[#6b7385]">
            Start Virtual Desk on :3456 — browser tools stay fail-closed (no fake success).
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-[#0b0d13] text-[#c5cad6]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <label className="sr-only" htmlFor="browser-url">
          URL
        </label>
        <input
          id="browser-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#12151c] px-2 py-1.5 font-mono text-[12px]"
          disabled={busy}
        />
        <button
          type="button"
          onClick={onOpen}
          disabled={busy || deskLive !== true}
          className="rounded-full bg-accent-strong px-3 py-1 text-[12px] font-medium text-white disabled:opacity-40"
        >
          Open
        </button>
        <button
          type="button"
          onClick={onSnapshot}
          disabled={busy || deskLive !== true}
          className="rounded-full px-3 py-1 text-[12px] ring-1 ring-white/15 disabled:opacity-40"
        >
          Snapshot
        </button>
      </div>
      {tabs.length > 0 && (
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {tabs.map((t) => (
            <span
              key={t.index}
              className="shrink-0 rounded-md bg-white/5 px-2 py-1 font-mono text-[10px] text-[#9aa3b5]"
              title={t.url}
            >
              {t.title || t.url || `Tab ${t.index + 1}`}
            </span>
          ))}
        </div>
      )}
      {pending && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px]">
          <span className="text-amber-100">{pending.message}</span>
          <button type="button" className="rounded-full bg-success/20 px-2 py-0.5 text-success" onClick={pending.onApprove}>
            Approve
          </button>
          <button type="button" className="rounded-full px-2 py-0.5 ring-1 ring-line" onClick={() => setLog("Ask more — refine the action in chat.")}>
            Ask more
          </button>
          <button type="button" className="rounded-full bg-danger/20 px-2 py-0.5 text-danger" onClick={pending.onReject}>
            Reject
          </button>
        </div>
      )}
      {log && <p className="px-3 py-2 font-mono text-[11px] text-[#9aa3b5]">{log}</p>}
    </div>
  );
}
