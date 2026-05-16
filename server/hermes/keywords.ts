/**
 * Hermes Trigger Keywords (Phase 1 - Hybrid Approach)
 * 
 * These keywords help decide when a message should be escalated from Saffi to Hermes.
 * 
 * We organize them into categories for better maintainability.
 * This is a starting point — we can improve this logic significantly later.
 */

export const JOB_COMPLETION_KEYWORDS = [
  "finished",
  "completed",
  "done",
  "job done",
  "all done",
  "wrapped up",
];

export const INVENTORY_KEYWORDS = [
  "used",
  "valve",
  "valves",
  "pump",
  "stock",
  "inventory",
  "material",
  "materials",
  "part",
  "parts",
  "deduct",
  "remove from stock",
];

export const CUSTOMER_FEEDBACK_KEYWORDS = [
  "happy",
  "unhappy",
  "satisfied",
  "unsatisfied",
  "customer said",
  "client said",
  "customer is",
  "client is",
];

export const GENERAL_UPDATE_KEYWORDS = [
  "update job",
  "mark as complete",
  "change status",
  "job update",
];

// Combined list used by the simple keyword check
export const HERMES_TRIGGER_KEYWORDS = [
  ...JOB_COMPLETION_KEYWORDS,
  ...INVENTORY_KEYWORDS,
  ...CUSTOMER_FEEDBACK_KEYWORDS,
  ...GENERAL_UPDATE_KEYWORDS,
];