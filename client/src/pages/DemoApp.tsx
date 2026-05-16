/**
 * DemoApp — wraps the full app in demo mode.
 * Signs in as the pre-created demo user for the chosen industry.
 * Demo data is pre-seeded server-side; no client-side seeding needed.
 */

import { useState, useEffect, useRef, createContext, useContext } from "react";
import { useLocation, Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";
import { getIndustryConfig } from "@/lib/industryConfig";
import { AuthContext } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Pages (same ones used in real app)
import Dashboard from "@/pages/Dashboard";
import Bookings from "@/pages/Bookings";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import Leads from "@/pages/Leads";
import Quotes from "@/pages/Quotes";
import Invoices from "@/pages/Invoices";
import Consent from "@/pages/Consent";
import { Link } from "wouter";
import {
  LayoutDashboard, CalendarDays, Users, Sparkles,
  FileText, ShieldCheck, Receipt, X, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { setAuthToken } from "@/lib/queryClient";

// ─── Demo context ────────────────────────────────────────────────────────────

interface DemoCtx {
  token: string | null;
  industry: string;
  businessName: string;
}
const DemoContext = createContext<DemoCtx>({ token: null, industry: "", businessName: "" });
export function useDemoContext() { return useContext(DemoContext); }

// ─── Industry meta ───────────────────────────────────────────────────────────

const INDUSTRY_META: Record<string, { name: string; businessName: string; emoji: string }> = {
  aesthetics: { name: "Aesthetics & Beauty", businessName: "Glow Studio",      emoji: "🌿" },
  hair:       { name: "Hair & Nail Salon",   businessName: "Luxe Salon",       emoji: "💇" },
  plumber:    { name: "Plumbing",            businessName: "Premier Plumbing", emoji: "🔧" },
  electrician:{ name: "Electrician",         businessName: "Spark Electric",   emoji: "⚡" },
  joiner:     { name: "Joiner & Carpenter",  businessName: "Oak & Co Joinery", emoji: "🪵" },
  landscaper: { name: "Landscaper",          businessName: "GreenScape",       emoji: "🌱" },
  cpd:        { name: "CPD Academy",         businessName: "ProCert Academy",  emoji: "🎓" },
  health:     { name: "Health & Wellness",   businessName: "Balance Clinic",   emoji: "🏥" },
  builder:    { name: "Builder",             businessName: "Solid Build Co",   emoji: "🧱" },
};

// ─── Demo sign-in function ────────────────────────────────────────────────────
// Data is pre-seeded server-side — just sign in and show it.

async function signInAsDemo(industry: string): Promise<{ token: string; userId: string }> {
  const demoEmail = `demo-${industry}@practivault-demo.app`;
  const demoPassword = `DemoPass2026!${industry}`;

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword,
  });

  if (signInError || !signInData.session) {
    throw new Error(`Could not sign in to demo account: ${signInError?.message || "No session returned"}`);
  }

  return {
    token: signInData.session.access_token,
    userId: signInData.session.user.id,
  };
}

// ─── Demo sidebar ────────────────────────────────────────────────────────────

