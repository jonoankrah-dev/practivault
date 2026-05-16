/**
 * Hermes Reasoner
 * 
 * This file is responsible for getting a reasoned response from Hermes.
 * Currently uses an improved mock. Later it will make real calls to Grok.
 */

import { HermesResponse, HermesProposal, HermesAction } from "./types";
import { HERMES_CONFIG } from "./config";
import { HERMES_TOOLS } from "./tools";

export interface ReasonerOptions {
  useMock?: boolean;
}

/**
 * Main entry point for getting reasoning from Hermes.
 */
export async function getHermesReasoning(
  userMessage: string,
  context?: Record<string, any>,
  options: ReasonerOptions = {}
): Promise<HermesResponse> {
  const useMock = options.useMock ?? HERMES_CONFIG.useMock;

  if (HERMES_CONFIG.verboseLogging) {
    console.log("[Hermes] Reasoning requested for:", userMessage);
  }

  if (useMock) {
    return generateSmartMockResponse(userMessage, context);
  }

  // Real Grok call will go here later
  return {
    shouldEscalate: false,
    directReply: "Real Hermes (Grok) is not connected yet.",
  };
}

/**
 * Improved mock that tries to understand job updates better.
 */
function generateSmartMockResponse(
  userMessage: string,
  context?: Record<string, any>
): HermesResponse {
  const lower = userMessage.toLowerCase();
  const actions: HermesAction[] = [];

  // Detect job completion
  const isJobFinished =
    lower.includes("finished") ||
    lower.includes("completed") ||
    lower.includes("done") ||
    lower.includes("wrapped up");

  // Detect materials used
  const materialsUsed = extractMaterials(userMessage);

  if (isJobFinished) {
    actions.push({
      type: "complete_job",
      payload: { jobId: context?.jobId || "auto-detected" },
      description: "Mark the job as completed",
    });

    if (materialsUsed.items.length > 0) {
      actions.push({
        type: "deduct_inventory",
        payload: materialsUsed,
        description: `Remove ${materialsUsed.items.join(", ")} from stock`,
      });
    }

    actions.push({
      type: "create_note",
      payload: { note: userMessage },
      description: "Log the technician's update",
    });

    const proposal: HermesProposal = {
      summary: "Mark job as complete and update inventory based on materials mentioned.",
      actions,
      reasoning: "User indicated the job is finished and listed specific parts used.",
      confidence: HERMES_CONFIG.mockConfidence,
    };

    return { shouldEscalate: true, proposal };
  }

  // Just inventory update
  if (materialsUsed.items.length > 0) {
    actions.push({
      type: "deduct_inventory",
      payload: materialsUsed,
      description: "Update inventory",
    });

    const proposal: HermesProposal = {
      summary: "Update inventory based on materials mentioned.",
      actions,
      reasoning: "Message contains references to materials being used.",
      confidence: 0.65,
    };

    return { shouldEscalate: true, proposal };
  }

  // No clear action detected
  return {
    shouldEscalate: false,
    directReply: "I received your message but couldn't identify any clear actions to propose.",
  };
}

/**
 * Basic material extraction (will be replaced by real NLP from Grok).
 */
function extractMaterials(message: string) {
  const items: string[] = [];
  const quantities: number[] = [];

  const lower = message.toLowerCase();

  const parts = ["valve", "valves", "pump", "pumps", "pipe", "pipes", "fitting", "fittings"];

  parts.forEach((part) => {
    if (lower.includes(part)) {
      items.push(part.replace(/s$/, "")); // normalize plural
    }
  });

  // Very naive quantity detection
  const quantityMatch = message.match(/(\d+)\s*(valve|pump|pipe|fitting)/i);
  if (quantityMatch) {
    quantities.push(parseInt(quantityMatch[1]));
  } else {
    quantities.push(...Array(items.length).fill(1));
  }

  return {
    items: items.length > 0 ? items : ["unknown"],
    quantities,
  };
}