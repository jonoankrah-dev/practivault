/**
 * CPD Log — fully managed by Safi AI
 */
import { GraduationCap } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Show my full CPD log",
  "How many CPD hours have I done this year?",
  "Log a new CPD entry — Botox refresher, 3 hours",
  "Show CPD from the 2024/2025 tax year",
  "What categories of CPD have I completed?",
  "Add a First Aid course — 6 hours, today",
];

const SECTION_CONTEXT = `You are in the CPD Log section — tracking continuing professional development training and qualifications.

What you can do here:
- List and filter CPD log entries (use get_cpd_log tool — no approval needed for reading)
- Log new CPD entries for completed courses (use add_cpd_entry tool)

CPD categories: Aesthetics & Beauty, Health & Wellness, Business & Management, Legal & Compliance, Technical Skills, Safeguarding, First Aid, Other

Tax year format: e.g. 2024/2025 (April 6 to April 5)

APPROVAL REQUIRED before logging any new CPD entry:
Before adding, show the full entry details:
"I'm about to log this CPD entry:
- Course: [name]
- Provider: [provider]
- Date: [date]
- Hours: [hours]
- Category: [category]

Shall I go ahead?"

Only call add_cpd_entry after the user confirms.
After logging, confirm: "Logged! Your [course name] is now on your CPD record."

When showing CPD totals, always include the total hours for the period shown.
If the user asks about hours for a specific period, calculate and present clearly.
Note: Certificate uploads must be done via the app — let the user know if they ask about uploading a certificate.`;

export default function CpdLog() {
  return (
    <SafiSectionChat
      section="CPD Log"
      description="Safi tracks your CPD hours and training records"
      icon={<GraduationCap className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
