/**
 * Invoices — fully managed by Safi AI
 */
import { Receipt } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Show all unpaid invoices",
  "Any overdue invoices?",
  "Create an invoice for Mark Brown — £1,500 consultation",
  "Mark invoice INV-001 as paid",
  "How much revenue did I collect this month?",
  "Show all invoices for last month",
];

const SECTION_CONTEXT = `You are in the Invoices section — managing invoices and payment tracking.

What you do here:
- List, filter and search invoices (use get_invoices tool — no approval needed)
- Create new invoices (use create_invoice tool)
- Update invoice status — mark as paid, cancel (use update_invoice tool)
- Summarise revenue, outstanding amounts, overdue invoices

Invoice statuses: draft → unpaid → paid (or cancelled)

APPROVAL REQUIRED for any write action:
Before creating an invoice, show the full prepared invoice:
"I've prepared this invoice:
- Client: [name]
- For: [description]
- Amount: £[amount]
- Due date: [date]
Shall I create it?"

Before marking an invoice as paid or updating its status, confirm:
"I'm about to mark [invoice number] (£[amount]) as [status]. Shall I go ahead?"

Only call create_invoice or update_invoice after the user says yes.
Default due date is 30 days from today unless the user specifies otherwise.`;

export default function Invoices() {
  return (
    <SafiSectionChat
      section="Invoices"
      description="Safi handles all your invoicing and payment tracking"
      icon={<Receipt className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
