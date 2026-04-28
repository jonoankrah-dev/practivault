/**
 * Training Videos — add video form (link or upload) + Safi AI chat
 */
import { useState, useRef } from "react";
import { Video, Upload, Link2, X, Loader2, Trash2, ExternalLink, Play, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CATEGORIES = ["aesthetics", "beauty", "hair", "health", "cpd", "trades", "general"];
const VIDEO_LINK_TYPES = ["youtube", "vimeo", "link"];

const SUGGESTIONS = [
  "Show all training videos",
  "What free videos do I have?",
  "Show all aesthetics training videos",
  "Which videos aren't in any package?",
  "How many paid videos are in my library?",
  "Show videos by category",
];

const SECTION_CONTEXT = `You are Safi, the practice manager for this business. You are in the Training Videos section.

When this section opens, immediately call get_videos and show a summary grouped by category. Don't wait to be asked.

Your job:
- Show the full video library grouped by category
- Flag which videos are free vs paid
- Spot videos not yet included in any package (bundling opportunities)
- Suggest categories that are missing

Tools available:
- get_videos — list all videos, filter by category, free/paid (use immediately, no approval needed)

For adding videos: the owner uses the form panel on the left — they can add YouTube/Vimeo/external links or upload video files directly.

Be proactive about spotting gaps and opportunities. If the library is empty, encourage adding content.`;

interface TrainingVideo {
  id: string;
  title: string;
  description?: string;
  category: string;
  video_type: string;
  video_url?: string;
  file_url?: string;
  is_free: boolean;
  duration_mins?: number;
  created_at: string;
}

export default function Videos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [addMode, setAddMode] = useState<"link" | "upload">("link");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [videoType, setVideoType] = useState("youtube");
  const [videoUrl, setVideoUrl] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState("0");
  const [durationMins, setDurationMins] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: videos = [], isLoading } = useQuery<TrainingVideo[]>({
    queryKey: ["/api/videos"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/videos");
      return r.json();
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please give this video a title.", variant: "destructive" });
      return;
    }
    if (addMode === "link" && !videoUrl.trim()) {
      toast({ title: "URL required", description: "Please paste a video URL.", variant: "destructive" });
      return;
    }
    if (addMode === "upload" && !file) {
      toast({ title: "No file chosen", description: "Please select a video file to upload.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("category", category);
      fd.append("is_free", String(isFree));
      fd.append("price", isFree ? "0" : price);
      if (durationMins) fd.append("duration_mins", durationMins);

      if (addMode === "link") {
        fd.append("video_type", videoType);
        fd.append("video_url", videoUrl.trim());
      } else {
        fd.append("video_type", "upload");
        fd.append("file", file!);
      }

      const token = getAuthToken();
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed"); }

      toast({ title: "Video added", description: `${title} is now in your library.` });
      setTitle(""); setDescription(""); setVideoUrl(""); setFile(null); setIsFree(true); setPrice("0"); setDurationMins("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["/api/videos"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteId) return;
    const vid = videos.find(v => v.id === confirmDeleteId);
    setDeleting(true);
    try {
      await apiRequest("DELETE", `/api/videos/${confirmDeleteId}`);
      toast({ title: "Deleted", description: `"${vid?.title}" removed.` });
      qc.invalidateQueries({ queryKey: ["/api/videos"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const getVideoIcon = (type: string) => {
    if (type === "youtube") return <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1 rounded">YT</span>;
    if (type === "vimeo") return <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1 rounded">VM</span>;
    if (type === "upload") return <span className="text-[9px] font-bold text-[#E83A8E] bg-[#E83A8E]/10 px-1 rounded">UP</span>;
    return <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1 rounded">LK</span>;
  };

  return (
    <div className="flex h-full max-h-screen overflow-hidden">
      {/* LEFT — Add video panel */}
      <div className="w-[340px] shrink-0 border-r bg-background flex flex-col overflow-hidden">
        {/* Add form */}
        <div className="border-b">
          <button
            onClick={() => setShowAdd(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Play className="h-4 w-4 text-[#E83A8E]" />
              Add Training Video
            </span>
            {showAdd ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showAdd && (
            <div className="px-4 pb-4 space-y-3">
              <Tabs value={addMode} onValueChange={v => setAddMode(v as "link" | "upload")}>
                <TabsList className="w-full h-8">
                  <TabsTrigger value="link" className="flex-1 text-xs gap-1"><Link2 className="h-3 w-3" />Link / URL</TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1 text-xs gap-1"><Upload className="h-3 w-3" />Upload File</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-1">
                <Label className="text-xs">Title *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Lip Filler Technique Guide" className="h-8 text-sm" />
              </div>

              {addMode === "link" ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Platform</Label>
                    <Select value={videoType} onValueChange={setVideoType}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VIDEO_LINK_TYPES.map(t => <SelectItem key={t} value={t} className="text-sm capitalize">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Video URL *</Label>
                    <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" className="h-8 text-sm" />
                  </div>
                </>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-[#E83A8E]/30 rounded-xl p-4 text-center cursor-pointer hover:border-[#E83A8E]/60 hover:bg-[#E83A8E]/5 transition-colors"
                >
                  {file ? (
                    <div className="flex items-center gap-2 justify-center text-sm">
                      <Video className="h-4 w-4 text-[#E83A8E]" />
                      <span className="font-medium truncate max-w-[160px]">{file.name}</span>
                      <button onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                        className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-xs space-y-1">
                      <Upload className="h-6 w-6 mx-auto text-[#E83A8E]/50" />
                      <p className="font-medium text-foreground">Click to choose video</p>
                      <p>MP4, MOV, AVI · up to 500MB</p>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-sm capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Duration (mins)</Label>
                  <Input value={durationMins} onChange={e => setDurationMins(e.target.value)} type="number" min="1" placeholder="e.g. 45" className="h-8 text-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label className="text-xs cursor-pointer">Free to access</Label>
                <Switch checked={isFree} onCheckedChange={setIsFree} className="data-[state=checked]:bg-[#E83A8E]" />
              </div>

              {!isFree && (
                <div className="space-y-1">
                  <Label className="text-xs">Price (£)</Label>
                  <Input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="29.99" className="h-8 text-sm" />
                </div>
              )}

              <Button onClick={handleSave} disabled={saving} className="w-full h-8 text-sm bg-[#E83A8E] hover:bg-[#c42d77] text-white">
                {saving ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Saving…</> : <><Play className="h-3.5 w-3.5 mr-2" />Add to Library</>}
              </Button>
            </div>
          )}
        </div>

        {/* Library list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Library ({videos.length})</p>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
          ) : videos.length === 0 ? (
            <p className="text-xs text-muted-foreground">No videos yet. Add your first one above.</p>
          ) : (
            <div className="space-y-2">
              {videos.map(v => (
                <div key={v.id} className="flex flex-col gap-1.5 p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  {confirmDeleteId !== v.id ? (
                    <div className="flex items-start gap-2">
                      <Video className="h-4 w-4 text-[#E83A8E] shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{v.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {getVideoIcon(v.video_type)}
                          <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize border-[#E83A8E]/20 text-[#E83A8E]">{v.category}</Badge>
                          <span className="text-[9px] text-muted-foreground">{v.is_free ? "Free" : `£${(v as any).price ?? 0}`}</span>
                          {v.duration_mins && <span className="text-[9px] text-muted-foreground">{v.duration_mins}min</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {(v.video_url || v.file_url) && (
                          <a href={v.video_url || v.file_url} target="_blank" rel="noopener noreferrer"
                            className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <button onClick={() => setConfirmDeleteId(v.id)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <p className="text-xs font-medium truncate">Delete "{v.title}"?</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" className="h-7 text-xs flex-1"
                          onClick={handleDeleteConfirmed} disabled={deleting}>
                          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes, delete"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                          onClick={() => setConfirmDeleteId(null)} disabled={deleting}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Safi chat */}
      <div className="flex-1 min-w-0">
        <SafiSectionChat
          section="Training Videos"
          description="Safi manages your training video library"
          icon={<Video className="h-4 w-4 text-[#E83A8E]" />}
          suggestions={SUGGESTIONS}
          sectionContext={SECTION_CONTEXT}
        />
      </div>
    </div>
  );
}
