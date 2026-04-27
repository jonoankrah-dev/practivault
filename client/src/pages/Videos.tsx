import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Video, Link2, Upload, Play, Trash2, Tag, Clock, Lock, Globe, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/PageHeader";
import { apiRequest, queryClient, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CATEGORIES = ["aesthetics", "trades", "cpd", "beauty", "hair", "health", "general"] as const;
const VIDEO_TYPES = [
  { value: "youtube", label: "YouTube link" },
  { value: "vimeo", label: "Vimeo link" },
  { value: "link", label: "Other URL" },
  { value: "upload", label: "Upload video file" },
] as const;

function getEmbedUrl(url: string, type: string): string | null {
  if (type === "youtube") {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  }
  if (type === "vimeo") {
    const m = url.match(/vimeo\.com\/(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  }
  return url; // direct link or uploaded file
}

function VideoPlayer({ video }: { video: any }) {
  const [open, setOpen] = useState(false);
  const url = video.video_url || video.file_url;
  const embedUrl = url ? getEmbedUrl(url, video.video_type) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-xl"
        data-testid={`button-play-${video.id}`}
      >
        <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          <Play className="h-5 w-5 text-gray-900 ml-0.5" />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden">
          <div className="aspect-video bg-black">
            {embedUrl && (video.video_type === "youtube" || video.video_type === "vimeo") ? (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; encrypted-media"
              />
            ) : embedUrl ? (
              <video src={embedUrl} controls className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">No video URL</div>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold">{video.title}</h3>
            {video.description && <p className="text-sm text-muted-foreground mt-1">{video.description}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VideoCard({ video, onDelete }: { video: any; onDelete: () => void }) {
  const hasThumbnail = !!video.thumbnail_url;
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm group" data-testid={`card-video-${video.id}`}>
      {/* Thumbnail / placeholder */}
      <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-t-xl overflow-hidden">
        {hasThumbnail ? (
          <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="h-10 w-10 text-white/20" />
          </div>
        )}
        <VideoPlayer video={video} />
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge variant="secondary" className="text-[10px] capitalize bg-black/50 text-white border-0">
            {video.video_type}
          </Badge>
        </div>
        <div className="absolute top-2 right-2">
          {video.is_free ? (
            <Badge className="text-[10px] bg-emerald-500/90 text-white border-0">Free</Badge>
          ) : (
            <Badge className="text-[10px] bg-[#b1306f]/90 text-white border-0">£{Number(video.price).toFixed(2)}</Badge>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-semibold leading-tight line-clamp-2">{video.title}</h3>
        {video.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{video.description}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 capitalize">
              <Tag className="h-3 w-3" /> {video.category}
            </span>
            {video.duration_mins && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {video.duration_mins}m
              </span>
            )}
          </div>
          <button
            onClick={onDelete}
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            data-testid={`button-delete-video-${video.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddVideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [videoType, setVideoType] = useState("youtube");
  const [videoUrl, setVideoUrl] = useState("");
  const [durationMins, setDurationMins] = useState("");
  const [price, setPrice] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setTitle(""); setDescription(""); setCategory("general");
    setVideoType("youtube"); setVideoUrl(""); setDurationMins("");
    setPrice(""); setIsFree(true); setFile(null);
  };

  const handleSave = async () => {
    if (!title) return toast({ title: "Title required", variant: "destructive" });
    setUploading(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let body: FormData | string;
      let contentType: string | undefined;

      if (videoType === "upload" && file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("title", title);
        fd.append("description", description);
        fd.append("category", category);
        fd.append("duration_mins", durationMins);
        fd.append("price", isFree ? "0" : price);
        fd.append("is_free", String(isFree));
        fd.append("video_type", "upload");
        body = fd;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({ title, description, category, video_type: videoType, video_url: videoUrl, duration_mins: durationMins ? Number(durationMins) : null, price: isFree ? 0 : Number(price), is_free: isFree });
        contentType = "application/json";
      }

      const res = await fetch("/api/videos", { method: "POST", headers, body });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({ title: "Video added" });
      reset();
      onClose();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Training Video</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. endoPulse Full Treatment Masterclass" data-testid="input-video-title" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What will they learn?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Video type</Label>
              <Select value={videoType} onValueChange={setVideoType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VIDEO_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {videoType !== "upload" ? (
            <div className="space-y-1.5">
              <Label>Video URL</Label>
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder={videoType === "youtube" ? "https://youtube.com/watch?v=..." : videoType === "vimeo" ? "https://vimeo.com/..." : "https://..."} data-testid="input-video-url" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Video file</Label>
              <div className={cn("border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors", file ? "border-primary/30 bg-primary/5" : "border-border")}>
                <input type="file" accept="video/*" className="hidden" id="video-file-input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <label htmlFor="video-file-input" className="cursor-pointer">
                  {file ? (
                    <p className="text-sm font-medium text-primary">{file.name}</p>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload video</p>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Duration (mins)</Label>
              <Input type="number" value={durationMins} onChange={(e) => setDurationMins(e.target.value)} placeholder="e.g. 45" />
            </div>
            <div className="space-y-1.5">
              <Label>Pricing</Label>
              <div className="flex gap-2">
                <button onClick={() => setIsFree(true)} className={cn("flex-1 text-xs py-2 rounded-lg border font-medium transition-colors", isFree ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50")}>Free</button>
                <button onClick={() => setIsFree(false)} className={cn("flex-1 text-xs py-2 rounded-lg border font-medium transition-colors", !isFree ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50")}>Paid</button>
              </div>
            </div>
          </div>

          {!isFree && (
            <div className="space-y-1.5">
              <Label>Price (£)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 49.99" data-testid="input-video-price" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={uploading || !title} className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-save-video">
            {uploading ? "Saving…" : "Save video"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VideosPage() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const { data: videos, isLoading } = useQuery<any[]>({ queryKey: ["/api/videos"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/videos/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/videos"] }); toast({ title: "Video deleted" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const filtered = (videos || []).filter((v) => {
    if (catFilter !== "all" && v.category !== catFilter) return false;
    if (!search) return true;
    return v.title?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Training Videos"
        subtitle={`${videos?.length ?? 0} videos`}
        actions={
          <Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-add-video">
            <Plus className="h-4 w-4 mr-1.5" /> Add Video
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search videos…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCatFilter("all")} className={cn("text-xs px-3 py-1.5 rounded-full border font-medium transition-colors", catFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50")}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCatFilter(c)} className={cn("text-xs px-3 py-1.5 rounded-full border font-medium capitalize transition-colors", catFilter === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50")}>{c}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Video className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{videos?.length === 0 ? "No videos yet — add your first one." : "No matches."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((v) => (
            <VideoCard key={v.id} video={v} onDelete={() => { if (confirm("Delete this video?")) deleteMutation.mutate(v.id); }} />
          ))}
        </div>
      )}

      <AddVideoModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
