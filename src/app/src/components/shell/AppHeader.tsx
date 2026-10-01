import type { PanelId } from "../../api";

type Props = {
  onHome: () => void;
  onNavigate: (panel: PanelId) => void;
};

export function AppHeader({ onHome, onNavigate }: Props) {
  return (
    <header className="asi-header">
      <button type="button" className="brand" onClick={onHome}>
        <div className="mark" aria-hidden />
        <div>
          <strong>ASI Agents</strong>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>Local-first · User ↔ Chief</div>
        </div>
      </button>
      <span className="chip">Online</span>
      <div className="header-tools">
        <button type="button" className="hbtn" onClick={() => onNavigate("models")}>
          Models
        </button>
        <button type="button" className="hbtn" onClick={() => onNavigate("permissions")}>
          Perms
        </button>
        <button type="button" className="hbtn critical" onClick={() => onNavigate("settings")}>
          ⚠ Critical
        </button>
        <span className="hbtn" style={{ cursor: "default" }}>
          1234tech
        </span>
      </div>
    </header>
  );
}
