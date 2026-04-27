import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Eye, Trash2, CopyIcon, ChevronRight, FileText, Send, Search, CheckCircle2, Receipt, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate, formatMoney } from "@/lib/utils-app";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Status workflow definition ───────────────────────────────────────────────

type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired" | "invoiced";

const WORKFLOW: QuoteStatus[] = ["draft", "sent", "viewed", "accepted", "invoiced"];

const NEXT_STEPS: Record<string, { label: string; next: QuoteStatus; icon: any; color: string }[]> = {
  draft:    [{ label: "Mark as Sent",     next: "sent",     icon: Send,          color: "text-blue-600" },
             { label: "Mark as Rejected", next: "rejected", icon: XCircle,       color: "text-red-600" }],
  sent:     [{ label: "Mark as Viewed",   next: "viewed",   icon: Search,        color: "text-purple-600" },
             { label: "Accept Quote",     next: "accepted", icon: CheckCircle2,  color: "text-green-600" },
             { label: "Mark as Rejected", next: "rejected", icon: XCircle,       color: "text-red-600" }],
  viewed:   [{ label: "Accept Quote",     next: "accepted", icon: CheckCircle2,  color: "text-green-600" },
             { label: "Mark as Rejected", next: "rejected", icon: XCircle,       color: "text-red-600" }],
  accepted: [{ label: "Convert to Invoice", next: "invoiced", icon: Receipt,     color: "text-teal-600" }],
  rejected: [],
  expired:  [],
  invoiced: [],
};

const STATUS_STEP_LABEL: Record<string, string> = {
  draft: "Draft", sent: "Sent", viewed: "Viewed", accepted: "Accepted", invoiced: "Invoiced",
};

