import { useState } from "react";
import { Check, Zap, Users, Rocket, ArrowRight, Sparkles, Shield, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  { label: "Unlimited clients & jobs", solo: true, team: true, growth: true },
  { label: "Unlimited team members", solo: "1 owner + 1 tech", team: true, growth: true },
  { label: "Bookings, quotes & invoicing", solo: true, team: true, growth: true },
  { label: "Before & After photos + consent", solo: true, team: true, growth: true },
  { label: "Leads pipeline & follow-ups", solo: true, team: true, growth: true },
  { label: "Full manuals & training library", solo: true, team: true, growth: true },
  { label: "Social Studio (AI content)", solo: true, team: true, growth: true },
  { label: "Saffi AI assistant (chat + voice)", solo: true, team: true, growth: true },
  { label: "AI Phone Receptionist (24/7 calls & SMS)", solo: true, team: true, growth: true },
  { label: "Client self-portal & self-quoting", solo: true, team: true, growth: true },
  { label: "Smart route optimization", solo: "Basic", team: true, growth: true },
  { label: "Inventory + low-stock alerts", solo: true, team: true, growth: true },
  { label: "No-code workflow automations", solo: "Basic", team: true, growth: true },
  { label: "Advanced analytics & profitability", solo: "Core", team: true, growth: true },
  { label: "Priority support + onboarding call", solo: false, team: false, growth: true },
  { label: "White-label (your brand everywhere)", solo: false, team: false, growth: true },
  { label: "Usage transparency dashboard", solo: true, team: true, growth: true },
];

