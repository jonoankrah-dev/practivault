import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Camera, Plus, Trash2, Search, ChevronLeft, ChevronRight, X, Upload } from "lucide-react";

type Client = { id: string; name: string };

type Photo = {
  id: string;
  client_id: string;
  treatment_type: string | null;
  notes: string | null;
  before_url: string | null;
  after_url: string | null;
  taken_at: string;
  created_at: string;
  client_name?: string;
};

const TREATMENTS = [
  "endoPulse Body Contouring",
  "Lip Filler",
  "Anti-Wrinkle Injections",
  "Dermal Filler",
  "Skin Booster",
  "Chemical Peel",
  "Microneedling",
  "PRP",
  "Fat Dissolving",
  "Thread Lift",
  "Other",
];

export default function Photos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Upload form
  const [clientId, setClientId] = useState("");
  const [treatment, setTreatment] = useState("");
  const [notes, setNotes] = useState("");
  const [takenAt, setTakenAt] = useState(new Date().toISOString().split("T")[0]);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: photos = [], isLoading } = useQuery<Photo[]>({ queryKey: ["/api/photos"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/photos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      toast({ title: "Photo set deleted" });
      setDeleteId(null);
    },
  });

  const filtered = photos.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (p.client_name || "").toLowerCase().includes(s) ||
      (p.treatment_type || "").toLowerCase().includes(s) ||
      (p.notes || "").toLowerCase().includes(s)
    );
  });

  // Group by client
  const byClient: Record<string, { client: string; items: Photo[] }> = {};
  for (const p of filtered) {
    const key = p.client_id;
    if (!byClient[key]) byClient[key] = { client: p.client_name || "Unknown", items: [] };
    byClient[key].items.push(p);
  }

  async function handleUpload() {
    if (!clientId || (!beforeFile && !afterFile)) {
      toast({ title: "Select a client and at least one photo", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("client_id", clientId);
      if (treatment) formData.append("treatment_type", treatment);
      if (notes) formData.append("notes", notes);
      formData.append("taken_at", takenAt);
      if (beforeFile) formData.append("before", beforeFile);
      if (afterFile) formData.append("after", afterFile);

      const token = getAuthToken();
      const API_BASE = (window as any).__PORT_5000__ || "";
      const res = await fetch(`${API_BASE}/api/photos/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");

      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      toast({ title: "Photos uploaded" });
      setUploadOpen(false);
      resetForm();
    } catch (e: any) {
      toast({ title: e.message || "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setClientId("");
    setTreatment("");
    setNotes("");
    setTakenAt(new Date().toISOString().split("T")[0]);
    setBeforeFile(null);
    setAfterFile(null);
  }

  const allPhotos = filtered;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Before & After"
        subtitle="Document client treatment results with before and after photo pairs"
        action={
          <Button onClick={() => setUploadOpen(true)} data-testid="button-add-photos">
            <Plus className="h-4 w-4 mr-2" />
            Add Photos
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by client or treatment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-photos"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Camera className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">{photos.length === 0 ? "No photos yet" : "No results"}</p>
          {photos.length === 0 && (
            <p className="text-sm mt-1">Upload before & after photos to document client results</p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.values(byClient).map(({ client, items }) => (
            <div key={client}>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                {client}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((photo, idx) => (
                  <Card key={photo.id} className="overflow-hidden group hover:shadow-md transition-shadow" data-testid={`card-photo-${photo.id}`}>
                    {/* Photo pair */}
                    <div className="grid grid-cols-2 gap-0.5 bg-border">
                      {/* Before */}
                      <div
                        className="relative aspect-square bg-muted cursor-pointer overflow-hidden"
                        onClick={() => setLightbox({ photos: allPhotos, index: allPhotos.indexOf(photo) })}
                      >
                        {photo.before_url ? (
                          <img src={photo.before_url} alt="Before" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No before</div>
                        )}
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">BEFORE</span>
                      </div>
                      {/* After */}
                      <div
                        className="relative aspect-square bg-muted cursor-pointer overflow-hidden"
                        onClick={() => setLightbox({ photos: allPhotos, index: allPhotos.indexOf(photo) })}
                      >
                        {photo.after_url ? (
                          <img src={photo.after_url} alt="After" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No after</div>
                        )}
                        <span className="absolute bottom-1 left-1 bg-[hsl(var(--primary)/0.8)] text-white text-[10px] px-1.5 py-0.5 rounded font-medium">AFTER</span>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {photo.treatment_type && (
                            <Badge className="text-[10px] px-2 py-0 border-0 bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] mb-1">
                              {photo.treatment_type}
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground">{new Date(photo.taken_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                          {photo.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{photo.notes}</p>}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setDeleteId(photo.id)}
                          data-testid={`button-delete-photo-${photo.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Before & After Photos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Client *</label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger data-testid="select-photo-client">
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Treatment</label>
                <Select value={treatment} onValueChange={setTreatment}>
                  <SelectTrigger data-testid="select-photo-treatment">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TREATMENTS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date</label>
                <Input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} data-testid="input-photo-date" />
              </div>
            </div>

            {/* Photo uploads */}
            <div className="grid grid-cols-2 gap-3">
              {/* Before */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Before photo</label>
                <div
                  className="border-2 border-dashed border-border rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-[hsl(var(--primary))] transition-colors overflow-hidden"
                  onClick={() => beforeRef.current?.click()}
                  data-testid="dropzone-before"
                >
                  {beforeFile ? (
                    <img src={URL.createObjectURL(beforeFile)} alt="Before preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-muted-foreground text-xs p-3">
                      <Upload className="h-6 w-6 mx-auto mb-1 opacity-40" />
                      <p>Before</p>
                    </div>
                  )}
                  <input ref={beforeRef} type="file" accept="image/*" className="hidden" onChange={(e) => setBeforeFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              {/* After */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">After photo</label>
                <div
                  className="border-2 border-dashed border-border rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-[hsl(var(--primary))] transition-colors overflow-hidden"
                  onClick={() => afterRef.current?.click()}
                  data-testid="dropzone-after"
                >
                  {afterFile ? (
                    <img src={URL.createObjectURL(afterFile)} alt="After preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-muted-foreground text-xs p-3">
                      <Upload className="h-6 w-6 mx-auto mb-1 opacity-40" />
                      <p>After</p>
                    </div>
                  )}
                  <input ref={afterRef} type="file" accept="image/*" className="hidden" onChange={(e) => setAfterFile(e.target.files?.[0] || null)} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea placeholder="e.g. 3 sessions, client very happy with results..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} data-testid="textarea-photo-notes" />
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleUpload} disabled={uploading || !clientId || (!beforeFile && !afterFile)} data-testid="button-confirm-photo-upload">
                {uploading ? "Uploading..." : "Upload Photos"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="h-6 w-6" />
          </button>
          {lightbox.index > 0 && (
            <button className="absolute left-4 text-white/70 hover:text-white" onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, index: lightbox.index - 1 }); }}>
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          {lightbox.index < lightbox.photos.length - 1 && (
            <button className="absolute right-4 text-white/70 hover:text-white" onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, index: lightbox.index + 1 }); }}>
              <ChevronRight className="h-8 w-8" />
            </button>
          )}
          <div className="flex gap-2 max-w-5xl w-full px-16" onClick={(e) => e.stopPropagation()}>
            {lightbox.photos[lightbox.index]?.before_url && (
              <div className="flex-1 relative">
                <img src={lightbox.photos[lightbox.index].before_url!} alt="Before" className="w-full max-h-[80vh] object-contain rounded-lg" />
                <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-medium">BEFORE</span>
              </div>
            )}
            {lightbox.photos[lightbox.index]?.after_url && (
              <div className="flex-1 relative">
                <img src={lightbox.photos[lightbox.index].after_url!} alt="After" className="w-full max-h-[80vh] object-contain rounded-lg" />
                <span className="absolute bottom-2 left-2 bg-[hsl(var(--primary)/0.8)] text-white text-xs px-2 py-1 rounded font-medium">AFTER</span>
              </div>
            )}
          </div>
          <div className="absolute bottom-6 text-white/60 text-sm">
            {lightbox.photos[lightbox.index]?.treatment_type} • {lightbox.photos[lightbox.index]?.client_name}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete photo set?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the before & after photos. Cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
