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
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Upload,
  Download,
  Eye,
  Trash2,
  Search,
  FileText,
  Plus,
} from "lucide-react";

type Manual = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
};

const CATEGORIES = [
  { value: "endopulse", label: "endoPulse Training" },
  { value: "cpd", label: "CPD Courses" },
  { value: "aesthetics", label: "Aesthetics Manuals" },
  { value: "other", label: "Other" },
];

const CATEGORY_COLOURS: Record<string, string> = {
  endopulse: "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]",
  cpd: "bg-teal-100 text-teal-700",
  aesthetics: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-600",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Manuals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Upload form state
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadCategory, setUploadCategory] = useState("endopulse");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: manuals = [], isLoading } = useQuery<Manual[]>({
    queryKey: ["/api/manuals"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/manuals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manuals"] });
      toast({ title: "Manual deleted" });
      setDeleteId(null);
    },
  });

  const filtered = manuals.filter((m) => {
    const matchSearch =
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || m.category === categoryFilter;
    return matchSearch && matchCat;
  });

  async function handleUpload() {
    if (!uploadFile || !uploadName.trim()) {
      toast({ title: "Please add a name and select a file", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("name", uploadName.trim());
      formData.append("description", uploadDesc.trim());
      formData.append("category", uploadCategory);

      const token = getAuthToken();
      const API_BASE = (window as any).__PORT_5000__
        ? (window as any).__PORT_5000__
        : "";

      // Use fetch directly for multipart (can't use apiRequest for FormData)
      const res = await fetch(`${API_BASE}/api/manuals/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");

      queryClient.invalidateQueries({ queryKey: ["/api/manuals"] });
      toast({ title: "Manual uploaded successfully" });
      setUploadOpen(false);
      setUploadName("");
      setUploadDesc("");
      setUploadCategory("endopulse");
      setUploadFile(null);
    } catch (e: any) {
      toast({ title: e.message || "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const byCategory: Record<string, Manual[]> = {};
  for (const m of filtered) {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Manuals Library"
        subtitle="Store and manage your training manuals and CPD course materials"
        action={
          <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-manual">
            <Plus className="h-4 w-4 mr-2" />
            Upload Manual
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search manuals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-manuals"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44" data-testid="select-category-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">
            {manuals.length === 0 ? "No manuals uploaded yet" : "No manuals match your search"}
          </p>
          {manuals.length === 0 && (
            <p className="text-sm mt-1">
              Upload your endoPulse training manual and CPD course PDFs to get started
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.filter(
            (c) => categoryFilter === "all" || c.value === categoryFilter
          ).map((cat) => {
            const items = byCategory[cat.value];
            if (!items?.length) return null;
            return (
              <div key={cat.value}>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                  {cat.label}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((m) => (
                    <Card
                      key={m.id}
                      className="group hover:shadow-md transition-shadow"
                      data-testid={`card-manual-${m.id}`}
                    >
                      <CardContent className="p-4 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-[hsl(var(--primary)/0.08)] flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-[hsl(var(--primary))]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-snug line-clamp-2" data-testid={`text-manual-name-${m.id}`}>
                              {m.name}
                            </p>
                            {m.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {m.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            className={`text-[10px] px-2 py-0.5 font-medium border-0 ${CATEGORY_COLOURS[m.category] || CATEGORY_COLOURS.other}`}
                          >
                            {CATEGORIES.find((c) => c.value === m.category)?.label || m.category}
                          </Badge>
                          {m.file_size && (
                            <span className="text-[11px] text-muted-foreground">
                              {formatBytes(m.file_size)}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 text-xs"
                            onClick={() => setPreviewUrl(m.file_url)}
                            data-testid={`button-preview-${m.id}`}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 text-xs"
                            asChild
                          >
                            <a href={m.file_url} download={m.file_name} target="_blank" rel="noreferrer" data-testid={`button-download-${m.id}`}>
                              <Download className="h-3.5 w-3.5 mr-1" />
                              Download
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteId(m.id)}
                            data-testid={`button-delete-${m.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Manual name *</label>
              <Input
                placeholder="e.g. endoPulse Training Manual v3"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                data-testid="input-manual-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Input
                placeholder="Brief description (optional)"
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                data-testid="input-manual-desc"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Category</label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger data-testid="select-upload-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">PDF file *</label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-[hsl(var(--primary))] transition-colors"
                onClick={() => fileRef.current?.click()}
                data-testid="dropzone-manual"
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="h-5 w-5 text-[hsl(var(--primary))]" />
                    <span className="font-medium">{uploadFile.name}</span>
                    <span className="text-muted-foreground">({formatBytes(uploadFile.size)})</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Click to select a PDF file</p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadName.trim()}
                data-testid="button-confirm-upload"
              >
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manual Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe
              src={previewUrl}
              className="flex-1 rounded-lg border"
              title="Manual preview"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete manual?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the manual and its file. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
