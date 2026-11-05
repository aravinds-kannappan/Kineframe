import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import LandingPage from "./landing/LandingPage";
import "./styles.css";
const WorkspaceApp = lazy(() => import("./workspace/WorkspaceApp"));
const path = location.pathname.replace(/\/+$/, "") || "/";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {path === "/" ? (
      <LandingPage />
    ) : path === "/workspace" ? (
      <Suspense
        fallback={
          <div className="route-loading" role="status">
            Opening your workspace…
          </div>
        }
      >
        <WorkspaceApp />
      </Suspense>
    ) : (
      <div className="route-loading">
        <h1>Nothing in this frame.</h1>
        <p>This page is no longer available.</p>
        <a href="/">Back to Kineframe →</a>
      </div>
    )}
  </React.StrictMode>,
);
