import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, FileText, Trash2, Send, CheckCircle2,
  Download, Eye, X, PoundSterling, Clock, AlertCircle, Building2,
} from "lucide-react";

type Client = { id: string; name: string; email?: string };

type LineItem = { description: string; quantity: number; unit_price: number; total: number };

type Invoice = {
  id: string;
  client_id: string | null;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "overdue";
  issue_date: string;
  due_date: string | null;
  items: LineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  payment_link: string | null;
  paid_at: string | null;
  created_at: string;
  client_name?: string;
  client_email?: string;
};

const STATUS_CONFIG = {
  draft: { label: "Draft", colour: "bg-gray-100 text-gray-600", icon: FileText },
  sent: { label: "Sent", colour: "bg-blue-100 text-blue-700", icon: Send },
  paid: { label: "Paid", colour: "bg-green-100 text-green-700", icon: CheckCircle2 },
  overdue: { label: "Overdue", colour: "bg-red-100 text-red-600", icon: AlertCircle },
};

function formatGBP(n: number) {
  return `£${Number(n).toFixed(2)}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY_ITEM: LineItem = { description: "", quantity: 1, unit_price: 0, total: 0 };

export default function Invoices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [taxYear, setTaxYear] = useState("all");

  const TAX_YEARS = (() => {
    const years = [];
    const y = new Date().getFullYear();
    for (let i = y; i >= y - 5; i--) years.push(`${i - 1}/${i}`);
    return years;
  })();

  function exportHmrcCsv() {
    const filtered = taxYear === "all" ? invoices : invoices.filter((inv) => {
      const [startYr, endYr] = taxYear.split("/").map(Number);
      const d = new Date(inv.issue_date);
      return d >= new Date(`${startYr}-04-06`) && d <= new Date(`${endYr}-04-05`);
    });
    const rows = [
      ["Invoice No", "Client", "Issue Date", "Due Date", "Status", "Subtotal (£)", "VAT Rate (%)", "VAT Amount (£)", "Total (£)"],
      ...filtered.map((inv) => [
        inv.invoice_number,
        inv.client_name || "",
        formatDate(inv.issue_date),
        formatDate(inv.due_date),
        inv.status,
        inv.subtotal.toFixed(2),
        inv.tax_rate.toFixed(0),
        inv.tax_amount.toFixed(2),
        inv.total.toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `HMRC-Invoices-${taxYear.replace("/", "-")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // Form state
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: me } = useQuery<any>({ queryKey: ["/api/me"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/invoices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice created" });
      setModalOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: e.message || "Failed", variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/invoices/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted" });
      setViewInvoice(null);
    },
  });

  function resetForm() {
    setClientId("");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setItems([{ ...EMPTY_ITEM }]);
    setTaxRate(0);
    setNotes("");
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      const q = Number(updated[index].quantity) || 0;
      const p = Number(updated[index].unit_price) || 0;
      updated[index].total = q * p;
      return updated;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  function handleCreate() {
    if (!clientId) return toast({ title: "Select a client", variant: "destructive" });
    if (items.length === 0 || items.every((i) => !i.description)) return toast({ title: "Add at least one line item", variant: "destructive" });
    createMutation.mutate({
      client_id: clientId,
      issue_date: issueDate,
      due_date: dueDate || null,
      items,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      notes: notes || null,
      status: "draft",
    });
  }

  async function downloadPDF(inv: Invoice) {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const berry = [177, 48, 111] as [number, number, number];
      const dark = [36, 31, 25] as [number, number, number];
      const cream = [245, 243, 239] as [number, number, number];
      const lightGrey = [230, 220, 215] as [number, number, number];

      // Business profile from /api/me (already fetched via useQuery)
      const profile = me || {};
      const bizName: string = profile.business_name || profile.name || "";
      const bizAddress: string = profile.business_address || "";
      const bizPhone: string = profile.business_phone || "";
      const bizWebsite: string = profile.business_website || "";
      const vatNumber: string = profile.vat_number || "";
      const companyNumber: string = profile.company_number || "";
      const bankDetails: string = profile.bank_details || "";
      const paymentTerms: string = profile.payment_terms || "";
      const logoUrl: string = profile.logo_url || "";

      // ── HEADER BAND ────────────────────────────────────────────
      doc.setFillColor(...berry);
      doc.rect(0, 0, 210, 40, "F");
      doc.setTextColor(255, 255, 255);

      // Logo (if available) — load as image, draw top-right
      let logoLoaded = false;
      if (logoUrl) {
        try {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              try {
                // Determine format from URL
                const ext = logoUrl.split(".").pop()?.toUpperCase();
                const fmt = ext === "PNG" ? "PNG" : ext === "JPG" || ext === "JPEG" ? "JPEG" : "PNG";
                // Draw logo at top-right of header, max 30px tall
                const maxH = 28;
                const ratio = img.width / img.height;
                const drawH = Math.min(maxH, img.height);
                const drawW = drawH * ratio;
                const xPos = 200 - drawW;
                doc.addImage(img, fmt, xPos, 6, drawW, drawH);
                logoLoaded = true;
              } catch { /* logo failed, skip */ }
              resolve();
            };
            img.onerror = () => resolve();
            img.src = logoUrl;
          });
        } catch { /* ignore */ }
      }

      // Business name in header (left side)
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      if (bizName) {
        doc.text(bizName, 15, 14);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("INVOICE", 15, 22);
        doc.text(`#${inv.invoice_number}`, 15, 29);
      } else {
        doc.setFontSize(22);
        doc.text("INVOICE", 15, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`#${inv.invoice_number}`, 15, 29);
      }

      // Status badge (top-right, below any logo)
      doc.setFontSize(8);
      doc.text(inv.status.toUpperCase(), logoLoaded ? 200 - 2 : 195, 38, { align: "right" });

      // ── FROM / TO BLOCK ────────────────────────────────────────
      doc.setTextColor(...dark);
      let y = 52;

      // FROM (business details, right column)
      if (bizName || bizAddress || bizPhone || bizWebsite) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("From:", 120, y);
        doc.setFont("helvetica", "normal");
        let fy = y + 5;
        if (bizName) { doc.text(bizName, 120, fy); fy += 5; }
        if (bizAddress) {
          const addrLines = doc.splitTextToSize(bizAddress, 75);
          doc.text(addrLines, 120, fy);
          fy += addrLines.length * 5;
        }
        if (bizPhone) { doc.text(bizPhone, 120, fy); fy += 5; }
        if (bizWebsite) { doc.text(bizWebsite, 120, fy); fy += 5; }
        if (vatNumber) { doc.text(`VAT Reg: ${vatNumber}`, 120, fy); fy += 5; }
        if (companyNumber) { doc.text(`Co. No: ${companyNumber}`, 120, fy); }
      }

      // BILLED TO (left column)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Billed to:", 15, y);
      doc.setFont("helvetica", "normal");
      doc.text(inv.client_name || "—", 15, y + 5);
      if (inv.client_email) doc.text(inv.client_email, 15, y + 10);

      // Dates
      y += 30;
      doc.setFont("helvetica", "bold");
      doc.text("Issue date:", 15, y);
      doc.setFont("helvetica", "normal");
      doc.text(formatDate(inv.issue_date), 50, y);
      if (inv.due_date) {
        doc.setFont("helvetica", "bold");
        doc.text("Due date:", 15, y + 6);
        doc.setFont("helvetica", "normal");
        doc.text(formatDate(inv.due_date), 50, y + 6);
      }

      // ── LINE ITEMS TABLE ───────────────────────────────────────
      y = 105;
      doc.setFillColor(...cream);
      doc.rect(10, y, 190, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Description", 15, y + 5.5);
      doc.text("Qty", 130, y + 5.5);
      doc.text("Unit price", 150, y + 5.5);
      doc.text("Total", 195, y + 5.5, { align: "right" });
      y += 12;

      doc.setFont("helvetica", "normal");
      for (const item of inv.items) {
        const descLines = doc.splitTextToSize(item.description, 110);
        doc.text(descLines, 15, y);
        doc.text(String(item.quantity), 130, y);
        doc.text(formatGBP(item.unit_price), 150, y);
        doc.text(formatGBP(item.total), 195, y, { align: "right" });
        y += Math.max(descLines.length * 6, 8);
        if (y > 250) { doc.addPage(); y = 20; }
      }

      // ── TOTALS ─────────────────────────────────────────────────
      y += 5;
      doc.setDrawColor(...lightGrey);
      doc.line(110, y, 200, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Subtotal", 130, y);
      doc.text(formatGBP(inv.subtotal), 195, y, { align: "right" });
      if (inv.tax_rate > 0) {
        y += 7;
        doc.text(`VAT (${inv.tax_rate}%)`, 130, y);
        doc.text(formatGBP(inv.tax_amount), 195, y, { align: "right" });
      }
      y += 7;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Total", 130, y);
      doc.text(formatGBP(inv.total), 195, y, { align: "right" });

      // ── PAYMENT / BANK DETAILS ─────────────────────────────────
      y += 18;
      if (paymentTerms) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Payment terms:", 15, y);
        doc.setFont("helvetica", "normal");
        const ptLines = doc.splitTextToSize(paymentTerms, 180);
        doc.text(ptLines, 15, y + 5);
        y += 5 + ptLines.length * 5;
      }

      if (bankDetails) {
        if (y > 260) { doc.addPage(); y = 20; }
        y += 4;
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Bank details:", 15, y);
        doc.setFont("helvetica", "normal");
        const bdLines = doc.splitTextToSize(bankDetails, 180);
        doc.text(bdLines, 15, y + 5);
        y += 5 + bdLines.length * 5;
      }

      if (inv.notes) {
        if (y > 260) { doc.addPage(); y = 20; }
        y += 4;
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Notes:", 15, y);
        doc.setFont("helvetica", "normal");
        const noteLines = doc.splitTextToSize(inv.notes, 180);
        doc.text(noteLines, 15, y + 5);
      }

      // ── FOOTER ─────────────────────────────────────────────────
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(160, 150, 140);
        const footerParts: string[] = [];
        if (vatNumber) footerParts.push(`VAT Reg: ${vatNumber}`);
        if (companyNumber) footerParts.push(`Co. No: ${companyNumber}`);
        if (bizWebsite) footerParts.push(bizWebsite);
        if (footerParts.length > 0) {
          doc.text(footerParts.join("  ·  "), 105, 290, { align: "center" });
        }
      }

      doc.save(`Invoice-${inv.invoice_number}.pdf`);
    } catch (e: any) {
      console.error(e);
      toast({ title: "PDF generation failed", description: e?.message || "", variant: "destructive" });
    }
  }

  const filtered = invoices.filter((inv) => {
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchSearch = !search ||
      (inv.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Summary stats
  const totalOutstanding = invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Create, send and track invoices for your clients"
        action={
          <Button onClick={() => setModalOpen(true)} data-testid="button-new-invoice">
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-lg font-bold" data-testid="text-outstanding">{formatGBP(totalOutstanding)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid (all time)</p>
              <p className="text-lg font-bold" data-testid="text-paid">{formatGBP(totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-lg font-bold text-red-600" data-testid="text-overdue-count">{overdueCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* HMRC export bar */}
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
        <Building2 className="h-4 w-4 text-green-700 shrink-0" />
        <span className="text-sm text-green-800 font-medium">HMRC Self Assessment Export</span>
        <Select value={taxYear} onValueChange={setTaxYear}>
          <SelectTrigger className="w-44 h-8 text-xs bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {TAX_YEARS.map((y) => <SelectItem key={y} value={y}>Tax year {y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 text-xs bg-white" onClick={exportHmrcCsv}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV for HMRC
        </Button>
        <span className="text-xs text-green-700 ml-auto">UK tax year: 6 Apr – 5 Apr</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-invoices" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <PoundSterling className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">{invoices.length === 0 ? "No invoices yet" : "No invoices match your search"}</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issue date</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => {
                const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                return (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" data-testid={`row-invoice-${inv.id}`}>
                    <TableCell className="font-medium" onClick={() => setViewInvoice(inv)}>#{inv.invoice_number}</TableCell>
                    <TableCell onClick={() => setViewInvoice(inv)}>{inv.client_name || "—"}</TableCell>
                    <TableCell onClick={() => setViewInvoice(inv)}>{formatDate(inv.issue_date)}</TableCell>
                    <TableCell onClick={() => setViewInvoice(inv)}>{formatDate(inv.due_date)}</TableCell>
                    <TableCell onClick={() => setViewInvoice(inv)} className="font-semibold">{formatGBP(inv.total)}</TableCell>
                    <TableCell onClick={() => setViewInvoice(inv)}>
                      <Badge className={`text-[11px] border-0 ${cfg.colour}`}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {inv.status === "draft" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatusMutation.mutate({ id: inv.id, status: "sent" })} data-testid={`button-send-${inv.id}`}>
                            <Send className="h-3 w-3 mr-1" /> Send
                          </Button>
                        )}
                        {(inv.status === "sent" || inv.status === "overdue") && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50" onClick={() => updateStatusMutation.mutate({ id: inv.id, status: "paid" })} data-testid={`button-markpaid-${inv.id}`}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark paid
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => downloadPDF(inv)} data-testid={`button-download-${inv.id}`}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(inv.id)} data-testid={`button-delete-${inv.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create invoice dialog */}
      <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="text-sm font-medium mb-1.5 block">Client *</label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger data-testid="select-invoice-client">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Issue date</label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} data-testid="input-issue-date" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Due date</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="input-due-date" />
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Line items</label>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setItems((p) => [...p, { ...EMPTY_ITEM }])} data-testid="button-add-line-item">
                  <Plus className="h-3 w-3 mr-1" /> Add item
                </Button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                  <span className="col-span-5">Description</span>
                  <span className="col-span-2">Qty</span>
                  <span className="col-span-3">Unit price (£)</span>
                  <span className="col-span-1 text-right">Total</span>
                  <span className="col-span-1" />
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center" data-testid={`line-item-${idx}`}>
                    <Input className="col-span-5 h-8 text-sm" placeholder="Description..." value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} />
                    <Input className="col-span-2 h-8 text-sm" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} />
                    <Input className="col-span-3 h-8 text-sm" type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", Number(e.target.value))} />
                    <span className="col-span-1 text-right text-sm font-medium">{formatGBP(item.total)}</span>
                    <Button size="sm" variant="ghost" className="col-span-1 h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeItem(idx)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatGBP(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">VAT rate (%)</span>
                  <Input type="number" min="0" max="100" className="h-7 w-20 text-sm" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} data-testid="input-tax-rate" />
                </div>
                <span className="font-medium">{formatGBP(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Total</span>
                <span>{formatGBP(total)}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea placeholder="Payment terms, bank details, etc." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} data-testid="textarea-invoice-notes" />
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-create-invoice">
                {createMutation.isPending ? "Creating..." : "Create Invoice"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View invoice dialog */}
      {viewInvoice && (
        <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Invoice #{viewInvoice.invoice_number}</DialogTitle>
                <Badge className={`text-[11px] border-0 ${STATUS_CONFIG[viewInvoice.status]?.colour}`}>
                  {STATUS_CONFIG[viewInvoice.status]?.label}
                </Badge>
              </div>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Client</span><p className="font-medium mt-0.5">{viewInvoice.client_name || "—"}</p></div>
                <div><span className="text-muted-foreground">Issue date</span><p className="font-medium mt-0.5">{formatDate(viewInvoice.issue_date)}</p></div>
                <div><span className="text-muted-foreground">Due date</span><p className="font-medium mt-0.5">{formatDate(viewInvoice.due_date)}</p></div>
                {viewInvoice.paid_at && <div><span className="text-muted-foreground">Paid on</span><p className="font-medium mt-0.5 text-green-700">{formatDate(viewInvoice.paid_at)}</p></div>}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Description</th>
                      <th className="text-center p-2 font-medium">Qty</th>
                      <th className="text-right p-2 font-medium">Price</th>
                      <th className="text-right p-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewInvoice.items.map((item, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{item.description}</td>
                        <td className="p-2 text-center">{item.quantity}</td>
                        <td className="p-2 text-right">{formatGBP(item.unit_price)}</td>
                        <td className="p-2 text-right font-medium">{formatGBP(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t">
                    <tr><td colSpan={3} className="p-2 text-right text-muted-foreground">Subtotal</td><td className="p-2 text-right font-medium">{formatGBP(viewInvoice.subtotal)}</td></tr>
                    {viewInvoice.tax_rate > 0 && <tr><td colSpan={3} className="p-2 text-right text-muted-foreground">VAT ({viewInvoice.tax_rate}%)</td><td className="p-2 text-right font-medium">{formatGBP(viewInvoice.tax_amount)}</td></tr>}
                    <tr><td colSpan={3} className="p-2 text-right font-bold">Total</td><td className="p-2 text-right font-bold text-base">{formatGBP(viewInvoice.total)}</td></tr>
                  </tfoot>
                </table>
              </div>

              {viewInvoice.notes && (
                <div className="text-sm"><p className="text-muted-foreground mb-1">Notes</p><p>{viewInvoice.notes}</p></div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => downloadPDF(viewInvoice)} data-testid="button-view-download">
                  <Download className="h-4 w-4 mr-1.5" /> Download PDF
                </Button>
                {viewInvoice.status === "draft" && (
                  <Button className="flex-1" onClick={() => { updateStatusMutation.mutate({ id: viewInvoice.id, status: "sent" }); setViewInvoice({ ...viewInvoice, status: "sent" }); }} data-testid="button-view-send">
                    <Send className="h-4 w-4 mr-1.5" /> Mark as Sent
                  </Button>
                )}
                {(viewInvoice.status === "sent" || viewInvoice.status === "overdue") && (
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => { updateStatusMutation.mutate({ id: viewInvoice.id, status: "paid" }); setViewInvoice({ ...viewInvoice, status: "paid" }); }} data-testid="button-view-markpaid">
                    <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark Paid
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(viewInvoice.id)} data-testid="button-view-delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
