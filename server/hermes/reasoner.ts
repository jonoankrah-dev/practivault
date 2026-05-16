/**
 * Hermes Reasoner
 * 
 * This file is responsible for getting a reasoned response from Hermes.
 * 
 * In the future, this will make the actual call to your Grok-powered Hermes Agent.
 * For now, it uses a mock implementation.
 */

import { HermesResponse, HermesProposal } from "./types";

export interface ReasonerOptions {
  useMock?: boolean;
}

/**
 * This is the core function that will eventually call your Hermes Agent (Grok).
 * 
 * Right now it just returns a mock response.
 */
export async function getHermesReasoning(
  userMessage: string,
  context?: Record<string, any>,
  options: ReasonerOptions = {}
): Promise<HermesResponse> {
  const useMock = options.useMock ?? true;

  if (useMock) {
    return getMockResponse(userMessage);
  }

  // TODO: Replace with real call to Hermes Agent
  // Example future implementation:
  // const response = await fetch("http://localhost:8000/hermes/reason", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ message: userMessage, context }),
  // });
  // return await response.json();

  return {
    shouldEscalate: false,
    directReply: "Hermes (real) is not connected yet.",
  };
}

/**
 * Temporary mock implementation for development and testing.
 * This simulates what a real Hermes response might look like.
 */
function getMockResponse(userMessage: string): HermesResponse {
  const lower = userMessage.toLowerCase();

  // Job completion scenarios
  if (lower.includes("finished") || lower.includes("completed") || lower.includes("done")) {
    const proposal: HermesProposal = {
      summary: "Mark job as complete and update inventory based on materials mentioned.",
      actions: [
        {
          type: "complete_job",
          payload: { jobId: "auto-detected-from-context" },
          description: "Mark the referenced job as completed",
        },
        {
          type: "deduct_inventory",
          payload: extractInventoryFromMessage(userMessage),
          description: "Remove used parts from stock",
        },
        {
          type: "create_note",
          payload: { note: userMessage },
          description: "Log the user's update",
        },
      ],
      reasoning: "User indicated the job is finished and listed specific materials used.",
      confidence: 0.8,
    };

    return { shouldEscalate: true, proposal };
  }

  // Inventory-related messages
  if (lower.includes("used") || lower.includes("stock") || lower.includes("inventory")) {
    const proposal: HermesProposal = {
      summary: "Update inventory based on materials the user mentioned.",
      actions: [
        {
          type: "deduct_inventory",
          payload: extractInventoryFromMessage(userMessage),
          description: "Adjust stock levels",
        },
      ],
      reasoning: "Message mentions materials being used.",
      confidence: 0.7,
    };

    return { shouldEscalate: true, proposal };
  }

  // Default - no clear action
  return {
    shouldEscalate: false,
    directReply: "I received your message but couldn't identify any clear actions to take.",
  };
}

/**
 * Very basic helper to extract inventory items from a message.
 * This is temporary and will be replaced by proper NLP from Hermes/Grok.
 */
function extractInventoryFromMessage(message: string) {
  const items: string[] = [];
  const quantities: number[] = [];

  const lower = message.toLowerCase();

  // Very naive extraction for testing
  if (lower.includes("valve")) items.push("valve");
  if (lower.includes("pump")) items.push("pump");

  // Default quantities if not specified
  quantities.push(1, 1);

  return {
    items: items.length > 0 ? items : ["unknown-item"],
    quantities: quantities.slice(0, items.length),
  };
}