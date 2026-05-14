/**
 * AI Phone Receptionist — Native & Included
 *
 * One of PractiVault’s core differentiators.
 * No per-user fees. No £99 add-on. No "paste your Vapi key".
 * This is a first-class, always-on feature for every plan.
 *
 * Current experience:
 * - Uses the connected business phone number (real inbound supported)
 * - Live voice testing powered by xAI Grok Realtime (same engine as Saffi)
 * - Call history from call_logs table
 * - Business-aware knowledge (can be made fully editable later)
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Phone,
  CheckCircle2,
  Mic,
  ArrowRight,
  Shield,
  Clock,
  Users,
  CalendarCheck,
  MessageCircle,
  RefreshCw,
  PlayCircle,
  Copy as CopyIcon,
  Check,
  UserPlus,
  CalendarPlus,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/PageHeader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { daysAgo } from "@/lib/utils-app";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SaffiVoiceConversation } from "@/components/SaffiVoiceConversation";

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

// These will be replaced by the user's actual business phone from /api/me or business_info
const FALLBACK_NUMBER = "Not connected yet";
const FALLBACK_FORMATTED = "Set your number in Settings";

// ---------- Benefit cards ----------
const BENEFITS = [
  {
    icon: Clock,
    title: "24/7 coverage",
    desc: "Answers every call — evenings, weekends, holidays. Never miss another lead.",
  },
  {
    icon: Users,
    title: "Qualifies in real time",
    desc: "Asks the right questions, scores interest, and only books serious enquiries.",
  },
  {
    icon: CalendarCheck,
    title: "Books straight into your calendar",
    desc: "Checks availability and creates confirmed bookings without you lifting a finger.",
  },
  {
    icon: MessageCircle,
    title: "Follows up automatically",
    desc: "Texts missed callers and sends reminders. Most leads are converted before you even see them.",
  },
];

// ---------- Knowledge topics (business-aware for v1) ----------
const KNOWLEDGE_TOPICS = [
  {
    label: "Your Services",
    body: "We offer a full range of treatments and services. Prices and availability are confirmed during the call based on the client’s needs.",
  },
  {
    label: "Pricing & Packages",
    body: "We quote accurately based on the service requested. Payment plans (Klarna, Clearpay, etc.) are offered where available.",
  },
  {
    label: "Availability",
    body: "We have slots most days. The AI checks real-time availability and can book or offer the next best times.",
  },
  {
    label: "Objections & Trust",
    body: "Safe, professional, and fully insured. We handle ‘is it painful?’, ‘how long does it last?’, and ‘do I need time off work?’ confidently.",
  },
];

// ---------- Call log row ----------
function CallRow({ call, onCreateLead }: { call: CallLog; onCreateLead: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const duration = call.duration_secs
    ? `${Math.floor(call.duration_secs / 60)}m ${call.duration_secs % 60}s`
    : "—";

  const statusColor =
    call.status === "completed" ? "bg-emerald-100 text-emerald-700" :
    call.status === "missed" ? "bg-red-100 text-red-700" :
    "bg-gray-100 text-gray-600";

  return (
    <>
      <tr
        className="border-b hover:bg-muted/30 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <td className="px-4 py-3 text-sm">
          {new Date(call.created_at).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </td>
        <td className="px-4 py-3">
          <div className="font-medium">{call.caller_name || call.caller_number || "Unknown"}</div>
          <div className="text-xs text-muted-foreground font-mono">{call.caller_number}</div>
        </td>
        <td className="px-4 py-3">
          <span className={cn("inline-block px-2 py-0.5 text-[10px] rounded-full font-medium", statusColor)}>
            {call.status || "unknown"}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{duration}</td>
        <td className="px-4 py-3 text-sm">{call.enquiry_type || "—"}</td>
        <td className="px-4 py-3 text-right">
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform inline-block", open && "rotate-180")} />
        </td>
      </tr>

      {open && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="p-5">
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div className="md:col-span-2 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">Summary</div>
                  <div className="leading-relaxed">{call.summary || "No summary recorded."}</div>
                </div>
                {call.transcript && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">Transcript</div>
                    <div className="font-mono text-xs bg-card border rounded-md p-3 max-h-64 overflow-auto whitespace-pre-wrap">
                      {call.transcript}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Actions</div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  disabled={!!call.lead_created}
                  onClick={() => onCreateLead(call.id)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {call.lead_created ? "Lead already created" : "Create lead from this call"}
                </Button>

                <Button variant="outline" size="sm" className="w-full justify-start" disabled>
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Create booking (coming soon)
                </Button>

                {call.transcript && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      navigator.clipboard.writeText(call.transcript || "");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    }}
                  >
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <CopyIcon className="h-4 w-4 mr-2" />}
                    {copied ? "Copied" : "Copy transcript"}
                  </Button>
                )}

                {call.recording_url && (
                  <a
                    href={call.recording_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border hover:bg-muted"
                  >
                    <PlayCircle className="h-4 w-4" /> Listen to recording
                  </a>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------- Main Page ----------
export default function PhoneReceptionist() {
  const { toast } = useToast();
  const [voiceOpen, setVoiceOpen] = useState(false);

  // Fetch business info so the number and knowledge are dynamic (white-label ready)
  const { data: me } = useQuery<any>({ queryKey: ["/api/me"] });
  const { data: businessInfo } = useQuery<any>({ queryKey: ["/api/business-info"] });

  const businessPhone = me?.business_phone || businessInfo?.phone || FALLBACK_NUMBER;
  const displayNumber = businessPhone === FALLBACK_NUMBER ? FALLBACK_FORMATTED : businessPhone;

  const { data: calls, isLoading, refetch } = useQuery<CallLog[]>({
    queryKey: ["/api/calls"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/calls");
      return res.json();
    },
  });

  const createLead = async (callId: string) => {
    try {
      await apiRequest("POST", `/api/calls/${callId}/create-lead`);
      toast({ title: "Lead created", description: "Added to your pipeline." });
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    } catch (e: any) {
      toast({ title: "Couldn’t create lead", description: e.message, variant: "destructive" });
    }
  };

  const hasCalls = (calls?.length || 0) > 0;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="AI Phone Receptionist"
        subtitle="Answers, qualifies, and books jobs 24/7 — included on every plan."
      />

      {/* Hero Status — Proud & Native */}
      <div className="rounded-3xl border bg-gradient-to-br from-[#E83A8E]/5 via-white to-white p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              <Shield className="h-3.5 w-3.5" /> INCLUDED ON EVERY PLAN
            </div>

            <h2 className="text-3xl font-bold tracking-tight">Your AI receptionist is live</h2>
            <p className="mt-2 text-lg text-muted-foreground max-w-xl">
              Calls to <span className="font-mono font-semibold text-foreground">{displayNumber}</span> are answered instantly by your AI.
              It books real appointments into your calendar.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-[#E83A8E] hover:bg-[#c42d77] gap-2 text-base px-8"
                onClick={() => setVoiceOpen(true)}
              >
                <Mic className="h-5 w-5" />
                Talk to your AI right now
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Button variant="outline" size="lg" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh calls
              </Button>
            </div>
          </div>

          {/* Number display */}
          <div className="lg:text-right">
            <div className="text-sm text-muted-foreground">Connected number</div>
            <div className="text-4xl font-mono font-semibold tracking-tighter mt-1">{businessPhone}</div>
            <div className="flex items-center lg:justify-end gap-2 mt-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-600">Active &amp; answering</span>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div>
        <div className="text-xs uppercase tracking-[1.5px] font-semibold text-muted-foreground mb-3 px-1">
          WHAT YOUR AI RECEPTIONIST DOES FOR YOU
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {BENEFITS.map((b, i) => (
            <div key={i} className="rounded-2xl border bg-white p-5 hover:border-[#E83A8E]/30 transition-colors">
              <b.icon className="h-6 w-6 text-[#E83A8E] mb-3" />
              <div className="font-semibold text-lg leading-tight">{b.title}</div>
              <div className="text-sm text-muted-foreground mt-2">{b.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Voice Test */}
      <div className="rounded-2xl border p-8 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold text-xl">Test the AI live</div>
            <p className="text-muted-foreground mt-1 max-w-md">
              Speak to your receptionist exactly as a real caller would. Ask about prices, availability, or anything a client might ask.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => setVoiceOpen(true)}
            className="shrink-0 bg-[#E83A8E] hover:bg-[#c42d77] gap-2"
          >
            <Mic className="h-5 w-5" /> Start voice test
          </Button>
        </div>
      </div>

      {/* Knowledge (what the AI knows) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <div className="font-semibold">What your AI knows about {businessInfo?.business_name || "your business"}</div>
            <div className="text-xs text-muted-foreground">This knowledge is used on every call</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast({ title: "Coming soon", description: "You'll be able to edit exactly what your AI knows about your services and policies." });
            }}
          >
            Edit knowledge
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {KNOWLEDGE_TOPICS.map((topic, idx) => (
            <div key={idx} className="rounded-xl border bg-white p-5">
              <div className="font-semibold text-sm mb-1.5">{topic.label}</div>
              <div className="text-sm text-muted-foreground leading-relaxed">{topic.body}</div>
            </div>
          ))}
          {/* Show user's main services if they have any */}
          {businessInfo?.products?.length > 0 && (
            <div className="rounded-xl border bg-white p-5 md:col-span-2">
              <div className="font-semibold text-sm mb-1.5">Your Current Services</div>
              <div className="text-sm text-muted-foreground">
                {businessInfo.products.map((p: any) => p.name).join(" • ")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Call History */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="font-semibold">Recent calls</div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="rounded-2xl border bg-white overflow-hidden">
          {isLoading ? (
            <div className="p-8">
              <Skeleton className="h-8 w-full mb-3" />
              <Skeleton className="h-8 w-full mb-3" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : hasCalls ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium w-28">Date</th>
                  <th className="px-4 py-3 font-medium">Caller</th>
                  <th className="px-4 py-3 font-medium w-24">Status</th>
                  <th className="px-4 py-3 font-medium w-20">Duration</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {calls!.slice(0, 12).map((call) => (
                  <CallRow key={call.id} call={call} onCreateLead={createLead} />
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <Phone className="h-10 w-10 mx-auto text-muted-foreground/40 mb-4" />
              <div className="font-medium">No calls yet</div>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                When someone calls {displayNumber}, the full conversation and actions will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer trust note */}
      <div className="text-center text-xs text-muted-foreground pt-4">
        All AI voice minutes and call handling are included in your plan. No surprise bills.
      </div>

      {/* Voice Test Dialog */}
      <Dialog open={voiceOpen} onOpenChange={setVoiceOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-[#E83A8E]" />
              Talk to your AI Receptionist
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              This is exactly how callers experience your receptionist. Try asking about prices, availability, or treatments.
            </p>
          </DialogHeader>

          <div className="p-6 pt-2">
            <SaffiVoiceConversation
              open={voiceOpen}
              onClose={() => setVoiceOpen(false)}
              receptionistMode
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
