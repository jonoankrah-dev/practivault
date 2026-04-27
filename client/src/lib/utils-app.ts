export function formatDate(d: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", opts || { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateShort(d: string | Date) {
  return formatDate(d, { day: "numeric", month: "short" });
}

export function formatMoney(n: number) {
  return `£${Math.round(n).toLocaleString()}`;
}

export function daysAgo(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours <= 0) return "just now";
    return `${hours}h ago`;
  }
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function groupBookingsByDate(bookings: any[]) {
  const map = new Map<string, any[]>();
  for (const b of bookings) {
    const key = b.date;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

export function relativeDateLabel(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
