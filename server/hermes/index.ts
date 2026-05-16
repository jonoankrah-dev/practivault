/**
 * Hermes Agent - Main Brain for PractiVault
 * 
 * Hermes is the self-improving autonomous brain powered by Grok.
 * 
 * Current Responsibilities (Phase 1):
 * - Receive messages that Saffi escalates
 * - Reason about what actions should be taken
 * - Return structured proposals for user approval
 * 
 * Future (Phase 2):
 * - Connect with PAI for long-term memory and goals
 * - Self-improvement based on user feedback
 * - More complex multi-step workflows
 */

import { HermesResponse } from "./types";
import { HERMES_TRIGGER_KEYWORDS } from "./keywords";
import { getHermesReasoning } from "./reasoner";

// ============================================
// Configuration (we can move this to env later)
// ============================================
const HERMES_CONFIG = {
  // This will eventually point to your Hermes Agent (Grok-powered)
  // For now we're using a mock while we build the structure
  enabled: true,
  useMock: true, // Set to false once real Grok integration is ready
};

// ============================================
// Keyword Detection (Hybrid approach - Phase 1)
// ============================================

/**
 * Checks if a user message should be escalated to Hermes.
 * Currently uses simple keyword matching.
 * Later we can make this smarter (LLM-based routing, embeddings, etc.)
 */
export function shouldEscalateToHermes(message: string): boolean {
  if (!HERMES_CONFIG.enabled) return false;

  const lowerMessage = message.toLowerCase();

  return HERMES_TRIGGER_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase())
  );
}

// ============================================
// Main Hermes Function
// ============================================

/**
 * This is the main function Saffi will call when it wants Hermes to handle something.
 * 
 * Right now it returns a mock proposal.
 * Later this will call your actual Hermes Agent (Grok) via API.
 */
/**
 * Main entry point for sending a message to Hermes.
 * This is what Saffi (or other parts of the system) will call.
 */
export async function sendToHermes(
  userMessage: string,
  context?: Record<string, any>
): Promise<HermesResponse> {
  console.log("[Hermes] Processing message:", userMessage);

  return await getHermesReasoning(userMessage, context, {
    useMock: HERMES_CONFIG.useMock,
  });
}