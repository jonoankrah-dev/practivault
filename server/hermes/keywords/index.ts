/**
 * Hermes Keywords - Trigger Detection (Phase 1 Hybrid Approach)
 *
 * These keywords help decide when a message should be escalated from Saffi to Hermes.
 * This is a lightweight first-pass filter before we send anything to the reasoner.
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

// === endoPulse / Endolaser Specific Keywords (from official course & tutor manual) ===
export const AESTHETICS_TREATMENT_KEYWORDS = [
  "endopulse",
  "endo pulse",
  "endolaser",
  "fibre",
  "fiber",
  "hypodermis",
  "superficial hypodermis",
  "subdermal",
  "vectors",
  "fan vectors",
  "retrograde",
  "passes",
  "joules",
  "watts",
  "power",
  "energy delivered",
  "total energy",
  "clinical endpoint",
  "erythema",
  "tissue softer",
  "wavelength",
  "980",
  "1470",
  "jawline",
  "submental",
  "jowls",
  "malar",
  "platysma",
  "lower face",
  "neck tightening",
  "arms",
  "abdomen",
  "thighs",
  "knees",
];

export const CONSUMABLES_KEYWORDS = [
  "numbing",
  "numbing cream",
  "lidocaine",
  "anaesthetic",
  "local anaesthesia",
  "fibre",
  "fiber",
  "sterile fibre",
  "disposable fibre",
  "compression",
  "compression garment",
  "bandage",
  "gauze",
  "marking pen",
  "eye protection",
  "infrared thermometer",
];

export const FEEDBACK_SENTIMENT_KEYWORDS = [
  "tolerated well",
  "happy",
  "pleased",
  "satisfied",
  "no issues",
  "minimal discomfort",
  "redness",
  "swelling",
  "adverse",
  "reaction",
];

// Combined list for quick scanning
export const HERMES_TRIGGER_KEYWORDS = [
  ...JOB_COMPLETION_KEYWORDS,
  ...INVENTORY_KEYWORDS,
  ...CUSTOMER_FEEDBACK_KEYWORDS,
  ...GENERAL_UPDATE_KEYWORDS,
  ...AESTHETICS_TREATMENT_KEYWORDS,
  ...CONSUMABLES_KEYWORDS,
];

/**
 * Detects if a message looks like a job/treatment update.
 * Returns a simple intent object (can be expanded later).
 */
export function detectKeywordIntent(message: string) {
  const lower = message.toLowerCase();

  const hasJobCompletion = JOB_COMPLETION_KEYWORDS.some((k) => lower.includes(k));
  const hasInventory = INVENTORY_KEYWORDS.some((k) => lower.includes(k));
  const hasFeedback = CUSTOMER_FEEDBACK_KEYWORDS.some((k) => lower.includes(k));
  const hasGeneralUpdate = GENERAL_UPDATE_KEYWORDS.some((k) => lower.includes(k));
  const hasAesthetics = AESTHETICS_TREATMENT_KEYWORDS.some((k) => lower.includes(k));
  const hasConsumables = CONSUMABLES_KEYWORDS.some((k) => lower.includes(k));

  return {
    isJobUpdate: hasJobCompletion || hasInventory || hasFeedback || hasGeneralUpdate || hasAesthetics || hasConsumables,
    hasJobCompletion,
    hasInventory,
    hasFeedback,
    hasGeneralUpdate,
    hasAestheticsTreatment: hasAesthetics,
    hasConsumables,
  };
}

/**
 * Quick boolean check used by Saffi before escalation.
 */
export function isJobUpdateMessage(message: string): boolean {
  return HERMES_TRIGGER_KEYWORDS.some((keyword) =>
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}
