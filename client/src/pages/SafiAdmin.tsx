import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Copy as CopyIcon,
  Check,
  Trash2,
  Sparkles,
  MessageSquare,
  Instagram,
  Send,
  User,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { SiWhatsapp, SiFacebook } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/PageHeader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { daysAgo } from "@/lib/utils-app";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { AiFrontDeskRecord, AiFrontDeskChannel } from "@shared/schema";

const CHANNELS: { value: AiFrontDeskChannel; label: string; icon: any }[] = [
  { value: "manual", label: "Manual", icon: User },
  { value: "messenger", label: "Messenger", icon: SiFacebook },
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "whatsapp", label: "WhatsApp", icon: SiWhatsapp },
];

const CATEGORY_BADGE: Record<string, string> = {
  "Training Enquiry": "bg-purple-100 text-purple-800",
  "Model Call": "bg-pink-100 text-pink-800",
  Pricing: "bg-amber-100 text-amber-800",
  Insurance: "bg-blue-100 text-blue-800",
  "Machine Purchase": "bg-emerald-100 text-emerald-800",
  "Follow-up": "bg-teal-100 text-teal-800",
  Other: "bg-zinc-200 text-zinc-700",
};

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const cls = CATEGORY_BADGE[category] ?? "bg-zinc-200 text-zinc-700";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
        cls,
      )}
      data-testid={`badge-category-${category}`}
    >
      {category}
    </span>
  );
}

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const c = CHANNELS.find((x) => x.value === channel);
  const Icon = c?.icon ?? User;
  return <Icon className={cn("h-3.5 w-3.5", className)} />;
}

export default function SafiAdmin({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<AiFrontDeskChannel>("manual");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<AiFrontDeskRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: history, isLoading: historyLoading } = useQuery<AiFrontDeskRecord[]>({
    queryKey: ["/api/ai-front-desk"],
  });

  const analyse = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      const res = await apiRequest("POST", "/api/ai-front-desk/analyse", {
        message,
        channel,
      });
      return (await res.json()) as AiFrontDeskRecord;
    },
    onSuccess: (data) => {
      setPendingResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-front-desk"] });
    },
    onError: (e: any) => {
      setErrorMsg(e?.message || "Something went wrong");
    },
  });

  const removeRecord = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/ai-front-desk/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-front-desk"] });
      toast({ title: "Removed from history" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" }),
  });

  const discardPending = useMutation({
    mutationFn: async () => {
      if (!pendingResult) return;
      const res = await apiRequest("DELETE", `/api/ai-front-desk/${pendingResult.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-front-desk"] });
      setPendingResult(null);
      setMessage("");
      setCopied(false);
    },
  });

  function copyReply(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Reply copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  }

  function saveAndClear() {
    // Already saved on analyse — just clear the UI
    setPendingResult(null);
    setMessage("");
    setCopied(false);
    toast({ title: "Saved to history" });
  }

  const todayCount = useMemo(() => {
    if (!history) return 0;
    const today = new Date().toDateString();
    return history.filter((r) => new Date(r.created_at).toDateString() === today).length;
  }, [history]);

  const loading = analyse.isPending;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Saffi — Admin Assistant"
        subtitle={`${todayCount} message${todayCount === 1 ? "" : "s"} analysed today · Paste a DM and get a reply in your voice`}
        actions={
          onBack ? (
            <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT — 60% */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">New message</div>
                <div className="text-xs text-muted-foreground">
                  Pick a channel, paste the message, get a draft reply
                </div>
              </div>
            </div>

            {/* Channel pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                const active = channel === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChannel(c.value)}
                    disabled={loading || !!pendingResult}
                    data-testid={`pill-channel-${c.value}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted text-foreground/80",
                      (loading || !!pendingResult) && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              placeholder="Paste the message here…"
              disabled={loading || !!pendingResult}
              data-testid="input-message"
              className="resize-none text-[15px]"
            />

            {errorMsg && (
              <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3" data-testid="error-analyse">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>{errorMsg}</div>
              </div>
            )}

            <Button
              onClick={() => analyse.mutate()}
              disabled={!message.trim() || loading || !!pendingResult}
              className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-analyse"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  AI is reading this message…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyse &amp; Draft Reply
                </>
              )}
            </Button>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="bg-card border border-card-border rounded-xl shadow-sm p-5 space-y-3">
              <div className="text-xs text-muted-foreground font-medium">
                AI is reading this message…
              </div>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          )}

          {/* Result card */}
          {pendingResult && !loading && (
            <div className="bg-card border border-card-border rounded-xl shadow-sm p-5 space-y-4" data-testid="card-result">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={pendingResult.category} />
                  {pendingResult.next_action && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary/10 text-secondary border border-secondary/20"
                      data-testid="chip-next-action"
                    >
                      → {pendingResult.next_action}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  via <span className="capitalize">{pendingResult.channel}</span>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
                  <span>Drafted reply</span>
                  <button
                    onClick={() => copyReply(pendingResult.drafted_reply || "")}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    data-testid="button-copy-reply"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="h-3.5 w-3.5" />
                        Copy reply
                      </>
                    )}
                  </button>
                </div>
                <div
                  className="bg-muted/40 border border-border rounded-lg p-4 text-[15px] leading-relaxed whitespace-pre-wrap"
                  data-testid="text-drafted-reply"
                >
                  {pendingResult.drafted_reply || "(no reply drafted)"}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => discardPending.mutate()}
                  disabled={discardPending.isPending}
                  data-testid="button-discard"
                >
                  Discard
                </Button>
                <Button
                  onClick={saveAndClear}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-save-clear"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Save &amp; Clear
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — 40% */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Recent messages</div>
                <div className="text-xs text-muted-foreground">
                  {history?.length ?? 0} saved
                </div>
              </div>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="max-h-[calc(100vh-240px)] overflow-y-auto divide-y divide-border">
              {historyLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-md" />
                  ))}
                </div>
              ) : !history || history.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="h-10 w-10 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-2">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium">No history yet</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Analyse your first message to see it here
                  </div>
                </div>
              ) : (
                history.map((r) => {
                  const expanded = expandedId === r.id;
                  return (
                    <div
                      key={r.id}
                      className="p-4 hover:bg-muted/30 transition-colors"
                      data-testid={`row-history-${r.id}`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <ChannelIcon channel={r.channel} />
                            <CategoryBadge category={r.category} />
                          </div>
                          <div className="text-[11px] text-muted-foreground shrink-0">
                            {daysAgo(r.created_at)}
                          </div>
                        </div>
                        <div className="text-[13px] text-foreground/90 line-clamp-2">
                          {r.message_in.length > 80 && !expanded
                            ? r.message_in.slice(0, 80) + "…"
                            : r.message_in}
                        </div>
                      </button>

                      {expanded && r.drafted_reply && (
                        <div className="mt-3 space-y-2">
                          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                            Drafted reply
                          </div>
                          <div className="bg-muted/40 border border-border rounded-md p-3 text-[13px] leading-relaxed whitespace-pre-wrap">
                            {r.drafted_reply}
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            {r.next_action && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary/10 text-secondary">
                                → {r.next_action}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => copyReply(r.drafted_reply || "")}
                                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-primary"
                                title="Copy reply"
                                data-testid={`button-copy-${r.id}`}
                              >
                                <CopyIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm("Remove this from history?")) removeRecord.mutate(r.id);
                                }}
                                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                                title="Delete"
                                data-testid={`button-delete-${r.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
