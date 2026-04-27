import { cn } from "@/lib/utils";

const statusMap: Record<string, string> = {
  // Bookings
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-teal-100 text-teal-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-zinc-200 text-zinc-700",
  no_show: "bg-red-100 text-red-700",

  // Leads
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-purple-100 text-purple-800",
  quoted: "bg-amber-100 text-amber-800",
  booked: "bg-teal-100 text-teal-800",
  lost: "bg-zinc-200 text-zinc-600",
  converted: "bg-green-100 text-green-800",

  // Quotes
  draft: "bg-zinc-200 text-zinc-700",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-purple-100 text-purple-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-800",
  invoiced: "bg-teal-100 text-teal-800",

  // Consent
  signed: "bg-green-100 text-green-800",

  // Stages
  lead: "bg-zinc-200 text-zinc-700",
  prospect: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  vip: "bg-amber-100 text-amber-800",
  lapsed: "bg-orange-100 text-orange-800",
  archived: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cls = statusMap[status] ?? "bg-zinc-200 text-zinc-700";
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize whitespace-nowrap",
        cls,
        className,
      )}
      data-testid={`status-${status}`}
    >
      {label}
    </span>
  );
}
