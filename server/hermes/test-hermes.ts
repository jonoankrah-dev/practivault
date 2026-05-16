/**
 * Hermes Test Script
 * 
 * Run with: npx tsx server/hermes/test-hermes.ts
 * 
 * This is an improved interactive-style tester for Hermes.
 */

import { sendToHermes, shouldEscalateToHermes } from "./index";

const testCases = [
  "Just finished the boiler repair at 123 Main St, used 2 valves and 1 pump, customer is happy",
  "I used 3 pipes and 4 fittings on the job today",
  "The job is completed, customer was very satisfied",
  "Finished the radiator install, took 4 hours",
  "Customer said the work was bad and there's a leak now",
  "Hello, how are you today?",
  "Update job #47 - all done, used 1 pump",
];

async function runTests() {
  console.log("=== Hermes Test Suite ===\n");

  for (const message of testCases) {
    console.log("-----------------------------------");
    console.log("User Message:", message);
    console.log("Should Escalate:", shouldEscalateToHermes(message));

    const response = await sendToHermes(message);

    if (response.shouldEscalate && response.proposal) {
      console.log("Hermes Proposal:");
      console.log("  Summary:", response.proposal.summary);
      console.log("  Confidence:", response.proposal.confidence);
      console.log("  Reasoning:", response.proposal.reasoning);
      console.log("  Actions:");
      response.proposal.actions.forEach((action, i) => {
        console.log(`    ${i + 1}. ${action.type} - ${action.description}`);
      });
    } else {
      console.log("Hermes Direct Reply:", response.directReply);
    }
    console.log("");
  }
}

runTests().catch(console.error);