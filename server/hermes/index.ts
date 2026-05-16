/**
 * Hermes — Public API
 *
 * Usage from routes.ts:
 *   import { reasonAboutTreatment, executeProposal } from "./hermes";
 *   import type { HermesProposal } from "./hermes/types";
 */

export * from "./types";
export { reasonAboutTreatment } from "./core/reasoner";
export { executeProposal } from "./executor";
export { HERMES_CONFIG, getXaiApiKey } from "./config";

// Re-export keywords detector for debugging / future use
export { containsTreatmentLanguage } from "./keywords/detector";