const PLANS = [
  {
    id: "solo",
    name: "Solo",
    icon: Zap,
    tagline: "Solopreneurs & 1-tech teams",
    monthly: 39,
    annual: 31,
    color: "from-blue-500/10 to-blue-600/5",
    accent: "text-blue-600",
    border: "border-blue-200",
    cta: "Start 14-day free trial",
    popular: false,
    bestFor: "1 owner + 1 tech",
  },
  {
    id: "team",
    name: "Team",
    icon: Users,
    tagline: "Growing crews that want everything",
    monthly: 129,
    annual: 103,
    color: "from-[#E83A8E]/10 to-[#E83A8E]/5",
    accent: "text-[#E83A8E]",
    border: "border-[#E83A8E]/30",
    cta: "Start 14-day free trial",
    popular: true,
    bestFor: "2–10 person teams",
  },
  {
    id: "growth",
    name: "Growth",
    icon: Rocket,
    tagline: "Scaling businesses & multi-location",
    monthly: 249,
    annual: 199,
    color: "from-[#0d6b67]/10 to-[#0d6b67]/5",
    accent: "text-[#0d6b67]",
    border: "border-[#0d6b67]/30",
    cta: "Start 14-day free trial",
    popular: false,
    bestFor: "10+ users + white-label",
  },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="h-4 w-4 text-emerald-500 mx-auto" />;
  if (value === false) return <span className="text-[10px] text-muted-foreground/40">—</span>;
  return <span className="text-[10px] font-medium text-muted-foreground">{value}</span>;
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-[#f6f3ef]">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-[#E83A8E] flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C7 2 3 6 3 11c0 3.3 1.7 6.2 4.3 7.9L9 22h6l1.7-3.1C19.3 17.2 21 14.3 21 11c0-5-4-9-9-9z" />
            <circle cx="12" cy="11" r="3" />
          </svg>
        </div>
        <span className="font-bold text-gray-900 tracking-tight">PractiVault</span>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-16 space-y-16">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-[#E83A8E]/10 text-[#E83A8E] text-xs font-semibold px-3 py-1 rounded-full">
            <Sparkles className="h-3.5 w-3.5" /> Simple, transparent pricing
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            Everything included.<br />
            <span className="text-[#E83A8E]">No surprise bills. Ever.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            The only all-in-one platform for trades and clinics that doesn’t nickel-and-dime you with per-user fees or £99 AI add-ons.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <span className={cn("text-sm font-medium", !annual ? "text-gray-900" : "text-muted-foreground")}>Monthly</span>
            <button
              onClick={() => setAnnual((a) => !a)}
              data-testid="button-billing-toggle"
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors duration-200",
                annual ? "bg-[#E83A8E]" : "bg-gray-200"
              )}
            >
              <span className={cn("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200", annual && "translate-x-5")} />
            </button>
            <span className={cn("text-sm font-medium", annual ? "text-gray-900" : "text-muted-foreground")}>
              Annual
              <span className="ml-1.5 text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Save 20%</span>
            </span>
          </div>
        </div>

        {/* Strong anti-per-user-fees trust line */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700 border border-emerald-100">
            <Shield className="h-4 w-4" />
            <span className="font-medium">No per-user fees. No £99 AI add-ons. No surprise bills. Ever.</span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const price = annual ? plan.annual : plan.monthly;
            return (
              <div
                key={plan.id}
                data-testid={`card-plan-${plan.id}`}
                className={cn(
                  "relative bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all hover:shadow-lg",
                  plan.popular ? "border-[#E83A8E] shadow-[#E83A8E]/10 scale-[1.01]" : "border-gray-100"
                )}
              >
                {plan.popular && (
                  <div className="bg-[#E83A8E] text-white text-[11px] font-bold text-center py-1.5 tracking-wide uppercase flex items-center justify-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> MOST POPULAR — BEST VALUE
                  </div>
                )}

                <div className={cn("bg-gradient-to-br p-6 space-y-4", plan.color)}>
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm", plan.accent)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900 text-xl">{plan.name}</h2>
                      <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-gray-900 tracking-tighter">£{price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  {annual && (
                    <div className="text-xs text-emerald-600 font-medium">Billed annually • Save 20%</div>
                  )}

                  <button
                    data-testid={`button-cta-${plan.id}`}
                    className={cn(
                      "w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.985]",
                      plan.popular
                        ? "bg-[#E83A8E] text-white hover:bg-[#c42d77] shadow-sm"
                        : "bg-white text-gray-900 border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                    )}
                  >
                    {plan.cta} <ArrowRight className="h-4 w-4" />
                  </button>

                  <p className="text-center text-[10px] text-muted-foreground">{plan.bestFor}</p>
                </div>

                {/* All features — truly inclusive */}
                <div className="p-5 space-y-2.5">
                  {FEATURES.map((f) => {
                    const val = (f as any)[plan.id];
                    return (
                      <div key={f.label} className="flex items-center gap-2.5 text-sm">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="text-gray-700 flex-1">{f.label}</span>
                        {typeof val === "string" && (
                          <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{val}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Usage Transparency — the trust builder most platforms don't offer */}
        <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#E83A8E]/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-[#E83A8E]" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Usage &amp; Transparency Dashboard — included on every plan</h3>
              <p className="text-sm text-muted-foreground">See exactly what you’re getting. No black box.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-4 pt-2">
            {[
              { icon: "🤖", label: "AI calls & voice minutes", desc: "Every Saffi + Phone Receptionist interaction logged" },
              { icon: "📱", label: "SMS & WhatsApp sent", desc: "Real count + cost to us (we eat it)" },
              { icon: "📍", label: "Route optimisation runs", desc: "How many miles & hours saved this month" },
              { icon: "✅", label: "Jobs completed", desc: "Your revenue vs platform cost — crystal clear" },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border bg-[#faf9f6] p-4 text-sm">
                <div className="text-xl mb-1.5">{item.icon}</div>
                <div className="font-semibold text-gray-900">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground pt-2">
            This is how we prove “all-inclusive” isn’t marketing speak. You’ll always see the real numbers.
          </p>
        </div>

        {/* The All-Inclusive Switch — strong acquisition offer without naming competitors */}
        <div className="rounded-2xl border-2 border-[#E83A8E]/30 bg-gradient-to-br from-[#fff7fb] to-white p-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 text-[#E83A8E] font-semibold text-sm tracking-wider">
            <Sparkles className="h-4 w-4" /> LAUNCH OFFER
          </div>
          <h2 className="text-2xl font-bold text-gray-900">The All-Inclusive Switch</h2>
          <p className="max-w-lg mx-auto text-muted-foreground">
            Tired of per-user fees and surprise add-on bills? We’ll import all your data for free and give you <span className="font-semibold text-gray-900">3 months at 50% off</span> any plan.
          </p>
          <button className="mt-2 px-8 py-3 bg-[#E83A8E] hover:bg-[#c42d77] text-white font-semibold rounded-xl text-sm flex items-center gap-2 mx-auto transition-all active:scale-[0.985]">
            Switch to all-inclusive → Import my data free <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-[10px] text-muted-foreground">No long contracts. Cancel with 1 click + full data export anytime.</p>
        </div>

        {/* Full comparison table (simplified — everything is included) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Full feature comparison</h2>
              <p className="text-sm text-muted-foreground">The only real difference is scale + priority</p>
            </div>
            <div className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">Everything below is included on ALL plans</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-muted-foreground font-medium w-1/2">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className={cn("px-4 py-3 font-semibold text-center", p.accent)}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {FEATURES.map((f) => (
                  <tr key={f.label} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-gray-700">{f.label}</td>
                    <td className="px-4 py-3 text-center"><FeatureValue value={(f as any).solo} /></td>
                    <td className="px-4 py-3 text-center"><FeatureValue value={(f as any).team} /></td>
                    <td className="px-4 py-3 text-center"><FeatureValue value={(f as any).growth} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* White label + Growth positioning */}
        <div className="bg-gradient-to-br from-[#0d6b67] to-[#0a5553] rounded-2xl p-8 text-white text-center space-y-4">
          <Rocket className="h-10 w-10 mx-auto opacity-80" />
          <h2 className="text-2xl font-bold">White label + priority support on Growth</h2>
          <p className="text-white/80 max-w-xl mx-auto">
            Your business name. Your logo. Your colours. Your clients see <strong className="text-white">your brand only</strong>.
            Plus dedicated onboarding, priority support, and advanced workflow builder. Perfect for academies, multi-location groups, and resellers.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {["Full white-label (remove all PractiVault branding)", "Priority phone & chat support", "Dedicated onboarding call", "Advanced no-code automations", "Early access to new AI features"].map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                <Check className="h-3.5 w-3.5 text-emerald-400" /> {item}
              </span>
            ))}
          </div>
        </div>

        {/* FAQ — focused on all-inclusive value */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
          {[
            { q: "Is there really no per-user fee?", a: "Correct. Solo includes 1 owner + 1 tech. Team & Growth = unlimited users at a flat price. No £29/user surprises." },
            { q: "Is the AI Phone Receptionist actually included?", a: "Yes. Every plan gets 24/7 AI voice + SMS that answers, qualifies, books jobs, and follows up. No separate AI add-on required." },
            { q: "What if I want to cancel or leave?", a: "1-click cancellation + full data export (CSV + PDF). We’ll even help you migrate out if you ever want to. No hostage tactics." },
            { q: "Do you support trades AND beauty?", a: "Yes — the same platform works for plumbers, joiners, electricians, aesthetic clinics, salons, and training academies." },
            { q: "Can I see exactly what I’m using?", a: "Every plan includes the live Usage Dashboard. You’ll see AI minutes, SMS count, route savings, jobs completed — real numbers, not marketing." },
            { q: "Is there a free trial?", a: "14 days on any plan. No card required. Plus the All-Inclusive Switch offer: free data import + 50% off for 3 months." },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-1.5">
              <h3 className="font-semibold text-gray-900 text-sm">{q}</h3>
              <p className="text-sm text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PractiVault · All rights reserved
      </footer>
    </div>
  );
}
