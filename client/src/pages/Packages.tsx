import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Package, Video, BookOpen, Trash2, ChevronRight, Tag, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/PageHeader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function PackageCard({ pkg, videos, manuals, onDelete }: { pkg: any; videos: any[]; manuals: any[]; onDelete: () => void }) {
  const pkgVideos = (pkg.video_ids || []).map((id: string) => videos.find((v) => v.id === id)).filter(Boolean);
  const pkgManuals = (pkg.manual_ids || []).map((id: string) => manuals.find((m) => m.id === id)).filter(Boolean);

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden" data-testid={`card-package-${pkg.id}`}>
      {/* Header */}
      <div className="bg-gradient-to-br from-[#b1306f]/10 to-[#0d6b67]/10 px-5 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-snug">{pkg.title}</h3>
            {pkg.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{pkg.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pkg.is_free ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Free</Badge>
            ) : (
              <Badge className="bg-[#b1306f]/10 text-[#b1306f] border-[#b1306f]/20 text-xs">£{Number(pkg.price || 0).toFixed(2)}</Badge>
            )}
            <button onClick={onDelete} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-package-${pkg.id}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Contents */}
      <div className="p-4 space-y-3">
        {/* Videos */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Video className="h-3 w-3" /> Videos ({pkgVideos.length})
          </p>
          {pkgVideos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No videos linked</p>
          ) : (
            <ul className="space-y-1">
              {pkgVideos.map((v: any) => (
                <li key={v.id} className="flex items-center gap-2 text-xs text-foreground">
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{v.title}</span>
                  <span className="ml-auto text-muted-foreground shrink-0 capitalize">{v.video_type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Manuals */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <BookOpen className="h-3 w-3" /> Manuals ({pkgManuals.length})
          </p>
          {pkgManuals.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No manuals linked</p>
          ) : (
            <ul className="space-y-1">
              {pkgManuals.map((m: any) => (
                <li key={m.id} className="flex items-center gap-2 text-xs text-foreground">
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{m.name}</span>
                  <span className="ml-auto text-muted-foreground shrink-0 capitalize">{m.category}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Summary */}
        <div className="pt-1 border-t border-border flex items-center gap-3 text-xs text-muted-foreground">
          <span>{pkgVideos.length} video{pkgVideos.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{pkgManuals.length} manual{pkgManuals.length !== 1 ? "s" : ""}</span>
          <span className="ml-auto text-[10px]">
            {new Date(pkg.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>
    </div>
  );
}

function AddPackageModal({ open, onClose, videos, manuals }: { open: boolean; onClose: () => void; videos: any[]; manuals: any[] }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [selectedManuals, setSelectedManuals] = useState<string[]>([]);
  const [videoSearch, setVideoSearch] = useState("");
  const [manualSearch, setManualSearch] = useState("");

  const toggleVideo = (id: string) => setSelectedVideos((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleManual = (id: string) => setSelectedManuals((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/packages", {
        title, description,
        price: isFree ? 0 : Number(price),
        is_free: isFree,
        video_ids: selectedVideos,
        manual_ids: selectedManuals,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({ title: "Package created" });
      setTitle(""); setDescription(""); setPrice(""); setIsFree(false);
      setSelectedVideos([]); setSelectedManuals([]);
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const filteredVideos = videos.filter((v) => v.title?.toLowerCase().includes(videoSearch.toLowerCase()));
  const filteredManuals = manuals.filter((m) => m.name?.toLowerCase().includes(manualSearch.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Training Package</DialogTitle></DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label>Package name</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. endoPulse™ Complete Training Bundle" data-testid="input-package-title" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's included and who is it for?" />
          </div>

          {/* Pricing */}
          <div className="space-y-2">
            <Label>Pricing</Label>
            <div className="flex gap-2">
              <button onClick={() => setIsFree(false)} className={cn("flex-1 text-sm py-2 rounded-lg border font-medium transition-colors", !isFree ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40")}>Paid</button>
              <button onClick={() => setIsFree(true)} className={cn("flex-1 text-sm py-2 rounded-lg border font-medium transition-colors", isFree ? "bg-emerald-500 text-white border-emerald-500" : "border-border hover:border-emerald-400")}>Free</button>
            </div>
            {!isFree && (
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Package price (£)" data-testid="input-package-price" />
            )}
          </div>

          {/* Link Videos */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Video className="h-4 w-4" /> Link Videos</Label>
            {videos.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">No videos yet — add some in Training Videos first.</p>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-8 text-xs" placeholder="Search videos…" value={videoSearch} onChange={(e) => setVideoSearch(e.target.value)} />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                  {filteredVideos.map((v) => (
                    <label key={v.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/40 cursor-pointer" data-testid={`checkbox-video-${v.id}`}>
                      <input type="checkbox" checked={selectedVideos.includes(v.id)} onChange={() => toggleVideo(v.id)} className="accent-primary h-3.5 w-3.5" />
                      <span className="text-xs flex-1 truncate">{v.title}</span>
                      <span className="text-[10px] text-muted-foreground capitalize shrink-0">{v.video_type}</span>
                    </label>
                  ))}
                </div>
                {selectedVideos.length > 0 && (
                  <p className="text-xs text-[#b1306f] font-medium">{selectedVideos.length} video{selectedVideos.length !== 1 ? "s" : ""} selected</p>
                )}
              </>
            )}
          </div>

          {/* Link Manuals */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> Link Manuals</Label>
            {manuals.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">No manuals yet — upload some in Manuals first.</p>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-8 text-xs" placeholder="Search manuals…" value={manualSearch} onChange={(e) => setManualSearch(e.target.value)} />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                  {filteredManuals.map((m) => (
                    <label key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/40 cursor-pointer" data-testid={`checkbox-manual-${m.id}`}>
                      <input type="checkbox" checked={selectedManuals.includes(m.id)} onChange={() => toggleManual(m.id)} className="accent-primary h-3.5 w-3.5" />
                      <span className="text-xs flex-1 truncate">{m.name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize shrink-0">{m.category}</span>
                    </label>
                  ))}
                </div>
                {selectedManuals.length > 0 && (
                  <p className="text-xs text-[#b1306f] font-medium">{selectedManuals.length} manual{selectedManuals.length !== 1 ? "s" : ""} selected</p>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!title || create.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-save-package">
            {create.isPending ? "Creating…" : "Create package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PackagesPage() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);

  const { data: packages, isLoading } = useQuery<any[]>({ queryKey: ["/api/packages"] });
  const { data: videos } = useQuery<any[]>({ queryKey: ["/api/videos"] });
  const { data: manuals } = useQuery<any[]>({ queryKey: ["/api/manuals"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/packages/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/packages"] }); toast({ title: "Package deleted" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Training Packages"
        subtitle="Bundle videos + manuals into sellable courses"
        actions={
          <Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-add-package">
            <Plus className="h-4 w-4 mr-1.5" /> Create Package
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : !packages?.length ? (
        <div className="text-center py-20">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-1">No packages yet</p>
          <p className="text-xs text-muted-foreground">Create your first training bundle — combine videos and manuals into one package your clients can buy.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              videos={videos || []}
              manuals={manuals || []}
              onDelete={() => { if (confirm("Delete this package?")) deleteMutation.mutate(pkg.id); }}
            />
          ))}
        </div>
      )}

      <AddPackageModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        videos={videos || []}
        manuals={manuals || []}
      />
    </div>
  );
}
