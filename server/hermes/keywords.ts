/**
 * Hermes Trigger Keywords
 * 
 * This is the starting list of keywords that will cause Saffi to escalate
 * a message to Hermes for deeper reasoning.
 * 
 * We can improve this list over time (or make it dynamic later).
 */

export const HERMES_TRIGGER_KEYWORDS = [
  // Job completion related
  "finished",
  "completed",
  "done",
  "job done",

  // Inventory / materials used
  "used",
  "valve",
  "valves",
  "pump",
  "stock",
  "inventory",
  "material",
  "materials",

  // Customer feedback
  "happy",
  "unhappy",
  "customer said",
  "client said",

  // General complex updates
  "update job",
  "mark as complete",
  "deduct",
  "remove from stock",
];