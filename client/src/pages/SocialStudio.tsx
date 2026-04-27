import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  Copy as CopyIcon,
  Check,
  Loader2,
  RefreshCw,
  Save,
  Calendar as CalendarIcon,
  Trash2,
  Search,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Instagram,
  Plus,
  Archive,
  Video,
  Film,
  ExternalLink,
} from "lucide-react";
import { SiTiktok, SiFacebook } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import PageHeader from "@/components/PageHeader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  SocialPost,
  SocialPlatform,
  SocialPostType,
  SocialPostStatus,
} from "@shared/schema";

// ==========================================================================
// Constants
// ==========================================================================

type TabKey = "generate" | "library" | "calendar" | "reel";

const PLATFORMS: {
  value: SocialPlatform;
  label: string;
  Icon: any;
  pillClass: string;
  badgeClass: string;
}[] = [
  {
    value: "instagram",
    label: "Instagram",
    Icon: Instagram,
    pillClass:
      "data-[active=true]:bg-pink-600 data-[active=true]:text-white data-[active=true]:border-pink-600",
    badgeClass: "bg-pink-100 text-pink-800",
  },
  {
    value: "tiktok",
    label: "TikTok",
    Icon: SiTiktok,
    pillClass:
      "data-[active=true]:bg-zinc-900 data-[active=true]:text-white data-[active=true]:border-zinc-900",
    badgeClass: "bg-zinc-900 text-white",
  },
  {
    value: "facebook",
    label: "Facebook",
    Icon: SiFacebook,
    pillClass:
      "data-[active=true]:bg-blue-600 data-[active=true]:text-white data-[active=true]:border-blue-600",
    badgeClass: "bg-blue-100 text-blue-800",
  },
  {
    value: "all",
    label: "All",
    Icon: Sparkles,
    pillClass:
      "data-[active=true]:bg-[hsl(var(--secondary))] data-[active=true]:text-white data-[active=true]:border-[hsl(var(--secondary))]",
    badgeClass: "bg-teal-100 text-teal-800",
  },
];

const POST_TYPES: {
  value: SocialPostType;
  label: string;
  emoji: string;
  description: string;
}[] = [
  {
    value: "practitioner_pitch",
    label: "Practitioner Pitch",
    emoji: "🎯",
    description: "Challenge practitioners to add endoPulse™ to their clinic. Income claims + FOMO.",
  },
  {
    value: "client_results",
    label: "Client Results",
    emoji: "📸",
    description: "Show client transformations. No surgery needed. Speak to their pain.",
  },
  {
    value: "model_call",
    label: "Model Call",
    emoji: "🌟",
    description: "Half price model opportunity. Urgency + exclusivity.",
  },
  {
    value: "income_claim",
    label: "Income Claim",
    emoji: "💰",
    description: "Compare endoPulse™ £800/session vs £100 filler maths.",
  },
  {
    value: "educational",
    label: "Educational",
    emoji: "🎓",
    description: "Explain dual wavelength technology simply. Build credibility.",
  },
  {
    value: "training_promo",
    label: "Training Promo",
    emoji: "🏥",
    description: "Harley Street credentials + CPD. Student success stories.",
  },
  {
    value: "machine_sale",
    label: "Machine Sale",
    emoji: "🤖",
    description: "ROI: machine costs £2,999, breaks even in 4 sessions.",
  },
  {
    value: "objection_handling",
    label: "Objection Handling",
    emoji: "🛡️",
    description: "Answer: is it safe? does it hurt? what's recovery like?",
  },
  {
    value: "before_after",
    label: "Before & After",
    emoji: "✨",
    description: "Hook to stop the scroll. Swipe results. DM CTA.",
  },
  {
    value: "tiktok",
    label: "TikTok Script",
    emoji: "📱",
    description: "POV format. Fast rhythm. Speaks to both practitioners and clients.",
  },
];

const STATUS_META: Record<
  SocialPostStatus,
  { label: string; cls: string; Icon: any }
