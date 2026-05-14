/**
 * Clients — fully managed by Safi AI
 */
import { Users } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Show me all active clients",
  "Find client Sarah Jones",
  "Add a new client — Emma White, 07700 900123, emma@example.com",
  "Who are my VIP clients?",
  "Move John Smith to VIP stage",
  "Show clients who haven't booked recently",
];

const SECTION_CONTEXT = `You are in the Clients section — managing the full client database.

What you can do here:
- List and search clients (use get_clients_detail tool — no approval needed for reading)
- Create new client records (use create_client tool)
- Update client details or stage (use update_client tool)
- Delete a client (use delete_client tool) — only after explicit user confirmation
- Also use get_bookings to check a client's appointment history

Client stages: lead → prospect → active → vip → lapsed → archived

APPROVAL REQUIRED for any write action:
Before creating a client:
"I'm about to add this client:
- Name: [name]
- Email: [email]
- Phone: [phone]
- Stage: [stage]
Shall I go ahead?"

Before updating a client:
"I'm about to update [name]: [what's changing]. Shall I go ahead?"

Before deleting a client:
"I'm about to permanently delete [name] from your database. This cannot be undone. Shall I go ahead?"

Only call create_client, update_client, or delete_client after the user confirms.

When showing clients, present them in a clean list with name, contact info, and stage.
If asked about a specific client's history, use get_bookings filtered by client name to show their appointments.`;

export default function Clients() {
  return (
    <SafiSectionChat
      section="Clients"
      description="Safi manages your full client database"
      icon={<Users className="h-4 w-4 text-[#E83A8E]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
