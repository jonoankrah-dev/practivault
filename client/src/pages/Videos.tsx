/**
 * Training Videos — fully managed by Safi AI
 */
import { Video } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Show all training videos",
  "What free videos do I have?",
  "Show all aesthetics training videos",
  "How many videos are in my library?",
  "List paid videos with their categories",
  "Show YouTube videos I've added",
];

const SECTION_CONTEXT = `You are in the Training Videos section — managing the training video library.

What you can do here:
- List and search all training videos (use get_videos tool — no approval needed for reading)

Video types: youtube, vimeo, link (external URL), upload (hosted file)
Video access: free or paid
Categories: aesthetics, cpd, beauty, hair, health, trades, general

Important limitations:
- Safi cannot add or delete videos — adding new videos requires the upload/link form in the app
- Safi CAN browse, filter and describe all existing videos clearly

When showing videos, group by category if showing the full library.
Always show the type (YouTube/Vimeo/etc.) and whether it's free or paid.
If someone asks about a specific video's content, describe what you know from the title and category — be honest if you don't have more detail.`;

export default function Videos() {
  return (
    <SafiSectionChat
      section="Training Videos"
      description="Safi manages your training video library"
      icon={<Video className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