> = {
  draft: { label: "Draft", cls: "bg-zinc-200 text-zinc-700", Icon: Edit3 },
  scheduled: { label: "Scheduled", cls: "bg-blue-100 text-blue-800", Icon: Clock },
  posted: { label: "Posted", cls: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
  archived: { label: "Archived", cls: "bg-amber-100 text-amber-800", Icon: Archive },
};

function platformMeta(p: SocialPlatform) {
  return PLATFORMS.find((x) => x.value === p) || PLATFORMS[3];
}

function postTypeMeta(t: SocialPostType) {
  return (
    POST_TYPES.find((x) => x.value === t) || {
      value: t,
      label: t,
      emoji: "✨",
      description: "",
    }
  );
}

// ==========================================================================
// Main page
// ==========================================================================

export default function SocialStudio() {
  const [tab, setTab] = useState<TabKey>("generate");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Social Media Studio"
        subtitle="Generate, save and schedule posts in Jono's voice."
      />

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {([
          { k: "generate", label: "Generate", Icon: Sparkles },
          { k: "reel", label: "Reel", Icon: Video },
          { k: "library", label: "Library", Icon: Archive },
          { k: "calendar", label: "Calendar", Icon: CalendarIcon },
        ] as const).map((t) => {
          const active = tab === t.k;
          const Icon = t.Icon;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k as TabKey)}
              data-testid={`tab-${t.k}`}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "generate" && <GenerateTab />}
      {tab === "reel" && <ReelTab />}
      {tab === "library" && <LibraryTab />}
      {tab === "calendar" && <CalendarTab />}
    </div>
  );
}

// ==========================================================================
// Generate Tab
// ==========================================================================

type GenerateResult = {
  caption: string;
  hook: string;
  hashtags: string;
  keyword_cta: string;
};

