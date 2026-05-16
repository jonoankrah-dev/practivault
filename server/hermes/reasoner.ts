/**
 * Hermes Reasoner
 * 
 * This is the core reasoning engine for Hermes.
 * 
 * Currently powered by an advanced mock.
 * Later this will call your real Grok-powered Hermes Agent.
 */

import { HermesResponse, HermesProposal, HermesAction } from "./types";
import { HERMES_CONFIG } from "./config";
import { HERMES_TOOLS } from "./tools";

export interface ReasonerOptions {
  useMock?: boolean;
}

/**
 * Main function that Saffi (or other systems) will call to get reasoning from Hermes.
 */
export async function getHermesReasoning(
  userMessage: string,
  context?: Record<string, any>,
  options: ReasonerOptions = {}
): Promise<HermesResponse> {
  const useMock = options.useMock ?? HERMES_CONFIG.useMock;

  if (HERMES_CONFIG.verboseLogging) {
    console.log("[Hermes Reasoner] Processing:", userMessage);
  }

  if (useMock) {
    return generateAdvancedMockResponse(userMessage, context);
  }

  // Real Grok call will go here
  return {
    shouldEscalate: false,
    directReply: "Real Hermes Agent not connected yet.",
  };
}

/**
 * Advanced mock response engine.
 * This tries to intelligently understand job updates and generate realistic proposals.
 */
function generateAdvancedMockResponse(
  userMessage: string,
  context?: Record<string, any>
): HermesResponse {
  const lower = userMessage.toLowerCase();
  const actions: HermesAction[] = [];
  let confidence = 0.5;
  let reasoning = "";

  // === Job Completion Detection ===
  const jobCompletionSignals = ["finished", "completed", "done", "wrapped up", "all done"];
  const isJobFinished = jobCompletionSignals.some((word) => lower.includes(word));

  // === Material Extraction ===
  const materials = extractMaterialsWithQuantities(userMessage);

  // === Customer Feedback ===
  const hasPositiveFeedback = ["happy", "satisfied", "good job", "pleased"].some((w) => lower.includes(w));
  const hasNegativeFeedback = ["unhappy", "not happy", "bad", "problem", "issue"].some((w) => lower.includes(w));

  // === Build Actions ===

  if (isJobFinished) {
    actions.push({
      type: "complete_job",
      payload: { jobId: context?.jobId || "auto-detected" },
      description: "Mark the job as completed",
    });
    confidence += 0.25;
    reasoning += "User indicated the job is finished. ";
  }

  if (materials.items.length > 0) {
    actions.push({
      type: "deduct_inventory",
      payload: materials,
      description: `Remove ${materials.items.join(", ")} from inventory`,
    });
    confidence += 0.2;
    reasoning += "Specific materials were mentioned as used. ";
  }

  if (userMessage.length > 20) {
    actions.push({
      type: "create_note",
      payload: { note: userMessage },
      description: "Log the user's update as a job note",
    });
    confidence += 0.1;
  }

  if (hasPositiveFeedback) {
    actions.push({
      type: "create_note",
      payload: { note: `Positive customer feedback: ${userMessage}` },
      description: "Record positive customer feedback",
    });
    confidence += 0.1;
  }

  if (hasNegativeFeedback) {
    actions.push({
      type: "create_note",
      payload: { note: `Issue reported: ${userMessage}` },
      description: "Flag potential issue from customer feedback",
    });
    confidence += 0.05;
  }

  // === Decision ===
  const shouldEscalate = actions.length > 0 && confidence >= 0.6;

  if (!shouldEscalate) {
    return {
      shouldEscalate: false,
      directReply: "I understood your message, but I couldn't confidently identify clear actions to take.",
    };
  }

  const proposal: HermesProposal = {
    summary: generateSummary(actions),
    actions,
    reasoning: reasoning.trim(),
    confidence: Math.min(confidence, 0.95),
  };

  return {
    shouldEscalate: true,
    proposal,
  };
}

/**
 * Improved material extraction with better quantity detection.
 */
function extractMaterialsWithQuantities(message: string) {
  const items: string[] = [];
  const quantities: number[] = [];

  const lower = message.toLowerCase();

  // Common field service parts
  const partMap: { [key: string]: string } = {
    valve: "valve",
    valves: "valve",
    pump: "pump",
    pumps: "pump",
    pipe: "pipe",
    pipes: "pipe",
    fitting: "fitting",
    fittings: "fitting",
    boiler: "boiler part",
    radiator: "radiator",
  };

  Object.keys(partMap).forEach((word) => {
    if (lower.includes(word)) {
      const partName = partMap[word];
      if (!items.includes(partName)) {
        items.push(partName);
      }
    }
  });

  // Try to find numbers near the parts
  items.forEach((item) => {
    const regex = new RegExp(`(\\d+)\\s*${item}`, "i");
    const match = message.match(regex);
    if (match) {
      quantities.push(parseInt(match[1]));
    } else {
      quantities.push(1);
    }
  });

  return {
    items: items.length > 0 ? items : ["unknown"],
    quantities,
  };
}

function generateSummary(actions: HermesAction[]): string {
  if (actions.length === 0) return "No actions proposed.";

  const types = actions.map((a) => a.type.replace("_", " "));
  return `Proposed actions: ${types.join(", ")}`;
}