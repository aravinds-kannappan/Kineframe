import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Experience from "./Experience";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.pathname.startsWith("/lab") ||
    new URLSearchParams(location.search).has("room") ? (
      <App />
    ) : (
      <Experience />
    )}
  </React.StrictMode>,
);
