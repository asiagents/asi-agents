import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@theme/App";
import "@theme/index.css";
import { api } from "./api";

function Bootstrap() {
  const [ready, setReady] = useState(false);
  const [firstLaunch, setFirstLaunch] = useState(true);

  useEffect(() => {
    api
      .onboarding()
      .then((ob) => {
        setFirstLaunch(!ob.complete);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="grid h-screen place-items-center bg-bg text-sm text-muted">
        Starting ASI Agents…
      </div>
    );
  }

  return <App firstLaunch={firstLaunch} deskModule={true} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>
);
