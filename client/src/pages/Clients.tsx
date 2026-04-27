import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, X, Phone, Mail, Edit3, Trash2, CalendarDays, Link2, Copy, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatMoney, formatDate, daysAgo } from "@/lib/utils-app";
import { useToast } from "@/hooks/use-toast";

const STAGES = ["lead", "prospect", "active", "vip", "lapsed", "archived"] as const;

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: clients, isLoading } = useQuery<any[]>({ queryKey: ["/api/clients"] });

  const filtered = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c) => {
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.phone?.toLowerCase().includes(s)
      );
    });
  }, [clients, search, stageFilter]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Clients"
        subtitle={`${clients?.length ?? 0} total`}
        actions={
          <Button
            onClick={() => setAddOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-add-client"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Client
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-5 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Contact</th>
              <th className="text-left px-4 py-3 font-medium">Stage</th>
              <th className="text-right px-4 py-3 font-medium">LTV</th>
              <th className="text-left px-4 py-3 font-medium">Added</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-10" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-sm text-muted-foreground py-12">
                {clients?.length === 0 ? "No clients yet — add your first one." : "No matches."}
              </td></tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  data-testid={`row-client-${c.id}`}
                >
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium">{c.name}</div>
                    {c.email && <div className="text-xs text-muted-foreground mt-0.5">{c.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {c.phone || "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.stage} /></td>
                  <td className="px-4 py-3 text-right text-sm font-medium tabular-nums">
                    {formatMoney(Number(c.ltv || 0))}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{daysAgo(c.created_at)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ClientDetailDrawer clientId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function AddClientModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: any }) {
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [stage, setStage] = useState<string>(initial?.stage || "prospect");
  const [notes, setNotes] = useState(initial?.notes || "");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/clients", {
        name,
        email: email || null,
        phone: phone || null,
        stage,
        notes: notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client added" });
      onClose();
      setName(""); setEmail(""); setPhone(""); setNotes(""); setStage("prospect");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!name || create.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-save-client"
          >
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientDetailDrawer({ clientId, onClose }: { clientId: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/clients", clientId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clients/${clientId}`);
      return res.json();
    },
    enabled: !!clientId,
  });

  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState("");

  const addNote = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/clients/${clientId}`, {
        notes: (data?.client?.notes ? data.client.notes + "\n\n" : "") + noteText,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      setNoteText("");
      toast({ title: "Note added" });
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/clients/${clientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onClose();
      toast({ title: "Client deleted" });
    },
  });

  const client = data?.client;
  const bookings = data?.bookings || [];

  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generatePortal = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/portal/generate", { client_id: clientId });
      return res.json();
    },
    onSuccess: (session: any) => {
      const baseUrl = window.location.origin + window.location.pathname;
      const link = `${baseUrl}#/portal/${session.token}`;
      setPortalLink(link);
    },
    onError: (e: any) => toast({ title: "Failed to generate link", description: e.message, variant: "destructive" }),
  });

  const copyLink = async () => {
    if (!portalLink) return;
    await navigator.clipboard.writeText(portalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={!!clientId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-[480px] w-full p-0 overflow-y-auto">
        {isLoading || !client ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8" />
            <Skeleton className="h-24" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <>
            <div className="px-6 py-5 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{client.name}</h2>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={client.stage} />
                    <span className="text-xs text-muted-foreground">
                      Added {formatDate(client.created_at)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Delete this client?")) del.mutate();
                  }}
                  className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Contact */}
              <div className="space-y-2">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${client.phone}`} className="hover:underline">{client.phone}</a>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Lifetime value</div>
                  <div className="text-base font-semibold mt-1">{formatMoney(Number(client.ltv || 0))}</div>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Visits</div>
                  <div className="text-base font-semibold mt-1">{bookings.filter((b: any) => b.status === "completed").length}</div>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Total bookings</div>
                  <div className="text-base font-semibold mt-1">{bookings.length}</div>
                </div>
              </div>

              {/* Recent bookings */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Recent bookings
                </h3>
                {bookings.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-lg">
                    No bookings yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bookings.slice(0, 8).map((b: any) => (
                      <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-md border border-border">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{b.treatments?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(b.date)} at {b.time?.slice(0, 5)}
                          </div>
                        </div>
                        <StatusBadge status={b.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Portal */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Client Portal</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Generate a private link your client can use to view their appointments, invoices, consent forms, and before/after photos — no login required.
                </p>
                {portalLink ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-muted/40 rounded-lg p-3">
                      <input
                        readOnly
                        value={portalLink}
                        className="flex-1 text-xs bg-transparent outline-none text-muted-foreground"
                        data-testid="input-portal-link"
                      />
                      <button
                        onClick={copyLink}
                        className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md hover:bg-primary/10 text-primary"
                        data-testid="button-copy-portal-link"
                        title="Copy link"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Link expires in 30 days. Regenerate to reset.</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generatePortal.mutate()}
                        disabled={generatePortal.isPending}
                        data-testid="button-regenerate-portal"
                      >
                        {generatePortal.isPending ? "Generating…" : "Regenerate"}
                      </Button>
                      {client?.email && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const subject = encodeURIComponent("Your client portal is ready");
                            const body = encodeURIComponent(`Hi ${client.name},\n\nYou can now view your records — appointments, invoices, consent forms and before/after photos — using the link below:\n\n${portalLink}\n\nThis link is personal to you and expires in 30 days.\n\nTake care,\nThe Team`);
                            window.open(`mailto:${client.email}?subject=${subject}&body=${body}`);
                          }}
                          data-testid="button-email-portal"
                        >
                          <Mail className="h-3.5 w-3.5 mr-1.5" /> Email to client
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => generatePortal.mutate()}
                    disabled={generatePortal.isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    data-testid="button-generate-portal"
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    {generatePortal.isPending ? "Generating…" : "Send Portal Link"}
                  </Button>
                )}
              </div>

              {/* Insurance Evidence Pack */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Insurance Evidence Pack</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Export a single PDF containing this client's consent forms, before &amp; after photos, timestamped bookings, and invoices — ready to share with your insurer or solicitor if needed.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const { jsPDF } = await import("jspdf");
                      const doc = new jsPDF();
                      const berry = [177, 48, 111] as [number, number, number];
                      const dark = [36, 31, 25] as [number, number, number];
                      doc.setFillColor(...berry);
                      doc.rect(0, 0, 210, 35, "F");
                      doc.setTextColor(255, 255, 255);
                      doc.setFontSize(18);
                      doc.setFont("helvetica", "bold");
                      doc.text("INSURANCE EVIDENCE PACK", 15, 18);
                      doc.setFontSize(10);
                      doc.setFont("helvetica", "normal");
                      doc.text(`Client: ${client.name}`, 15, 28);
                      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 130, 28);
                      doc.setTextColor(...dark);
                      let y = 48;
                      // Client details
                      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
                      doc.text("CLIENT DETAILS", 15, y); y += 8;
                      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
                      doc.text(`Name: ${client.name}`, 15, y); y += 6;
                      if (client.email) { doc.text(`Email: ${client.email}`, 15, y); y += 6; }
                      if (client.phone) { doc.text(`Phone: ${client.phone}`, 15, y); y += 6; }
                      doc.text(`Stage: ${client.stage}`, 15, y); y += 10;
                      // Bookings
                      if (bookings.length > 0) {
                        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
                        doc.text("BOOKINGS (timestamped)", 15, y); y += 8;
                        doc.setFillColor(245, 243, 239);
                        doc.rect(10, y, 190, 7, "F");
                        doc.setFont("helvetica", "bold"); doc.setFontSize(8);
                        doc.text("Date", 15, y + 5); doc.text("Treatment", 50, y + 5); doc.text("Status", 130, y + 5); doc.text("Time", 170, y + 5);
                        y += 11;
                        doc.setFont("helvetica", "normal");
                        for (const b of bookings) {
                          doc.text(new Date(b.date).toLocaleDateString("en-GB"), 15, y);
                          doc.text(b.treatments?.name || "—", 50, y);
                          doc.text(b.status || "—", 130, y);
                          doc.text(b.time?.slice(0,5) || "—", 170, y);
                          y += 7;
                          if (y > 270) { doc.addPage(); y = 20; }
                        }
                        y += 4;
                      }
                      if (client.notes) {
                        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
                        doc.text("NOTES", 15, y); y += 8;
                        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
                        const lines = doc.splitTextToSize(client.notes, 180);
                        doc.text(lines, 15, y); y += lines.length * 5 + 8;
                      }
                      doc.setFontSize(7); doc.setTextColor(150, 140, 130);
                      doc.text("Generated by PractiVault — practivault.com", 105, 290, { align: "center" });
                      doc.save(`Evidence-Pack-${client.name.replace(/\s+/g, "-")}.pdf`);
                    } catch { toast({ title: "Export failed", variant: "destructive" }); }
                  }}
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                  Export Evidence Pack PDF
                </Button>
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Notes</h3>
                {client.notes && (
                  <div className="text-sm bg-muted/30 rounded-lg p-3 mb-2 whitespace-pre-wrap">
                    {client.notes}
                  </div>
                )}
                <Textarea
                  placeholder="Add a note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={() => addNote.mutate()}
                  disabled={!noteText || addNote.isPending}
                  size="sm"
                  className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {addNote.isPending ? "Saving…" : "Add note"}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