function GenerateTab() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [postType, setPostType] = useState<SocialPostType>("practitioner_pitch");
  const [topic, setTopic] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [savedPostId, setSavedPostId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedType = postTypeMeta(postType);

  const generate = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      const res = await apiRequest("POST", "/api/social-posts/generate", {
        post_type: postType,
        platform,
        topic: topic || undefined,
        extra_context: extraContext || undefined,
      });
      return (await res.json()) as GenerateResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setSavedPostId(null);
      setScheduledAt("");
    },
    onError: (e: any) => {
      setErrorMsg(e?.message || "Generation failed");
    },
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("Nothing to save");
      const res = await apiRequest("POST", "/api/social-posts", {
        caption: result.caption,
        platform,
        post_type: postType,
        hook: result.hook,
        hashtags: result.hashtags,
        keyword_cta: result.keyword_cta,
        status: "draft",
      });
      return (await res.json()) as SocialPost;
    },
    onSuccess: (post) => {
      setSavedPostId(post.id);
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({ title: "Saved as draft", description: "Find it in the Library tab." });
    },
    onError: (e: any) => {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    },
  });

  const schedulePost = useMutation({
    mutationFn: async () => {
      if (!savedPostId || !scheduledAt) throw new Error("Pick a date/time first");
      const iso = new Date(scheduledAt).toISOString();
      const res = await apiRequest("PATCH", `/api/social-posts/${savedPostId}`, {
        status: "scheduled",
        scheduled_at: iso,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({ title: "Scheduled", description: "Post added to the calendar." });
    },
    onError: (e: any) => {
      toast({ title: "Couldn't schedule", description: e.message, variant: "destructive" });
    },
  });

  const copyCaption = () => {
    if (!result?.caption) return;
    navigator.clipboard.writeText(result.caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ------------------------------ LEFT CONTROLS ------------------------------ */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold">Create a Post</h2>
          </div>

          {/* Platform selector */}
          <div className="mb-5">
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">
              Platform
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {PLATFORMS.map((p) => {
                const active = platform === p.value;
                const Icon = p.Icon;
                return (
                  <button
                    key={p.value}
                    data-active={active}
                    onClick={() => setPlatform(p.value)}
                    data-testid={`platform-${p.value}`}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-accent transition-colors",
                      p.pillClass,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Post type selector */}
          <div className="mb-5">
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">
              Post type
            </Label>
            <Select value={postType} onValueChange={(v) => setPostType(v as SocialPostType)}>
              <SelectTrigger data-testid="select-post-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="inline-flex items-center gap-2">
                      <span>{t.emoji}</span>
                      <span>{t.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {selectedType.description}
            </p>
          </div>

          {/* Topic */}
          <div className="mb-4">
            <Label
              htmlFor="topic"
              className="text-xs font-medium text-muted-foreground mb-1.5 block"
            >
              Topic / angle <span className="text-muted-foreground/70">(optional)</span>
            </Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. tummy results, Harley Street training, machine ROI"
              data-testid="input-topic"
            />
          </div>

          {/* Extra context */}
          <div className="mb-5">
            <Label
              htmlFor="extra"
              className="text-xs font-medium text-muted-foreground mb-1.5 block"
            >
              Extra context <span className="text-muted-foreground/70">(optional)</span>
            </Label>
            <Textarea
              id="extra"
              rows={3}
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              placeholder="Anything specific to include — a client name, a date, a promo..."
              data-testid="input-extra-context"
            />
          </div>

          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="w-full"
            data-testid="button-generate"
          >
            {generate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Writing in your voice...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>

          {errorMsg && (
            <div className="mt-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {errorMsg}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------ RIGHT OUTPUT ------------------------------ */}
      <div className="lg:col-span-7">
        {generate.isPending && <GenerateSkeleton />}

        {!generate.isPending && !result && (
          <div className="h-full min-h-[420px] flex items-center justify-center border-2 border-dashed border-border rounded-xl bg-background/60">
            <div className="text-center max-w-sm px-6">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] mb-3">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold mb-1">Your post will appear here</h3>
              <p className="text-xs text-muted-foreground">
                Pick a platform and post type, then hit Generate. The AI writes in your voice —
                short sentences, punchy hooks, a comment keyword CTA.
              </p>
            </div>
          </div>
        )}

        {!generate.isPending && result && (
          <div className="space-y-4">
            {/* Hook */}
            {result.hook && (
              <div className="inline-flex items-start gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))]/10 border border-[hsl(var(--secondary))]/20">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--secondary))] mt-0.5">
                  Hook
                </span>
                <span className="text-sm font-medium text-foreground">{result.hook}</span>
              </div>
            )}

            {/* Caption card */}
            <div className="bg-white border border-card-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Caption
                </span>
                <button
                  onClick={copyCaption}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  data-testid="button-copy-caption"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="h-3.5 w-3.5" />
                      Copy caption
                    </>
                  )}
                </button>
              </div>
              <div
                className="text-[15px] leading-[1.65] whitespace-pre-wrap font-sans text-foreground"
                data-testid="text-caption"
              >
                {result.caption}
              </div>
            </div>

            {/* Hashtags + CTA */}
            <div className="flex flex-wrap items-center gap-2">
              {result.hashtags &&
                result.hashtags
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
            </div>

            {result.keyword_cta && (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--primary))]">
                  Comment keyword
                </span>
                <span className="text-sm font-semibold text-[hsl(var(--primary))]">
                  {result.keyword_cta}
                </span>
              </div>
            )}

            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                variant="default"
                onClick={() => saveDraft.mutate()}
                disabled={saveDraft.isPending || !!savedPostId}
                data-testid="button-save-draft"
              >
                {saveDraft.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : savedPostId ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {savedPostId ? "Saved" : "Save as Draft"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
                data-testid="button-regenerate"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            </div>

            {/* Schedule section */}
            {savedPostId && (
              <div className="mt-4 bg-card border border-card-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarIcon className="h-4 w-4 text-[hsl(var(--secondary))]" />
                  <h4 className="text-sm font-semibold">Schedule this post</h4>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="flex-1"
                    data-testid="input-schedule-date"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => schedulePost.mutate()}
                    disabled={!scheduledAt || schedulePost.isPending}
                    data-testid="button-schedule"
                  >
                    {schedulePost.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4 mr-2" />
                    )}
                    Schedule Post
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GenerateSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-56" />
      <div className="bg-white border border-card-border rounded-xl p-5 shadow-sm space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

// ==========================================================================
// Library Tab
// ==========================================================================

function LibraryTab() {
  const [statusFilter, setStatusFilter] = useState<SocialPostStatus | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | "all">("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: posts, isLoading } = useQuery<SocialPost[]>({
    queryKey: ["/api/social-posts"],
  });

  const filtered = useMemo(() => {
    let list = posts || [];
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (platformFilter !== "all") list = list.filter((p) => p.platform === platformFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.caption?.toLowerCase().includes(q) ||
          p.hook?.toLowerCase().includes(q) ||
          p.hashtags?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [posts, statusFilter, platformFilter, search]);

  const openPost = posts?.find((p) => p.id === openId);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center gap-1 bg-card border border-card-border rounded-lg p-1">
          {(["all", "draft", "scheduled", "posted", "archived"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              data-testid={`filter-status-${s}`}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
                statusFilter === s
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All" : STATUS_META[s].label + "s"}
            </button>
          ))}
        </div>

        <Select
          value={platformFilter}
          onValueChange={(v) => setPlatformFilter(v as SocialPlatform | "all")}
        >
          <SelectTrigger className="w-[150px]" data-testid="filter-platform">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts..."
            className="pl-8"
            data-testid="input-search-library"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="h-64 flex items-center justify-center border-2 border-dashed border-border rounded-xl bg-background/60">
          <div className="text-center max-w-sm px-6">
            <p className="text-sm font-medium mb-1">
              {posts && posts.length > 0 ? "No posts match these filters" : "No posts yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {posts && posts.length > 0
                ? "Try changing the status or platform filter."
                : "Generate your first one in the Generate tab."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} onOpen={() => setOpenId(post.id)} />
          ))}
        </div>
      )}

      <EditDrawer
        post={openPost || null}
        open={!!openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

function PostCard({ post, onOpen }: { post: SocialPost; onOpen: () => void }) {
  const { toast } = useToast();
  const plat = platformMeta(post.platform);
  const type = postTypeMeta(post.post_type);
  const status = STATUS_META[post.status];
  const StatusIcon = status.Icon;
  const PlatIcon = plat.Icon;

  const markPosted = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/social-posts/${post.id}`, {
        status: "posted",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({ title: "Marked as posted" });
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/social-posts/${post.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({ title: "Deleted" });
    },
  });

  const copyCaption = () => {
    navigator.clipboard.writeText(post.caption);
    toast({ title: "Caption copied" });
  };

  const scheduledLabel = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium",
            plat.badgeClass,
          )}
        >
          <PlatIcon className="h-3 w-3" />
          {plat.label}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground">
          <span>{type.emoji}</span>
          {type.label}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ml-auto",
            status.cls,
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>

      {post.hook && (
        <div
          className="text-sm font-semibold mb-1.5 line-clamp-1"
          data-testid={`hook-${post.id}`}
        >
          {post.hook}
        </div>
      )}
      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-3 whitespace-pre-wrap flex-1">
        {post.caption}
      </p>

      {post.hashtags && (
        <div className="flex flex-wrap gap-1 mb-3">
          {post.hashtags
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 5)
            .map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground"
              >
                {tag}
              </span>
            ))}
        </div>
      )}

      {scheduledLabel && (
        <div className="text-[11px] text-muted-foreground mb-3 inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {scheduledLabel}
        </div>
      )}

      <div className="flex items-center gap-1 pt-2 border-t border-border/60 -mx-4 px-4 mt-auto">
        <button
          onClick={copyCaption}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Copy caption"
          data-testid={`button-copy-${post.id}`}
        >
          <CopyIcon className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onOpen}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Edit"
          data-testid={`button-edit-${post.id}`}
        >
          <Edit3 className="h-3.5 w-3.5" />
        </button>
        {post.status !== "posted" && (
          <button
            onClick={() => markPosted.mutate()}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-emerald-600"
            title="Mark as posted"
            data-testid={`button-mark-posted-${post.id}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => {
            if (confirm("Delete this post?")) del.mutate();
          }}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-destructive ml-auto"
          title="Delete"
          data-testid={`button-delete-${post.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ==========================================================================
// Edit Drawer
// ==========================================================================

function EditDrawer({
  post,
  open,
  onClose,
}: {
  post: SocialPost | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [caption, setCaption] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [postType, setPostType] = useState<SocialPostType>("practitioner_pitch");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<SocialPostStatus>("draft");

  useMemo(() => {
    if (post) {
      setCaption(post.caption);
      setPlatform(post.platform);
      setPostType(post.post_type);
      setScheduledAt(
        post.scheduled_at
          ? new Date(post.scheduled_at).toISOString().slice(0, 16)
          : "",
      );
      setNotes(post.notes || "");
      setStatus(post.status);
    }
  }, [post?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!post) throw new Error("No post");
      const body: any = {
        caption,
        platform,
        post_type: postType,
        notes: notes || null,
        status,
      };
      if (scheduledAt) {
        body.scheduled_at = new Date(scheduledAt).toISOString();
      } else {
        body.scheduled_at = null;
      }
      const res = await apiRequest("PATCH", `/api/social-posts/${post.id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({ title: "Saved" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!post) throw new Error("No post");
      const res = await apiRequest("DELETE", `/api/social-posts/${post.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({ title: "Deleted" });
      onClose();
    },
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-[500px] w-full p-0 overflow-y-auto">
        {post && (
          <div className="p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold">Edit post</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Created {new Date(post.created_at).toLocaleDateString("en-GB")}
              </p>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Caption
              </Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={10}
                className="font-sans text-sm leading-relaxed"
                data-testid="edit-caption"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Platform
                </Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as SocialPlatform)}>
                  <SelectTrigger data-testid="edit-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Post type
                </Label>
                <Select value={postType} onValueChange={(v) => setPostType(v as SocialPostType)}>
                  <SelectTrigger data-testid="edit-post-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POST_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.emoji} {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Status
                </Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as SocialPostStatus)}
                >
                  <SelectTrigger data-testid="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Scheduled at
                </Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  data-testid="edit-schedule"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Notes
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Private notes..."
                data-testid="edit-notes"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                data-testid="button-save-edit"
              >
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm("Delete this post?")) del.mutate();
                }}
                className="text-destructive hover:text-destructive ml-auto"
                data-testid="button-delete-edit"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ==========================================================================
// Calendar Tab
// ==========================================================================

function CalendarTab() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: posts, isLoading } = useQuery<SocialPost[]>({
    queryKey: ["/api/social-posts"],
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  // JS Sunday=0; show weeks starting Monday
  const startOffset = (firstDay.getDay() + 6) % 7;

  const todayKey = new Date().toISOString().slice(0, 10);

  // Map of YYYY-MM-DD -> posts[]
  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    (posts || []).forEach((p) => {
      if (!p.scheduled_at) return;
      const key = new Date(p.scheduled_at).toISOString().slice(0, 10);
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    });
    return map;
  }, [posts]);

  const cells: { key: string; day: number | null; isToday: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ key: `empty-${i}`, day: null, isToday: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ key, day: d, isToday: key === todayKey });
  }

  const selectedPosts = selectedDate ? postsByDay.get(selectedDate) || [] : [];
  const openPost = posts?.find((p) => p.id === openId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8">
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          {/* Calendar header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" data-testid="calendar-month">
              {monthLabel}
            </h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCursor(new Date(year, month - 1, 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
                }
                data-testid="button-today"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCursor(new Date(year, month + 1, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Weekday row */}
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="text-[11px] font-medium text-muted-foreground text-center py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1.5">
              {[...Array(35)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((c) => {
                if (c.day === null) {
                  return <div key={c.key} className="aspect-square" />;
                }
                const dayPosts = postsByDay.get(c.key) || [];
                const isSelected = selectedDate === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setSelectedDate(c.key)}
                    data-testid={`day-${c.key}`}
                    className={cn(
                      "aspect-square relative rounded-md p-1.5 text-left border transition-colors flex flex-col",
                      isSelected
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
                        : "border-border hover:bg-accent",
                      c.isToday && !isSelected && "border-[hsl(var(--secondary))]",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium",
                        c.isToday ? "text-[hsl(var(--secondary))]" : "text-foreground",
                      )}
                    >
                      {c.day}
                    </span>
                    {dayPosts.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-auto">
                        {dayPosts.slice(0, 4).map((p) => {
                          const plat = platformMeta(p.platform);
                          return (
                            <span
                              key={p.id}
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                plat.value === "instagram" && "bg-pink-600",
                                plat.value === "tiktok" && "bg-zinc-900",
                                plat.value === "facebook" && "bg-blue-600",
                                plat.value === "all" && "bg-[hsl(var(--secondary))]",
                              )}
                            />
                          );
                        })}
                        {dayPosts.length > 4 && (
                          <span className="text-[9px] text-muted-foreground font-medium">
                            +{dayPosts.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      <div className="lg:col-span-4">
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm min-h-[280px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">
              {selectedDate
                ? new Date(selectedDate).toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })
                : "Pick a day"}
            </h3>
            {selectedPosts.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedPosts.length} post{selectedPosts.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {!selectedDate ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              Click a day on the calendar to see scheduled posts.
            </div>
          ) : selectedPosts.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              Nothing scheduled for this day.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedPosts
                .sort(
                  (a, b) =>
                    new Date(a.scheduled_at!).getTime() -
                    new Date(b.scheduled_at!).getTime(),
                )
                .map((p) => {
                  const plat = platformMeta(p.platform);
                  const PlatIcon = plat.Icon;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setOpenId(p.id)}
                      className="w-full text-left bg-background border border-border rounded-lg p-3 hover:bg-accent transition-colors"
                      data-testid={`cal-post-${p.id}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center h-5 w-5 rounded-md",
                            plat.badgeClass,
                          )}
                        >
                          <PlatIcon className="h-3 w-3" />
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {new Date(p.scheduled_at!).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-medium line-clamp-2 leading-snug">
                        {p.hook || p.caption.slice(0, 60)}
                      </p>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      <EditDrawer
        post={openPost || null}
        open={!!openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

// ==========================================================================
// Reel Tab
// ==========================================================================

type ReelScriptLine = { time: string; line: string };
type ReelOverlay = { time: string; text: string };
type ReelResult = {
  hook: string;
  script: ReelScriptLine[];
  overlays: ReelOverlay[];
  veo3_prompt: string;
  caption: string;
  keyword_cta: string;
};

const REEL_TYPES: {
  value: string;
  label: string;
  emoji: string;
  description: string;
  postType: SocialPostType;
}[] = [
  {
    value: "practitioner_pitch",
    label: "Practitioner Pitch",
    emoji: "🎯",
    description: "Challenge clinics to add endoPulse™",
    postType: "practitioner_pitch",
  },
  {
    value: "before_after",
    label: "Before & After",
    emoji: "📸",
    description: "Show transformation results",
    postType: "before_after",
  },
  {
    value: "income_claim",
    label: "Income Claim",
    emoji: "💰",
    description: "£800/session, 10k/month lifestyle",
    postType: "income_claim",
  },
  {
    value: "model_call",
    label: "Model Call",
    emoji: "🌟",
    description: "Urgent half-price model opportunity",
    postType: "model_call",
  },
  {
    value: "training_promo",
    label: "Training Promo",
    emoji: "🎓",
    description: "Harley Street credibility",
    postType: "training_promo",
  },
  {
    value: "machine_sale",
    label: "Machine Sale",
    emoji: "🤖",
    description: "ROI pitch, breaks even in 4 sessions",
    postType: "machine_sale",
  },
];

const REEL_STYLES = [
  { value: "talking head", label: "Talking head (you speaking to camera)" },
  { value: "voiceover", label: "Voiceover (you narrate over footage)" },
  { value: "text only", label: "Text only (on-screen text with music, no speaking)" },
  { value: "b-roll montage", label: "B-roll montage (footage with captions)" },
];

function CopyButton({
  text,
  label = "Copy",
  className,
  testId,
}: {
  text: string;
  label?: string;
  className?: string;
  testId?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border bg-white hover:bg-zinc-50 transition-colors",
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied
        </>
      ) : (
        <>
          <CopyIcon className="h-3.5 w-3.5" /> {label}
        </>
      )}
    </button>
  );
}

function ReelTab() {
  const { toast } = useToast();
  const [reelType, setReelType] = useState<string>("practitioner_pitch");
  const [duration, setDuration] = useState<"10" | "15" | "30">("10");
  const [style, setStyle] = useState<string>("talking head");
  const [topic, setTopic] = useState("");
  const [reelResult, setReelResult] = useState<ReelResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selected = REEL_TYPES.find((r) => r.value === reelType) || REEL_TYPES[0];

  const generate = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      const res = await apiRequest("POST", "/api/social-posts/generate-reel", {
        reel_type: reelType,
        duration,
        style,
        topic: topic || undefined,
      });
      return (await res.json()) as ReelResult;
    },
    onSuccess: (data) => {
      setReelResult(data);
      setSaved(false);
    },
    onError: (e: any) => {
      setErrorMsg(e?.message || "Reel generation failed");
    },
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!reelResult) throw new Error("Nothing to save");
      const scriptText = reelResult.script
        .map((s) => `[${s.time}] ${s.line}`)
        .join("\n");
      const overlaysText = reelResult.overlays
        .map((o) => `[${o.time}] ${o.text}`)
        .join("\n");
      const notes = [
        `HOOK: ${reelResult.hook}`,
        `\nSCRIPT:\n${scriptText}`,
        `\nON-SCREEN TEXT:\n${overlaysText}`,
        `\nVEO 3 PROMPT:\n${reelResult.veo3_prompt}`,
      ].join("\n");
      const res = await apiRequest("POST", "/api/social-posts", {
        caption: reelResult.caption,
        platform: "instagram",
        post_type: selected.postType,
        hook: reelResult.hook,
        keyword_cta: reelResult.keyword_cta,
        status: "draft",
        notes,
      });
      return await res.json();
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({
        title: "Reel saved to Library",
        description: "Find it as a draft post in the Library tab.",
      });
    },
    onError: (e: any) => {
      toast({
        title: "Save failed",
        description: e?.message || "Could not save reel",
        variant: "destructive",
      });
    },
  });

  const scriptText = reelResult
    ? reelResult.script.map((s) => `[${s.time}] ${s.line}`).join("\n")
    : "";
  const overlaysText = reelResult
    ? reelResult.overlays.map((o) => `[${o.time}] ${o.text}`).join("\n")
    : "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-6">
      {/* LEFT — Controls */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎬</span>
          <h2 className="text-xl font-semibold tracking-tight">Create a Reel</h2>
        </div>

        {/* Reel type grid */}
        <div>
          <Label className="mb-2 block">Reel type</Label>
          <div className="grid grid-cols-2 gap-2.5">
            {REEL_TYPES.map((r) => {
              const active = reelType === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReelType(r.value)}
                  data-testid={`reel-type-${r.value}`}
                  className={cn(
                    "text-left p-3 rounded-xl border transition-colors",
                    active
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)]"
                      : "border-border bg-white hover:border-[hsl(var(--primary))]",
                  )}
                >
                  <div className="text-xl leading-none mb-1.5">{r.emoji}</div>
                  <div className="text-sm font-semibold leading-tight">
                    {r.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {r.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration */}
        <div>
          <Label className="mb-2 block">Reel duration</Label>
          <div className="inline-flex rounded-lg border border-border p-1 bg-white">
            {(["10", "15", "30"] as const).map((d) => {
              const active = duration === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  data-testid={`reel-duration-${d}`}
                  className={cn(
                    "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                    active
                      ? "bg-[hsl(var(--primary))] text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d} sec
                </button>
              );
            })}
          </div>
        </div>

        {/* Style */}
        <div>
          <Label className="mb-2 block">Style</Label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger data-testid="select-reel-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REEL_STYLES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Topic */}
        <div>
          <Label htmlFor="reel-topic" className="mb-2 block">
            Topic / angle <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="reel-topic"
            data-testid="input-reel-topic"
            placeholder="e.g. tummy results, Harley Street, machine ROI"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <Button
          data-testid="button-generate-reel"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
          className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-white"
          size="lg"
        >
          {generate.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Crafting your reel...
            </>
          ) : (
            <>
              <Film className="h-4 w-4 mr-2" />
              Generate Reel Pack
            </>
          )}
        </Button>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}
      </div>

      {/* RIGHT — Output */}
      <div>
        {generate.isPending && !reelResult && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        )}

        {!generate.isPending && !reelResult && (
          <div className="h-full min-h-[400px] rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center p-8 bg-zinc-50/50">
            <Video className="h-10 w-10 text-muted-foreground mb-3" />
            <div className="font-medium">Your reel pack will appear here</div>
            <div className="text-sm text-muted-foreground mt-1 max-w-xs">
              Pick a reel type, duration and style on the left, then hit Generate.
            </div>
          </div>
        )}

        {reelResult && (
          <div className="space-y-4">
            {/* Section 1: Hook */}
            <div className="rounded-xl border border-border bg-white overflow-hidden">
              <div className="bg-[hsl(var(--secondary))] text-white px-4 py-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider">
                  Hook · first 2 seconds
                </div>
                <CopyButton
                  text={reelResult.hook}
                  testId="copy-hook"
                  className="!bg-white/15 !border-white/30 !text-white hover:!bg-white/25"
                />
              </div>
              <div className="p-5">
                <div className="text-xl md:text-2xl font-bold leading-snug">
                  {reelResult.hook}
                </div>
              </div>
            </div>

            {/* Section 2: Script */}
            <div className="rounded-xl border border-border bg-white overflow-hidden">
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-border">
                <div className="text-sm font-semibold">Script</div>
                <CopyButton text={scriptText} label="Copy all" testId="copy-script" />
              </div>
              <div className="p-4 space-y-2">
                {reelResult.script.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[hsl(var(--secondary)/0.12)] text-[hsl(var(--secondary))]">
                      {s.time}
                    </span>
                    <span className="text-sm font-mono leading-relaxed">
                      {s.line}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Overlays */}
            <div className="rounded-xl border border-border bg-white overflow-hidden">
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-border">
                <div className="text-sm font-semibold">On-screen text overlays</div>
                <CopyButton text={overlaysText} label="Copy all" testId="copy-overlays" />
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {reelResult.overlays.map((o, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs"
                  >
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm font-mono font-semibold bg-[hsl(var(--primary))] text-white text-[10px]">
                      {o.time}
                    </span>
                    <span className="font-medium">{o.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Veo 3 prompt */}
            <div className="rounded-xl border border-border bg-white overflow-hidden">
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-border">
                <div className="text-sm font-semibold">Veo 3 video prompt</div>
                <CopyButton
                  text={reelResult.veo3_prompt}
                  label="Copy prompt"
                  testId="copy-veo3"
                />
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {reelResult.veo3_prompt}
                </div>
                <a
                  href="https://nanobanana.art/ai-video-generator"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-nano-banana"
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary)/0.9)] text-white font-medium transition-colors"
                >
                  Open Nano Banana
                  <ExternalLink className="h-4 w-4" />
                </a>
                <p className="text-xs text-muted-foreground text-center">
                  Paste this prompt into Nano Banana to generate your {duration}-second video with Google Veo 3
                </p>
              </div>
            </div>

            {/* Section 5: Caption */}
            <div className="rounded-xl border border-border bg-white overflow-hidden">
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-border">
                <div className="text-sm font-semibold">
                  Caption + hashtags
                </div>
                <CopyButton
                  text={reelResult.caption}
                  label="Copy caption"
                  testId="copy-caption"
                />
              </div>
              <div className="p-4">
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                  {reelResult.caption}
                </pre>
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end">
              <Button
                data-testid="button-save-reel"
                variant="outline"
                disabled={saveDraft.isPending || saved}
                onClick={() => saveDraft.mutate()}
              >
                {saveDraft.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : saved ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-emerald-600" /> Saved to Library
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" /> Save to Library
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
