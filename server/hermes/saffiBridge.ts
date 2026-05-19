import type { HermesAction, HermesProposal, HermesResponse } from "./types";

/** Ensure the UI always gets a valid proposal shape. */
export function normalizeHermesProposal(
  proposal: HermesProposal | undefined | null,
): HermesProposal | null {
  if (!proposal) return null;

  const rawActions = Array.isArray(proposal.actions) ? proposal.actions : [];
  const actions: HermesAction[] = rawActions
    .filter((a) => a && typeof a.type === "string" && a.type.trim())
    .map((a) => ({
      type: a.type.trim(),
      payload: a.payload && typeof a.payload === "object" ? a.payload : {},
      description:
        a.description?.trim() || `Execute ${a.type.replace(/_/g, " ")}`,
      id: a.id,
      actionType: a.actionType ?? a.type,
      confidence: a.confidence,
      reasoning: a.reasoning,
    }));

  if (actions.length === 0) return null;

  return {
    ...proposal,
    summary:
      proposal.summary?.trim() ||
      `Hermes suggests ${actions.length} action${actions.length === 1 ? "" : "s"}.`,
    actions,
    confidence: proposal.confidence ?? proposal.overallConfidence ?? 0.75,
  };
}

export type SaffiHermesPayload = {
  reply: string;
  hermesProposal?: HermesProposal;
  requiresApproval?: boolean;
  hermesFailed?: boolean;
};

/**
 * Map Hermes output to what Saffi chat returns. Returns null to fall through to the normal tool loop.
 */
export function hermesResponseToSaffiPayload(
  response: HermesResponse,
): SaffiHermesPayload | null {
  const proposal = normalizeHermesProposal(response.proposal);

  if (proposal) {
    return {
      reply:
        response.directReply?.trim() ||
        proposal.summary ||
        "Hermes has analyzed your update and prepared actions for your approval.",
      hermesProposal: proposal,
      requiresApproval: true,
    };
  }

  if (response.directReply?.trim()) {
    return { reply: response.directReply.trim() };
  }

  return null;
}
