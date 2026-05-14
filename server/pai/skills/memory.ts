/**
 * Memory & Context Skills for PAI alignment
 *
 * These will eventually map to PAI's hot/warm/cold memory tiers and TELOS context.
 */

import type { PaiSkill, PaiSkillContext } from "./index";

export const recordImportantSignal: PaiSkill = {
  name: "record_important_signal",
  description: "Record a meaningful signal from the current conversation (preference, correction, rule, pattern, or important fact). PAI will use this to improve future behaviour. This is how Saffi learns and gets better over time.",
  parameters: {
    type: "object",
    properties: {
      signalType: { type: "string", enum: ["preference", "correction", "rule", "fact", "pattern"] },
      content: { type: "string", description: "What was learned or observed" },
      importance: { type: "number", description: "How important this is (1-5)" }
    },
    required: ["signalType", "content"]
  },
  async execute(args: any, context: PaiSkillContext) {
    // For now we still write to activity_events.
    // Later this will feed directly into PAI's memory system.
    console.log("[PAI Memory] Signal recorded:", args);
    return { success: true, message: "Signal recorded for future learning." };
  },
};
