/**
 * Hermes - The Agentic Brain for PractiVault
 *
 * Hermes is the high-level reasoning engine that understands natural language
 * updates from practitioners (e.g. "Just finished the boiler repair at 123 Main St,
 * used 2 valves and 1 pump, customer was happy").
 *
 * It proposes structured actions that Saffi then presents to the user for approval.
 *
 * Current public API (what Saffi calls):
 *   - shouldEscalateToHermes(message)
 *   - sendToHermes(message, context)
 */

// Re-export core types and config for consumers
export * from "./types";
export { HERMES_CONFIG } from "./config";

// Execution Layer (new)
export { executeHermesProposal } from "./executor";
export type { ExecutionContext, ExecutionResult } from "./executor";

// Public API functions
import { HermesResponse } from "./types";
import { HERMES_TRIGGER_KEYWORDS, isJobUpdateMessage } from "./keywords";
import { getHermesReasoning } from "./core/reasoner";
import { HERMES_CONFIG } from "./config";

/**
 * Quick check used by Saffi to decide whether to escalate a message to Hermes.
 * Uses keyword matching as a fast first filter (Phase 1 hybrid approach).
 */
export function shouldEscalateToHermes(message: string): boolean {
  if (!HERMES_CONFIG.enabled) return false;

  const matchesKeyword = isJobUpdateMessage(message);

  if (HERMES_CONFIG.verboseLogging && matchesKeyword) {
    console.log("[Hermes] Message matched trigger keywords — escalating");
  }

  return matchesKeyword;
}

/**
 * Main entry point.
 * Saffi calls this when it wants Hermes to deeply reason about a message.
 *
 * Context can include:
 *   - userId: string
 *   - db: SupabaseClient (recommended) → enables Hermes to search the user's uploaded manuals via RAG
 *   - sectionContext: string
 */
export async function sendToHermes(
  userMessage: string,
  context?: Record<string, any>
): Promise<HermesResponse> {
  if (HERMES_CONFIG.verboseLogging) {
    console.log("[Hermes] sendToHermes called with:", userMessage);
  }

  return await getHermesReasoning(userMessage, context, {
    useMock: HERMES_CONFIG.useMock,
  });
}
