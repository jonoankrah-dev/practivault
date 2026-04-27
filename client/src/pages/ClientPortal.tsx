import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  CalendarDays,
  Receipt,
  ShieldCheck,
  ImageIcon,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PortalData {
  client: {
    id: string;
    name: string;
    email: string;
    phone: string;
    stage: string;
    created_at: string;
  };
  bookings: Array<{
    id: string;
    treatment_name: string;
    date: string;
    time: string;
    status: string;
    notes: string;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    amount: number;
    vat_amount: number;
    total_amount: number;
    status: string;
    issue_date: string;
    due_date: string;
    items: string;
  }>;
  consent: Array<{
    id: string;
    treatment: string;
    status: string;
    signed_at: string;
    created_at: string;
  }>;
  photos: Array<{
    id: string;
    treatment_tag: string;
    before_url: string;
    after_url: string;
    notes: string;
    taken_at: string;
  }>;
  expires_at: string;
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed" || status === "signed" || status === "paid") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "pending" || status === "sent") return <Clock className="h-4 w-4 text-amber-500" />;
  if (status === "cancelled" || status === "overdue") return <XCircle className="h-4 w-4 text-red-500" />;
  return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
}

function statusColor(status: string) {
  if (["completed", "signed", "paid"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["pending", "sent", "draft"].includes(status)) return "bg-amber-50 text-amber-700 border-amber-200";
  if (["cancelled", "overdue"].includes(status)) return "bg-red-50 text-red-700 border-red-200";
  return "bg-muted text-muted-foreground";
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        data-testid={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <span className="h-8 w-8 rounded-lg bg-[#b1306f]/10 text-[#b1306f] flex items-center justify-center">
          {icon}
        </span>
        <span className="font-semibold text-gray-900 flex-1">{title}</span>
        <span className="text-sm text-muted-foreground mr-3">{count} {count === 1 ? "record" : "records"}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  );
}

function PhotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <img src={url} alt="Photo" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
    </div>
  );
}

export default function ClientPortal({ token }: { token: string }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<PortalData>({
    queryKey: ["/api/portal", token],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/portal/${token}`);
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f6f3ef] flex items-center justify-center">
        <div className="w-full max-w-2xl mx-auto p-6 space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    const msg = (error as any)?.message || "Portal link not found or has expired.";
    return (
      <div className="min-h-screen bg-[#f6f3ef] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link unavailable</h1>
          <p className="text-muted-foreground text-sm">{msg}</p>
          <p className="text-muted-foreground text-xs mt-4">Contact your practitioner to get a new link.</p>
        </div>
      </div>
    );
  }

  const { client, bookings, invoices, consent, photos, expires_at } = data;

  return (
    <div className="min-h-screen bg-[#f6f3ef]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-4">
          {/* Logo mark */}
          <div className="h-10 w-10 rounded-xl bg-[#b1306f] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C7 2 3 6 3 11c0 3.3 1.7 6.2 4.3 7.9L9 22h6l1.7-3.1C19.3 17.2 21 14.3 21 11c0-5-4-9-9-9z" />
              <circle cx="12" cy="11" r="3" />
            </svg>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-gray-900">Client Portal</h1>
            <p className="text-xs text-muted-foreground">Your personal health record</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Client card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-[#b1306f] text-white flex items-center justify-center text-lg font-semibold shrink-0">
              {(client?.name?.[0] || "?").toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">{client?.name}</h2>
              <p className="text-sm text-muted-foreground">{client?.email}</p>
              {client?.phone && <p className="text-sm text-muted-foreground">{client?.phone}</p>}
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${statusColor(client?.stage)}`}>
              {client?.stage || "client"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Client since {formatDate(client?.created_at)} · Link expires {formatDate(expires_at)}
          </p>
        </div>

        {/* Bookings */}
        <Section icon={<CalendarDays className="h-4 w-4" />} title="Appointments" count={bookings.length}>
          {bookings.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted-foreground">No appointments on record.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {bookings.map((b) => (
                <li key={b.id} className="px-6 py-4 flex items-center gap-4" data-testid={`booking-${b.id}`}>
                  <StatusIcon status={b.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.treatment_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(b.date)}{b.time ? ` at ${b.time}` : ""}
                    </p>
                    {b.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.notes}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${statusColor(b.status)}`}>
                    {b.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Invoices */}
        <Section icon={<Receipt className="h-4 w-4" />} title="Invoices" count={invoices.length}>
          {invoices.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted-foreground">No invoices on record.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {invoices.map((inv) => (
                <li key={inv.id} className="px-6 py-4 flex items-center gap-4" data-testid={`invoice-${inv.id}`}>
                  <StatusIcon status={inv.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      Issued {formatDate(inv.issue_date)} · Due {formatDate(inv.due_date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{formatMoney(inv.total_amount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${statusColor(inv.status)}`}>
                      {inv.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Consent Forms */}
        <Section icon={<ShieldCheck className="h-4 w-4" />} title="Consent Forms" count={consent.length}>
          {consent.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted-foreground">No consent forms on record.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {consent.map((c) => (
                <li key={c.id} className="px-6 py-4 flex items-center gap-4" data-testid={`consent-${c.id}`}>
                  <StatusIcon status={c.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.treatment || "General Consent"}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.signed_at ? `Signed ${formatDate(c.signed_at)}` : `Sent ${formatDate(c.created_at)}`}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${statusColor(c.status)}`}>
                    {c.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Before & After Photos */}
        <Section icon={<ImageIcon className="h-4 w-4" />} title="Before & After Photos" count={photos.length}>
          {photos.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted-foreground">No photos shared yet.</p>
          ) : (
            <div className="p-4 space-y-4">
              {photos.map((p) => (
                <div key={p.id} className="space-y-2" data-testid={`photo-${p.id}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">{p.treatment_tag || "Treatment"}</span>
                    <span className="text-xs text-muted-foreground">· {formatDate(p.taken_at)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {p.before_url && (
                      <button
                        onClick={() => setLightbox(p.before_url)}
                        className="relative rounded-xl overflow-hidden aspect-[4/3] bg-gray-100 group"
                        data-testid={`photo-before-${p.id}`}
                      >
                        <img src={p.before_url} alt="Before" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-md font-medium">Before</span>
                      </button>
                    )}
                    {p.after_url && (
                      <button
                        onClick={() => setLightbox(p.after_url)}
                        className="relative rounded-xl overflow-hidden aspect-[4/3] bg-gray-100 group"
                        data-testid={`photo-after-${p.id}`}
                      >
                        <img src={p.after_url} alt="After" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-[#b1306f]/80 text-white px-1.5 py-0.5 rounded-md font-medium">After</span>
                      </button>
                    )}
                  </div>
                  {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-6">
          Powered by PractiVault · This link is private and personal to you
        </p>
      </div>

      {/* Lightbox */}
      {lightbox && <PhotoLightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
