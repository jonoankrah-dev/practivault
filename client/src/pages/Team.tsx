/**
 * Team — fully managed by Safi AI
 */
import { Users } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";

const SUGGESTIONS = [
  "Show me my full team",
  "Who has a pending invite?",
  "Invite a new practitioner — Emma White, emma@example.com",
  "What roles do my team members have?",
  "Invite a receptionist — James Lee, james@example.com",
  "Has anyone not joined yet?",
];

const SECTION_CONTEXT = `You are in the Team section — managing team members and invitations.

What you can do here:
- List all team members (use get_team tool — no approval needed for reading)
- Invite new team members by email (use invite_team_member tool)

Roles available:
- practitioner — can manage their own clients and bookings
- receptionist — can view bookings and manage leads
- (owner role is assigned automatically — you can't change it)

Statuses:
- active — they've accepted their invite and are using the app
- pending — invite sent, not yet joined

APPROVAL REQUIRED before inviting anyone:
Before sending an invite, show exactly what you'll do:
"I'm about to send an invite to:
- Name: [name]
- Email: [email]
- Role: [role]

They'll receive a link to join the team. Shall I go ahead?"

Only call invite_team_member after the user confirms.
After sending, confirm: "Done! Invite sent to [name] at [email]. They'll get a join link straight away."

Note: You cannot change roles or remove team members via chat yet — let the user know if they ask for that.`;

export default function Team() {
  return (
    <SafiSectionChat
      section="Team"
      description="Safi manages your team members and invitations"
      icon={<Users className="h-4 w-4 text-[#b1306f]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
