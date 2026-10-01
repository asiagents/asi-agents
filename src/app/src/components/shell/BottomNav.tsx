import type { PanelId } from "../../api";

const PRIMARY: { id: PanelId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "group", label: "Group" },
  { id: "desk", label: "Apps" },
  { id: "inbox", label: "Inbox" },
  { id: "settings", label: "Settings" },
];

type Props = {
  panel: PanelId;
  onNavigate: (panel: PanelId) => void;
};

export function BottomNav({ panel, onNavigate }: Props) {
  return (
    <footer className="asi-footer">
      <nav className="nav-pill" aria-label="Primary">
        {PRIMARY.map(({ id, label }) => (
          <button key={id} type="button" className={panel === id ? "active" : ""} onClick={() => onNavigate(id)}>
            {label}
          </button>
        ))}
        <button type="button" disabled style={{ opacity: 0.4 }} title="Office — later module">
          Office — later
        </button>
      </nav>
      <nav className="nav-secondary" aria-label="Secondary">
        <button type="button" onClick={() => onNavigate("permissions")}>
          Permissions
        </button>
        <button type="button" onClick={() => onNavigate("channels")}>
          Channels
        </button>
        <button type="button" onClick={() => onNavigate("models")}>
          Models
        </button>
        <button type="button" onClick={() => onNavigate("desk")}>
          Virtual Computer
        </button>
      </nav>
    </footer>
  );
}
