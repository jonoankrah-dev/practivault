import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, Users, Sparkles, FileText, AlertCircle, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type Stats = {
  todaysRevenue: number;
  activeClientsCount: number;
  newLeadsCount: number;
  pendingQuotesValue: number;
  pendingQuotesCount: number;
  todaysBookings: any[];
  highScoreLeads: any[];
  revenueByMonth: { key: string; label: string; revenue: number }[];
};

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "berry",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  tone?: "berry" | "teal" | "amber" | "zinc";
}) {
  const toneBg = {
    berry: "bg-primary/10 text-primary",
    teal: "bg-secondary/10 text-secondary",
    amber: "bg-amber-100 text-amber-700",
    zinc: "bg-zinc-100 text-zinc-600",
  }[tone];
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </div>
          <div className="text-xl font-semibold mt-1 tracking-tight" data-testid={`kpi-${label}`}>
            {value}
          </div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${toneBg}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<Stats>({
    queryKey: ["/api/dashboard/stats"],
  });
  const todaysBookings = data?.todaysBookings ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back — here's what's happening today, ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`}
      />

      {isError && (
        <div
          className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <span className="min-w-0">
              Could not load dashboard data.{error instanceof Error ? ` ${error.message}` : ""}
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[108px] rounded-xl" />)
        ) : (
          <>
            <KpiCard
              label="Today's Revenue"
              value={`£${Math.round(data?.todaysRevenue || 0).toLocaleString()}`}
              sub={`${todaysBookings.length} bookings today`}
              icon={TrendingUp}
              tone="berry"
            />
            <KpiCard
              label="Active Clients"
              value={`${data?.activeClientsCount ?? 0}`}
              sub="Including VIP + prospects"
              icon={Users}
              tone="teal"
            />
            <KpiCard
              label="New Leads"
              value={`${data?.newLeadsCount ?? 0}`}
              sub="Awaiting first contact"
              icon={Sparkles}
              tone="amber"
            />
            <KpiCard
              label="Pending Quotes"
              value={`£${Math.round(data?.pendingQuotesValue || 0).toLocaleString()}`}
              sub={`${data?.pendingQuotesCount ?? 0} open`}
              icon={FileText}
              tone="zinc"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's bookings */}
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Today's Bookings</h2>
            <Link
              href="/bookings"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : !todaysBookings.length ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No bookings scheduled for today.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {todaysBookings.map((b: any) => (
                <div key={b.id} className="flex items-center gap-4 py-3">
                  <div className="w-14 text-sm font-medium tabular-nums text-foreground">
                    {b.time?.slice(0, 5)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{b.clients?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {b.treatments?.name} · {b.treatments?.duration_mins}min
                    </div>
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    £{Number(b.treatments?.price || 0).toLocaleString()}
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Suggestions */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">AI Suggestions</h2>
          </div>

          <div className="space-y-3">
            {data?.highScoreLeads && data.highScoreLeads.length > 0 ? (
              data.highScoreLeads.map((l: any) => (
                <div
                  key={l.id}
                  className="border border-card-border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium">{l.name}</div>
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {l.ai_score}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    High-score lead from {l.source} — follow up soon
                  </p>
                  <Link href="/leads" className="text-xs text-primary hover:underline">
                    Reply now →
                  </Link>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground flex items-start gap-2 p-3 bg-muted/40 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>No high-priority leads right now. Nice work keeping inbox zero!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Revenue — Last 6 months</h2>
          <span className="text-xs text-muted-foreground">confirmed + completed</span>
        </div>
        <div style={{ height: 260 }}>
          {isLoading ? (
            <Skeleton className="h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.revenueByMonth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: any) => [`£${Number(v).toLocaleString()}`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
