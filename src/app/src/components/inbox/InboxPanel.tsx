type Perm = { id: string; title: string; description: string; status: string; kind?: string };
type Draft = { id: string; title: string; meta: string; sent: boolean; channel?: string };

type Props = {
  perms: Perm[];
  drafts: Draft[];
  onOpenPermissions: () => void;
  onOpenChannels: () => void;
  onPermAction: (id: string, action: "approve" | "deny" | "always") => void;
};

export function InboxPanel({ perms, drafts, onOpenPermissions, onOpenChannels, onPermAction }: Props) {
  const pending = perms.filter((p) => p.status === "pending");
  const unsentDrafts = drafts.filter((d) => !d.sent);
  const badge = pending.length + unsentDrafts.length;

  return (
    <div className="inbox-layout">
      <aside className="card inbox-panel">
        <div className="inbox-panel-h">
          <h2>
            Inbox {badge > 0 && <span className="inbox-badge">{badge}</span>}
          </h2>
        </div>
        {pending.length > 0 && (
          <>
            <div className="inbox-section-label">Approvals</div>
            <div className="inbox-list">
              {pending.map((p) => (
                <div key={p.id} className="inbox-item unread">
                  <span className="inbox-av warn">⚙</span>
                  <div className="inbox-meta">
                    <b>{p.title}</b>
                    <span>{p.description}</span>
                    <span className="inbox-chip ask">Ask</span>
                    <div className="inbox-actions">
                      <button type="button" className="btn primary sm" onClick={() => onPermAction(p.id, "approve")}>
                        Approve
                      </button>
                      <button type="button" className="btn danger sm" onClick={() => onPermAction(p.id, "deny")}>
                        Deny
                      </button>
                      <button type="button" className="btn ok sm" onClick={() => onPermAction(p.id, "always")}>
                        Always
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {unsentDrafts.length > 0 && (
          <>
            <div className="inbox-section-label">Channel drafts</div>
            <div className="inbox-list">
              {unsentDrafts.map((d) => (
                <button key={d.id} type="button" className="inbox-item unread" onClick={onOpenChannels}>
                  <span className="inbox-av ok">✉</span>
                  <div className="inbox-meta">
                    <b>{d.title}</b>
                    <span>{d.meta}</span>
                    <span className="inbox-chip channel">{d.channel ?? "channel"}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
        {badge === 0 && (
          <p className="inbox-empty">All caught up — check Group Chat or Permissions for history.</p>
        )}
      </aside>
      <div className="card inbox-feed">
        <div className="inbox-panel-h">
          <h2>Activity</h2>
        </div>
        <div className="inbox-note">
          <strong>Draft-first:</strong> Agents compose channel messages. Nothing sends until you press Send in Channels.
        </div>
        {perms
          .filter((p) => p.status !== "pending")
          .slice(0, 4)
          .map((p) => (
            <div key={p.id} className="feed-item">
              <span className="feed-dot">✓</span>
              <div>
                <b>{p.title}</b>
                <p>Marked {p.status}</p>
              </div>
            </div>
          ))}
        {drafts
          .filter((d) => d.sent)
          .map((d) => (
            <div key={d.id} className="feed-item">
              <span className="feed-dot">→</span>
              <div>
                <b>{d.title}</b>
                <p>Sent (simulated)</p>
              </div>
            </div>
          ))}
        <div className="tools" style={{ padding: 14 }}>
          <button type="button" className="btn sm" onClick={onOpenChannels}>
            Channel drafts
          </button>
          <button type="button" className="btn sm" onClick={onOpenPermissions}>
            Permissions queue
          </button>
        </div>
      </div>
    </div>
  );
}
