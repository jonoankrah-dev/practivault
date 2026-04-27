import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MessageSquare, ArrowRightCircle, Archive, Copy as CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { daysAgo } from "@/lib/utils-app";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SOURCE_BADGE: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-800",
  facebook: "bg-blue-100 text-blue-800",
  referral: "bg-amber-100 text-amber-800",
  website: "bg-purple-100 text-purple-800",
  walk_in: "bg-green-100 text-green-800",
  manual: "bg-zinc-200 text-zinc-700",
  other: "bg-zinc-200 text-zinc-700",
};

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize", SOURCE_BADGE[source] ?? "bg-zinc-200 text-zinc-700")}>
      {source.replace(/_/g, " ")}
    </span>
  );
}

function ScoreChip({ score }: { score: number }) {
  const cls = score >= 80 ? "bg-primary text-primary-foreground" : score >= 60 ? "bg-secondary text-secondary-foreground" : "bg-zinc-200 text-zinc-700";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums min-w-[36px] justify-center", cls)}>
      {score}
    </span>
  );
}

const STATUSES = ["all", "new", "contacted", "quoted", "booked", "lost", "converted"] as const;

export default function LeadsPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [quickReplyLead, setQuickReplyLead] = useState<any | null>(null);

  const { data: leads, isLoading } = useQuery<any[]>({ queryKey: ["/api/leads"] });

  const filtered = useMemo(() => {
    if (!leads) return [];
    if (status === "all") return leads;
    return leads.filter((l) => l.status === status);
  }, [leads, status]);

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const res = await apiRequest("PATCH", `/api/leads/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
  });

  const convert = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/leads/${id}/convert`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Lead converted to client" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Leads"
        subtitle={`${leads?.length ?? 0} total · ${leads?.filter((l) => l.status === "new").length ?? 0} new`}
        actions={
          <Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-add-lead">
            <Plus className="h-4 w-4 mr-1.5" /> Add Lead
          </Button>
        }
      />

      <Tabs value={status} onValueChange={setStatus} className="mb-4">
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">{s}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-5 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Source</th>
              <th className="text-left px-4 py-3 font-medium">Interest</th>
              <th className="text-center px-4 py-3 font-medium">Score</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Received</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="p-3"><Skeleton className="h-10" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-sm text-muted-foreground py-12">
                {leads?.length === 0 ? "No leads yet." : "No leads in this filter."}
              </td></tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-lead-${l.id}`}>
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.email || l.phone || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3"><SourceBadge source={l.source} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[200px]">
                    {l.treatment_interest || "—"}
                  </td>
                  <td className="px-4 py-3 text-center"><ScoreChip score={l.ai_score ?? 50} /></td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{daysAgo(l.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setQuickReplyLead(l)}
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-primary"
                        title="Quick reply"
                        data-testid={`button-reply-${l.id}`}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (l.status !== "converted" && confirm(`Convert ${l.name} to a client?`)) convert.mutate(l.id);
                        }}
                        disabled={l.status === "converted"}
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-green-700 disabled:opacity-30"
                        title="Convert to client"
                        data-testid={`button-convert-${l.id}`}
                      >
                        <ArrowRightCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => update.mutate({ id: l.id, patch: { status: "lost" } })}
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                        title="Archive / mark lost"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} />
      {quickReplyLead && (
        <QuickReplyModal lead={quickReplyLead} onClose={() => setQuickReplyLead(null)} onMarkContacted={() => update.mutate({ id: quickReplyLead.id, patch: { status: "contacted" } })} />
      )}
    </div>
  );
}

function AddLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("manual");
  const [treatmentInterest, setTreatmentInterest] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/leads", {
        name, email: email || null, phone: phone || null,
        source, treatment_interest: treatmentInterest || null, notes: notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead added" });
      onClose();
      setName(""); setEmail(""); setPhone(""); setSource("manual"); setTreatmentInterest(""); setNotes("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["instagram", "facebook", "referral", "website", "walk_in", "manual", "other"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Treatment interest</Label>
            <Input value={treatmentInterest} onChange={(e) => setTreatmentInterest(e.target.value)} placeholder="e.g. Abdomen fat melting" />
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
          >
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickReplyModal({ lead, onClose, onMarkContacted }: { lead: any; onClose: () => void; onMarkContacted: () => void }) {
  const { toast } = useToast();
  const isTraining =
    lead.treatment_interest?.toLowerCase().includes("training") ||
    lead.notes?.toLowerCase().includes("training");

  const templates = [
    {
      label: "Training enquiry",
      text: `Hey ${lead.name}! Thanks so much for reaching out ⭐️ We offer endoPulse™ training — online (£400), in-house Harley Street/Liverpool (£1,500), or grab the machine + free online training for £2,999 😊 Which sounds most like what you're after? xx`,
    },
    {
      label: "Treatment enquiry",
      text: `Hey ${lead.name}! Thanks for your message ⭐️ We have a high volume of interest at the moment — I'll get back to you personally asap, usually within a few hours! Check our results on Instagram 👉 @endopulse xx`,
    },
  ];
  const [selectedIdx, setSelectedIdx] = useState(isTraining ? 0 : 1);

  function copy() {
    navigator.clipboard.writeText(templates[selectedIdx].text);
    toast({ title: "Copied to clipboard" });
    onMarkContacted();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Quick Reply — {lead.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            {templates.map((t, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm border transition-colors",
                  selectedIdx === i
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Textarea
            value={templates[selectedIdx].text}
            onChange={() => {}}
            rows={6}
            className="font-[15px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={copy} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <CopyIcon className="h-4 w-4 mr-1.5" /> Copy & mark contacted
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
