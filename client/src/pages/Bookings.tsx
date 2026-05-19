/**
 * Bookings — fully managed by Saffi AI
 */
import { CalendarDays } from "lucide-react";
import SaffiSectionChat from "@/components/SaffiSectionChat";

const SUGGESTIONS = [
  "Show me today's bookings",
  "What bookings do I have this week?",
  "Book Sarah Jones in for a 980nm treatment on Friday at 2pm",
  "Mark booking for John Smith as completed",
  "Any no-shows or cancellations?",
  "Show all upcoming confirmed bookings",
];

const SECTION_CONTEXT = `You are in the Bookings section — managing all appointments and scheduling.

What you can do here:
- List bookings (use get_bookings tool — no approval needed for reading)
- Create new bookings (use create_booking tool)
- Update booking status — complete, cancel, mark no-show (use update_booking tool)

Booking statuses: pending, confirmed, completed, cancelled, no_show

APPROVAL REQUIRED for any write action:
Before creating a booking, show the full details:
"I've prepared this booking:
- Client: [name]
- Treatment: [name]
- Date: [date]
- Time: [time]
- Status: confirmed
Shall I go ahead and create it?"

Before updating a booking status:
"I'm about to mark [client name]'s booking on [date] at [time] as [status]. Shall I go ahead?"

Only call create_booking or update_booking after the user confirms.

Important: When searching for bookings, always include the booking ID [in brackets] in your response — this is needed if we need to update it later.
If a client or treatment isn't found, explain clearly and suggest the user add them first.`;

export default function Bookings() {
  return (
    <SaffiSectionChat
      section="Bookings"
      description="Saffi manages all your appointments and scheduling"
      icon={<CalendarDays className="h-4 w-4 text-[#E83A8E]" />}
      suggestions={SUGGESTIONS}
      sectionContext={SECTION_CONTEXT}
    />
  );
}
