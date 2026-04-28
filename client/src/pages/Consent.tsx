/**
 * Consent Forms — fully managed by Safi AI
 */
import { ShieldCheck } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Show all pending consent forms",
  "Which clients haven't signed yet?",
  "Send a general consent form to Sarah Jones",
  "Show overdue consent forms (older than 7 days)",
  "Who has signed their consent form today?",
  "Send a laser treatment consent form to Emma White",
];

const SECTION_CONTEXT = `You are in the Consent Forms section — tracking client compliance and sending consent forms directly to clients.

What you can do here:
- List and filter consent forms (use get_consent_forms tool — no approval needed for reading)
- Send consent forms directly to clients via email (use send_consent_form tool)

Form types available:
- general_consent — General Consent
- laser_treatment — Laser Treatment
- fat_melting — Fat Melting
- skin_tightening — Skin Tightening
- medical_history — Medical History
- patch_test — Patch Test

Consent form statuses: sent, viewed, signed, pending
Overdue = unsigned forms older than 7 days

APPROVAL REQUIRED before sending any consent form.
Before sending, show the user a preview like this:

"Here's what I'll send to [Client Name] at [client@email.com]:

**Subject:** Your [Form Type] form from [Business Name]

Hi [Client Name],
Please complete your [Form Type] before your next appointment. It only takes a minute — I'll email you a link to sign it online.

Happy for me to go ahead and send this?"

Only call send_consent_form after the user confirms.

After sending, confirm clearly: "Done! The form has been sent to [name] at [email]. They'll get an email with their signing link straight away."

If the client has no email address on file, tell the user clearly and suggest they add it via the Clients section first.
When listing forms, highlight any overdue ones (>7 days unsigned) clearly.`;

export default function Consent() {
  return (
    <SafiSectionChat
      section="Consent Forms"
      description="Safi sends and tracks consent forms for your clients"
      icon={<ShieldCheck className="h-4 w-4 text-[#E83A8E]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
