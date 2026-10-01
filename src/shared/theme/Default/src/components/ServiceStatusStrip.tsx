import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ServiceEntry } from "@asi-api";
import { usePendingPermissions } from "../hooks/usePendingPermissions";

type Health = { ok?: boolean; status?: string };

/** Compact API + registry strip (Settings → Connections for detail). */
export function ServiceStatusStrip() {
  const [health, setHealth] = useState<"live" | "off" | "checking">("checking");
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const { pendingCount, offline: permsOffline } = usePendingPermissions();

  const refresh = () => {
    setHealth("checking");
    Promise.all([
      api.health().then(() => setHealth("live")).catch(() => setHealth("off")),
      api.registry().then((r) => setServices(r.services)).catch(() => setServices([])),
    ]);
  };

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const liveCount = services.filter((s) => s.status === "live").length;

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-raised/80 px-4 py-1.5 text-[11px] text-muted"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${health === "live" ? "bg-success" : health === "off" ? "bg-danger" : "bg-warn"}`}
          aria-hidden="true"
        />
        API {health === "live" ? ":3445" : health === "off" ? "offline" : "…"}
      </span>
      <span>
        Registry · {services.length ? `${liveCount}/${services.length} live` : "—"}
      </span>
      <span>
        Permissions ·{" "}
        {permsOffline ? (
          "offline"
        ) : pendingCount != null && pendingCount > 0 ? (
          <a href="/permissions" target="_blank" rel="noopener noreferrer" className="font-medium text-warn hover:underline">
            {pendingCount} pending ↗
          </a>
        ) : (
          "none pending"
        )}
      </span>
      <Link to="/settings/connections" className="ml-auto font-medium text-accent-ink hover:underline">
        Services
      </Link>
    </div>
  );
}
