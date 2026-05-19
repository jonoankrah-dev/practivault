import { useEffect, useState, type ReactNode } from "react";
import { ensureSupabaseReady } from "@/lib/supabase";

const CONFIG_BOUNDARY_VERSION = "runtime-config-v3";
const CONFIG_TIMEOUT_MS = 12_000;

type State =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function ConfigBoundary({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setState({
        status: "error",
        message: `Timed out after ${CONFIG_TIMEOUT_MS / 1000}s. Check .env SUPABASE_URL and SUPABASE_ANON_KEY, then restart npm run dev.`,
      });
    }, CONFIG_TIMEOUT_MS);

    ensureSupabaseReady()
      .then(() => {
        if (!cancelled) setState({ status: "ready" });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setState({ status: "error", message });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div
        data-config-version={CONFIG_BOUNDARY_VERSION}
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#1a0d13",
          color: "#f9e8f0",
          fontSize: "1.125rem",
        }}
      >
        Loading PractiVault…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
          background: "#fff8f7",
        }}
      >
        <div style={{ maxWidth: 560, textAlign: "left" }}>
          <h1 style={{ fontSize: "1.4rem", margin: 0, color: "#7a1d1d" }}>
            PractiVault could not start
          </h1>
          <p style={{ marginTop: 12, color: "#333" }}>
            Fix your <code>.env</code>, then restart <code>npm run dev</code>.
          </p>
          <p style={{ marginTop: 12, color: "#555", fontSize: "0.9rem" }}>
            Details: <code>{state.message}</code>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
