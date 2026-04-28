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

const SECTION_CONTEXT = `You are operating in the Invoices section.
Your job here is to help manage all invoices and payments for the business.
You can:
- List, filter and search invoices (use get_invoices tool)
- Create new invoices (use create_invoice tool) — ask for: client name, line items, amounts, due date
- Update invoice status (use update_invoice tool) — e.g. mark as paid, send reminder
- Summarise revenue, outstanding amounts, overdue invoices

Invoice statuses: draft, unpaid, paid, overdue, cancelled

When creating an invoice:
- Auto-generate invoice number (INV-XXX format)
- Default due date is 30 days from today if not specified
- Confirm all details with user before creating

After any write action, confirm success and show the updated invoice.
For payment confirmations, always ask the user before marking as paid if amounts seem unusual.`;

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
