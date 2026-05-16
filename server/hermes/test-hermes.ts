/**
 * Simple test script for Hermes
 * 
 * Run with: npx tsx server/hermes/test-hermes.ts
 */

import { sendToHermes, shouldEscalateToHermes } from "./index";

async function test() {
  const testMessages = [
    "Just finished the boiler repair at 123 Main St, used 2 valves and 1 pump, customer is happy",
    "I used 3 pipes on the job today",
    "The job is completed",
    "Customer was very satisfied with the work",
    "Hello, how are you today?",
  ];

  for (const message of testMessages) {
    console.log("\n============================");
    console.log("User message:", message);
    console.log("Should escalate?", shouldEscalateToHermes(message));

    const response = await sendToHermes(message);
    console.log("Hermes response:", JSON.stringify(response, null, 2));
  }
}

test().catch(console.error);