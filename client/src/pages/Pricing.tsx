import { useState } from "react";
import { Check, X, Zap, Star, Building2, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  { label: "Clients", starter: "Up to 50", pro: "Up to 500", scale: "Unlimited" },
  { label: "Team members", starter: "1 (owner)", pro: "Up to 5", scale: "Unlimited" },
  { label: "Bookings & calendar", starter: true, pro: true, scale: true },
  { label: "Invoicing & quotes", starter: true, pro: true, scale: true },
  { label: "Before & After photos", starter: true, pro: true, scale: true },
  { label: "Consent forms", starter: true, pro: true, scale: true },
  { label: "Leads pipeline", starter: true, pro: true, scale: true },
  { label: "Manuals library", starter: true, pro: true, scale: true },
  { label: "Social Studio", starter: false, pro: true, scale: true },
  { label: "Buddy voice assistant", starter: false, pro: true, scale: true },
  { label: "Client portal", starter: false, pro: true, scale: true },
  { label: "Training videos", starter: false, pro: true, scale: true },
  { label: "Training packages", starter: false, pro: true, scale: true },
  { label: "AI Phone Receptionist", starter: false, pro: false, scale: true },
  { label: "Priority support", starter: false, pro: false, scale: true },
  { label: "White label (your brand)", starter: false, pro: false, scale: true },
  { label: "\"Powered by PractiVault\" badge", starter: false, pro: false, scale: "Footer only" },
];

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    icon: Zap,
    tagline: "Perfect for new businesses getting started",
    monthly: 19,
    annual: 15,
    color: "from-blue-500/10 to-blue-600/5",
    accent: "text-blue-600",
    border: "border-blue-200",
    cta: "Start free trial",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    icon: Star,
    tagline: "For growing practices and sole traders",
    monthly: 49,
    annual: 39,
    color: "from-[#E83A8E]/10 to-[#E83A8E]/5",
    accent: "text-[#E83A8E]",
    border: "border-[#E83A8E]/30",
    cta: "Start free trial",
    popular: true,
  },
  {
    id: "scale",
    name: "Scale",
    icon: Building2,
    tagline: "For academies, chains & white-label businesses",
    monthly: 99,
    annual: 79,
    color: "from-[#0d6b67]/10 to-[#0d6b67]/5",
    accent: "text-[#0d6b67]",
    border: "border-[#0d6b67]/30",
    cta: "Start free trial",
    popular: false,
  },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="h-4 w-4 text-emerald-500 mx-auto" />;
  if (value === false) return <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />;
  return <span className="text-xs text-center text-muted-foreground">{value}</span>;
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
            Run your entire business.<br />
            <span className="text-[#E83A8E]">Hands-free if you want.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            One app for every practitioner, tradesperson, and educator — from solo starters to multi-location academies.
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
                  "relative bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-shadow hover:shadow-md",
                  plan.popular ? "border-[#E83A8E] shadow-[#E83A8E]/10" : "border-gray-100"
                )}
              >
                {plan.popular && (
                  <div className="bg-[#E83A8E] text-white text-[11px] font-bold text-center py-1.5 tracking-wide uppercase">
                    Most popular
                  </div>
                )}

                <div className={cn("bg-gradient-to-br p-6 space-y-4", plan.color)}>
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm", plan.accent)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900">{plan.name}</h2>
                      <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                    </div>
                  </div>

                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-gray-900">£{price}</span>
                    <span className="text-sm text-muted-foreground mb-1.5">/mo</span>
                    {annual && <span className="text-xs text-emerald-600 font-medium mb-1.5 ml-1">billed annually</span>}
                  </div>

                  <button
                    data-testid={`button-cta-${plan.id}`}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all",
                      plan.popular
                        ? "bg-[#E83A8E] text-white hover:bg-[#c42d77] shadow-sm"
                        : "bg-white text-gray-900 border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                    )}
                  >
                    {plan.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Features list */}
                <div className="p-5 space-y-2.5">
                  {FEATURES.map((f) => {
                    const val = f[plan.id as keyof typeof f];
                    if (val === false) return null;
                    return (
                      <div key={f.label} className="flex items-center gap-2.5">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="text-sm text-gray-700">{f.label}</span>
                        {typeof val === "string" && val !== "true" && (
                          <span className="ml-auto text-xs text-muted-foreground">{val}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Full comparison table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Full feature comparison</h2>
            <p className="text-sm text-muted-foreground">Every feature, side by side</p>
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
                    <td className="px-4 py-3 text-center"><FeatureValue value={f.starter} /></td>
                    <td className="px-4 py-3 text-center"><FeatureValue value={f.pro} /></td>
                    <td className="px-4 py-3 text-center"><FeatureValue value={f.scale} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* White label callout */}
        <div className="bg-gradient-to-br from-[#0d6b67] to-[#0a5553] rounded-2xl p-8 text-white text-center space-y-4">
          <Building2 className="h-10 w-10 mx-auto opacity-80" />
          <h2 className="text-2xl font-bold">White label on Scale</h2>
          <p className="text-white/80 max-w-xl mx-auto">
            Your business name. Your logo. Your colours. Your clients see
            <strong className="text-white"> your brand</strong> — with a discreet
            <span className="italic"> "Powered by PractiVault"</span> badge in the footer.
            Perfect for academies, franchise chains, and training companies.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {["Your business name in sidebar", "Your logo on client portal", "Your brand on invoice PDFs", "Your colours throughout", "Powered by PractiVault badge"].map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                <Check className="h-3.5 w-3.5 text-emerald-400" /> {item}
              </span>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
          {[
            { q: "Is there a free trial?", a: "Yes — every plan starts with a 14-day free trial. No card required." },
            { q: "Can I switch plans?", a: "Anytime. Upgrade or downgrade instantly from your Settings page." },
            { q: "What does white label include?", a: "Your business name, logo, and accent colour throughout the app, client portal, invoices, and consent forms. A small 'Powered by PractiVault' badge stays in the footer." },
            { q: "Do you support trades AND beauty?", a: "Absolutely — PractiVault is built for every practitioner and tradesperson. Plumbers, joiners, salon owners, aestheticians, CPD educators — all covered." },
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
