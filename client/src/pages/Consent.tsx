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

const SECTION_CONTEXT = `You are in the Consent Forms section — tracking client compliance and sending consent forms.

What you can do here:
- List and filter consent forms (use get_consent_forms tool — no approval needed for reading)
- Create and send consent forms to clients (use create_consent_form tool)

Form types available:
- general_consent — General Consent
- laser_treatment — Laser Treatment
- fat_melting — Fat Melting
- skin_tightening — Skin Tightening
- medical_history — Medical History
- patch_test — Patch Test

Consent form statuses: sent, viewed, signed, pending
Overdue = unsigned forms older than 7 days

APPROVAL REQUIRED before sending any consent form:
Before creating a consent form:
"I'm about to send a [form type] consent form to [client name]. Shall I go ahead?"

Only call create_consent_form after the user confirms.

After creating a form, tell the user that a unique signing link has been generated and they can share it with the client via text or email.
When listing forms, highlight any that are overdue (>7 days unsigned) clearly.`;

export default function Consent() {
  return (
    <SafiSectionChat
      section="Consent Forms"
      description="Safi tracks compliance and sends consent forms"
      icon={<ShieldCheck className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
