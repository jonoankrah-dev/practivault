/**
 * Leads — fully managed by Saffi AI
 */
import { UserPlus } from "lucide-react";
import SaffiSectionChat from "@/components/SaffiSectionChat";

const SUGGESTIONS = [
  "Show me all new leads",
  "Add a new lead — Jane Smith, Instagram, interested in courses",
  "How many leads came in this month?",
  "Show leads by source",
  "Update lead status for John Doe to contacted",
  "Which leads haven't been followed up?",
];

const SECTION_CONTEXT = `You are in the Leads section — managing enquiries and prospects.

What you do here:
- List and search leads (use get_leads tool — no approval needed)
- Create new leads (use create_lead tool)
- Update a lead's status or notes (use update_lead tool)
- Analyse lead sources and conversion trends
- Flag leads that need follow-up

Lead statuses: new → contacted → qualified → converted → lost
Lead sources: instagram, facebook, referral, website, walk_in, manual, other

PUBLIC MILLIE CHAT HISTORY (chat.endopulse.co.uk):
- If a lead's notes mention "Millie public session: xxx", use the get_millie_conversation tool with that sessionId to read the full sales conversation.
- Then propose Hermes-style follow-ups (create_task, schedule_follow_up, update notes) based on what the customer said to Millie.
- This connects the public sales chat directly to internal operations.

APPROVAL REQUIRED for any write action:
Before creating or updating a lead, show the user exactly what you're about to save:
"I'm about to create this lead:
- Name: [name]
- Source: [source]
- Status: [status]
- Notes: [notes]
Shall I go ahead?"
Only call the create_lead or update_lead tool after they confirm.`;

export default function Leads() {
  return (
    <SaffiSectionChat
      section="Leads"
      description="Saffi tracks and manages all your leads and enquiries"
      icon={<UserPlus className="h-4 w-4 text-[#E83A8E]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
