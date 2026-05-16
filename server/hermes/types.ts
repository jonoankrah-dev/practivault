/**
 * Hermes — Agentic Brain for Saffi
 * Types for proposals, messages, and execution results.
 *
 * Hermes turns natural language (especially endoPulse treatment notes) into
 * structured, editable, user-approved actions.
 */

export type HermesActionType =
  | "complete_job"
  | "deduct_inventory"
  | "create_note"
  | "update_booking_status"
  | "create_followup_task"
  | "send_whatsapp"
  | "log_treatment";

export interface HermesAction {
  id: string;                    // client-side stable id for editing
  actionType: HermesActionType;
  payload: Record<string, unknown>;
  confidence?: number;           // 0-1
  reasoning?: string;            // why Hermes suggested this
}

export interface ExtractedTreatmentDetails {
  clientName?: string;
  clientPhone?: string;
  treatment?: string;            // e.g. "endoPulse 980nm + 1470nm"
  area?: string;                 // "neck", "face", "abdomen"
  wavelengths?: string[];        // ["980", "1470"]
  passes?: number;
  energy?: string;               // "15J", "good contraction"
  materialsUsed?: Array<{ name: string; quantity: number; unit?: string }>;
  clientFeedback?: string;
  positiveFeedback?: boolean;
  durationMinutes?: number;
  date?: string;                 // ISO
}

export interface HermesProposal {
  id: string;
  extractedDetails: ExtractedTreatmentDetails;
  actions: HermesAction[];
  rawTranscript: string;
  overallConfidence: number;
  createdAt: string;
  status: "pending_review" | "approved" | "edited" | "executed" | "rejected";
}

export type ChatMessageRole = "user" | "assistant" | "tool" | "hermesProposal";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content?: string;              // for text messages
  proposal?: HermesProposal;     // when role === "hermesProposal"
  toolName?: string;
  toolResult?: string;
}

// Result of executing an approved proposal
export interface HermesExecutionResult {
  success: boolean;
  executedActions: Array<{
    actionType: HermesActionType;
    success: boolean;
    result?: string;
    error?: string;
  }>;
  summary: string;
}
