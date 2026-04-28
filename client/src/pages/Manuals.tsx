/**
 * Manuals — PDF upload panel + Safi AI chat
 */
import { useState, useRef } from "react";
import { BookOpen, Upload, X, FileText, Loader2, Trash2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import SafiSectionChat from "@/components/SafiSectionChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = ["aesthetics", "cpd", "endopulse", "health", "compliance", "technical", "business", "other"];

const SUGGESTIONS = [
  "Show all my manuals",
  "What manuals do I have about aesthetics?",
  "Find the manual about the 980nm machine",
  "Summarise my compliance documents",
  "Which manuals were uploaded this month?",
  "Answer a client question from my manuals",
];

const SECTION_CONTEXT = `You are Safi, the practice manager for this business. You are in the Manuals section.

When this section opens, immediately call get_manuals and show a clear summary grouped by category. Don't wait to be asked.

You have full access to the extracted text of all uploaded manuals. Use this to:
- Answer client or practitioner questions about procedures, protocols, or products
- Summarise specific documents
- Find relevant information across all manuals at once
- Flag if important categories are missing (e.g. no compliance manual)

Tools available:
- get_manuals — list all uploaded manuals, filter by category or search by name (use immediately, no approval needed)

For uploads: the owner uses the upload panel on the left — once uploaded, the text is automatically extracted so you can read and answer questions from it.

Be proactive: if the library is empty, say so and encourage uploading. If there are many manuals, group them neatly by category. Always offer to answer questions from the content.`;

interface Manual {
  id: string;
  name: string;
  description?: string;
  category: string;
  file_url: string;
  file_name: string;
  created_at: string;
}

export default function Manuals() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(true);

  const { data: manuals = [], isLoading } = useQuery<Manual[]>({
    queryKey: ["/api/manuals"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/manuals");
      return r.json();
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "));
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) {
      toast({ title: "Missing details", description: "Please choose a file and give it a name.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      fd.append("description", description.trim());
      fd.append("category", category);

      const res = await fetch("/api/manuals/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      toast({ title: "Manual uploaded", description: `${name} is now in your library and Safi can read it.` });
      setName(""); setDescription(""); setCategory("other"); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["/api/manuals"] });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, manualName: string) => {
    if (!confirm(`Delete "${manualName}"? This cannot be undone.`)) return;
    try {
      const res = await apiRequest("DELETE", `/api/manuals/${id}`);
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Deleted", description: `${manualName} removed.` });
      qc.invalidateQueries({ queryKey: ["/api/manuals"] });
    } catch {
      toast({ title: "Error", description: "Could not delete this manual.", variant: "destructive" });
    }
  };

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
              <Upload className="h-4 w-4 text-[#b1306f]" />
              Upload Manual / PDF
            </span>
            {showUpload ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showUpload && (
            <div className="px-4 pb-4 space-y-3">
              {/* File drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-[#b1306f]/30 rounded-xl p-4 text-center cursor-pointer hover:border-[#b1306f]/60 hover:bg-[#b1306f]/5 transition-colors"
              >
                {file ? (
                  <div className="flex items-center gap-2 justify-center text-sm">
                    <FileText className="h-4 w-4 text-[#b1306f]" />
                    <span className="font-medium truncate max-w-[180px]">{file.name}</span>
                    <button onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                      className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs space-y-1">
                    <Upload className="h-6 w-6 mx-auto text-[#b1306f]/50" />
                    <p className="font-medium text-foreground">Click to choose file</p>
                    <p>PDF, DOCX, or TXT · up to 50MB</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. EndoPulse Protocol Guide" className="h-8 text-sm" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Description (optional)</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" className="h-8 text-sm" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c} className="text-sm capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!file || !name.trim() || uploading}
                className="w-full h-8 text-sm bg-[#b1306f] hover:bg-[#9a2860] text-white"
              >
                {uploading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Uploading…</> : <><Upload className="h-3.5 w-3.5 mr-2" />Upload Manual</>}
              </Button>
            </div>
          )}
        </div>

        {/* Library list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Library ({manuals.length})</p>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : manuals.length === 0 ? (
            <p className="text-xs text-muted-foreground">No manuals yet. Upload your first PDF above.</p>
          ) : (
            <div className="space-y-2">
              {manuals.map(m => (
                <div key={m.id} className="group flex items-start gap-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors">
                  <FileText className="h-4 w-4 text-[#b1306f] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{m.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize border-[#b1306f]/20 text-[#b1306f]">{m.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleDateString("en-GB")}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <a href={m.file_url} target="_blank" rel="noopener noreferrer"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button onClick={() => handleDelete(m.id, m.name)}
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Safi chat */}
      <div className="flex-1 min-w-0">
        <SafiSectionChat
          section="Manuals"
          description="Safi reads and answers questions from your documents"
          icon={<BookOpen className="h-4 w-4 text-[#b1306f]" />}
          suggestions={SUGGESTIONS}
          sectionContext={SECTION_CONTEXT}
        />
      </div>
    </div>
  );
}
