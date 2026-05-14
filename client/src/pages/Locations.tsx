import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Phone, Mail, Star, Trash2, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Location = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_default: boolean;
  created_at: string;
};

export default function Locations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const { data: locations = [], isLoading } = useQuery<Location[]>({ queryKey: ["/api/locations"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/locations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Location added" });
      setModalOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: e.message || "Failed", variant: "destructive" }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/locations/${id}`, { is_default: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/locations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/locations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Location removed" });
    },
  });

  function resetForm() {
    setName(""); setAddress(""); setPhone(""); setEmail("");
  }

  function handleCreate() {
    if (!name) return toast({ title: "Location name required", variant: "destructive" });
    createMutation.mutate({
      name,
      address: address || null,
      phone: phone || null,
      email: email || null,
      is_default: locations.length === 0,
    });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Locations"
        subtitle="Manage multiple sites, vans, or chairs — all under one account"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        }
      />

      {/* Info banner */}
      <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800 flex items-start gap-2">
        <Building2 className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Multi-location management:</strong> Add each of your sites, vans, or rented chairs. Tag clients and bookings to a location so you can filter your dashboard by site.
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No locations yet</p>
          <p className="text-sm mt-1">Add your first site, salon chair, or van</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {locations.map((loc) => (
            <Card key={loc.id} className={loc.is_default ? "border-[#E83A8E]/40 shadow-sm" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-[#E83A8E]/10 flex items-center justify-center">
                      <MapPin className="h-4.5 w-4.5 text-[#E83A8E]" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{loc.name}</CardTitle>
                      {loc.is_default && <Badge className="text-[10px] bg-[#E83A8E]/10 text-[#E83A8E] border-0 mt-0.5">Default</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!loc.is_default && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" title="Set as default" onClick={() => setDefaultMutation.mutate(loc.id)}>
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(loc.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                {loc.address && (
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{loc.address}</span>
                  </div>
                )}
                {loc.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{loc.phone}</span>
                  </div>
                )}
                {loc.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>{loc.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add location dialog */}
      <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Location Name *</label>
              <Input placeholder="e.g. Main Salon, Van 1, Chair at Luxe" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Address</label>
              <Input placeholder="Full address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Phone</label>
                <Input placeholder="01234 567890" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <Input type="email" placeholder="site@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Add Location"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
