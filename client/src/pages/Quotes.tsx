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

const SECTION_CONTEXT = `You are operating in the Quotes section.
Your job here is to help manage all quotes and estimates for the business.
You can:
- List and filter quotes (use get_quotes tool)
- Create new quotes (use create_quote tool) — ask for: client name, items/services, amounts
- Update quote status (use update_quote tool)
- Help convert quotes to invoices

Quote statuses: draft, sent, viewed, accepted, rejected, expired, invoiced

When creating a quote, confirm all details with the user first.
Quote numbers are auto-generated — you don't need to ask for them.
After any write action, confirm success and show the result.
If a user says "send quote to X", create it and mark it as sent.`;

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
