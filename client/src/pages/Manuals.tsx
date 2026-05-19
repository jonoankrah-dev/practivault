/**
 * Manuals — PDF upload panel + Saffi AI chat
 */
import { useState, useRef } from "react";
import {
  BookOpen, Upload, X, FileText, Loader2, Trash2,
  ExternalLink, ChevronDown, ChevronUp, AlertTriangle, RefreshCw,
} from "lucide-react";
import SaffiSectionChat from "@/components/SaffiSectionChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { apiRequest, getAuthToken } from "@/lib/queryClient";

const CATEGORIES = [
  "aesthetics", "cpd", "endopulse", "health",
  "compliance", "technical", "business", "other",
];

const SUGGESTIONS = [
  "Show all my manuals",
  "What manuals do I have about aesthetics?",
  "Find the manual about the 980nm machine",
  "Summarise my compliance documents",
  "Which manuals were uploaded this month?",
  "Answer a client question from my manuals",
];

const SECTION_CONTEXT = `You are Saffi, the practice manager for this business. You are in the Manuals section.

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
  extraction_status?: "pending" | "processing" | "completed" | "failed";
  extraction_error?: string | null;
}

export default function Manuals() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ name: string; error: string; id: string } | null>(null);

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: manuals = [], isLoading } = useQuery<Manual[]>({
    queryKey: ["/api/manuals"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/manuals");
      if (!res.ok) throw new Error("Failed to load manuals");
      return res.json();
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !name) {
      setName(f.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "));
    }
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) {
      toast({
        title: "Missing details",
        description: "Please choose a file and give it a name.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      fd.append("description", description.trim());
      fd.append("category", category);

      const token = getAuthToken();
      const res = await fetch("/api/manuals/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      if (!res.ok) {
        let msg = "Upload failed";
        try { const e = await res.json(); msg = e.message || msg; } catch {}
        throw new Error(msg);
      }

      toast({
        title: "Manual uploaded",
        description: `"${name}" is now in your library and Saffi can read it.`,
      });
      setName(""); setDescription(""); setCategory("other"); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["/api/manuals"] });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteId) return;
    const manual = manuals.find(m => m.id === confirmDeleteId);
    setDeleting(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/manuals/${confirmDeleteId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let msg = "Delete failed";
        try { const e = await res.json(); msg = e.message || msg; } catch {}
        throw new Error(msg);
      }

      toast({ title: "Deleted", description: `"${manual?.name}" removed.` });
      qc.invalidateQueries({ queryKey: ["/api/manuals"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/manuals/${id}/extract`, { method: "POST" });
      if (!res.ok) throw new Error("Retry failed");

      const data = await res.json();
      if (data.ok === false) {
        toast({ title: "Retry failed", description: data.message || "Could not re-process the manual", variant: "destructive" });
      } else {
        toast({ title: "Re-extraction started", description: "We'll process this manual in the background." });
      }

      qc.invalidateQueries({ queryKey: ["/api/manuals"] });
    } catch (e: any) {
      toast({ title: "Retry failed", description: e.message, variant: "destructive" });
    } finally {
      setRetryingId(null);
    }
  };

  const manualToDelete = manuals.find(m => m.id === confirmDeleteId);

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
              <Upload className="h-4 w-4 text-[#E83A8E]" />
              Upload Manual / PDF
            </span>
            {showUpload
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showUpload && (
            <div className="px-4 pb-4 space-y-3">
              {/* File drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-[#E83A8E]/30 rounded-xl p-4 text-center cursor-pointer hover:border-[#E83A8E]/60 hover:bg-[#E83A8E]/5 transition-colors"
              >
                {file ? (
                  <div className="flex items-center gap-2 justify-center text-sm">
                    <FileText className="h-4 w-4 text-[#E83A8E]" />
                    <span className="font-medium truncate max-w-[180px]">{file.name}</span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setFile(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs space-y-1">
                    <Upload className="h-6 w-6 mx-auto text-[#E83A8E]/50" />
                    <p className="font-medium text-foreground">Click to choose file</p>
                    <p>PDF, DOCX, or TXT · up to 50MB</p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. endoPulse Protocol Guide"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description"
                  className="h-8 text-sm"
                />
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
                className="w-full h-8 text-sm bg-[#E83A8E] hover:bg-[#c42d77] text-white"
              >
                {uploading
                  ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Uploading…</>
                  : <><Upload className="h-3.5 w-3.5 mr-2" />Upload Manual</>}
              </Button>

              {uploading && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Uploading and extracting text — this may take a few seconds…
                </p>
              )}
            </div>
          )}
        </div>

        {/* Library list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Library ({manuals.length})
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : manuals.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No manuals yet. Upload your first PDF above.
            </p>
          ) : (
            <div className="space-y-2">
              {manuals.map(m => (
                <div
                  key={m.id}
                  className="flex flex-col gap-1.5 p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  {/* Normal view */}
                  {confirmDeleteId !== m.id ? (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-[#E83A8E] shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{m.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 capitalize border-[#E83A8E]/20 text-[#E83A8E]"
                          >
                            {m.category}
                          </Badge>

                          {/* Extraction status */}
                          {m.extraction_status === "processing" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                              Processing…
                            </span>
                          )}
                          {m.extraction_status === "failed" && (
                            <button
                              onClick={() => setErrorDialog({
                                name: m.name,
                                error: m.extraction_error || "Unknown error",
                                id: m.id
                              })}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                            >
                              Failed
                            </button>
                          )}
                          {m.extraction_status === "pending" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              Queued
                            </span>
                          )}

                          <span className="text-[10px] text-muted-foreground">
                            {new Date(m.created_at).toLocaleDateString("en-GB")}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <a
                          href={m.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Open file"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>

                        {/* Retry extraction if failed */}
                        {m.extraction_status === "failed" && (
                          <button
                            onClick={() => handleRetry(m.id)}
                            disabled={retryingId === m.id}
                            className="h-6 w-6 flex items-center justify-center rounded hover:bg-amber-100 text-amber-600 disabled:opacity-50"
                            title="Retry extraction"
                          >
                            {retryingId === m.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => setConfirmDeleteId(m.id)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Inline delete confirmation */
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <p className="text-xs font-medium">Delete "{m.name}"?</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        This will permanently remove the file and all extracted text.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs flex-1"
                          onClick={handleDeleteConfirmed}
                          disabled={deleting}
                        >
                          {deleting
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : "Yes, delete"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs flex-1"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deleting}
                        >
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

      {/* RIGHT — Saffi chat */}
      <div className="flex-1 min-w-0">
        <SaffiSectionChat
          section="Manuals"
          description="Saffi reads and answers questions from your documents"
          icon={<BookOpen className="h-4 w-4 text-[#E83A8E]" />}
          suggestions={SUGGESTIONS}
          sectionContext={SECTION_CONTEXT}
        />
      </div>
    </div>

  );
}
