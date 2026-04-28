/**
 * Quotes — fully managed by Safi AI
 */
import { FileText } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Show all pending quotes",
  "Create a new quote for Sarah Jones — Machine 980nm",
  "Which quotes have been accepted?",
  "Mark quote QUO-001 as sent",
  "Any quotes that are about to expire?",
  "Convert accepted quote to invoice",
];

const SECTION_CONTEXT = `You are in the Quotes section — creating and managing quotes/estimates.

What you do here:
- List and filter quotes (use get_quotes tool — no approval needed)
- Create new quotes (use create_quote tool)
- Update quote status (use update_quote tool)
- Help convert quotes to invoices

Quote statuses: draft → sent → viewed → accepted → invoiced (or rejected / expired)

APPROVAL REQUIRED for any write action:
Before creating a quote, show the full prepared quote:
"I've prepared this quote:
- Client: [name]
- Items: [description]
- Amount: £[amount]
- Status: draft
Shall I create it?"

Before updating a quote status, confirm:
"I'm about to mark [quote number] as [status]. Shall I go ahead?"

Only call create_quote or update_quote after the user approves.
Quote numbers are auto-generated — do not ask the user for them.`;

export default function Quotes() {
  return (
    <SafiSectionChat
      section="Quotes"
      description="Safi creates and manages all your quotes and estimates"
      icon={<FileText className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
