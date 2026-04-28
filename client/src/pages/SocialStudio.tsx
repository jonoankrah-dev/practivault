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

const SECTION_CONTEXT = `You are operating in the Social Studio section.
Your job here is to help create and manage social media content for the business.
You can:
- Write Instagram posts, captions, and story text
- Draft TikTok scripts and reel ideas
- Create Facebook posts and updates
- Generate content calendars and campaign ideas
- Suggest hashtags, hooks, and calls to action
- Tailor tone — educational, promotional, behind-the-scenes, testimonial

Always ask for tone/goal if unclear. Format output clearly with platform labels.
When writing posts, include relevant emojis, hashtags, and a CTA unless the user says not to.
Keep captions punchy. Reels scripts should have a hook in the first 3 seconds.`;

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
