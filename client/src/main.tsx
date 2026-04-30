import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ConfigBoundary } from "@/components/ConfigBoundary";

if (!window.location.hash) {
  window.location.hash = "#/";
  }

  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ConfigBoundary>
              <App />
                  </ConfigBoundary>
                    </React.StrictMode>,
                    );
                    