import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ConfigBoundary } from "@/components/ConfigBoundary";
import { BootErrorBoundary } from "@/components/BootErrorBoundary";

if (!window.location.hash) {
  window.location.hash = "#/login";
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BootErrorBoundary>
      <ConfigBoundary>
        <App />
      </ConfigBoundary>
    </BootErrorBoundary>
  </React.StrictMode>,
);
