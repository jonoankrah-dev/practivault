import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class BootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BootErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            minHeight: "100vh",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            background: "#fff5f5",
            color: "#7a1d1d",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", margin: 0 }}>PractiVault failed to load</h1>
          <p style={{ marginTop: 12, color: "#333" }}>Copy this error message:</p>
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              background: "#fff",
              border: "1px solid #fcc",
              borderRadius: 8,
              overflow: "auto",
              fontSize: 13,
              color: "#111",
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
