/**
 * Hermes Agent Types
 * 
 * This file defines the data structures Hermes will use when communicating
 * with Saffi and PractiVault.
 */

/**
 * Represents a single action Hermes wants to perform.
 * Example: { type: "complete_job", jobId: "123", notes: "..." }
 */
export interface HermesAction {
  type: string;                    // e.g. "complete_job", "deduct_inventory", "create_note"
  payload: Record<string, any>;    // The data needed for the action
  description: string;             // Human-readable explanation of what this action does
}

/**
 * A proposal from Hermes that needs user approval.
 */
export interface HermesProposal {
  summary: string;                 // Short summary of what Hermes wants to do
  actions: HermesAction[];         // List of actions to perform if approved
  reasoning?: string;              // Optional explanation of why Hermes suggested this
  confidence?: number;             // 0–1 score of how confident Hermes is
}

/**
 * The response Hermes sends back after processing a message.
 */
export interface HermesResponse {
  shouldEscalate: boolean;         // Whether this needs user approval
  proposal?: HermesProposal;       // The actual proposal (if shouldEscalate is true)
  directReply?: string;            // A simple reply if no action is needed
}