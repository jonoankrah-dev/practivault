import type { Express, Request, Response } from "express";
import {
  recordActivityEvent,
  queueAgentAction,
  type AgentActionStatus,
} from "../lib/saffiMemory";

type AuthedRequest = Request & {
  user?: { id: string; email: string | null };
  db?: any;
};

const ALLOWED_TRANSITIONS: Record<AgentActionStatus, AgentActionStatus[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "rejected", "cancelled", "draft"],
  approved: ["ready_for_execution", "cancelled"],
  ready_for_execution: ["cancelled"],
  rejected: [],
  sent: [],
  cancelled: [],
  failed: ["ready_for_execution", "cancelled"],
};

function canTransition(from: AgentActionStatus, to: AgentActionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

function clampLimit(raw: unknown, def = 50, max = 200): number {
  const n = Number.parseInt(String(raw ?? def), 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

export function registerSaffiMemoryRoutes(app: Express): void {
  app.get("/api/activity-events", async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = clampLimit(req.query.limit, 50, 200);
      const source = typeof req.query.source === "string" ? req.query.source : null;
      const eventType = typeof req.query.event_type === "string" ? req.query.event_type : null;
      const clientId = typeof req.query.client_id === "string" ? req.query.client_id : null;

      let q = req.db!
        .from("activity_events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (source) q = q.eq("source", source);
      if (eventType) q = q.eq("event_type", eventType);
      if (clientId) q = q.eq("client_id", clientId);

      const { data, error } = await q;
      if (error) return res.status(500).json({ message: error.message });
      return res.json({ events: data ?? [] });
    } catch (e) {
      return res.status(500).json({ message: (e as Error).message });
    }
  });

  app.post("/api/activity-events", async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const b = req.body ?? {};
      if (!b.source || !b.event_type || !b.title) {
        return res
          .status(400)
          .json({ message: "source, event_type, and title are required" });
      }
      const id = await recordActivityEvent(
        {
          userId,
          source: b.source,
          platform: b.platform ?? null,
          feature: b.feature ?? null,
          eventType: b.event_type,
          entityType: b.entity_type ?? null,
          entityId: b.entity_id ?? null,
          clientId: b.client_id ?? null,
          title: b.title,
          summary: b.summary ?? null,
          payload: b.payload ?? {},
          visibility: b.visibility,
          sensitivity: b.sensitivity,
          createdBy: b.created_by ?? "user",
        },
        req.db!,
      );
      if (!id) return res.status(500).json({ message: "failed to record event" });
      return res.status(201).json({ id });
    } catch (e) {
      return res.status(500).json({ message: (e as Error).message });
    }
  });

  app.get("/api/agent-actions", async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = clampLimit(req.query.limit, 50, 200);
      const status = typeof req.query.status === "string" ? req.query.status : null;
      const pendingOnly = req.query.pending === "1" || req.query.pending === "true";

      let q = req.db!
        .from("agent_action_queue")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (pendingOnly) {
        q = q.in("status", ["draft", "pending_approval"]);
      } else if (status) {
        q = q.eq("status", status);
      }

      const { data, error } = await q;
      if (error) return res.status(500).json({ message: error.message });
      return res.json({ actions: data ?? [] });
    } catch (e) {
      return res.status(500).json({ message: (e as Error).message });
    }
  });

  app.post("/api/agent-actions", async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const b = req.body ?? {};
      if (!b.action_type || !b.title) {
        return res.status(400).json({ message: "action_type and title are required" });
      }
      const id = await queueAgentAction(
        {
          userId,
          activityEventId: b.activity_event_id ?? null,
          actionType: b.action_type,
          channel: b.channel ?? null,
          platform: b.platform ?? null,
          targetClientId: b.target_client_id ?? null,
          targetContact: b.target_contact ?? null,
          targetMeta: b.target_meta ?? {},
          title: b.title,
          draftBody: b.draft_body ?? null,
          payload: b.payload ?? {},
          status: b.status ?? "pending_approval",
          approvalRequired: b.approval_required ?? true,
          createdBy: b.created_by ?? "user",
        },
        req.db!,
      );
      if (!id) return res.status(500).json({ message: "failed to queue action" });
      return res.status(201).json({ id });
    } catch (e) {
      return res.status(500).json({ message: (e as Error).message });
    }
  });

  app.patch("/api/agent-actions/:id", async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = String(req.params.id);
      const b = req.body ?? {};

      const { data: existing, error: readErr } = await req.db!
        .from("agent_action_queue")
        .select("id, user_id, status, title, draft_body, action_type, channel")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (readErr || !existing) return res.status(404).json({ message: "not found" });

      const patch: Record<string, unknown> = {};
      if (typeof b.status === "string") {
        const next = b.status as AgentActionStatus;
        if (next === "sent" || next === "failed") {
          return res.status(400).json({
            message: "status_not_user_settable",
            detail: `${next} is set by the future executor service, not by approval`,
          });
        }
        if (!canTransition(existing.status as AgentActionStatus, next)) {
          return res.status(400).json({
            message: "invalid_transition",
            from: existing.status,
            to: next,
          });
        }
        patch.status = next;
        if (next === "approved") {
          patch.approved_by = userId;
          patch.approved_at = new Date().toISOString();
        }
        if (next === "rejected") {
          patch.rejected_reason = b.rejected_reason ?? null;
        }
      }
      if (typeof b.draft_body === "string") patch.draft_body = b.draft_body;
      if (typeof b.title === "string") patch.title = b.title;
      if (b.payload && typeof b.payload === "object") patch.payload = b.payload;
      if (b.target_meta && typeof b.target_meta === "object") patch.target_meta = b.target_meta;

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ message: "no updatable fields provided" });
      }

      const { data: updated, error: updErr } = await req.db!
        .from("agent_action_queue")
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (updErr) return res.status(500).json({ message: updErr.message });

      if (patch.status === "approved" || patch.status === "rejected") {
        await recordActivityEvent(
          {
            userId,
            source: "saffi",
            feature: "approval_queue",
            eventType: `action_${patch.status as string}`,
            entityType: "agent_action",
            entityId: id,
            title: `Action ${patch.status as string}: ${updated.title}`,
            summary: updated.draft_body ? updated.draft_body.slice(0, 200) : null,
            payload: { action_type: updated.action_type, channel: updated.channel },
            createdBy: "user",
          },
          req.db!,
        );
      }

      return res.json({ action: updated });
    } catch (e) {
      return res.status(500).json({ message: (e as Error).message });
    }
  });

  app.post("/api/agent-actions/:id/prepare-execution", async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = String(req.params.id);

      const { data: existing, error: readErr } = await req.db!
        .from("agent_action_queue")
        .select("id, user_id, status, title, draft_body, action_type, channel")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (readErr || !existing) return res.status(404).json({ message: "not found" });

      const from = existing.status as AgentActionStatus;
      if (!canTransition(from, "ready_for_execution")) {
        return res.status(409).json({
          message: "not_promotable",
          detail: `cannot promote from ${from} to ready_for_execution`,
        });
      }

      const { data: updated, error: updErr } = await req.db!
        .from("agent_action_queue")
        .update({ status: "ready_for_execution" })
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (updErr) return res.status(500).json({ message: updErr.message });

      await recordActivityEvent(
        {
          userId,
          source: "saffi",
          feature: "approval_queue",
          eventType: "action_ready_for_execution",
          entityType: "agent_action",
          entityId: id,
          title: `Action ready for execution: ${updated.title}`,
          summary: updated.draft_body ? updated.draft_body.slice(0, 200) : null,
          payload: { action_type: updated.action_type, channel: updated.channel },
          createdBy: "user",
        },
        req.db!,
      );

      return res.json({ action: updated, executed: false });
    } catch (e) {
      return res.status(500).json({ message: (e as Error).message });
    }
  });
}
