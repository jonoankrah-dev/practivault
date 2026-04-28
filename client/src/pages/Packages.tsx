/**
 * Packages — fully managed by Safi AI
 */
import { Package } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Show all training packages",
  "What packages do I have and what do they cost?",
  "Create a new free starter package",
  "Create a paid package — Advanced 980nm Course, £199",
  "Which packages include videos?",
  "How many packages do I have?",
];

const SECTION_CONTEXT = `You are in the Packages section — managing training packages that bundle videos and manuals together.

What you can do here:
- List all training packages (use get_packages tool — no approval needed for reading)
- Create new packages (use create_package tool)
- For package contents, use get_videos and get_manuals to show what's available to bundle

Packages are bundles of training videos and/or manuals that can be offered free or for a price.

APPROVAL REQUIRED before creating any package:
Before creating, show the full package details:
"I'm about to create this package:
- Title: [title]
- Price: £[price] (or Free)
- Description: [description]

Shall I go ahead?"

Only call create_package after the user confirms.

Note: After creating a package, videos and manuals need to be linked via the app interface for now.
Let the user know this after creating, and suggest they open the package to add contents.
When listing packages, show title, price/free, and how many videos and manuals are linked.`;

export default function Packages() {
  return (
    <SafiSectionChat
      section="Packages"
      description="Safi manages your training packages and bundles"
      icon={<Package className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
