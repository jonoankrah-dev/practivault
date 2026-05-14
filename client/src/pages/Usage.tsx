/**
 * Usage & Transparency Dashboard
 * Shows customers exactly what they're getting for their flat monthly price.
 * This is the #1 trust builder against per-user / add-on pricing competitors.
 */
import { useQuery } from "@tanstack/react-query";
import { Phone, MessageSquare, Briefcase, Camera, TrendingDown, Shield, Calendar } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface UsageSummary {
  period: { month: string; monthStart: string; thirtyDaysAgo: string };
  jobs: { thisMonth: number; allTime: number };
  aiVoice: { minutesThisMonth: number; minutesAllTime: number; callsThisMonth: number };
  messagesSent: { whatsappThisMonth: number; whatsappAllTime: number; aiGeneratedThisMonth: number };
  socialStudio: { draftsThisMonth: number; draftsAllTime: number };
  savings: { hypotheticalJobberCost: number; yourPrice: number; note: string };
  generatedAt: string;
}

export default function Usage() {
  const { data, isLoading, error } = useQuery<UsageSummary>({
    queryKey: ["/api/usage/summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/usage/summary");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (error) {
    return (
      <div className="p-8">
        <PageHeader title="Usage & Transparency" subtitle="See exactly what you're getting" />
        <div className="text-red-600 mt-4">Failed to load usage data. Please try again later.</div>
      </div>
    );
  }

  const m = data?.period?.month || "this month";
  const jobs = data?.jobs || { thisMonth: 0, allTime: 0 };
  const voice = data?.aiVoice || { minutesThisMonth: 0, minutesAllTime: 0, callsThisMonth: 0 };
  const msgs = data?.messagesSent || { whatsappThisMonth: 0, whatsappAllTime: 0, aiGeneratedThisMonth: 0 };
  const social = data?.socialStudio || { draftsThisMonth: 0, draftsAllTime: 0 };
  const savings = data?.savings || { hypotheticalJobberCost: 180, yourPrice: 129, note: "" };

  const monthlySavings = Math.max(0, savings.hypotheticalJobberCost - savings.yourPrice);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Usage & Transparency"
        subtitle="Everything below is included in your flat monthly price. No overages. No surprises."
      />

      {/* Trust banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Shield className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="font-semibold text-emerald-900">We show you the real numbers</div>
            <div className="text-sm text-emerald-700">This is how we prove "all-inclusive" isn't marketing speak.</div>
          </div>
        </div>
        <div className="md:ml-auto text-xs text-emerald-600 bg-white px-3 py-1.5 rounded-full border border-emerald-200">
          Updated {data ? new Date(data.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "just now"}
        </div>
      </div>

      {/* This Month vs All Time */}
      <div>
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">{m}</span>
          <span className="text-muted-foreground/60">•</span>
          <span>All time</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Jobs */}
          <Card className="border-[#E83A8E]/10">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#E83A8E]">
                <Briefcase className="h-4 w-4" />
                <span className="text-xs font-semibold tracking-wider">JOBS COMPLETED</span>
              </div>
              <div className="text-4xl font-bold tabular-nums">{jobs.thisMonth}</div>
              <div className="text-xs text-muted-foreground">this month • {jobs.allTime} all time</div>
            </CardContent>
          </Card>

          {/* AI Voice */}
          <Card className="border-[#E83A8E]/10">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#E83A8E]">
                <Phone className="h-4 w-4" />
                <span className="text-xs font-semibold tracking-wider">AI PHONE RECEPTIONIST</span>
              </div>
              <div className="text-4xl font-bold tabular-nums">{voice.minutesThisMonth}<span className="text-xl font-normal text-muted-foreground">m</span></div>
              <div className="text-xs text-muted-foreground">{voice.callsThisMonth} calls answered this month • {voice.minutesAllTime}m all time</div>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="border-[#E83A8E]/10">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#E83A8E]">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs font-semibold tracking-wider">MESSAGES SENT</span>
              </div>
              <div className="text-4xl font-bold tabular-nums">{msgs.whatsappThisMonth + msgs.aiGeneratedThisMonth}</div>
              <div className="text-xs text-muted-foreground">
                {msgs.whatsappThisMonth} WhatsApp + {msgs.aiGeneratedThisMonth} AI-generated this month
              </div>
            </CardContent>
          </Card>

          {/* Social Studio */}
          <Card className="border-[#E83A8E]/10">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#E83A8E]">
                <Camera className="h-4 w-4" />
                <span className="text-xs font-semibold tracking-wider">SOCIAL STUDIO</span>
              </div>
              <div className="text-4xl font-bold tabular-nums">{social.draftsThisMonth}</div>
              <div className="text-xs text-muted-foreground">advertising posts & reels drafted this month • {social.draftsAllTime} all time</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* The Money Shot — Savings comparison */}
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white">
        <CardContent className="p-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-1">
              <div className="uppercase text-emerald-600 text-xs tracking-[1px] font-semibold mb-2">THE JOBBER ALTERNATIVE COST</div>
              <div className="text-2xl font-semibold text-gray-900 mb-1">What similar activity would cost on traditional per-user + add-on pricing</div>
              <div className="text-sm text-muted-foreground">{savings.note}</div>
            </div>

            <div className="text-center lg:text-right">
              <div className="text-5xl font-bold text-emerald-600 tabular-nums">£{savings.hypotheticalJobberCost}</div>
              <div className="text-xs text-emerald-600/80 mt-0.5">estimated this month</div>
            </div>

            <div className="hidden lg:block w-px h-16 bg-emerald-200" />

            <div className="text-center lg:text-left">
              <div className="text-sm text-emerald-700 font-medium">You pay (flat)</div>
              <div className="text-5xl font-bold text-gray-900 tabular-nums">£{savings.yourPrice}</div>
              <div className="text-emerald-600 font-semibold flex items-center justify-center lg:justify-start gap-1 mt-1">
                <TrendingDown className="h-4 w-4" /> Save ~£{monthlySavings} this month
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Why this matters */}
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        {[
          {
            title: "No per-user fees",
            body: "Hire two more technicians? Your price stays the same. Jobber would charge you another £58–£87/month instantly.",
          },
          {
            title: "AI Phone + SMS included",
            body: "24/7 voice receptionist + WhatsApp automation. On Jobber this is a separate £99/mo add-on with limited functionality.",
          },
          {
            title: "Unlimited AI usage",
            body: "Social posts, reel scripts, quote drafting, follow-ups — all the Saffi calls you need. No credit system, no surprise overage bills.",
          },
        ].map((item, idx) => (
          <div key={idx} className="rounded-2xl border bg-white p-5 space-y-2">
            <div className="font-semibold text-gray-900">{item.title}</div>
            <div className="text-muted-foreground leading-snug">{item.body}</div>
          </div>
        ))}
      </div>

      <div className="text-[11px] text-center text-muted-foreground pt-4">
        Data is calculated in real time from your actual activity. We will never charge extra based on these numbers.
      </div>
    </div>
  );
}
