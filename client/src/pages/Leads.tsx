/**
 * Leads — fully managed by Safi AI
 */
import { UserPlus } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Show me all new leads",
  "Add a new lead — Jane Smith, Instagram, interested in courses",
  "How many leads came in this month?",
  "Show leads by source",
  "Update lead status for John Doe to contacted",
  "Which leads haven't been followed up?",
];

const SECTION_CONTEXT = `You are operating in the Leads section.
Your job here is to help manage all leads and enquiries for the business.
You can:
- List and search leads (use get_leads tool)
- Create new leads (use create_lead tool) — ask for: name, source, notes if not provided
- Update a lead's status or notes (use update_lead tool)
- Analyse lead sources and conversion
- Flag leads that need follow-up

Lead statuses: new, contacted, qualified, converted, lost
Lead sources: instagram, facebook, referral, website, walk_in, manual, other

When creating or updating a lead, always confirm the details back to the user before executing.
After any write action, fetch the updated list to confirm success.`;

export default function Leads() {
  return (
    <SafiSectionChat
      section="Leads"
      description="Safi tracks and manages all your leads and enquiries"
      icon={<UserPlus className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
