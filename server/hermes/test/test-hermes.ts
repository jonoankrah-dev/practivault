/**
 * Hermes Test Suite — Full endoPulse Flow (Reasoning + Execution Simulation)
 *
 * Run with:
 *   npx tsx server/hermes/test/test-hermes.ts
 *
 * This now tests both reasoning and simulates the full approval → execution flow.
 */

import { sendToHermes, shouldEscalateToHermes } from "../index";

const testCases = [
  // === Authentic endoPulse practitioner language (inspired by official course + tutor manual) ===
  "Just finished lower face and jawline on Mrs Thompson, endoPulse 1470nm, total energy 950J at 8W, 3 passes, used 6ml 1% lidocaine, compression garment applied, client tolerated very well and was pleased with the tightening",

  "Submental and neck tightening completed on Sarah, fibre moved in fan vectors, 2 passes, 720J delivered, mild erythema as clinical endpoint reached, client happy, no issues",

  "Full arms treatment done on Jane today, endoPulse, 1100J total, lidocaine used, compression applied for 24h, client reported minimal discomfort, all good",

  "Jawline and jowls on Mr Patel, 980nm wavelength, 4 passes, total 1350J, client had some transient swelling as expected, advised post care and compression",

  "Midface and malar lifting completed, fibre in superficial hypodermis, clinical endpoint reached (softer tissue, good erythema), client very satisfied, booked review in 6 weeks",

  "Neck and platysma bands treated, careful near marginal mandibular nerve, only retrograde passes near danger zones, 680J, lidocaine 8ml, client fine, compression on",

  // === Weaker / edge cases ===
  "endoPulse session finished",
  "Used lidocaine and did 2 passes on the jawline",
  "Client was happy with the result after treatment",

  // Non-treatment
  "Can you order more sterile fibres for next week?",
];

async function runTests() {
  console.log("=== Hermes Aesthetics Reasoner Test Suite ===\n");

  for (const message of testCases) {
    console.log("──────────────────────────────────────────────");
    console.log("Practitioner Message:");
    console.log(`"${message}"`);
    console.log("");

    const shouldEscalate = shouldEscalateToHermes(message);
    console.log("Should Escalate to Hermes:", shouldEscalate);

    if (!shouldEscalate) {
      console.log("→ Skipped (not a treatment-style update)\n");
      continue;
    }

    const response = await sendToHermes(message);

    if (response.shouldEscalate && response.proposal) {
      const p = response.proposal;
      console.log("✓ Hermes Proposal Generated");
      console.log(`  Summary:     ${p.summary}`);
      console.log(`  Confidence:  ${p.confidence}`);
      console.log(`  Reasoning:   ${p.reasoning}`);
      console.log("  Actions:");
      p.actions.forEach((action, i) => {
        console.log(`    ${i + 1}. ${action.type}`);
        console.log(`       → ${action.description}`);
        if (action.payload && typeof action.payload === "object") {
          console.log(`       Payload: ${JSON.stringify(action.payload, null, 2)}`);
        }
      });
    } else {
      console.log("→ Hermes did not escalate:", response.directReply);
    }
    console.log("");
  }

  console.log("=== Test run complete ===");

  // === Full Flow Simulation (Reasoning → Proposal → Simulated Execution) ===
  console.log("\n\n=== FULL FLOW SIMULATION (as if user clicked Approve) ===\n");
  const testProposal = {
    summary: "Test proposal",
    actions: [
      { type: "complete_treatment", payload: { areasTreated: ["jawline"], energy: "850J" }, description: "Complete jawline treatment" },
      { type: "deduct_consumables", payload: { items: ["lidocaine"], quantities: [5] }, description: "Deduct 5 lidocaine" }
    ]
  };

  console.log("Simulating execution of proposal...");
  console.log("In real app, this would call /api/hermes/execute and update the database.");
  console.log("Executed actions would be: complete_treatment + deduct_consumables");
}

runTests().catch(console.error);
