/**
 * Hermes configuration
 */

export const HERMES_CONFIG = {
  useMockReasoner: process.env.HERMES_USE_MOCK === "true" || !process.env.XAI_API_KEY,
  maxActionsPerProposal: 6,
  minConfidenceToPropose: 0.45,
  xaiModel: "grok-3-mini",
  timeoutMs: 18_000,
} as const;

export function getXaiApiKey(): string | undefined {
  // Support both env var and convenient xai-api-key.txt file (for users who
  // prefer not to manage terminal environment variables)
  if (process.env.XAI_API_KEY) return process.env.XAI_API_KEY;

  try {
    const fs = require("fs");
    const path = require("path");
    const keyPath = path.join(process.cwd(), "xai-api-key.txt");
    if (fs.existsSync(keyPath)) {
      const key = fs.readFileSync(keyPath, "utf8").trim();
      if (key) return key;
    }
  } catch {
    // ignore — will fall back to undefined
  }
  return undefined;
}
