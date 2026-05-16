/**
 * Hermes Reasoner
 * 
 * This file handles getting a reasoned response from Hermes.
 * Currently uses a smart mock. Later it will call your real Grok-powered Hermes Agent.
 */

import { HermesResponse, HermesProposal } from "./types";
import { HERMES_CONFIG } from "./config";
import { HERMES_TOOLS } from "./tools";

export interface ReasonerOptions {
  useMock?: boolean;
}

/**
 * Main function that will eventually call your Hermes Agent (Grok).
 */
export async function getHermesReasoning(
  userMessage: string,
  context?: Record<string, any>,
  options: ReasonerOptions = {}
): Promise<HermesResponse> {
  const useMock = options.useMock ?? HERMES_CONFIG.useMock;

  if (HERMES_CONFIG.verboseLogging) {
    console.log("[Hermes Reasoner] Processing message:", userMessage);
  }

  if (useMock) {
    return getImprovedMockResponse(userMessage);
  }

  // Future real implementation will go here
  return {
    shouldEscalate: false,
    directReply: "Real Hermes Agent is not connected yet.",
  };
}

/**
 * Improved mock response with better logic.
 */
function getImprovedMockResponse(userMessage: string): HermesResponse {
  const lower = userMessage.toLowerCase();

  // Job completion + materials used
  if (
    (lower.includes("finished") || lower.includes("completed") || lower.includes("done")) &&
    (lower.includes("used") || lower.includes("valve") || lower.includes("pump"))
  ) {
    const proposal = {
      summary: "Mark job as complete and deduct used materials from inventory.",
      actions: [
        {
          type: "complete_job",
          payload: { jobId: "auto-detected" },
          description: "Mark the job as completed",
        },
        {
          type: "deduct_inventory",
          payload: extractMaterials(userMessage),
          description: "Remove used parts from stock",
        },
        {
          type: "create_note",
          payload: { note: userMessage },
          description: "Log the technician's update",
        },
      ],
      reasoning: "User clearly stated the job is finished and listed specific materials used.",
      confidence: HERMES_CONFIG.mockConfidence,
    };

    return { shouldEscalate: true, proposal };
  }

  // Just mentions finishing a job
  if (lower.includes("finished") || lower.includes("completed")) {
    const proposal = {
      summary: "Mark the referenced job as complete.",
      actions: [
        {
          type: "complete_job",
          payload: { jobId: "auto-detected" },
          description: "Mark job as completed",
        },
        {
          type: "create_note",
          payload: { note: userMessage },
          description: "Add user's note to the job",
        },
      ],
      reasoning: "User indicated the job is finished.",
      confidence: 0.75,
    };

    return { shouldEscalate: true, proposal };
  }

  // Inventory related only
  if (lower.includes("used") || lower.includes("stock") || lower.includes("inventory")) {
    const proposal = {
      summary: "Update inventory based on materials mentioned.",
      actions: [
        {
          type: "deduct_inventory",
          payload: extractMaterials(userMessage),
          description: "Adjust stock levels",
        },
      ],
      reasoning: "Message mentions materials being used.",
      confidence: 0.65,
    };

    return { shouldEscalate: true, proposal };
  }

  return {
    shouldEscalate: false,
    directReply: "Message received, but no clear actions were identified.",
  };
}

/**
 * Very basic material extraction (will be replaced by real NLP from Grok later).
 */
function extractMaterials(message: string) {
  const items: string[] = [];
  const quantities: number[] = [];

  const lower = message.toLowerCase();

  if (lower.includes("valve")) items.push("valve");
  if (lower.includes("pump")) items.push("pump");

  // Default to 1 if no quantity mentioned
  quantities.push(...Array(items.length).fill(1));

  return {
    items: items.length > 0 ? items : ["unknown"],
    quantities,
  };
}