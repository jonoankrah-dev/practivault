import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useIndustry } from "@/contexts/IndustryContext";
import StatusBadge from "@/components/StatusBadge";
import SafiSectionChat from "@/components/SafiSectionChat";
import { Link, useLocation } from "wouter";
import { Plus, Pencil, Trash2, Users, Search, Loader2, Bot } from "lucide-react";
import type { Client, ClientStage } from "@shared/schema";

const STAGES: ClientStage[] = ["lead", "prospect", "active", "vip", "lapsed", "archived"];

const SAFFI_CLIENT_SUGGESTIONS = [
  "Summarise who I should call today from this list",
  "Who are my VIPs on screen?",
  "Draft a short follow-up SMS for the top row",
  "Any duplicates or missing emails here?",
  "What stages are most common in this view?",
];

const SAFFI_CLIENT_BASE = `You are Saffi assisting inside the live Clients CRM page.

The user has a full table UI: they can search, filter by stage, add, edit, and delete clients directly. You still have your usual tools (get_clients_detail, create_client, update_client, delete_client, get_bookings).

A snapshot of the rows currently visible in their table is appended below on each message — treat it as ground truth for "who is on my screen" until they change filters.

Rules:
- Client stages: lead → prospect → active → vip → lapsed → archived
- Before create_client, update_client, or delete_client, quote what you will do and wait for explicit confirmation.
- Prefer the snapshot for quick questions about visible rows; use get_clients_detail if they need data beyond the snapshot.`;

function formatMoney(n: number) {
  return `£${Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export default function Clients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const { config } = useIndustry();
  const entityLabel = config.labels.clients;
  /** In DemoApp, routes live under `/demo/:industry/...`; keep profile links inside that tree. */
  const demoRoutePrefix = /^\/demo\/[^/]+/.exec(location)?.[0] ?? "";
  const clientProfileHref = (id: string) =>
    demoRoutePrefix ? `${demoRoutePrefix}/clients/${id}` : `/clients/${id}`;

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [stageFilter, setStageFilter] = useState<string>("");

  const listUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (stageFilter) p.set("stage", stageFilter);
    if (debouncedSearch) p.set("q", debouncedSearch);
    const qs = p.toString();
    return `/api/clients${qs ? `?${qs}` : ""}`;
  }, [stageFilter, debouncedSearch]);

  const { data: clients = [], isLoading, isError, error, refetch, isFetching } = useQuery<Client[]>({
    queryKey: [listUrl],
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState<ClientStage>("prospect");

  const resetForm = useCallback(() => {
    setEditing(null);
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setNotes("");
    setStage("prospect");
  }, []);

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setName(c.name || "");
    setEmail(c.email || "");
    setPhone(c.phone || "");
    setAddress(c.address || "");
    setNotes(c.notes || "");
    setStage(c.stage || "prospect");
    setDialogOpen(true);
  };

  const invalidateClientLists = () => {
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === "string" &&
        q.queryKey[0].startsWith("/api/clients"),
    });
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/clients", body),
    onSuccess: () => {
      invalidateClientLists();
      toast({ title: `${entityLabel.slice(0, -1) || "Client"} added` });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to create";
      toast({ title: "Could not add client", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/clients/${id}`, body),
    onSuccess: () => {
      invalidateClientLists();
      toast({ title: "Saved" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to save";
      toast({ title: "Could not save changes", description: msg, variant: "destructive" });
    },
  });

  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      invalidateClientLists();
      toast({ title: "Removed" });
      setDeleteTarget(null);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast({ title: "Could not remove client", description: msg, variant: "destructive" });
    },
  });

  function buildPayload(): Record<string, unknown> {
    const trimmedEmail = email.trim();
    return {
      name: name.trim(),
      email: trimmedEmail ? trimmedEmail : null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      stage,
    };
  }

  function handleSave() {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload = buildPayload();
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  const clientsSaffiContext = useMemo(() => {
    const filterLine = `Filters: search="${debouncedSearch || ""}" · stage="${stageFilter || "all"}".`;
    if (!clients.length) {
      return `${SAFFI_CLIENT_BASE}\n\n${filterLine}\nVisible rows: none (empty list or no matches).`;
    }
    const max = 60;
    const slice = clients.slice(0, max);
    const lines = slice.map(
      (c) =>
        `- id=${c.id} | name=${c.name} | stage=${c.stage} | email=${c.email ?? "—"} | phone=${c.phone ?? "—"} | ltv=${c.ltv}`,
    );
    const tail =
      clients.length > max
        ? `\n…plus ${clients.length - max} more row(s) not listed — use get_clients_detail if you need the full set.`
        : "";
    return `${SAFFI_CLIENT_BASE}\n\n${filterLine}\nVisible rows (${clients.length}):\n${lines.join("\n")}${tail}`;
  }, [clients, debouncedSearch, stageFilter]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title={entityLabel}
        subtitle={`Add, edit, and organise your ${entityLabel.toLowerCase()} in one place.`}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add {entityLabel.endsWith("s") ? entityLabel.slice(0, -1) : entityLabel}
          </Button>
        }
      />

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Could not load {entityLabel.toLowerCase()}.
            {error instanceof Error ? ` ${error.message}` : ""}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={`Search ${entityLabel.toLowerCase()}…`}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search clients"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={stageFilter || "__all__"} onValueChange={(v) => setStageFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger aria-label="Filter by stage">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 rounded-xl border border-border p-8 text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto opacity-50" />
          <p className="text-sm">Loading…</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-border text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-foreground">No {entityLabel.toLowerCase()} yet</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">
            {debouncedSearch || stageFilter
              ? "Try clearing search or filters."
              : `Add your first ${entityLabel.endsWith("s") ? entityLabel.slice(0, -1).toLowerCase() : entityLabel.toLowerCase()}.`}
          </p>
          {!debouncedSearch && !stageFilter && (
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add {entityLabel.endsWith("s") ? entityLabel.slice(0, -1) : entityLabel}
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                <TableHead className="hidden sm:table-cell text-muted-foreground">Added</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <div>
                      <Link href={clientProfileHref(c.id)}>
                        <a className="text-primary hover:underline">{c.name}</a>
                      </Link>
                    </div>
                    <div className="text-xs text-muted-foreground md:hidden mt-0.5">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    <div>{c.email || "—"}</div>
                    <div>{c.phone || ""}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.stage} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(c.ltv)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Remove"
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        modal={false}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${entityLabel.endsWith("s") ? entityLabel.slice(0, -1) : entityLabel}` : `Add ${entityLabel.endsWith("s") ? entityLabel.slice(0, -1) : entityLabel}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" autoComplete="tel" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Address</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Stage</label>
              <Select value={stage} onValueChange={(v) => setStage(v as ClientStage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" rows={3} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes this record from your database. Bookings and history may become orphaned depending on your setup. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section aria-label="Saffi assistant" className="pt-8 mt-2 border-t border-border/70">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
          Assistant
        </p>
        <SafiSectionChat
          variant="embedded"
          section="Saffi"
          description={`Same ${entityLabel.toLowerCase()} as the table — filtered list is sent with each message.`}
          icon={<Bot className="h-3.5 w-3.5 text-[#E83A8E]" />}
          suggestions={SAFFI_CLIENT_SUGGESTIONS}
          sectionContext={clientsSaffiContext}
        />
      </section>
    </div>
  );
}
