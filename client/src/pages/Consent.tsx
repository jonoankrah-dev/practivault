import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Copy as CopyIcon, Eye, Trash2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils-app";
import { useToast } from "@/hooks/use-toast";

const FORM_TYPES = [
  { value: "general_consent", label: "General Consent" },
  { value: "laser_treatment", label: "Laser Treatment" },
  { value: "fat_melting", label: "Fat Melting" },
  { value: "skin_tightening", label: "Skin Tightening" },
  { value: "medical_history", label: "Medical History" },
  { value: "patch_test", label: "Patch Test" },
];

export default function ConsentPage() {
  const { toast } = useToast();
  const { data: forms, isLoading } = useQuery<any[]>({ queryKey: ["/api/consent"] });
  const [addOpen, setAddOpen] = useState(false);

  const stats = useMemo(() => {
    const list = forms || [];
    const sent = list.length;
    const signed = list.filter((f) => f.status === "signed").length;
    const pending = list.filter((f) => f.status === "sent" || f.status === "pending" || f.status === "viewed").length;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const overdue = list.filter((f) => {
      return f.status !== "signed" && new Date(f.created_at).getTime() < sevenDaysAgo;
    }).length;
    return { sent, signed, pending, overdue };
  }, [forms]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/consent/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consent"] });
      toast({ title: "Deleted" });
    },
  });

  function copyLink(token: string) {
    const link = `${window.location.origin}/#/consent/public/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied" });
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Consent Forms"
        subtitle="Compliance tracking for every treatment"
        actions={
          <Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-send-form">
            <Plus className="h-4 w-4 mr-1.5" /> Send Form
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Sent" value={stats.sent} tone="zinc" />
        <StatCard label="Signed" value={stats.signed} tone="green" />
        <StatCard label="Pending" value={stats.pending} tone="amber" />
        <StatCard label="Overdue >7d" value={stats.overdue} tone="red" />
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-5 py-3 font-medium">Client</th>
              <th className="text-left px-4 py-3 font-medium">Form</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Sent</th>
              <th className="text-left px-4 py-3 font-medium">Signed</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-10" /></td></tr>
              ))
            ) : !forms?.length ? (
              <tr><td colSpan={6} className="text-center text-sm text-muted-foreground py-12">No consent forms yet.</td></tr>
            ) : (
              forms.map((f) => (
                <tr key={f.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-consent-${f.id}`}>
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium">{f.clients?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{f.clients?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize text-muted-foreground">{f.form_type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(f.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{f.signed_at ? formatDate(f.signed_at) : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => copyLink(f.token)}
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-primary"
                        title="Copy link"
                        data-testid={`button-copy-${f.id}`}
                      >
                        <CopyIcon className="h-4 w-4" />
                      </button>
                      {f.signed_at && (
                        <button
                          onClick={() => window.open(`/#/consent/public/${f.token}`, "_blank")}
                          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-primary"
                          title="View signed data"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm("Delete this consent form?")) del.mutate(f.id); }}
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SendFormModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "zinc" | "green" | "amber" | "red" }) {
  const toneCls = { zinc: "text-zinc-700", green: "text-green-700", amber: "text-amber-700", red: "text-red-700" }[tone];
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
      <div className="text-xs text-muted-foreground font-medium uppercase">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}

function SendFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: clients } = useQuery<any[]>({ queryKey: ["/api/clients"], enabled: open });
  const [clientId, setClientId] = useState("");
  const [formType, setFormType] = useState("general_consent");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/consent", {
        client_id: clientId,
        form_type: formType,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/consent"] });
      const link = `${window.location.origin}/#/consent/public/${data.token}`;
      navigator.clipboard.writeText(link);
      toast({ title: "Form created", description: "Link copied to clipboard" });
      onClose();
      setClientId("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader><DialogTitle>Send Consent Form</DialogTitle></DialogHeader>
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
            <Label>Form type</Label>
            <Select value={formType} onValueChange={setFormType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            On creation, a unique signing link will be copied to your clipboard — you can text or email it to the client.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!clientId || create.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {create.isPending ? "Creating…" : "Create & copy link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
