/**
 * Hermes Reasoner
 * Turns conversation turns into HermesProposal objects.
 * Has two paths:
 *   1. Mock / keyword path (fast, no API key needed) — good for development & the user's current setup.
 *   2. Real xAI Grok path (when key is present) for higher accuracy.
 */

import { HERMES_CONFIG, getXaiApiKey } from "../config";
import { HERMES_SYSTEM_PROMPT, TREATMENT_DETECTION_PROMPT } from "../prompts";
import {
  containsTreatmentLanguage,
  extractBasicDetails,
  proposeActionsFromDetails,
} from "../keywords/detector";
import type { HermesProposal, ExtractedTreatmentDetails, HermesAction } from "../types";

export interface ReasonerInput {
  userMessage: string;
  history?: Array<{ role: string; content: string }>;
  businessName?: string;
}

export async function reasonAboutTreatment(input: ReasonerInput): Promise<HermesProposal | null> {
  const { userMessage, businessName } = input;

  if (!containsTreatmentLanguage(userMessage)) {
    return null; // not a treatment completion turn — let normal Saffi chat handle it
  }

  if (HERMES_CONFIG.useMockReasoner) {
    return mockReasoner(userMessage, businessName);
  }

  return await realGrokReasoner(input);
}

function mockReasoner(userMessage: string, businessName?: string): HermesProposal {
  const details = extractBasicDetails(userMessage);
  const actions = proposeActionsFromDetails(details, userMessage);

  const proposal: HermesProposal = {
    id: "prop-" + Date.now().toString(36),
    extractedDetails: details,
    actions,
    rawTranscript: userMessage,
    overallConfidence: Math.min(0.88, 0.6 + (actions.length * 0.08)),
    createdAt: new Date().toISOString(),
    status: "pending_review",
  };

  return proposal;
}

async function realGrokReasoner(input: ReasonerInput): Promise<HermesProposal | null> {
  const apiKey = getXaiApiKey();
  if (!apiKey) return mockReasoner(input.userMessage, input.businessName);

  const messages = [
    { role: "system", content: HERMES_SYSTEM_PROMPT },
    { role: "user", content: TREATMENT_DETECTION_PROMPT + input.userMessage },
  ];

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: HERMES_CONFIG.xaiModel,
        messages,
        max_tokens: 800,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(HERMES_CONFIG.timeoutMs),
    });

    if (!res.ok) {
      console.error("[Hermes] Grok reasoner failed, falling back to mock");
      return mockReasoner(input.userMessage, input.businessName);
    }

    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content ?? "";

    // The prompt asks for raw JSON — try to parse it
    let parsed: any;
    try {
      // strip possible ```json fences
      const jsonText = content.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(jsonText);
    } catch {
      return mockReasoner(input.userMessage, input.businessName);
    }

    const proposal: HermesProposal = {
      id: "prop-" + Date.now().toString(36),
      extractedDetails: parsed.extractedDetails || {},
      actions: (parsed.actions || []).map((a: any, i: number) => ({
        id: "act-" + i + "-" + Date.now().toString(36),
        actionType: a.actionType,
        payload: a.payload || {},
        confidence: a.confidence,
        reasoning: a.reasoning,
      })),
      rawTranscript: input.userMessage,
      overallConfidence: parsed.overallConfidence ?? 0.7,
      createdAt: new Date().toISOString(),
      status: "pending_review",
    };

    return proposal;
  } catch (e) {
    console.error("[Hermes] realGrokReasoner error", e);
    return mockReasoner(input.userMessage, input.businessName);
  }
}
