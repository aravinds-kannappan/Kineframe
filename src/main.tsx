import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import WorkspaceApp from "./workspace/WorkspaceApp";
import Experience from "./Experience";
import CircuitSandbox from "./sandbox/CircuitSandbox";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.pathname.startsWith("/lab") ||
    new URLSearchParams(location.search).has("room") ? (
      <App />
    ) : location.pathname.startsWith("/experience") ? (
      <Experience />
    ) : location.pathname.startsWith("/sandbox") ? (
      <CircuitSandbox />
    ) : (
      <WorkspaceApp />
    )}
  </React.StrictMode>,
);
