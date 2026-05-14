import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIndustry } from "@/contexts/IndustryContext";
import { ArrowLeft, Calendar, History } from "lucide-react";
import type { Client } from "@shared/schema";

type ClientDetailResponse = {
  client: Client;
  bookings: any[];
  timeline: any[];
};

function formatMoney(n: number) {
  return `£${Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export default function ClientDetail({ clientId }: { clientId: string }) {
  const { config } = useIndustry();
  const label = config.labels.clients;

  const { data, isLoading, isError, error, refetch } = useQuery<ClientDetailResponse>({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

  const c = data?.client;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" asChild>
          <Link href="/clients">
            <a aria-label={`Back to ${label}`}>
              <ArrowLeft className="h-4 w-4" />
            </a>
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <Skeleton className="h-8 w-64 mb-2" />
          ) : isError ? (
            <div className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load"}
              <Button variant="outline" size="sm" className="ml-3" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <PageHeader
              title={c?.name || "Client"}
              subtitle={[c?.email, c?.phone].filter(Boolean).join(" · ") || "No contact on file"}
              actions={c && <StatusBadge status={c.stage} />}
            />
          )}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
        </div>
      )}

      {!isLoading && c && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">LTV</CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold tabular-nums">{formatMoney(c.ltv)}</CardContent>
            </Card>
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-foreground/90">{c.address || "—"}</CardContent>
            </Card>
          </div>

          {c.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{c.notes}</CardContent>
            </Card>
          )}

          <Tabs defaultValue="bookings" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="bookings" className="gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Bookings
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                Timeline
              </TabsTrigger>
            </TabsList>
            <TabsContent value="bookings" className="mt-4">
              {!data?.bookings?.length ? (
                <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">No bookings yet.</p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                  {data.bookings.map((b: any) => (
                    <li key={b.id} className="px-4 py-3 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium tabular-nums">{b.date}</span>
                      <span className="text-muted-foreground">{b.time?.slice(0, 5)}</span>
                      <span className="flex-1 min-w-0 truncate">{b.treatments?.name || "Treatment"}</span>
                      <span className="tabular-nums">{formatMoney(Number(b.treatments?.price || 0))}</span>
                      <StatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
              {!data?.timeline?.length ? (
                <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">No timeline events yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.timeline.map((ev: any) => (
                    <li key={ev.id} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span className="uppercase tracking-wide">{ev.type?.replace(/_/g, " ")}</span>
                        <span>{ev.created_at ? new Date(ev.created_at).toLocaleString("en-GB") : ""}</span>
                      </div>
                      <p className="mt-1 text-foreground/90">{ev.description}</p>
                      {ev.amount != null && Number(ev.amount) !== 0 && (
                        <p className="text-xs font-medium mt-1 tabular-nums">{formatMoney(Number(ev.amount))}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground">
            To edit or remove this record, use{" "}
            <Link href="/clients" className="text-primary underline">
              {label}
            </Link>{" "}
            and the row actions.
          </p>
        </>
      )}
    </div>
  );
}
