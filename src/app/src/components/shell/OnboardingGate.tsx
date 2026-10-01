type Props = {
  onSkipToChat: () => void;
  onManualSetup: () => void;
};

export function OnboardingGate({ onSkipToChat, onManualSetup }: Props) {
  return (
    <div className="onboard-overlay" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <div className="onboard-card card">
        <div className="mark onboard-mark" aria-hidden />
        <h1 id="onboard-title">Welcome to ASI Agents</h1>
        <p className="sub">
          Local-first · User ↔ Chief. Pick how you want to start — both paths stay available later in Settings.
        </p>
        <div className="onboard-actions">
          <button type="button" className="btn primary" onClick={onSkipToChat}>
            Skip setup → straight to chat
          </button>
          <button type="button" className="btn" onClick={onManualSetup}>
            Manual setup
          </button>
        </div>
        <p className="onboard-foot">Data stays in %LOCALAPPDATA%/ASI Agents/ on this PC.</p>
      </div>
    </div>
  );
}
