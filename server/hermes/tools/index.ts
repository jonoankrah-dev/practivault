/**
 * Hermes Tools
 * Action-specific helpers that can be called by the executor or directly by Saffi.
 * For now this is a placeholder — real implementations will live here or be
 * delegated to the existing tool executor in routes.ts.
 */

export const SUPPORTED_HERMES_ACTIONS = [
  "complete_job",
  "deduct_inventory",
  "create_note",
  "update_booking_status",
  "create_followup_task",
] as const;
