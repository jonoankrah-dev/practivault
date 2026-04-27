import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, GraduationCap, Clock, Award, Download, Trash2, FileUp,
} from "lucide-react";

type CpdLog = {
  id: string;
  course_name: string;
  provider: string | null;
  date: string;
  hours: number;
  category: string | null;
  certificate_url: string | null;
  notes: string | null;
  created_at: string;
};

const CATEGORIES = [
  "Aesthetics & Beauty",
  "Health & Wellness",
  "Business & Management",
  "Legal & Compliance",
  "Technical Skills",
  "Safeguarding",
  "First Aid",
  "Other",
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const TAX_YEARS = (() => {
  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(`${y - 1}/${y}`);
  }
  return years;
})();

export default function CpdLog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState("all");

  // Form state
  const [courseName, setCourseName] = useState("");
  const [provider, setProvider] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [hours, setHours] = useState<number>(1);
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);

  const { data: logs = [], isLoading } = useQuery<CpdLog[]>({ queryKey: ["/api/cpd"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      let certUrl = null;
      if (certFile) {
        const fd = new FormData();
        fd.append("file", certFile);
        const res = await fetch("/api/cpd/upload-cert", {
          method: "POST",
          headers: { Authorization: `Bearer ${(await import("@/contexts/AuthContext")).getToken?.() || ""}` },
          body: fd,
        });
        const json = await res.json();
        certUrl = json.url || null;
      }
      return apiRequest("POST", "/api/cpd", { ...data, certificate_url: certUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cpd"] });
      toast({ title: "CPD entry added" });
      setModalOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: e.message || "Failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/cpd/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cpd"] });
      toast({ title: "Entry removed" });
    },
  });

  function resetForm() {
    setCourseName(""); setProvider(""); setDate(new Date().toISOString().split("T")[0]);
    setHours(1); setCategory(""); setNotes(""); setCertFile(null);
  }

  function handleCreate() {
    if (!courseName) return toast({ title: "Course name required", variant: "destructive" });
    createMutation.mutate({ course_name: courseName, provider: provider || null, date, hours, category: category || null, notes: notes || null });
  }

  // Filter by year
  const filtered = logs.filter((l) => {
    if (yearFilter === "all") return true;
    const [startYr, endYr] = yearFilter.split("/").map(Number);
    const d = new Date(l.date);
    const taxStart = new Date(`${startYr}-04-06`);
    const taxEnd = new Date(`${endYr}-04-05`);
    return d >= taxStart && d <= taxEnd;
  });

  const totalHours = filtered.reduce((s, l) => s + Number(l.hours), 0);
  const byCategory = filtered.reduce((acc: Record<string, number>, l) => {
    const cat = l.category || "Other";
    acc[cat] = (acc[cat] || 0) + Number(l.hours);
    return acc;
  }, {});

  async function exportPDF() {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const berry = [177, 48, 111] as [number, number, number];
      const dark = [36, 31, 25] as [number, number, number];

      doc.setFillColor(...berry);
      doc.rect(0, 0, 210, 35, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("CPD RECORD", 15, 18);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const yearLabel = yearFilter === "all" ? "All years" : `Tax Year ${yearFilter}`;
      doc.text(yearLabel, 15, 28);
      doc.text(`Total hours: ${totalHours.toFixed(1)}`, 130, 28);

      doc.setTextColor(...dark);
      let y = 50;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(245, 243, 239);
      doc.rect(10, y, 190, 8, "F");
      doc.text("Date", 15, y + 5.5);
      doc.text("Course", 40, y + 5.5);
      doc.text("Provider", 100, y + 5.5);
      doc.text("Category", 145, y + 5.5);
      doc.text("Hours", 188, y + 5.5, { align: "right" });
      y += 12;

      doc.setFont("helvetica", "normal");
      for (const log of filtered) {
        doc.text(formatDate(log.date), 15, y);
        doc.text(doc.splitTextToSize(log.course_name, 55)[0], 40, y);
        doc.text(doc.splitTextToSize(log.provider || "—", 40)[0], 100, y);
        doc.text(doc.splitTextToSize(log.category || "—", 40)[0], 145, y);
        doc.text(String(log.hours), 188, y, { align: "right" });
        y += 8;
        if (y > 270) { doc.addPage(); y = 20; }
      }

      y += 6;
      doc.setDrawColor(230, 220, 215);
      doc.line(10, y, 200, y);
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.text(`Total CPD Hours: ${totalHours.toFixed(1)}`, 15, y);

      doc.save(`CPD-Record-${yearFilter.replace("/", "-")}.pdf`);
    } catch {
      toast({ title: "PDF export failed", variant: "destructive" });
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="CPD Log"
        subtitle="Track your continuing professional development hours and certificates"
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log CPD
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#b1306f]/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-[#b1306f]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
              <p className="text-lg font-bold">{totalHours.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Courses</p>
              <p className="text-lg font-bold">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Award className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">With Certificate</p>
              <p className="text-lg font-bold">{filtered.filter((l) => l.certificate_url).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + export */}
      <div className="flex gap-3 items-center">
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {TAX_YEARS.map((y) => (
              <SelectItem key={y} value={y}>Tax year {y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportPDF} className="ml-auto">
          <Download className="h-4 w-4 mr-2" />
          Export CPD Record PDF
        </Button>
      </div>

      {/* HMRC compliance callout */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
        <Award className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Compliance tip:</strong> Regulated practitioners (aesthetics, health, beauty) must evidence ongoing CPD. Export your record at any time to share with your insurance provider or regulatory body.
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No CPD entries yet</p>
          <p className="text-sm mt-1">Log your first course to get started</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Certificate</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">{formatDate(log.date)}</TableCell>
                  <TableCell className="font-medium">{log.course_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.provider || "—"}</TableCell>
                  <TableCell>
                    {log.category && (
                      <Badge variant="outline" className="text-[11px]">{log.category}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">{log.hours}h</TableCell>
                  <TableCell>
                    {log.certificate_url ? (
                      <a href={log.certificate_url} target="_blank" rel="noreferrer" className="text-[#b1306f] text-sm underline">View</a>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(log.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add CPD dialog */}
      <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log CPD Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Course / Training Name *</label>
              <Input placeholder="e.g. Level 7 Botulinum Toxin Masterclass" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Provider</label>
                <Input placeholder="e.g. JCCP, Harley Academy" value={provider} onChange={(e) => setProvider(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">CPD Hours</label>
                <Input type="number" min="0.5" step="0.5" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Certificate (optional)</label>
              <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-md p-3 hover:bg-muted/30 transition-colors">
                <FileUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{certFile ? certFile.name : "Upload PDF or image"}</span>
                <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => setCertFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea placeholder="What did you learn? Any follow-up actions?" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
