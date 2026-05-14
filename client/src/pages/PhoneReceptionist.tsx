import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneIncoming,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  Circle,
  Loader2,
  PlayCircle,
  Copy as CopyIcon,
  Check,
  RefreshCw,
  Sparkles,
  UserPlus,
  CalendarPlus,
  ChevronDown,
  Plug,
  Unplug,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/PageHeader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { daysAgo } from "@/lib/utils-app";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------- Types ----------
type CallLog = {
  id: string;
  vapi_call_id: string | null;
  caller_number: string | null;
  caller_name: string | null;
  duration_secs: number | null;
  status: string | null;
  summary: string | null;
  transcript: string | null;
  enquiry_type: string | null;
  action_taken: string | null;
  lead_created: boolean | null;
  booking_created: boolean | null;
  lead_id: string | null;
  recording_url: string | null;
  metadata: any;
  created_at: string;
};

type VapiSettings = {
  vapi_key: string | null;
  assistant_id: string | null;
  phone_number_id: string | null;
  phone_number: string | null;
};

// ---------- Helpers ----------
const ENQUIRY_BADGE: Record<string, string> = {
  training: "bg-teal-100 text-teal-800",
  treatment: "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]",
  machine: "bg-purple-100 text-purple-800",
  pricing: "bg-amber-100 text-amber-800",
  booking: "bg-blue-100 text-blue-800",
  model_call: "bg-pink-100 text-pink-800",
  insurance: "bg-indigo-100 text-indigo-800",
  other: "bg-zinc-200 text-zinc-700",
};

function EnquiryBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const cls = ENQUIRY_BADGE[type] ?? ENQUIRY_BADGE.other;
  const label = type.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function formatDuration(secs: number | null) {
  if (!secs || secs <= 0) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

// ---------- Knowledge topics for Assistant card ----------
const KNOWLEDGE_TOPICS: { key: string; label: string; body: string }[] = [
  {
    key: "Treatments",
    label: "Treatments",
    body:
      "Dual wavelength laser (980nm + 1470nm) that tightens skin AND melts fat in one session. Areas: face, jawline, under-eyes, jowls, neck, tummy, arms, thighs, back. From £450–£800+ per session. Results visible immediately, improve over 6–8 weeks.",
  },
  {
    key: "Training",
    label: "Training",
    body:
      "Online (£400, CPD accredited, 4 months, 2 case studies). In-person (£1,500, 1-day, Harley Street London or Rodney Street Liverpool). Practitioners can earn £700/hr.",
  },
  {
    key: "Machine",
    label: "Machine",
    body:
      "Machine purchase £2,999 with Klarna available. Insurance from day one via Finch and PolicyBee. Practitioners can earn £5k/week, £10k/month.",
  },
  {
    key: "Pricing",
    label: "Pricing",
    body:
      "Treatments from £450–£800+. Training £400 online / £1,500 in-person. Machine £2,999. The AI won't quote prices until it understands what the caller needs.",
  },
  {
    key: "Model Calls",
    label: "Model Calls",
    body:
      "Jono occasionally offers discounted model treatments. Models must be comfortable with photos. Direct callers to DM @endopulse on Instagram or email.",
  },
  {
    key: "Objections",
    label: "Objections",
    body:
      'Safe? Yes — UK trademarked, CPD accredited, covered by major insurers. Hurt? Warm sensation, anaesthetic applied. Recovery? Little to none. Vs surgery? Same results, fraction of cost, no scarring.',
  },
];

// ---------- Setup Card ----------
function SetupCard({
  settings,
  onSaved,
}: {
  settings: VapiSettings;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const connected = !!settings.vapi_key;

  const save = useMutation({
    mutationFn: async (vapi_key: string) => {
      // Save key
      const r = await apiRequest("POST", "/api/settings/vapi-key", { vapi_key });
      await r.json();
      // Create assistant
      const r2 = await apiRequest("POST", "/api/vapi/create-assistant", {
        api_key: vapi_key,
      });
      const asst = await r2.json();
      // Save assistant id
      await apiRequest("POST", "/api/settings/vapi-key", {
        assistant_id: asst.assistant_id,
      });
      return asst;
    },
    onSuccess: () => {
      toast({
        title: "Receptionist activated",
        description: "Your AI assistant is live and ready to take calls.",
      });
      setKeyInput("");
      onSaved();
    },
    onError: (e: any) => {
      toast({
        title: "Couldn't activate",
        description: e?.message || "Please check your Vapi API key.",
        variant: "destructive" as any,
      });
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("DELETE", "/api/settings/vapi-key");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Disconnected", description: "Vapi settings cleared." });
      onSaved();
    },
  });

  if (connected) {
    return (
      <div className="bg-card border border-card-border rounded-xl shadow-sm p-5 flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold tracking-tight">Receptionist connected</h3>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
              <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
              Active
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Vapi is answering calls as <span className="font-medium">endoPulse™ AI Receptionist</span>
            {settings.phone_number ? (
              <>
                {" "}on <span className="font-mono">{settings.phone_number}</span>.
              </>
            ) : (
              ". Provision a UK number below to start taking real calls."
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (confirm("Disconnect Vapi? Your assistant settings will be cleared.")) {
              disconnect.mutate();
            }
          }}
          disabled={disconnect.isPending}
          data-testid="button-disconnect-vapi"
        >
          <Unplug className="h-4 w-4 mr-1.5" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 md:p-8 bg-gradient-to-br from-[hsl(var(--primary))]/[0.06] via-transparent to-[hsl(var(--secondary))]/[0.06]">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-[hsl(var(--primary))] text-white flex items-center justify-center shrink-0 shadow-sm">
            <PhoneCall className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">
              Connect your AI Receptionist
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Paste your Vapi API key below to activate your AI phone receptionist. Vapi answers every call
              in a warm British voice, 24/7, capturing leads and booking enquiries straight into FieldFlow.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3 max-w-xl">
          <label className="text-sm font-medium">Vapi API Key</label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="vapi_..."
              className="pr-10 font-mono text-sm"
              data-testid="input-vapi-key"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => save.mutate(keyInput.trim())}
              disabled={!keyInput.trim() || save.isPending}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
              data-testid="button-activate-receptionist"
            >
              {save.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Activating…
                </>
              ) : (
                <>
                  <Plug className="h-4 w-4 mr-1.5" />
                  Activate Receptionist
                </>
              )}
            </Button>
            <a
              href="https://vapi.ai"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-1"
            >
              Get your free Vapi API key <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t border-border/50 mt-2 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              ~£0.07 per minute of call time. A 3-minute call costs about 20p. Pay Vapi directly — FieldFlow
              doesn't mark up usage.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Assistant Status Card ----------
function AssistantStatusCard({
  settings,
  onProvisioned,
}: {
  settings: VapiSettings;
  onProvisioned: () => void;
}) {
  const { toast } = useToast();
  const connected = !!settings.vapi_key;
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  const buyNumber = useMutation({
    mutationFn: async () => {
      if (!settings.vapi_key || !settings.assistant_id) {
        throw new Error("Connect Vapi and create an assistant first.");
      }
      const r = await apiRequest("POST", "/api/vapi/buy-number", {
        api_key: settings.vapi_key,
        assistant_id: settings.assistant_id,
      });
      const data = await r.json();
      await apiRequest("POST", "/api/settings/vapi-key", {
        phone_number_id: data.id,
        phone_number: data.number,
      });
      return data;
    },
    onSuccess: (d: any) => {
      toast({
        title: "Number provisioned",
        description: `Your receptionist is live on ${d.number}.`,
      });
      onProvisioned();
    },
    onError: (e: any) => {
      toast({
        title: "Couldn't provision number",
        description: e?.message || "Vapi didn't return a UK number.",
        variant: "destructive" as any,
      });
    },
  });

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm">
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold tracking-tight">Assistant</h3>
            <p className="text-sm text-muted-foreground">
              The AI persona, voice and knowledge that answers every call.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700">
                <Circle className="h-2 w-2" />
                Not configured
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3 text-sm">
          <Row label="Assistant name" value="endoPulse™ AI Receptionist" />
          <Row
            label="Phone number"
            value={
              settings.phone_number ? (
                <span className="font-mono">{settings.phone_number}</span>
              ) : (
                <span className="text-muted-foreground">No number yet</span>
              )
            }
          />
          <Row label="Voice" value="British English — Rachel (ElevenLabs)" />
          <Row label="Language" value="English (UK)" />
          <Row label="Model" value="GPT-4o mini" />
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Knowledge
          </div>
          <div className="flex flex-wrap gap-1.5">
            {KNOWLEDGE_TOPICS.map((t) => (
              <button
                key={t.key}
                onClick={() => setOpenTopic(openTopic === t.key ? null : t.key)}
                className={cn(
                  "text-[11px] font-medium px-2 py-1 rounded-full border transition-colors",
                  openTopic === t.key
                    ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border-[hsl(var(--secondary))]"
                    : "bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary))] border-[hsl(var(--secondary))]/20 hover:bg-[hsl(var(--secondary))]/20",
                )}
                data-testid={`topic-${t.key}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {openTopic && (
            <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg p-3 leading-relaxed">
              {KNOWLEDGE_TOPICS.find((t) => t.key === openTopic)?.body}
            </div>
          )}
        </div>
      </div>

      <div className="p-5 border-t border-border flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]"
          disabled={!connected || !!settings.phone_number || buyNumber.isPending}
          onClick={() => buyNumber.mutate()}
          data-testid="button-provision-number"
        >
          {buyNumber.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Provisioning…
            </>
          ) : settings.phone_number ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Number active
            </>
          ) : (
            <>
              <PhoneIncoming className="h-4 w-4 mr-1.5" />
              Provision UK phone number
            </>
          )}
        </Button>
        <a
          href="https://dashboard.vapi.ai"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground px-2 py-1.5"
        >
          <PhoneCall className="h-4 w-4 mr-1.5" />
          Test call
          <ExternalLink className="h-3 w-3 ml-1" />
        </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium w-32 shrink-0">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

// ---------- Call Log ----------
function CallLogSection({
  calls,
  isLoading,
  onRefresh,
}: {
  calls: CallLog[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return calls;
    return calls.filter((c) => c.status === filter);
  }, [calls, filter]);

  const createLead = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/calls/${id}/create-lead`);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Lead created", description: "Added to your leads pipeline." });
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: (e: any) => {
      toast({
        title: "Couldn't create lead",
        description: e?.message,
        variant: "destructive" as any,
      });
    },
  });

  // Stats
  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = calls.filter((c) => new Date(c.created_at).getTime() >= weekAgo);
    const totalThisWeek = thisWeek.length;
    const validDurations = calls.filter((c) => (c.duration_secs || 0) > 0);
    const avgDuration =
      validDurations.length > 0
        ? Math.round(
            validDurations.reduce((s, c) => s + (c.duration_secs || 0), 0) /
              validDurations.length,
          )
        : 0;
    const leadsCreated = calls.filter((c) => c.lead_created).length;
    const typeCount = new Map<string, number>();
    for (const c of calls) {
      if (!c.enquiry_type) continue;
      typeCount.set(c.enquiry_type, (typeCount.get(c.enquiry_type) || 0) + 1);
    }
    let topType: string | null = null;
    let topCount = 0;
    for (const [k, v] of Array.from(typeCount.entries())) {
      if (v > topCount) {
        topCount = v;
        topType = k;
      }
    }
    return { totalThisWeek, avgDuration, leadsCreated, topType };
  }, [calls]);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Calls this week" value={String(stats.totalThisWeek)} />
        <StatCard label="Avg duration" value={formatDuration(stats.avgDuration)} />
        <StatCard label="Leads created" value={String(stats.leadsCreated)} />
        <StatCard
          label="Top enquiry"
          value={stats.topType ? stats.topType.replace(/_/g, " ") : "—"}
          capitalize
        />
      </div>

      {/* Header + filter pills + refresh */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold tracking-tight">Recent Calls</h3>
          <p className="text-sm text-muted-foreground">
            Every call your AI receptionist handles, with a full transcript.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
            {["all", "completed", "missed", "in-progress"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 capitalize transition-colors",
                  filter === f
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
                data-testid={`filter-${f}`}
              >
                {f.replace("-", " ")}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            data-testid="button-refresh-calls"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-5 py-3 font-medium">Caller</th>
              <th className="text-left px-4 py-3 font-medium">When</th>
              <th className="text-left px-4 py-3 font-medium">Duration</th>
              <th className="text-left px-4 py-3 font-medium">Enquiry</th>
              <th className="text-left px-4 py-3 font-medium">Summary</th>
              <th className="text-left px-4 py-3 font-medium">Actions</th>
              <th className="text-right px-4 py-3 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="p-3">
                    <Skeleton className="h-10" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div className="text-sm">
                      No calls yet. Once your receptionist starts answering calls, they'll appear here.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const isOpen = expanded === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      data-testid={`row-call-${c.id}`}
                    >
                      <td className="px-5 py-3">
                        <div className="text-sm font-medium">
                          {c.caller_name || "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {c.caller_number || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {daysAgo(c.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums">
                        {formatDuration(c.duration_secs)}
                      </td>
                      <td className="px-4 py-3">
                        <EnquiryBadge type={c.enquiry_type} />
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[320px]">
                        <div className="truncate">
                          {c.summary ? c.summary.slice(0, 80) + (c.summary.length > 80 ? "…" : "") : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {c.lead_created && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                              <UserPlus className="h-3 w-3" /> Lead
                            </span>
                          )}
                          {c.booking_created && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              <CalendarPlus className="h-3 w-3" /> Booking
                            </span>
                          )}
                          {c.recording_url && (
                            <a
                              href={c.recording_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-[hsl(var(--primary))]"
                              title="Play recording"
                            >
                              <PlayCircle className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform inline-block",
                            isOpen && "rotate-180",
                          )}
                        />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="p-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="md:col-span-2 space-y-4">
                              <div>
                                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
                                  Summary
                                </div>
                                <div className="text-sm whitespace-pre-wrap">
                                  {c.summary || "No summary available."}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
                                  Transcript
                                </div>
                                <div className="text-[13px] font-mono whitespace-pre-wrap leading-relaxed bg-card border border-border rounded-md p-3 max-h-80 overflow-auto">
                                  {c.transcript || "No transcript recorded."}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
                                Actions
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start"
                                disabled={!!c.lead_created || createLead.isPending}
                                onClick={() => createLead.mutate(c.id)}
                              >
                                <UserPlus className="h-4 w-4 mr-1.5" />
                                {c.lead_created ? "Lead created" : "Create lead"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start"
                                disabled
                                title="Coming soon"
                              >
                                <CalendarPlus className="h-4 w-4 mr-1.5" />
                                Create booking
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => {
                                  navigator.clipboard.writeText(c.transcript || "");
                                  setCopiedId(c.id);
                                  setTimeout(() => setCopiedId(null), 1500);
                                }}
                              >
                                {copiedId === c.id ? (
                                  <>
                                    <Check className="h-4 w-4 mr-1.5" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <CopyIcon className="h-4 w-4 mr-1.5" />
                                    Copy transcript
                                  </>
                                )}
                              </Button>
                              {c.recording_url && (
                                <a
                                  href={c.recording_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center w-full text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted text-foreground"
                                >
                                  <PlayCircle className="h-4 w-4 mr-1.5" />
                                  Open recording
                                  <ExternalLink className="h-3 w-3 ml-auto" />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className={cn("mt-1 text-xl font-semibold tracking-tight", capitalize && "capitalize")}>
        {value}
      </div>
    </div>
  );
}

// ---------- Main Page ----------
export default function PhoneReceptionist() {
  const { data: settings, refetch: refetchSettings } = useQuery<VapiSettings>({
    queryKey: ["/api/settings/vapi-key"],
  });

  const {
    data: calls,
    isLoading,
    refetch: refetchCalls,
  } = useQuery<CallLog[]>({
    queryKey: ["/api/calls"],
  });

  const s: VapiSettings = settings || {
    vapi_key: null,
    assistant_id: null,
    phone_number_id: null,
    phone_number: null,
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="AI Receptionist"
        subtitle="Your 24/7 AI phone receptionist — powered by Vapi, branded as endoPulse™."
      />

      <div className="space-y-6">
        <SetupCard settings={s} onSaved={() => refetchSettings()} />
        <AssistantStatusCard settings={s} onProvisioned={() => refetchSettings()} />
        <CallLogSection
          calls={calls || []}
          isLoading={isLoading}
          onRefresh={() => refetchCalls()}
        />
      </div>
    </div>
  );
}
