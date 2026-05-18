/**
 * Fast keyword + rule-based detector for endoPulse treatment language.
 * Used by the mock reasoner when no XAI key or for instant proposals.
 */

import type { HermesAction } from "../types";

// Local fallback keywords (the old TREATMENT_KEYWORDS was removed during refactor)
const TREATMENT_KEYWORDS = [
  "endopulse", "endo pulse", "980", "1470", "radial fiber", "fibre",
  "tumescent", "treatment note", "complete treatment", "deduct", "consumable"
];

type ExtractedTreatmentDetails = any; // temporary until we stabilize the type

export function containsTreatmentLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return TREATMENT_KEYWORDS.some(kw => lower.includes(kw));
}

export function extractBasicDetails(text: string): ExtractedTreatmentDetails {
  const lower = text.toLowerCase();
  const details: ExtractedTreatmentDetails = {};

  // Very naive extraction — good enough for mock / first iteration
  const nameMatch = text.match(/(?:for|on|client|patient)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (nameMatch) details.clientName = nameMatch[1];

  if (lower.includes("neck")) details.area = "neck";
  else if (lower.includes("face")) details.area = "face";
  else if (lower.includes("abdomen") || lower.includes("tummy")) details.area = "abdomen";
  else if (lower.includes("leg")) details.area = "leg";

  if (lower.includes("980")) details.wavelengths = [...(details.wavelengths || []), "980"];
  if (lower.includes("1470")) details.wavelengths = [...(details.wavelengths || []), "1470"];

  // Materials — look for "used X" patterns
  const materialMatches = text.matchAll(/(?:used|2x|3x)\s*(\d+)?\s*(radial fiber|fiber|needle|catheter|tumescent|solution|pack)\b/gi);
  const materials: ExtractedTreatmentDetails["materialsUsed"] = [];
  for (const m of materialMatches) {
    const qty = m[1] ? parseInt(m[1], 10) : 1;
    materials.push({ name: m[2], quantity: qty });
  }
  if (materials.length) details.materialsUsed = materials;

  if (lower.includes("good contraction") || lower.includes("happy") || lower.includes("great")) {
    details.clientFeedback = "Positive feedback noted";
    details.positiveFeedback = true;
  }

  return details;
}

export function proposeActionsFromDetails(details: ExtractedTreatmentDetails, raw: string): HermesAction[] {
  const actions: HermesAction[] = [];
  const now = new Date().toISOString();

  if (details.clientName || details.area) {
    actions.push({
      type: "complete_treatment",
      payload: {
        clientName: details.clientName,
        area: details.area,
        treatment: details.wavelengths ? `endoPulse ${details.wavelengths.join("+")}nm` : "endoPulse treatment",
        completedAt: now,
      },
      description: "Mark the treatment as completed based on user description.",
    });
  }

  if (details.materialsUsed?.length) {
    actions.push({
      type: "deduct_consumables",
      payload: {
        items: details.materialsUsed,
        reason: `Used during ${details.area || "endoPulse"} treatment for ${details.clientName || "client"}`,
      },
      description: "Deduct consumables from inventory based on treatment details.",
    });
  }

  // Always create a rich note as the source of truth
  actions.push({
    type: "record_treatment_note",
    payload: {
      title: `endoPulse treatment — ${details.area || "unspecified area"}`,
      body: raw,
      clientName: details.clientName,
      extracted: details,
      tags: ["treatment", "endoPulse", "laser"],
      createdAt: now,
    },
    description: "Create a detailed treatment note for compliance and records.",
  });

  return actions;
}
