/**
 * Hermes Test Script (Improved)
 * 
 * Run with: npx tsx server/hermes/test-hermes.ts
 * 
 * This script lets you quickly test how Hermes responds to different messages.
 */

import { sendToHermes, shouldEscalateToHermes } from "./index";

const testMessages = [
  "Just finished the boiler repair at 123 Main St, used 2 valves and 1 pump, customer is happy",
  "I used 3 pipes and 4 fittings today",
  "The job is completed",
  "Customer was very satisfied with the work we did",
  "Finished the job, took 5 hours, used 1 pump",
  "Hello, how are you?",
  "Update on job #47 - all done, removed 2 valves",
];

async function runTests() {
  console.log("=== Hermes Test Suite ===\n");

  for (const message of testMessages) {
    console.log("-----------------------------------");
    console.log("User Message:", message);
    console.log("Should Escalate:", shouldEscalateToHermes(message));

    const response = await sendToHermes(message);

    if (response.shouldEscalate && response.proposal) {
      console.log("Hermes Proposal:");
      console.log("  Summary:     ", response.proposal.summary);
      console.log("  Confidence:  ", response.proposal.confidence);
      console.log("  Reasoning:   ", response.proposal.reasoning);
      console.log("  Actions:");
      response.proposal.actions.forEach((action, i) => {
        console.log(`    ${i + 1}. ${action.type}`);
        console.log(`       → ${action.description}`);
      });
    } else {
      console.log("Hermes Reply:", response.directReply);
    }
    console.log("");
  }
}

runTests().catch(console.error);