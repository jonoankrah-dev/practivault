import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, PlayCircle, RefreshCw, X, Zap } from "lucide-react";
import { safiMemoryApi } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type ActivityEvent = {
  id: string;
  source: string;
  event_type: string;
  title: string;
  summary: string | null;
  created_at: string;
  created_by: string;
};

type AgentAction = {
  id: string;
  action_type: string;
  channel: string | null;
  title: string;
  draft_body: string | null;
  status: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SafiMemory() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const eventsQuery = useQuery({
    queryKey: ["/api/activity-events", "recent"],
    queryFn: () => safiMemoryApi.recentEvents(50),
    refetchInterval: 30_000,
  });
  const actionsQuery = useQuery({
    queryKey: ["/api/agent-actions", "pending"],
    queryFn: () => safiMemoryApi.pendingActions(),
    refetchInterval: 30_000,
  });
  const approvedQuery = useQuery({
    queryKey: ["/api/agent-actions", "approved"],
    queryFn: () => safiMemoryApi.approvedActions(),
    refetchInterval: 30_000,
  });

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["/api/activity-events", "recent"] }),
      qc.invalidateQueries({ queryKey: ["/api/agent-actions", "pending"] }),
      qc.invalidateQueries({ queryKey: ["/api/agent-actions", "approved"] }),
    ]);
  };

  async function updateAction(id: string, status: "approved" | "rejected") {
    try {
      if (status === "approved") {
        await safiMemoryApi.approveAction(id);
        toast({ title: "Approved", description: "Safi can now pick this up when the executor is added." });
      } else {
        const reason = window.prompt("Reason for rejection? (optional)") ?? undefined;
        await safiMemoryApi.rejectAction(id, reason);
        toast({ title: "Rejected", description: "Safi will learn from that decision." });
      }
      await refresh();
    } catch (e: any) {
      toast({ title: "Could not update action", description: e.message, variant: "destructive" });
    }
  }

  async function prepareExecution(id: string) {
    try {
      await safiMemoryApi.prepareExecution(id);
      toast({
        title: "Prepared",
        description: "This is now ready for the future executor. Nothing has been sent or posted.",
      });
      await refresh();
    } catch (e: any) {
      toast({ title: "Could not prepare action", description: e.message, variant: "destructive" });
    }
  }

  const pending = actionsQuery.data?.actions as AgentAction[] | undefined;
  const approved = approvedQuery.data?.actions as AgentAction[] | undefined;
  const events = eventsQuery.data?.events as ActivityEvent[] | undefined;
  const loading = actionsQuery.isLoading || approvedQuery.isLoading || eventsQuery.isLoading;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#E83A8E]/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-[#E83A8E]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Safi Memory</h1>
            <p className="text-xs text-muted-foreground">
              Activity Safi can learn from, plus actions waiting for your approval.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} data-testid="button-refresh-safi-memory">
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="p-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">Pending approval</h2>
              <p className="text-xs text-muted-foreground">
                Safi prepares these, but nothing sends or posts until you approve.
              </p>
            </div>
            <Badge variant="outline">{pending?.length ?? 0}</Badge>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && (!pending || pending.length === 0) && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing waiting right now.
            </div>
          )}
          <div className="space-y-3">
            {pending?.map((action) => (
              <article key={action.id} className="rounded-xl border p-3" data-testid={`card-agent-action-${action.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">{action.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {action.action_type}
                      {action.channel ? ` · ${action.channel}` : ""} · {formatDate(action.created_at)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    <Clock className="h-3 w-3 mr-1" />
                    {action.status}
                  </Badge>
                </div>
                {action.draft_body && (
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
                    {action.draft_body}
                  </pre>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => updateAction(action.id, "approved")} data-testid={`button-approve-${action.id}`}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateAction(action.id, "rejected")} data-testid={`button-reject-${action.id}`}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Reject
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">Approved · awaiting execution prep</h2>
              <p className="text-xs text-muted-foreground">
                Approved actions can be prepared for the future executor. Nothing sends or posts from this button.
              </p>
            </div>
            <Badge variant="outline">{approved?.length ?? 0}</Badge>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && (!approved || approved.length === 0) && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing approved and waiting right now.
            </div>
          )}
          <div className="space-y-3">
            {approved?.map((action) => (
              <article key={action.id} className="rounded-xl border p-3" data-testid={`card-approved-agent-action-${action.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">{action.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {action.action_type}
                      {action.channel ? ` · ${action.channel}` : ""} · {formatDate(action.created_at)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {action.status}
                  </Badge>
                </div>
                {action.draft_body && (
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
                    {action.draft_body}
                  </pre>
                )}
                <div className="mt-3">
                  <Button size="sm" onClick={() => prepareExecution(action.id)} data-testid={`button-prepare-execution-${action.id}`}>
                    <PlayCircle className="h-3.5 w-3.5 mr-1" />
                    Prepare for execution
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <p className="text-xs text-muted-foreground">
              The start of PractiVault’s business memory layer.
            </p>
          </div>
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && (!events || events.length === 0) && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No memory events yet. WhatsApp and Social Studio will start filling this.
            </div>
          )}
          <div className="divide-y">
            {events?.map((event) => (
              <article key={event.id} className="py-3" data-testid={`card-activity-event-${event.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium">{event.title}</h3>
                    {event.summary && <p className="text-xs text-muted-foreground mt-1">{event.summary}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {event.source} · {event.event_type} · by {event.created_by}
                    </p>
                  </div>
                  <time className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDate(event.created_at)}
                  </time>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
