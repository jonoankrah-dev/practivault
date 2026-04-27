import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Sparkles, Upload, Building2, CreditCard, FileText as FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/PageHeader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: me } = useQuery<any>({ queryKey: ["/api/me"] });
  const { data: treatments, isLoading } = useQuery<any[]>({ queryKey: ["/api/treatments"] });
  const [editing, setEditing] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Personal profile
  const [name, setName] = useState("");

  // Business profile
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!me) return;
    if (me.name) setName(me.name);
    setBusinessName(me.business_name || "");
    setBusinessPhone(me.business_phone || "");
    setBusinessAddress(me.business_address || "");
    setBusinessWebsite(me.business_website || "");
    setVatNumber(me.vat_number || "");
    setCompanyNumber(me.company_number || "");
    setPaymentTerms(me.payment_terms || "Payment due within 30 days of invoice date.");
    setBankDetails(me.bank_details || "");
    setLogoUrl(me.logo_url || "");
  }, [me]);

  const seed = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/treatments/seed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments"] });
      toast({ title: "Treatments seeded" });
    },
  });

  // Auto-seed first time if empty
  useEffect(() => {
    if (treatments && treatments.length === 0) {
      seed.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treatments]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PATCH", "/api/me", { name });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "Profile saved" });
    },
  });

  const updateBusiness = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PATCH", "/api/me", {
        business_name: businessName || null,
        business_phone: businessPhone || null,
        business_address: businessAddress || null,
        business_website: businessWebsite || null,
        vat_number: vatNumber || null,
        company_number: companyNumber || null,
        payment_terms: paymentTerms || null,
        bank_details: bankDetails || null,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "Business profile saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const res = await fetch(`/api/me/logo`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: (data) => {
      setLogoUrl(data.logo_url);
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "Logo uploaded" });
    },
    onError: () => toast({ title: "Logo upload failed", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/treatments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments"] });
      toast({ title: "Deleted" });
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await apiRequest("PATCH", `/api/treatments/${id}`, { is_active: active });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/treatments"] }),
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader title="Settings" subtitle="Manage your profile, business details and treatment menu" />

      {/* Personal Profile */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-sm font-semibold mb-4">Personal Profile</h2>
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-semibold">
            {(name?.[0] || user?.email?.[0] || "J").toUpperCase()}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {updateProfile.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>

      {/* Business Profile */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Business Profile</h2>
          <span className="ml-auto text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Used on invoices & PDFs</span>
        </div>

        {/* Logo upload */}
        <div className="flex items-start gap-4 mb-5 pb-5 border-b border-border">
          <div
            className="h-20 w-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all overflow-hidden bg-muted/20 shrink-0"
            onClick={() => logoInputRef.current?.click()}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <div className="text-center">
                <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                <span className="text-[10px] text-muted-foreground">Upload logo</span>
              </div>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadLogo.mutate(file);
            }}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">Company Logo</p>
            <p className="text-xs text-muted-foreground">PNG, JPG or WebP. Shown in the header of every invoice PDF. Recommended: 400×200px or wider.</p>
            {logoUrl && (
              <button
                className="text-xs text-destructive hover:underline mt-1"
                onClick={() => {
                  setLogoUrl("");
                  apiRequest("PATCH", "/api/me", { logo_url: null });
                  queryClient.invalidateQueries({ queryKey: ["/api/me"] });
                }}
              >
                Remove logo
              </button>
            )}
            {uploadLogo.isPending && <p className="text-xs text-primary">Uploading…</p>}
          </div>
        </div>

        {/* Business details grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label>Business / Company name</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Premier Plumbing Ltd" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder="07xxx xxxxxx" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Business address</Label>
            <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="123 High Street, Birmingham, B1 1AA" />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={businessWebsite} onChange={(e) => setBusinessWebsite(e.target.value)} placeholder="https://yoursite.co.uk" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>VAT number</Label>
              <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="GB123456789" />
            </div>
            <div className="space-y-1.5">
              <Label>Co. number</Label>
              <Input value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} placeholder="12345678" />
            </div>
          </div>
        </div>

        {/* Payment & banking */}
        <div className="border-t border-border pt-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment details — printed on every invoice</span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Bank details</Label>
              <Textarea
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                rows={3}
                placeholder={"Bank: Barclays\nSort code: 20-00-00\nAccount: 12345678\nRef: Your invoice number"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment terms</Label>
              <Textarea
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                rows={2}
                placeholder="Payment due within 30 days of invoice date. Late payments may incur a 5% fee."
              />
            </div>
          </div>
        </div>

        <Button onClick={() => updateBusiness.mutate()} disabled={updateBusiness.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {updateBusiness.isPending ? "Saving…" : "Save business profile"}
        </Button>
      </div>

      {/* Treatments */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Treatments</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your service menu</p>
          </div>
          <div className="flex items-center gap-2">
            {treatments && treatments.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>
                <Sparkles className="h-4 w-4 mr-1.5" /> Seed endoPulse™ menu
              </Button>
            )}
            <Button
              onClick={() => setAddOpen(true)}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-add-treatment"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : !treatments?.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No treatments yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {treatments.map((t) => (
              <div key={t.id} className="px-6 py-3 flex items-center gap-4 hover:bg-muted/20">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{t.name}</div>
                  {t.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</div>}
                </div>
                <div className="text-sm text-muted-foreground tabular-nums w-16">{t.duration_mins}min</div>
                <div className="text-sm font-medium tabular-nums w-16 text-right">£{Number(t.price).toLocaleString()}</div>
                <Switch
                  checked={t.is_active}
                  onCheckedChange={(v) => toggle.mutate({ id: t.id, active: v })}
                />
                <button
                  onClick={() => setEditing(t)}
                  className="h-8 px-2 text-xs rounded-md hover:bg-muted text-muted-foreground"
                >
                  Edit
                </button>
                <button
                  onClick={() => { if (confirm("Delete this treatment?")) del.mutate(t.id); }}
                  className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <TreatmentModal
        open={addOpen || !!editing}
        initial={editing}
        onClose={() => { setAddOpen(false); setEditing(null); }}
      />
    </div>
  );
}

function TreatmentModal({ open, initial, onClose }: { open: boolean; initial?: any | null; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [duration, setDuration] = useState(60);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (initial) {
      setName(initial.name || "");
      setPrice(Number(initial.price) || 0);
      setDuration(Number(initial.duration_mins) || 60);
      setDescription(initial.description || "");
    } else {
      setName(""); setPrice(0); setDuration(60); setDescription("");
    }
  }, [initial, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (initial) {
        const r = await apiRequest("PATCH", `/api/treatments/${initial.id}`, {
          name, price: Number(price), duration_mins: Number(duration), description: description || null,
        });
        return r.json();
      }
      const r = await apiRequest("POST", "/api/treatments", {
        name, price: Number(price), duration_mins: Number(duration), description: description || null,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments"] });
      toast({ title: initial ? "Updated" : "Added" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Treatment" : "Add Treatment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price (£)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!name || save.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
