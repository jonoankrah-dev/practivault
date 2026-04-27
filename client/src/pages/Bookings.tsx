import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Check, X, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatMoney, relativeDateLabel, groupBookingsByDate } from "@/lib/utils-app";
import { useToast } from "@/hooks/use-toast";

export default function BookingsPage() {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: bookings, isLoading } = useQuery<any[]>({
    queryKey: ["/api/bookings", { from: today, to }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/bookings?from=${today}&to=${to}`);
      return res.json();
    },
  });

  const [modalOpen, setModalOpen] = useState(false);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Booking updated" });
    },
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/bookings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: "Booking deleted" });
    },
  });

  const grouped = bookings ? groupBookingsByDate(bookings) : [];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Bookings"
        subtitle="Upcoming appointments — next 14 days"
        actions={
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-new-booking"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Booking
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center shadow-sm">
          <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-sm font-semibold">No upcoming bookings</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create a booking to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, items }) => (
            <div key={date}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
                {relativeDateLabel(date)} · {new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
              </h3>
              <div className="bg-card border border-card-border rounded-xl divide-y divide-border shadow-sm overflow-hidden">
                {items.map((b: any) => (
                  <div key={b.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className="min-w-[60px]">
                      <div className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs font-semibold tabular-nums">
                        {b.time?.slice(0, 5)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{b.clients?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {b.treatments?.name} · {b.treatments?.duration_mins}min
                      </div>
                    </div>
                    <div className="text-sm font-medium tabular-nums">
                      {formatMoney(Number(b.treatments?.price || 0))}
                    </div>
                    <StatusBadge status={b.status} />
                    <div className="flex items-center gap-1">
                      {b.status !== "completed" && (
                        <button
                          onClick={() => updateStatus.mutate({ id: b.id, status: "completed" })}
                          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-green-700"
                          title="Mark complete"
                          data-testid={`button-complete-${b.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      {b.status !== "cancelled" && (
                        <button
                          onClick={() => updateStatus.mutate({ id: b.id, status: "cancelled" })}
                          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                          title="Cancel"
                          data-testid={`button-cancel-${b.id}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm("Delete this booking?")) deleteBooking.mutate(b.id);
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function NewBookingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: clients } = useQuery<any[]>({ queryKey: ["/api/clients"], enabled: open });
  const { data: treatments } = useQuery<any[]>({ queryKey: ["/api/treatments"], enabled: open });

  const [clientId, setClientId] = useState("");
  const [treatmentId, setTreatmentId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [status, setStatus] = useState("confirmed");
  const [depositPaid, setDepositPaid] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bookings", {
        client_id: clientId,
        treatment_id: treatmentId,
        date,
        time,
        status,
        deposit_paid: depositPaid,
        deposit_amount: depositPaid ? Number(depositAmount) : 0,
        notes: notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Booking created" });
      onClose();
      setClientId("");
      setTreatmentId("");
      setNotes("");
    },
    onError: (e: any) => toast({ title: "Failed to create", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Booking</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger data-testid="select-client">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
                {!clients?.length && <div className="p-3 text-sm text-muted-foreground">No clients yet. Add one first.</div>}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Treatment</Label>
            <Select value={treatmentId} onValueChange={setTreatmentId}>
              <SelectTrigger data-testid="select-treatment">
                <SelectValue placeholder="Select treatment" />
              </SelectTrigger>
              <SelectContent>
                {treatments?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} — £{t.price}</SelectItem>
                ))}
                {!treatments?.length && <div className="p-3 text-sm text-muted-foreground">No treatments yet. Add some in Settings.</div>}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2.5">
            <Label className="cursor-pointer">Deposit paid</Label>
            <Switch checked={depositPaid} onCheckedChange={setDepositPaid} />
          </div>

          {depositPaid && (
            <div className="space-y-1.5">
              <Label>Deposit amount (£)</Label>
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!clientId || !treatmentId || create.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-create-booking"
          >
            {create.isPending ? "Creating…" : "Create booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