const DEMO_NAV = [
  { href: "dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "bookings",  label: "Bookings",   icon: CalendarDays },
  { href: "clients",   label: "Clients",    icon: Users },
  { href: "leads",     label: "Leads",      icon: Sparkles },
  { href: "quotes",    label: "Quotes",     icon: FileText },
  { href: "invoices",  label: "Invoices",   icon: Receipt },
  { href: "consent",   label: "Consent",    icon: ShieldCheck },
];

function DemoSidebar({ industry, businessName, base }: { industry: string; businessName: string; base: string }) {
  const [location] = useLocation();
  const cfg = getIndustryConfig(industry);
  // Use industry-specific nav items that match their vocabulary
  const navItems = cfg.nav.filter(item =>
    ["/bookings","/clients","/leads","/quotes","/consent","/invoices","/dashboard"].includes(item.href)
  );

  return (
    <aside
      className="w-60 flex flex-col border-r border-white/10 shrink-0"
      style={{ backgroundColor: cfg.sidebarBg, color: cfg.sidebarFg }}
    >
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{cfg.emoji}</span>
          <div>
            <div className="font-bold text-[13px] leading-tight" style={{ color: cfg.sidebarFg }}>{businessName}</div>
            <div className="text-[10px] opacity-50 leading-tight">Powered by PractiVault</div>
          </div>
        </div>
        <div className="mt-1.5 pl-8">
          <span className="text-[10px] opacity-50">{cfg.name}</span>
        </div>
      </div>
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map((item) => {
          const active = location === `${base}/${item.href.replace("/","")}` || location.startsWith(`${base}/${item.href.replace("/","")}`);
          const Icon = item.icon;
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={`${base}${item.href}`}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all"
              style={
                active
                  ? { backgroundColor: cfg.primaryHex, color: "#fff", fontWeight: 600 }
                  : { color: cfg.sidebarFg, opacity: 0.75 }
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <Link
          href="/demo"
          className="text-xs flex items-center gap-1.5 transition-colors opacity-50 hover:opacity-80"
          style={{ color: cfg.sidebarFg }}
        >
          ← Choose a different industry
        </Link>
      </div>
    </aside>
  );
}

// ─── Demo Banner ─────────────────────────────────────────────────────────────

function DemoBanner({ industryName, industry, onClose }: { industryName: string; industry: string; onClose: () => void }) {
  return (
    <div className="bg-[#E83A8E] text-white px-4 py-2.5 flex items-center justify-between gap-4 text-sm shrink-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold">🎯 Live Demo</span>
        <span className="text-white/70">|</span>
        <span className="text-white/90">You're viewing the <strong>{industryName}</strong> demo — pre-loaded with sample clients, bookings, invoices and leads.</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <a
          href={`/#/login?industry=${industry}`}
          className="inline-flex items-center gap-1.5 bg-white text-[#E83A8E] text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-white/90 transition-colors"
        >
          Start free trial <ExternalLink className="h-3 w-3" />
        </a>
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Demo inner router ────────────────────────────────────────────────────────

function DemoRouter({ base }: { base: string }) {
  return (
    <Switch>
      <Route path={`${base}/dashboard`} component={Dashboard} />
      <Route path={`${base}/bookings`}  component={Bookings} />
      <Route path={`${base}/clients/:id`}>
        {(params) => <ClientDetail clientId={params.id} clientsListHref={`${base}/clients`} />}
      </Route>
      <Route path={`${base}/clients`}   component={Clients} />
      <Route path={`${base}/leads`}     component={Leads} />
      <Route path={`${base}/quotes`}    component={Quotes} />
      <Route path={`${base}/invoices`}  component={Invoices} />
      <Route path={`${base}/consent`}   component={Consent} />
      <Route path={base}>
        <Redirect to={`${base}/dashboard`} />
      </Route>
    </Switch>
  );
}

// ─── Main DemoApp component ───────────────────────────────────────────────────

export default function DemoApp({ industry }: { industry: string }) {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [pendingNavigate, setPendingNavigate] = useState<string | null>(null);
  // Store the real user's session BEFORE we sign in as demo (captured synchronously)
  const originalSessionRef = useRef<{ access_token: string; refresh_token: string } | null>(null);

  // Read optional label/emoji overrides from query string (set by two-level picker)
  const hashQuery = window.location.hash.includes("?") 
    ? new URLSearchParams(window.location.hash.split("?")[1])
    : new URLSearchParams();
  const labelOverride = hashQuery.get("label");
  const emojiOverride = hashQuery.get("emoji");

  const meta = INDUSTRY_META[industry] || INDUSTRY_META["aesthetics"];
  const displayName = labelOverride || meta.name;
  const displayEmoji = emojiOverride || meta.emoji;
  const base = `/demo/${industry}`;

  // Apply industry theme colours for demo
  useEffect(() => {
    const cfg = getIndustryConfig(industry);
    const root = document.documentElement;
    root.style.setProperty("--sidebar-primary", cfg.primaryHsl);
    root.style.setProperty("--primary", cfg.primaryHsl);
    return () => {
      // Reset to default on unmount
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--primary");
    };
  }, [industry]);

  // Sign in as demo user, then show pre-seeded data
  useEffect(() => {
    setLoading(true);
    setError(null);

    // Capture real user's session FIRST, then sign in as demo
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      // If a REAL (non-demo) user is already logged in, send them to their dashboard
      if (s?.user?.email && !s.user.email.endsWith("@practivault-demo.app")) {
        window.location.hash = "/dashboard";
        return Promise.reject("real-user");
      }
      if (s?.access_token && s?.refresh_token) {
        originalSessionRef.current = {
          access_token: s.access_token,
          refresh_token: s.refresh_token,
        };
      }
      // Chain the demo sign-in AFTER session is captured
      return signInAsDemo(industry);
    })
      .then((data) => {
        setToken(data.token);
        setAuthToken(data.token);
        queryClient.clear();
        setLoading(false);
      })
      .catch((e) => {
        if (e === "real-user") return; // redirecting to dashboard, not an error
        setError(e.message);
        setLoading(false);
      });

    return () => {
      // Sign out demo user and restore the real user's session
      const orig = originalSessionRef.current;
      supabase.auth.signOut().then(() => {
        if (orig?.access_token && orig?.refresh_token) {
          supabase.auth.setSession({
            access_token: orig.access_token,
            refresh_token: orig.refresh_token,
          });
        }
      });
      setAuthToken(null);
      queryClient.clear();
    };
  }, [industry]);

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f3ef] flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 rounded-full border-4 border-[#E83A8E]/30 border-t-[#E83A8E] animate-spin" />
        <div className="text-center">
          <p className="text-sm font-semibold text-[#241f19]">Loading your {displayName} demo…</p>
          <p className="text-xs text-gray-400 mt-1">Signing in and loading your data…</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f3ef] flex flex-col items-center justify-center gap-4 px-6">
        <div className="text-4xl">⚠️</div>
        <div className="text-center max-w-sm">
          <p className="text-sm font-semibold text-[#241f19] mb-1">Couldn't load demo</p>
          <p className="text-xs text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => navigate("/demo")}
            className="text-sm font-semibold text-[#E83A8E] hover:underline"
          >
            ← Back to industry picker
          </button>
        </div>
      </div>
    );
  }

  // Intercept signOut so we can show a warning first
  const demoSignOut = async () => {
    setShowLogoutWarning(true);
  };

  const confirmLogout = async () => {
    setShowLogoutWarning(false);
    setAuthToken(null);
    queryClient.clear();
    await supabase.auth.signOut();
    // Restore real user session if we captured it
    const orig = originalSessionRef.current;
    if (orig?.access_token && orig?.refresh_token) {
      await supabase.auth.setSession({
        access_token: orig.access_token,
        refresh_token: orig.refresh_token,
      });
      navigate("/dashboard");
    } else {
      navigate("/demo");
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {/* Override signOut in AuthContext so AppShell uses our intercepted version */}
        <AuthContext.Consumer>
          {(auth) => (
            <AuthContext.Provider value={auth ? { ...auth, signOut: demoSignOut } : auth!}>
        <DemoContext.Provider value={{ token, industry, businessName: meta.businessName }}>

          {/* Logout warning dialog */}
          <AlertDialog open={showLogoutWarning} onOpenChange={setShowLogoutWarning}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave the demo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Any changes you made during this demo session will be lost — the demo resets to its original data each time.
                  You can come back and try a different industry whenever you like.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay in demo</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmLogout}
                  className="bg-[#E83A8E] hover:bg-[#c42d77] text-white"
                >
                  Leave &amp; pick another industry
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex flex-col h-screen overflow-hidden bg-background">

            {/* Pink banner */}
            {bannerOpen && (
              <DemoBanner
                industryName={displayName}
                industry={industry}
                onClose={() => setBannerOpen(false)}
              />
            )}

            {!bannerOpen && (
              <button
                onClick={() => setBannerOpen(true)}
                className="bg-[#E83A8E]/10 text-[#E83A8E] text-xs font-medium px-4 py-1.5 text-center hover:bg-[#E83A8E]/15 transition-colors"
              >
                🎯 Demo mode — <a href={`/#/login?industry=${industry}`} className="underline">Start free trial</a>
              </button>
            )}

            {/* App body */}
            <div className="flex flex-1 min-h-0">
              <DemoSidebar
                industry={industry}
                businessName={meta.businessName}
                base={base}
              />
              <main className="flex-1 overflow-y-auto">
                <DemoRouter base={base} />
              </main>
            </div>
          </div>
        </DemoContext.Provider>
            </AuthContext.Provider>
          )}
        </AuthContext.Consumer>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
