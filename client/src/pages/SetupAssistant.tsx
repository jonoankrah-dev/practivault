import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INDUSTRIES = [
  { id: "aesthetics", name: "Aesthetics & Beauty", emoji: "🌿" },
  { id: "hair", name: "Hair & Nail Salon", emoji: "💇" },
  { id: "plumber", name: "Plumbing", emoji: "🔧" },
  { id: "electrician", name: "Electrician", emoji: "⚡" },
  { id: "joiner", name: "Joiner & Carpenter", emoji: "🪵" },
  { id: "landscaper", name: "Landscaper & Lawncare", emoji: "🌱" },
  { id: "cpd", name: "CPD & Training Academy", emoji: "🎓" },
  { id: "health", name: "Health & Wellness", emoji: "🏥" },
  { id: "builder", name: "Builder & Bricklayer", emoji: "🧱" },
  { id: "hvac", name: "HVAC & Machine Servicing", emoji: "❄️" },
  { id: "decorator", name: "Decorator & Painter", emoji: "🖌️" },
  { id: "other", name: "Other / General Business", emoji: "🏢" },
];

interface Props {
  initialIndustry?: string;
  onComplete: () => void;
}

export default function SetupAssistant({ initialIndustry, onComplete }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;

  // Step 1 — Business name
  const [businessName, setBusinessName] = useState("");

  // Step 2 — Industry
  const [industry, setIndustry] = useState(initialIndustry || "");

  // Step 3 — Business details
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");

  // Step 4 — First client
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAdded, setClientAdded] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const progress = step === TOTAL_STEPS ? 100 : ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  async function saveAndFinish() {
    if (!user) return;
    setSaving(true);
    await supabase.from("users").update({
      business_name: businessName || null,
      industry: industry || null,
      business_phone: phone || null,
      business_address: address || null,
      business_website: website || null,
      setup_complete: true,
    }).eq("id", user.id);
    setSaving(false);
    onComplete();
  }

  async function addClient() {
    if (!user || !clientName.trim()) return;
    setClientLoading(true);
    await supabase.from("clients").insert({
      user_id: user.id,
      name: clientName.trim(),
      email: clientEmail.trim() || null,
      phone: clientPhone.trim() || null,
    });
    setClientLoading(false);
    setClientAdded(true);
  }

  async function skipToFinish() {
    await saveAndFinish();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-6 pb-4 flex items-center gap-3 border-b border-gray-100">
          <div className="h-9 w-9 rounded-xl bg-[#E83A8E] flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white fill-current">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#E83A8E] uppercase tracking-wide mb-0.5">
              Setup Assistant
            </p>
            <p className="text-xs text-gray-400">Step {step} of {TOTAL_STEPS} — {Math.round(progress)}% complete</p>
          </div>
        </div>

        {/* Step indicators + progress bar */}
        <div className="px-8 pt-4 pb-1">
          {/* Step dots */}
          <div className="flex items-center justify-between mb-2">
            {["Business", "Industry", "Details", "Client", "Done"].map((label, i) => {
              const s = i + 1;
              const done = step > s;
              const active = step === s;
              return (
                <div key={s} className="flex flex-col items-center gap-1" style={{ width: "18%" }}>
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      done
                        ? "bg-[#E83A8E] text-white"
                        : active
                        ? "bg-[#E83A8E] text-white ring-4 ring-[#E83A8E]/20"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {done ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s
                    )}
                  </div>
                  <span className={`text-[10px] font-medium leading-tight text-center ${
                    done || active ? "text-[#E83A8E]" : "text-gray-400"
                  }`}>{label}</span>
                </div>
              );
            })}
          </div>
          {/* Progress bar track */}
          <div className="relative h-1.5 bg-gray-100 rounded-full mx-4 -mt-6 mb-6" style={{ zIndex: -1 }}>
            <div
              className="absolute inset-y-0 left-0 bg-[#E83A8E] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="px-8 pt-4 pb-8">

          {/* ── STEP 1: Business name ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-[#241f19] leading-tight">
                  Welcome to PractiVault! 👋
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  Let's get you set up in about 2 minutes. First — what's your business called?
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-name">Business name</Label>
                <Input
                  id="biz-name"
                  placeholder="e.g. Dave's Plumbing Pro"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-gray-400">
                  This appears in your sidebar — "Dave's Plumbing Pro · Powered by PractiVault"
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 bg-[#E83A8E] hover:bg-[#c42d77] text-white"
                  onClick={() => setStep(2)}
                  disabled={!businessName.trim()}
                >
                  Next →
                </Button>
                <Button variant="ghost" className="text-gray-400 text-sm" onClick={() => setStep(2)}>
                  Skip
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Industry ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-[#241f19] leading-tight">
                  What type of business are you?
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  We'll personalise PractiVault to suit your industry.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => setIndustry(ind.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all text-sm font-medium ${
                      industry === ind.id
                        ? "border-[#E83A8E] bg-[#E83A8E]/5 text-[#E83A8E]"
                        : "border-gray-100 bg-gray-50 text-[#241f19] hover:border-[#E83A8E]/40"
                    }`}
                  >
                    <span className="text-lg">{ind.emoji}</span>
                    <span className="leading-tight">{ind.name}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" className="text-gray-400 text-sm px-3" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button
                  className="flex-1 bg-[#E83A8E] hover:bg-[#c42d77] text-white"
                  onClick={() => setStep(3)}
                  disabled={!industry}
                >
                  Next →
                </Button>
                <Button variant="ghost" className="text-gray-400 text-sm" onClick={() => setStep(3)}>
                  Skip
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Business details ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-[#241f19] leading-tight">
                  A few more details
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  These appear on your invoices and client communications. All optional.
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Business phone</Label>
                  <Input
                    placeholder="e.g. 07700 900000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Business address</Label>
                  <Input
                    placeholder="e.g. 12 Main Street, Manchester, M1 1AA"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Website <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input
                    placeholder="e.g. www.davesplumbing.co.uk"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" className="text-gray-400 text-sm px-3" onClick={() => setStep(2)}>
                  ← Back
                </Button>
                <Button
                  className="flex-1 bg-[#E83A8E] hover:bg-[#c42d77] text-white"
                  onClick={() => setStep(4)}
                >
                  Next →
                </Button>
                <Button variant="ghost" className="text-gray-400 text-sm" onClick={() => setStep(4)}>
                  Skip
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 4: First client ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-[#241f19] leading-tight">
                  Add your first client
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  Get a head start — add one client now. You can import more later.
                </p>
              </div>
              {clientAdded ? (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">{clientName} added!</p>
                    <p className="text-xs text-green-600">They're waiting for you in the Clients page.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Client name <span className="text-[#E83A8E]">*</span></Label>
                    <Input
                      placeholder="e.g. Sarah Johnson"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Input
                      type="email"
                      placeholder="e.g. sarah@example.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Input
                      placeholder="e.g. 07700 900000"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full bg-[#0d6b67] hover:bg-[#0a5a57] text-white"
                    onClick={addClient}
                    disabled={!clientName.trim() || clientLoading}
                  >
                    {clientLoading ? "Adding…" : "Add client"}
                  </Button>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <Button variant="ghost" className="text-gray-400 text-sm px-3" onClick={() => setStep(3)}>
                  ← Back
                </Button>
                <Button
                  className="flex-1 bg-[#E83A8E] hover:bg-[#c42d77] text-white"
                  onClick={() => setStep(5)}
                >
                  {clientAdded ? "Next →" : "Skip for now →"}
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 5: All done ── */}
          {step === 5 && (
            <div className="space-y-5 text-center">
              <div className="text-6xl py-2">🎉</div>
              <div>
                <h2 className="text-2xl font-bold text-[#241f19] leading-tight">
                  You're all set!
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  {businessName ? `${businessName} is` : "Your account is"} ready to go. Here's what to explore first:
                </p>
              </div>
              <div className="text-left space-y-2">
                {[
                  { icon: "📅", label: "Bookings", desc: "Schedule your first appointment" },
                  { icon: "👥", label: "Clients", desc: "View and manage your client list" },
                  { icon: "🧾", label: "Invoices", desc: "Send your first invoice in seconds" },
                  { icon: "🤖", label: "AI Front Desk", desc: "Let Buddy handle your enquiries" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 bg-[#f6f3ef] rounded-xl px-4 py-3">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-[#241f19]">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                className="w-full bg-[#E83A8E] hover:bg-[#c42d77] text-white text-base py-5"
                onClick={saveAndFinish}
                disabled={saving}
              >
                {saving ? "Saving…" : "Go to my dashboard →"}
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
