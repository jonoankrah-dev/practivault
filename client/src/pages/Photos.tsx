/**
 * Before & After — photo upload form + Safi AI chat
 */
import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2, Trash2, ChevronDown, ChevronUp, ImageIcon, AlertTriangle } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

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

const SUGGESTIONS = [
  "Show all before & after records",
  "Find photos for a specific client",
  "Which clients have before & after photos?",
  "Show recent photo records from this month",
  "How many photo records do I have?",
  "Show all endoPulse treatment photos",
];

const SECTION_CONTEXT = `You are Safi, the practice manager for this business. You are in the Before & After section.

When this section opens, immediately call get_before_after_photos and show a summary — how many records, which clients, recent activity. Don't wait to be asked.

Your job:
- Show photo records grouped by client or treatment type
- Help find specific client photo sets quickly
- Flag clients who have had treatments but no photo record yet (data gap)
- Summarise treatment results across all records

Tools available:
- get_before_after_photos — list all photo records, filter by client or treatment (use immediately, no approval needed)

For uploading new photos: the owner uses the upload form on the left — they select a client, treatment, date, then upload before and/or after images.

Be proactive and helpful — surface insights from the photo library, not just a list.`;

interface Client { id: string; name: string; }
interface PhotoRecord {
  id: string;
  client_id: string;
  client_name?: string;
  treatment_type?: string;
  taken_at: string;
  notes?: string;
  before_url?: string;
  after_url?: string;
}

