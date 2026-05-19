import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase";

export type ActivityCreatedBy = "user" | "saffi" | "system" | "integration";
export type ActivityVisibility = "private" | "team" | "public";
export type ActivitySensitivity = "normal" | "sensitive" | "restricted";

export interface RecordActivityEventInput {
  userId: string;
  source: string;
  eventType: string;
  title: string;
  platform?: string | null;
  feature?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  clientId?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  visibility?: ActivityVisibility;
  sensitivity?: ActivitySensitivity;
  createdBy?: ActivityCreatedBy;
}

export type AgentActionType =
  | "send_message"
  | "post_social"
  | "send_quote"
  | "send_invoice"
  | "follow_up"
  | "schedule_meeting"
  | "create_task"
  | "custom";

export type AgentActionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "ready_for_execution"
  | "rejected"
  | "sent"
  | "cancelled"
  | "failed";

export interface QueueAgentActionInput {
  userId: string;
  actionType: AgentActionType;
  title: string;
  activityEventId?: string | null;
  channel?: string | null;
  platform?: string | null;
  targetClientId?: string | null;
  targetContact?: string | null;
  targetMeta?: Record<string, unknown> | null;
  draftBody?: string | null;
  payload?: Record<string, unknown> | null;
  status?: AgentActionStatus;
  approvalRequired?: boolean;
  createdBy?: ActivityCreatedBy;
}

type DbClient = Pick<SupabaseClient, "from">;

/**
 * Best-effort write. Never throws. Returns the new row id or null on failure.
 * Logging must never break the route that caused it.
 */
export async function recordActivityEvent(
  input: RecordActivityEventInput,
  db: DbClient = supabaseAdmin,
): Promise<string | null> {
  try {
    if (!input.userId || !input.source || !input.eventType || !input.title) {
      console.warn("[saffi-memory] recordActivityEvent skipped: missing required field", {
        hasUserId: !!input.userId,
        hasSource: !!input.source,
        hasEventType: !!input.eventType,
        hasTitle: !!input.title,
      });
      return null;
    }

    const { data, error } = await db
      .from("activity_events")
      .insert({
        user_id: input.userId,
        source: input.source,
        platform: input.platform ?? null,
        feature: input.feature ?? null,
        event_type: input.eventType,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        client_id: input.clientId ?? null,
        title: input.title,
        summary: input.summary ?? null,
        payload: input.payload ?? {},
        visibility: input.visibility ?? "private",
        sensitivity: input.sensitivity ?? "normal",
        created_by: input.createdBy ?? "system",
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[saffi-memory] recordActivityEvent insert failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.warn("[saffi-memory] recordActivityEvent threw:", (e as Error).message);
    return null;
  }
}

/**
 * Best-effort queue insert. Never throws.
 */
export async function queueAgentAction(
  input: QueueAgentActionInput,
  db: DbClient = supabaseAdmin,
): Promise<string | null> {
  try {
    if (!input.userId || !input.actionType || !input.title) {
      console.warn("[saffi-memory] queueAgentAction skipped: missing required field");
      return null;
    }

    const { data, error } = await db
      .from("agent_action_queue")
      .insert({
        user_id: input.userId,
        activity_event_id: input.activityEventId ?? null,
        action_type: input.actionType,
        channel: input.channel ?? null,
        platform: input.platform ?? null,
        target_client_id: input.targetClientId ?? null,
        target_contact: input.targetContact ?? null,
        target_meta: input.targetMeta ?? {},
        title: input.title,
        draft_body: input.draftBody ?? null,
        payload: input.payload ?? {},
        status: input.status ?? "pending_approval",
        approval_required: input.approvalRequired ?? true,
        created_by: input.createdBy ?? "saffi",
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[saffi-memory] queueAgentAction insert failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.warn("[saffi-memory] queueAgentAction threw:", (e as Error).message);
    return null;
  }
}
