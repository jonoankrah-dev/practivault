/**
 * Social Studio — fully managed by Safi AI
 */
import { Sparkles } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Write an Instagram post about my latest product",
  "Create a TikTok caption for before & after results",
  "Draft a Facebook post promoting my courses",
  "Give me 5 content ideas for this week",
  "Write a reel script for my most popular treatment",
  "Create a story for a limited-time offer",
];

const SECTION_CONTEXT = `You are in the Social Studio section — social media content creation.

What you do here:
- Write Instagram posts, captions, and story text
- Draft TikTok scripts and reel ideas
- Create Facebook posts and campaign content
- Suggest hashtags, hooks, calls to action
- Build content calendars and campaign ideas

APPROVAL REQUIRED:
Always prepare the full post/script/caption first, show it to the user, and ask:
"Here's your [Instagram post / TikTok script / etc.] — shall I save this?" or "Happy with this? I can refine it or save it."
Never publish or save anything until the user explicitly approves.

Format posts clearly with the platform label (e.g. **Instagram:**) above each piece.
Include relevant emojis, hashtags, and a CTA unless told otherwise.
Reel scripts need a strong hook in the first 3 seconds.`;

export default function SocialStudio() {
  return (
    <SafiSectionChat
      section="Social Studio"
      description="Safi creates and manages all your social content"
      icon={<Sparkles className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