export default function Photos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const [clientId, setClientId] = useState("");
  const [treatment, setTreatment] = useState("");
  const [takenAt, setTakenAt] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showUpload, setShowUpload] = useState(true);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/clients");
      const d = await r.json();
      return (d || []).map((c: any) => ({ id: c.id, name: c.name }));
    },
  });

  const { data: photos = [], isLoading } = useQuery<PhotoRecord[]>({
    queryKey: ["/api/photos"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/photos");
      return r.json();
    },
  });

  const handleUpload = async () => {
    if (!clientId) {
      toast({ title: "Client required", description: "Please select a client.", variant: "destructive" });
      return;
    }
    if (!beforeFile && !afterFile) {
      toast({ title: "No images", description: "Please upload at least one image (before or after).", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("client_id", clientId);
      if (treatment) fd.append("treatment_type", treatment);
      fd.append("taken_at", takenAt);
      if (notes) fd.append("notes", notes);
      if (beforeFile) fd.append("before", beforeFile);
      if (afterFile) fd.append("after", afterFile);

      const token = getAuthToken();
      const res = await fetch("/api/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Upload failed"); }

      const clientName = clients.find(c => c.id === clientId)?.name ?? "Client";
      toast({ title: "Photos uploaded", description: `Before & after added for ${clientName}.` });
      setClientId(""); setTreatment(""); setNotes(""); setBeforeFile(null); setAfterFile(null);
      if (beforeRef.current) beforeRef.current.value = "";
      if (afterRef.current) afterRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["/api/photos"] });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await apiRequest("DELETE", `/api/photos/${confirmDeleteId}`);
      toast({ title: "Deleted", description: "Photo record removed." });
      qc.invalidateQueries({ queryKey: ["/api/photos"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const ImageThumb = ({ url, label }: { url?: string; label: string }) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="group relative block">
        <img src={url} alt={label} className="w-10 h-10 object-cover rounded border group-hover:opacity-80 transition-opacity" />
        <span className="absolute bottom-0 left-0 right-0 text-[7px] text-center bg-black/50 text-white rounded-b">{label}</span>
      </a>
    ) : (
      <div className="w-10 h-10 rounded border bg-muted flex flex-col items-center justify-center gap-0.5">
        <ImageIcon className="h-3 w-3 text-muted-foreground/40" />
        <span className="text-[7px] text-muted-foreground/60">{label}</span>
      </div>
    );

  const FilePickerZone = ({
    file, inputRef, label, onChange,
  }: { file: File | null; inputRef: React.RefObject<HTMLInputElement | null>; label: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <div className="flex-1 space-y-1">
      <Label className="text-xs">{label}</Label>
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-[#b1306f]/25 rounded-lg p-2 text-center cursor-pointer hover:border-[#b1306f]/50 hover:bg-[#b1306f]/5 transition-colors min-h-[56px] flex flex-col items-center justify-center"
      >
        {file ? (
          <div className="text-xs space-y-0.5">
            <p className="font-medium truncate max-w-[100px]">{file.name}</p>
            <button
              onClick={e => { e.stopPropagation(); if (inputRef.current) inputRef.current.value = ""; onChange({ target: { files: null } } as any); }}
              className="text-muted-foreground hover:text-destructive text-[10px] flex items-center gap-0.5 mx-auto"
            ><X className="h-2.5 w-2.5" /> Remove</button>
          </div>
        ) : (
          <div className="text-muted-foreground text-[10px] space-y-0.5">
            <Upload className="h-4 w-4 mx-auto text-[#b1306f]/40" />
            <p>Click to upload</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
      </div>
    </div>
  );

  return (
    <div className="flex h-full max-h-screen overflow-hidden">
      {/* LEFT — Upload panel */}
      <div className="w-[340px] shrink-0 border-r bg-background flex flex-col overflow-hidden">
        {/* Upload form */}
        <div className="border-b">
          <button
            onClick={() => setShowUpload(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-[#b1306f]" />
              Add Before & After
            </span>
            {showUpload ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showUpload && (
            <div className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Client *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 ? (
                      <SelectItem value="_none" disabled>No clients yet</SelectItem>
                    ) : clients.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Treatment</Label>
                <Select value={treatment} onValueChange={setTreatment}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select treatment…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TREATMENTS.map(t => <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={takenAt} onChange={e => setTakenAt(e.target.value)} className="h-8 text-sm" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Session 1, 2 weeks post" className="h-8 text-sm" />
              </div>

              {/* Before/After image pickers */}
              <div className="flex gap-2">
                <FilePickerZone
                  file={beforeFile}
                  inputRef={beforeRef}
                  label="Before photo"
                  onChange={e => setBeforeFile(e.target.files?.[0] ?? null)}
                />
                <FilePickerZone
                  file={afterFile}
                  inputRef={afterRef}
                  label="After photo"
                  onChange={e => setAfterFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <Button
                onClick={handleUpload}
                disabled={!clientId || (!beforeFile && !afterFile) || uploading}
                className="w-full h-8 text-sm bg-[#b1306f] hover:bg-[#9a2860] text-white"
              >
                {uploading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Uploading…</> : <><Upload className="h-3.5 w-3.5 mr-2" />Save Photos</>}
              </Button>
            </div>
          )}
        </div>

        {/* Records list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Records ({photos.length})</p>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
          ) : photos.length === 0 ? (
            <p className="text-xs text-muted-foreground">No photo records yet. Add your first one above.</p>
          ) : (
            <div className="space-y-2">
              {photos.map(p => (
                <div key={p.id} className="flex flex-col gap-1.5 p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  {confirmDeleteId !== p.id ? (
                    <div className="flex items-start gap-2">
                      <div className="flex gap-1 shrink-0">
                        <ImageThumb url={p.before_url} label="Before" />
                        <ImageThumb url={p.after_url} label="After" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.client_name ?? "Unknown"}</p>
                        {p.treatment_type && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-[#b1306f]/20 text-[#b1306f] mt-0.5 inline-block">{p.treatment_type}</Badge>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(p.taken_at).toLocaleDateString("en-GB")}</p>
                        {p.notes && <p className="text-[10px] text-muted-foreground truncate">{p.notes}</p>}
                      </div>
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <p className="text-xs font-medium">Delete this photo record?</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">This permanently removes the images from storage.</p>
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
          section="Before & After"
          description="Safi manages and analyses your treatment photo records"
          icon={<Camera className="h-4 w-4 text-[#b1306f]" />}
          suggestions={SUGGESTIONS}
          sectionContext={SECTION_CONTEXT}
        />
      </div>
    </div>
  );
}
