/**
 * Manuals — fully managed by Safi AI
 */
import { BookOpen } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Show all my manuals",
  "What endoPulse training documents do I have?",
  "Show all CPD course materials",
  "Find the manual about the 980nm machine",
  "How many manuals have I uploaded?",
  "Show manuals uploaded this month",
];

const SECTION_CONTEXT = `You are in the Manuals section — managing uploaded training documents and reference materials.

What you can do here:
- List and search all uploaded manuals (use get_manuals tool — no approval needed for reading)
- Answer questions about manual content — Safi has access to the extracted text from uploaded PDFs

Manual categories include: endopulse, cpd, aesthetics, and others.

Important limitations:
- Safi cannot upload new manuals — that must be done via the upload button in the app
- Safi CAN read and summarise the content of existing manuals using the knowledge embedded in your system context
- If a user asks to upload a new manual, explain they need to use the upload button, then offer to help find or summarise existing ones

When listing manuals, show name, category, and upload date clearly.
If asked about the content of a specific manual, draw on the extracted text you have access to in your knowledge.
Group manuals by category when showing a full list.`;

export default function Manuals() {
  return (
    <SafiSectionChat
      section="Manuals"
      description="Safi manages and answers questions from your training documents"
      icon={<BookOpen className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
