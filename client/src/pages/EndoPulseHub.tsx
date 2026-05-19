import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ClipboardList, PoundSterling, Sparkles, Wrench } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";

type EndoPulseSummary = {
  brandName: string;
  period: { month: string; monthStart: string };
  treatments: {
    total: number;
    active: number;
    requiringCompliance: number;
    items: Array<{ id: string; name: string; price: number; duration_mins: number; is_active: boolean }>;
  };
  bookings: {
    thisMonth: number;
    completedThisMonth: number;
    upcoming: number;
    revenueThisMonth: number;
    recent: Array<{
      id: string;
      date: string;
      time: string;
      status: string;
      clients?: { name?: string | null } | null;
      treatments?: { name?: string | null; price?: number | null } | null;
    }>;
  };
  leads: { thisMonth: number; openThisMonth: number };
  franchise: { hubStatus: string; nextControls: string[] };
  generatedAt: string;
};

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: any;
}) {
  return (
    <Card className="border-[#E83A8E]/10">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
          </div>
          <div className="rounded-xl bg-[#E83A8E]/10 p-2 text-[#E83A8E]">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EndoPulseHub() {
  const { data, isLoading, error } = useQuery<EndoPulseSummary>({
    queryKey: ["/api/endopulse/summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/endopulse/summary");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (error) {
    return (
      <div className="p-8">
        <PageHeader title="EndoPulse Hub" subtitle="Franchise operating layer" />
        <div className="mt-4 text-sm text-red-600">Could not load EndoPulse data.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <PageHeader
        title="EndoPulse Hub"
        subtitle="The operating home for EndoPulse treatments, franchise standards, and machine-led services."
      />

      <div className="rounded-2xl border border-[#E83A8E]/20 bg-gradient-to-br from-[#E83A8E]/10 to-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[#E83A8E]">
              Franchise foundation
            </div>
            <div className="mt-1 text-xl font-semibold text-foreground">
              EndoPulse is now tracked as a controlled service line.
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Any treatment tagged as EndoPulse can be reported separately from general services, labelled in
              bookings, and later tied to franchisee agreements, machine serials, territory rules, and brand
              standards.
            </p>
          </div>
          <div className="rounded-full border border-[#E83A8E]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#E83A8E]">
            {data?.brandName ?? "EndoPulse"} service line
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="EndoPulse services"
              value={`${data?.treatments.active ?? 0}`}
              sub={`${data?.treatments.total ?? 0} tagged treatment records`}
              icon={BadgeCheck}
            />
            <MetricCard
              label="Bookings this month"
              value={`${data?.bookings.thisMonth ?? 0}`}
              sub={`${data?.bookings.upcoming ?? 0} upcoming`}
              icon={ClipboardList}
            />
            <MetricCard
              label="Completed this month"
              value={`${data?.bookings.completedThisMonth ?? 0}`}
              sub={`£${Math.round(data?.bookings.revenueThisMonth ?? 0).toLocaleString()} completed value`}
              icon={PoundSterling}
            />
            <MetricCard
              label="EndoPulse leads"
              value={`${data?.leads.openThisMonth ?? 0}`}
              sub={`${data?.leads.thisMonth ?? 0} enquiries this month`}
              icon={Sparkles}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold">Tagged EndoPulse treatments</h2>
                <div className="mt-4 divide-y divide-border">
                  {(data?.treatments.items ?? []).length === 0 ? (
                    <div className="py-6 text-sm text-muted-foreground">
                      No EndoPulse treatments are tagged yet. Add or seed treatments with EndoPulse in the name,
                      or mark them as EndoPulse when editing services.
                    </div>
                  ) : (
                    data!.treatments.items.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{t.name}</div>
                          <div className="text-xs text-muted-foreground">{t.duration_mins}min service</div>
                        </div>
                        <div className="text-sm font-semibold">£{Number(t.price || 0).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-[#E83A8E]" />
                  <h2 className="text-sm font-semibold">Franchise controls coming next</h2>
                </div>
                <div className="mt-4 space-y-2">
                  {(data?.franchise.nextControls ?? []).map((control) => (
                    <div key={control} className="rounded-xl border bg-muted/30 px-3 py-2 text-sm capitalize">
                      {control}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  This page is the first operating layer. The next step is to make franchisee accounts,
                  machine serials, territories, training status, and brand standards enforceable here.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
