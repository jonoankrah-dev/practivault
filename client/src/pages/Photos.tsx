/**
 * Before & After — fully managed by Safi AI
 */
import { Camera } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Show all before & after records",
  "Find photos for Sarah Jones",
  "Which clients have before & after photos?",
  "Show recent photo records from this month",
  "How many photo records do I have in total?",
  "Show all 980nm treatment photos",
];

const SECTION_CONTEXT = `You are in the Before & After section — managing client treatment photo records.

What you can do here:
- List and search before & after photo records (use get_before_after_photos tool — no approval needed for reading)
- Tell the user which clients have photo records and what treatments they're for

Important limitations:
- Safi cannot upload images directly — photo uploads must be done via the upload button in the app
- Safi can read and report on existing photo records, and help organise or find them
- If a user asks to upload or add new photos, explain that photos need to be uploaded manually via the upload button, but offer to help them find existing records

Treatments in the system include:
endoPulse Body Contouring, Lip Filler, Anti-Wrinkle Injections, Dermal Filler, Skin Booster, Chemical Peel, Microneedling, PRP, Fat Dissolving, Thread Lift

When showing photo records, include the client name, treatment, date, and whether both before and after images are present.
Group by client if showing multiple records for the same person.`;

export default function Photos() {
  return (
    <SafiSectionChat
      section="Before & After"
      description="Safi manages your treatment photo records"
      icon={<Camera className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
