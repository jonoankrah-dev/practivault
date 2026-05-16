/**
 * Hermes Reasoner - The intelligent core of Hermes
 * 
 * This is where the "thinking" happens.
 * Currently uses an advanced mock. Later this will call Grok via your Hermes Agent.
 */

import { HermesResponse, HermesProposal, HermesAction } from "./types";
import { HERMES_CONFIG } from "./config";

export interface ReasonerOptions {
  useMock?: boolean;
}

/**
 * Main reasoning entry point.
 * Saffi (or other systems) will call this when they need Hermes' brain.
 */
export async function getHermesReasoning(
  userMessage: string,
  context?: Record<string, any>,
  options: ReasonerOptions = {}
): Promise<HermesResponse> {
  const useMock = options.useMock ?? HERMES_CONFIG.useMock;

  if (HERMES_CONFIG.verboseLogging) {
    console.log("[Hermes Reasoner] Received message:", userMessage);
  }

  if (useMock) {
    return generateAdvancedMockResponse(userMessage, context);
  }

  // TODO: Call real Hermes Agent (Grok-powered) here
  return {
    shouldEscalate: false,
    directReply: "Real Hermes is not connected yet.",
  };
}

/**
 * Advanced mock that tries to intelligently understand natural language job updates.
 * This will be replaced by real Grok reasoning later.
 */
function generateAdvancedMockResponse(
  userMessage: string,
  context?: Record<string, any>
): HermesResponse {
  const lower = userMessage.toLowerCase();
  const actions: HermesAction[] = [];
  let confidence = 0.6;
  let reasoning = "Based on the user's message, here is what I understood:";

  // === Job Completion ===
  const jobCompleteSignals = ["finished", "completed", "done", "wrapped up", "all done", "job is done"];
  const isJobFinished = jobCompleteSignals.some((signal) => lower.includes(signal));

  // === Materials Used ===
  const materials = extractMaterials(userMessage);

  // === Customer Sentiment ===
  const positiveSignals = ["happy", "satisfied", "good job", "pleased", "thank you"];
  const negativeSignals = ["unhappy", "not happy", "bad", "issue", "problem", "leak", "broken"];
  const hasPositive = positiveSignals.some((s) => lower.includes(s));
  const hasNegative = negativeSignals.some((s) => lower.includes(s));

  // === Build Actions ===

  if (isJobFinished) {
    actions.push({
      type: "complete_job",
      payload: { jobId: context?.jobId || "auto-detected" },
      description: "Mark the job as completed",
    });
    confidence += 0.2;
    reasoning += " User stated the job is finished.";
  }

  if (materials.items.length > 0) {
    actions.push({
      type: "deduct_inventory",
      payload: materials,
      description: `Remove ${materials.items.join(", ")} from inventory`,
    });
    confidence += 0.15;
    reasoning += " Specific materials were mentioned.";
  }

  if (userMessage.trim().length > 15) {
    actions.push({
      type: "create_note",
      payload: { note: userMessage },
      description: "Log the update as a job note",
    });
    confidence += 0.1;
  }

  if (hasPositive) {
    actions.push({
      type: "create_note",
      payload: { note: `Positive feedback: ${userMessage}` },
      description: "Record positive customer feedback",
    });
    confidence += 0.05;
  }

  if (hasNegative) {
    actions.push({
      type: "create_note",
      payload: { note: `Issue reported: ${userMessage}` },
      description: "Flag potential problem from customer feedback",
    });
    confidence += 0.05;
  }

  // === Final Decision ===
  const shouldEscalate = actions.length > 0 && confidence >= 0.65;

  if (!shouldEscalate) {
    return {
      shouldEscalate: false,
      directReply: "I understood your message, but I couldn't confidently determine any clear actions to take.",
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
 * Basic but improved material extraction.
 */
function extractMaterials(message: string) {
  const items: string[] = [];
  const quantities: number[] = [];

  const lower = message.toLowerCase();

  const commonParts = ["valve", "valves", "pump", "pumps", "pipe", "pipes", "fitting", "fittings", "boiler", "radiator"];

  commonParts.forEach((part) => {
    if (lower.includes(part)) {
      const cleanPart = part.replace(/s$/, "");
      if (!items.includes(cleanPart)) {
        items.push(cleanPart);
      }
    }
  });

  // Very basic quantity detection
  const numberMatch = message.match(/(\d+)\s*(valve|pump|pipe|fitting|boiler)/i);
  if (numberMatch) {
    quantities.push(parseInt(numberMatch[1]));
  } else {
    quantities.push(...Array(items.length).fill(1));
  }

  return {
    items: items.length > 0 ? items : ["unknown"],
    quantities,
  };
}

function generateSummary(actions: any[]): string {
  const types = actions.map((a) => a.type.replace(/_/g, " "));
  return `I suggest the following: ${types.join(" + ")}`;
}