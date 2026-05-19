import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LogOut, CreditCard, Bot, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustry } from "@/contexts/IndustryContext";
import { Logo } from "@/components/Logo";
import ShellFooter from "@/components/ShellFooter";
import { cn } from "@/lib/utils";
import DeveloperAgentChat from "@/components/DeveloperAgentChat";
import { isWhatsAppEnabled } from "@/lib/features";

function useSidebarCounts() {
  const { data: leads } = useQuery<any[]>({ queryKey: ["/api/leads"], staleTime: 60_000 });
  const { data: quotes } = useQuery<any[]>({ queryKey: ["/api/quotes"], staleTime: 60_000 });
  const { data: consent } = useQuery<any[]>({ queryKey: ["/api/consent"], staleTime: 60_000 });
  const { data: afd } = useQuery<any[]>({ queryKey: ["/api/ai-front-desk"], staleTime: 60_000 });
  const { data: calls } = useQuery<any[]>({ queryKey: ["/api/calls"], staleTime: 60_000 });
  const waEnabled = isWhatsAppEnabled();
  const { data: waCount } = useQuery<{ count: number }>({
    queryKey: ["/api/whatsapp/unread-count"],
    enabled: waEnabled,
    staleTime: 30_000,
    refetchInterval: waEnabled ? 30_000 : false,
  });

  const newLeads = leads?.filter((l) => l.status === "new").length || 0;
  const pipelineValue =
    quotes
      ?.filter((q) => ["draft", "sent", "viewed"].includes(q.status))
      .reduce((s, q) => s + Number(q.amount || 0), 0) || 0;
  const pendingConsent =
    consent?.filter((c) => c.status === "pending" || c.status === "sent").length || 0;
  const today = new Date().toDateString();
  const afdToday = afd?.filter((r) => new Date(r.created_at).toDateString() === today).length || 0;
  const missedCallsToday =
    calls?.filter(
      (c) => c.status === "missed" && new Date(c.created_at).toDateString() === today,
    ).length || 0;
  const unreadWhatsApp = waCount?.count || 0;

  return { newLeads, pipelineValue, pendingConsent, afdToday, missedCallsToday, unreadWhatsApp };
}

function formatMoney(n: number) {
  if (n >= 1000) return `£${(n / 1000).toFixed(1)}k`;
  return `£${n.toFixed(0)}`;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const { config, businessName, hidePoweredBy } = useIndustry();
  const { newLeads, pipelineValue, pendingConsent, afdToday, missedCallsToday, unreadWhatsApp } = useSidebarCounts();
  const [agentOpen, setAgentOpen] = useState(false);

  const badgeValues: Record<string, string | number | undefined> = {
    newLeads: newLeads > 0 ? newLeads : undefined,
    pipelineValue: pipelineValue > 0 ? formatMoney(pipelineValue) : undefined,
    pendingConsent: pendingConsent > 0 ? pendingConsent : undefined,
    afdToday: afdToday > 0 ? afdToday : undefined,
    missedCallsToday: missedCallsToday > 0 ? missedCallsToday : undefined,
    unreadWhatsApp: unreadWhatsApp > 0 ? unreadWhatsApp : undefined,
  };

  const displayName = businessName?.trim() || "endoPulse";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className="w-64 flex flex-col border-r border-white/10 shrink-0"
        style={{ backgroundColor: config.sidebarBg, color: config.sidebarFg }}
      >
        {/* Logo + business name */}
        <div className="px-5 py-5 flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <div style={{ color: config.primaryHex }}>
              <Logo size={24} />
            </div>
            <span className="font-bold tracking-tight text-[14px]" style={{ color: config.sidebarFg }}>
              {displayName}
            </span>
          </div>
          {!hidePoweredBy && (
            <p className="text-[10px] pl-8 opacity-50">Powered by PractiVault</p>
          )}
          {/* Industry pill */}
          <div className="flex items-center gap-1.5 mt-1 pl-8">
            <span className="text-xs">{config.emoji}</span>
            <span className="text-[10px] opacity-60">{config.name}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {config.nav.map((item) => {
            const active = location === item.href || (item.href === "/dashboard" && location === "/");
            const Icon = item.icon;
            const badge = item.badgeKey ? badgeValues[item.badgeKey] : undefined;

            return (
              <Link 
                key={`${item.href}-${item.label}`} 
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all",
                  active ? "font-semibold" : "opacity-70 hover:opacity-100",
                )}
                style={
                  active
                    ? { backgroundColor: config.primaryHex, color: "#fff" }
                    : { color: config.sidebarFg }
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = `${config.primaryHex}22`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }
                }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badge !== undefined && (
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-md font-medium"
                    style={
                      active
                        ? { backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }
                        : { backgroundColor: `${config.primaryHex}22`, color: config.primaryHex }
                    }
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <Link 
            href="/pricing"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors mb-1 opacity-50 hover:opacity-80"
            style={{ color: config.sidebarFg }}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Plans &amp; Pricing</span>
          </Link>
          <div className="flex items-center gap-3 px-2 py-2">
            <div
              className="h-8 w-8 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: config.primaryHex }}
            >
              {(user?.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: config.sidebarFg }}>
                {user?.email?.split("@")[0] || "User"}
              </div>
              <div className="text-xs truncate opacity-50" style={{ color: config.sidebarFg }}>
                {user?.email}
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="h-8 w-8 flex items-center justify-center rounded-md transition-colors opacity-50 hover:opacity-100"
              style={{ color: config.sidebarFg }}
              title="Sign out"
              data-testid="button-signout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content + footer */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
        <ShellFooter />
      </div>

      {/* Floating Developer Agent Button */}
      <button
        onClick={() => setAgentOpen(!agentOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105"
        style={{ backgroundColor: config.primaryHex, color: "#fff" }}
        title="Developer Agent (Hermes + AI)"
      >
        <Bot className="h-6 w-6" />
      </button>

      {/* Developer Agent Sidebar */}
      {agentOpen && (
        <div className="fixed bottom-0 right-0 top-0 z-[60] flex w-96 flex-col border-l bg-white shadow-2xl" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
            <div className="flex items-center gap-2 font-semibold">
              <Bot className="h-5 w-5" style={{ color: config.primaryHex }} />
              Developer Agent
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // TODO: Send stop signal to backend
                  setAgentOpen(false);
                }}
                className="rounded px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Stop
              </button>
              <button
                onClick={() => setAgentOpen(false)}
                className="rounded p-1 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <DeveloperAgentChat onClose={() => setAgentOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