const STATUS_ICON: Record<string, any> = {
  draft: FileText, sent: Send, viewed: Search, accepted: CheckCircle2, invoiced: Receipt,
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: quotes, isLoading } = useQuery<any[]>({ queryKey: ["/api/quotes"] });
  const [addOpen, setAddOpen] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<any | null>(null);

  const stats = useMemo(() => {
    if (!quotes) return { pipeline: 0, wonThisMonth: 0, conversion: 0 };
    const pipeline = quotes.filter((q) => ["draft", "sent", "viewed"].includes(q.status)).reduce((s, q) => s + Number(q.amount || 0), 0);
    const monthKey = new Date().toISOString().slice(0, 7);
    const wonThisMonth = quotes
      .filter((q) => ["accepted", "invoiced"].includes(q.status) && q.created_at?.slice(0, 7) === monthKey)
      .reduce((s, q) => s + Number(q.amount || 0), 0);
    const terminated = quotes.filter((q) => ["accepted", "rejected", "expired", "invoiced"].includes(q.status));
    const conversion = terminated.length > 0 ? (quotes.filter((q) => ["accepted", "invoiced"].includes(q.status)).length / terminated.length) * 100 : 0;
    return { pipeline, wonThisMonth, conversion };
  }, [quotes]);

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const res = await apiRequest("PATCH", `/api/quotes/${id}`, patch);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      // Update the preview panel if it's open on this quote
      setPreviewQuote((prev: any) => prev?.id === vars.id ? { ...prev, ...vars.patch } : prev);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/quotes/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setPreviewQuote(null);
      toast({ title: "Quote deleted" });
    },
  });

  const convertToInvoice = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/convert-to-invoice`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setPreviewQuote(null);
      toast({
        title: `Invoice ${data.invoiceNumber} created`,
        description: "Quote marked as Invoiced. Opening Invoices…",
      });
      setTimeout(() => navigate("/invoices"), 800);
    },
    onError: (e: any) => toast({ title: "Conversion failed", description: e.message, variant: "destructive" }),
  });

  const advanceStatus = (q: any, next: QuoteStatus) => {
    // "invoiced" is handled by the dedicated convert mutation
    if (next === "invoiced") {
      convertToInvoice.mutate(q.id);
      return;
    }
    const patch: any = { status: next };
    if (next === "sent" && !q.sent_at) patch.sent_at = new Date().toISOString();
    update.mutate({ id: q.id, patch });
    toast({ title: `Quote moved to ${next}` });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Quotes"
        subtitle={`${quotes?.length ?? 0} total`}
        actions={
          <Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-new-quote">
            <Plus className="h-4 w-4 mr-1.5" /> New Quote
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pipeline</div>
          <div className="text-2xl font-semibold mt-1">{formatMoney(stats.pipeline)}</div>
          <div className="text-xs text-muted-foreground mt-1">Draft + Sent + Viewed</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Won this month</div>
          <div className="text-2xl font-semibold mt-1 text-green-600">{formatMoney(stats.wonThisMonth)}</div>
          <div className="text-xs text-muted-foreground mt-1">Accepted + Invoiced</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Conversion rate</div>
          <div className="text-2xl font-semibold mt-1">{stats.conversion.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground mt-1">Of all closed quotes</div>
        </div>
      </div>

      {/* Kanban status strip */}
      <div className="flex items-center gap-0 mb-6 bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
        {WORKFLOW.map((step, i) => {
          const count = quotes?.filter((q) => q.status === step).length ?? 0;
          const Icon = STATUS_ICON[step];
          const isLast = i === WORKFLOW.length - 1;
          return (
            <div key={step} className={cn(
              "flex-1 flex items-center gap-2 px-4 py-3 text-sm",
              !isLast && "border-r border-border"
            )}>
              <StatusBadge status={step} />
              <span className="font-semibold ml-auto tabular-nums text-muted-foreground">{count}</span>
              {!isLast && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
            </div>
          );
        })}
        {/* rejected count */}
        <div className="border-l border-border px-4 py-3 flex items-center gap-2 text-sm">
          <StatusBadge status="rejected" />
          <span className="font-semibold ml-1 tabular-nums text-muted-foreground">
            {quotes?.filter((q) => q.status === "rejected").length ?? 0}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-5 py-3 font-medium">Client</th>
              <th className="text-left px-4 py-3 font-medium">Description</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-10" /></td></tr>
              ))
            ) : !quotes?.length ? (
              <tr><td colSpan={6} className="text-center text-sm text-muted-foreground py-12">No quotes yet.</td></tr>
            ) : (
              quotes.map((q) => {
                const nextSteps = NEXT_STEPS[q.status] ?? [];
                return (
                  <tr
                    key={q.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    data-testid={`row-quote-${q.id}`}
                    onClick={() => setPreviewQuote(q)}
                  >
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="text-sm font-medium">{q.clients?.name || q.notes || "—"}</div>
                      <div className="text-xs text-muted-foreground">{q.clients?.email || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                      {q.description || q.treatments?.name || "Custom"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">{formatMoney(Number(q.amount))}</td>
                    <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{q.created_at ? formatDate(q.created_at) : "—"}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {/* Next step dropdown */}
                        {nextSteps.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                                title="Advance status"
                              >
                                Next <ChevronRight className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[180px]">
                              {nextSteps.map((step) => {
                                const Icon = step.icon;
                                return (
                                  <DropdownMenuItem
                                    key={step.next}
                                    onClick={() => advanceStatus(q, step.next)}
                                    className="gap-2"
                                  >
                                    <Icon className={cn("h-4 w-4", step.color)} />
                                    <span>{step.label}</span>
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {/* Preview */}
                        <button
                          onClick={() => setPreviewQuote(q)}
                          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-primary"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => { if (confirm("Delete this quote?")) del.mutate(q.id); }}
                          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <NewQuoteModal open={addOpen} onClose={() => setAddOpen(false)} />
      <QuotePreviewPanel
        quote={previewQuote}
        onClose={() => setPreviewQuote(null)}
        onAdvance={advanceStatus}
        onDelete={(id) => del.mutate(id)}
        isConverting={convertToInvoice.isPending}
      />
    </div>
  );
}

// ─── New Quote Modal ──────────────────────────────────────────────────────────

function NewQuoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: clients } = useQuery<any[]>({ queryKey: ["/api/clients"], enabled: open });
  const { data: treatments } = useQuery<any[]>({ queryKey: ["/api/treatments"], enabled: open });
  const [clientId, setClientId] = useState("");
  const [treatmentId, setTreatmentId] = useState("none");
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/quotes", {
        client_id: clientId,
        treatment_id: treatmentId === "none" ? null : treatmentId,
        amount: Number(amount),
        status: "draft",
        expires_at: expiresAt || null,
        notes: notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote created as Draft" });
      onClose();
      setClientId(""); setTreatmentId("none"); setAmount(0); setNotes("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader><DialogTitle>New Quote</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Treatment (optional)</Label>
            <Select value={treatmentId} onValueChange={(v) => {
              setTreatmentId(v);
              if (v !== "none") {
                const t = treatments?.find((x) => x.id === v);
                if (t) setAmount(Number(t.price));
              }
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None / custom</SelectItem>
                {treatments?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (£)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Expires</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any notes for this quote…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!clientId || create.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {create.isPending ? "Creating…" : "Create Quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quote Preview Panel ──────────────────────────────────────────────────────

function QuotePreviewPanel({
  quote, onClose, onAdvance, onDelete, isConverting,
}: {
  quote: any | null;
  onClose: () => void;
  onAdvance: (q: any, next: QuoteStatus) => void;
  onDelete: (id: string) => void;
  isConverting?: boolean;
}) {
  const { toast } = useToast();

  return (
    <Sheet open={!!quote} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-[480px] w-full p-0 overflow-y-auto flex flex-col">
        {quote && (() => {
          const lineItems: { item: string; qty: number; unitPrice: number }[] =
            Array.isArray(quote.line_items) ? quote.line_items :
            typeof quote.line_items === "string" ? JSON.parse(quote.line_items) : [];
          const clientName = quote.clients?.name || quote.notes || "Client";
          const clientEmail = quote.clients?.email || null;
          const nextSteps = NEXT_STEPS[quote.status] ?? [];
          const workflowIdx = WORKFLOW.indexOf(quote.status as QuoteStatus);

          return (
            <>
              {/* Header */}
              <div className="p-6 border-b border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Quote for</div>
                <div className="text-lg font-semibold">{clientName}</div>
                {clientEmail && <div className="text-sm text-muted-foreground">{clientEmail}</div>}
                {quote.description && <div className="text-sm text-muted-foreground mt-1">{quote.description}</div>}
              </div>

              {/* Workflow stepper */}
              <div className="px-6 py-4 border-b border-border bg-muted/20">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Progress</div>
                <div className="flex items-center gap-0">
                  {WORKFLOW.map((step, i) => {
                    const isPast = workflowIdx > i;
                    const isCurrent = workflowIdx === i || (quote.status === "rejected" && i === 0);
                    const isActualCurrent = quote.status === step;
                    const Icon = STATUS_ICON[step];
                    return (
                      <div key={step} className="flex items-center flex-1 min-w-0">
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all",
                            isPast ? "bg-green-100 text-green-700" :
                            isActualCurrent ? "bg-primary text-white ring-2 ring-primary/30" :
                            "bg-muted text-muted-foreground"
                          )}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className={cn(
                            "text-[10px] font-medium text-center leading-tight",
                            isActualCurrent ? "text-primary" : isPast ? "text-green-700" : "text-muted-foreground"
                          )}>
                            {STATUS_STEP_LABEL[step]}
                          </span>
                        </div>
                        {i < WORKFLOW.length - 1 && (
                          <div className={cn(
                            "h-0.5 flex-1 mx-1 mb-4 rounded-full transition-all",
                            isPast ? "bg-green-400" : "bg-muted"
                          )} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {quote.status === "rejected" && (
                  <div className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5" /> This quote was rejected
                  </div>
                )}
                {quote.status === "expired" && (
                  <div className="mt-2 text-xs text-amber-600 font-medium">This quote has expired</div>
                )}
              </div>

              {/* Amount box */}
              <div className="px-6 py-4 border-b border-border">
                <div className="bg-primary/5 rounded-xl p-5 border border-primary/10">
                  <div className="text-xs text-muted-foreground uppercase font-medium">Total Amount</div>
                  <div className="text-3xl font-semibold tracking-tight text-primary mt-1">
                    {formatMoney(Number(quote.amount))}
                  </div>
                  {quote.treatments?.name && (
                    <div className="text-sm text-muted-foreground mt-1">{quote.treatments.name}</div>
                  )}
                </div>
              </div>

              {/* Line items */}
              {lineItems.length > 0 && (
                <div className="px-6 py-4 border-b border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Breakdown</div>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 text-muted-foreground">
                          <th className="text-left px-3 py-2 font-medium">Item</th>
                          <th className="text-center px-2 py-2 font-medium w-10">Qty</th>
                          <th className="text-right px-3 py-2 font-medium">Price</th>
                          <th className="text-right px-3 py-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((li, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                            <td className="px-3 py-2">{li.item}</td>
                            <td className="px-2 py-2 text-center text-muted-foreground">{li.qty}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{formatMoney(li.unitPrice)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatMoney(li.qty * li.unitPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border bg-primary/5">
                          <td colSpan={3} className="px-3 py-2 font-semibold text-right">Total</td>
                          <td className="px-3 py-2 font-bold text-right text-primary">{formatMoney(Number(quote.amount))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="px-6 py-4 border-b border-border space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={quote.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{quote.created_at ? formatDate(quote.created_at) : "—"}</span>
                </div>
                {quote.sent_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sent</span>
                    <span>{formatDate(quote.sent_at)}</span>
                  </div>
                )}
                {quote.expires_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expires</span>
                    <span>{formatDate(quote.expires_at)}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-6 py-4 space-y-2 mt-auto">
                {nextSteps.map((step) => {
                  const Icon = step.icon;
                  const isConvertBtn = step.next === "invoiced";
                  const converting = isConvertBtn && isConverting;
                  return (
                    <Button
                      key={step.next}
                      disabled={converting}
                      className={cn(
                        "w-full gap-2",
                        step.next === "rejected"
                          ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                          : isConvertBtn
                          ? "bg-teal-600 text-white hover:bg-teal-700"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                      variant={step.next === "rejected" ? "outline" : "default"}
                      onClick={() => onAdvance(quote, step.next)}
                    >
                      {converting
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Icon className="h-4 w-4" />}
                      {converting ? "Creating Invoice…" : step.label}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    const link = `${window.location.origin}/#/quote/${quote.id}`;
                    navigator.clipboard.writeText(link);
                    toast({ title: "Quote link copied" });
                  }}
                >
                  <CopyIcon className="h-4 w-4" /> Copy shareable link
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                  onClick={() => { if (confirm("Delete this quote?")) { onDelete(quote.id); onClose(); } }}
                >
                  <Trash2 className="h-4 w-4" /> Delete quote
                </Button>
              </div>
            </>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
}
