/**
 * Hermes Execution Layer
 *
 * This is where approved Hermes proposals actually get executed in the database.
 * 
 * When Saffi presents a Hermes proposal and the user clicks "Approve",
 * we call executeHermesProposal() which performs the real actions:
 *   - complete_treatment → mark booking complete + add treatment details
 *   - deduct_consumables → reduce inventory / log usage
 *   - record_treatment_note → save rich structured note
 *   - log_client_feedback → record sentiment + flag if needed
 *
 * Everything is logged to activity_events for the Usage dashboard.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HermesProposal, HermesAction } from "./types";

export interface ExecutionContext {
  userId: string;
  db: SupabaseClient;
  bookingId?: string;
  clientId?: string;
}

export interface ExecutionResult {
  success: boolean;
  executedActions: string[];
  errors: string[];
  activityEventIds: string[];
}

/**
 * Main entry point for executing an approved Hermes proposal.
 */
export async function executeHermesProposal(
  proposal: HermesProposal,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    success: true,
    executedActions: [],
    errors: [],
    activityEventIds: [],
  };

  for (const action of proposal.actions) {
    try {
      const executed = await executeSingleAction(action, context);
      if (executed) {
        result.executedActions.push(action.type);
      }
    } catch (err: any) {
      result.success = false;
      result.errors.push(`${action.type}: ${err.message}`);
      console.error(`[Hermes Executor] Failed to execute ${action.type}:`, err);
    }
  }

  return result;
}

async function executeSingleAction(
  action: HermesAction,
  context: ExecutionContext
): Promise<boolean> {
  const { type, payload } = action;
  const { userId, db, bookingId, clientId } = context;

  switch (type) {
    case "complete_treatment":
      return await executeCompleteTreatment(payload, context);

    case "deduct_consumables":
      return await executeDeductConsumables(payload, context);

    case "record_treatment_note":
      return await executeRecordTreatmentNote(payload, context);

    case "log_client_feedback":
      return await executeLogClientFeedback(payload, context);

    case "schedule_follow_up":
      return await executeScheduleFollowUp(payload, context);

    case "create_task":
      return await executeCreateTask(payload, context);

    default:
      console.warn(`[Hermes Executor] Unknown action type: ${type}`);
      return false;
  }
}

// ============================================
// Individual Action Executors
// ============================================

async function executeCompleteTreatment(payload: any, context: ExecutionContext): Promise<boolean> {
  const { db, userId } = context;
  let targetBookingId = context.bookingId || payload.bookingId;

  // === Smart Booking Resolution (Improvement #2) ===
  if (!targetBookingId) {
    targetBookingId = await resolveMostRelevantBooking(db, userId, payload.clientName);
  }

  if (!targetBookingId) {
    console.warn("[Hermes Executor] Could not find a booking to complete. Logging as activity only.");
    await logActivityEvent(db, userId, "hermes", "treatment_completed_no_booking", payload);
    return true; // Still consider it "handled"
  }

  const updateData: any = {
    status: "completed",
    completed_at: new Date().toISOString(),
  };

  if (payload.areasTreated?.length) {
    updateData.notes = (updateData.notes || "") + `\n[endoPulse] Areas: ${payload.areasTreated.join(", ")}`;
  }
  if (payload.energy) updateData.notes = (updateData.notes || "") + `\n[endoPulse] Energy: ${payload.energy}`;
  if (payload.passes) updateData.notes = (updateData.notes || "") + `\n[endoPulse] Passes: ${payload.passes}`;
  if (payload.wavelength) updateData.notes = (updateData.notes || "") + `\n[endoPulse] Wavelength: ${payload.wavelength}`;

  const { error } = await db
    .from("bookings")
    .update(updateData)
    .eq("user_id", userId)
    .eq("id", targetBookingId);

  if (error) throw error;

  await logActivityEvent(db, userId, "hermes", "treatment_completed", {
    bookingId: targetBookingId,
    ...payload,
  });

  return true;
}

/**
 * Smart resolver: finds the most relevant pending booking
 * - Matches by client name if provided (fuzzy)
 * - Falls back to most recent incomplete booking
 * - Handles cases where client name is partial
 */
async function resolveMostRelevantBooking(
  db: SupabaseClient,
  userId: string,
  clientName?: string | null
): Promise<string | null> {
  const { data: bookings } = await db
    .from("bookings")
    .select("id, client_id, date, time, clients(name)")
    .eq("user_id", userId)
    .in("status", ["scheduled", "confirmed", "in_progress"])
    .order("date", { ascending: true })
    .limit(8);

  if (!bookings || bookings.length === 0) return null;

  // Try to match client name
  if (clientName) {
    const lowerName = clientName.toLowerCase().trim();

    // Exact or contains match
    let match = bookings.find((b: any) => 
      b.clients?.name?.toLowerCase().includes(lowerName)
    );

    if (!match) {
      // Try reverse match (last name)
      const nameParts = lowerName.split(" ");
      match = bookings.find((b: any) => {
        const clientNameLower = (b.clients?.name || "").toLowerCase();
        return nameParts.some(part => clientNameLower.includes(part));
      });
    }

    if (match) return match.id;
  }

  // Fallback: most recent upcoming booking
  return bookings[0].id;
}

async function executeDeductConsumables(payload: any, context: ExecutionContext): Promise<boolean> {
  const { db, userId } = context;
  const { items = [], quantities = [] } = payload;

  for (let i = 0; i < items.length; i++) {
    const itemName = items[i];
    const qty = quantities[i] || 1;

    // Try to find existing inventory item and deduct
    const { data: existing } = await db
      .from("inventory_items")
      .select("id, quantity")
      .eq("user_id", userId)
      .ilike("name", `%${itemName}%`)
      .limit(1)
      .single();

    if (existing) {
      const newQty = Math.max(0, Number(existing.quantity) - qty);

      await db
        .from("inventory_items")
        .update({ quantity: newQty })
        .eq("id", existing.id);

      // Record deduction
      await db.from("inventory_deductions").insert({
        user_id: userId,
        inventory_item_id: existing.id,
        item_name: itemName,
        quantity_deducted: qty,
        source: "hermes",
      });
    } else {
      // Create a new low-stock item if it doesn't exist (auto-discovery)
      const { data: newItem } = await db
        .from("inventory_items")
        .insert({
          user_id: userId,
          name: itemName,
          quantity: 0,
          notes: "Auto-created by Hermes",
        })
        .select("id")
        .single();

      if (newItem) {
        await db.from("inventory_deductions").insert({
          user_id: userId,
          inventory_item_id: newItem.id,
          item_name: itemName,
          quantity_deducted: qty,
          source: "hermes",
          notes: "Item was not in inventory — Hermes created placeholder",
        });
      }
    }

    // Always log to activity_events
    await logActivityEvent(db, userId, "hermes", "consumable_used", {
      item: itemName,
      quantity: qty,
      source: "endoPulse_treatment",
    });
  }

  return true;
}

async function executeRecordTreatmentNote(payload: any, context: ExecutionContext): Promise<boolean> {
  const { db, userId, bookingId, clientId } = context;

  const noteText = payload.note || JSON.stringify(payload);

  // Try to attach note to booking if we have an ID
  if (bookingId) {
    const { error } = await db
      .from("bookings")
      .update({
        notes: (await getCurrentNotes(db, "bookings", bookingId)) + "\n\n" + noteText,
      })
      .eq("id", bookingId)
      .eq("user_id", userId);

    if (error) console.warn("Could not attach note to booking:", error);
  }

  // Always create a durable activity event
  await logActivityEvent(db, userId, "hermes", "treatment_note_recorded", {
    clientId,
    bookingId,
    note: noteText,
    areas: payload.areasTreated,
    energy: payload.energy,
    wavelength: payload.wavelength,
  });

  return true;
}

async function executeLogClientFeedback(payload: any, context: ExecutionContext): Promise<boolean> {
  const { db, userId, clientId } = context;

  const eventType = payload.sentiment === "negative" ? "client_complaint_logged" : "client_feedback_positive";

  await logActivityEvent(db, userId, "hermes", eventType, {
    clientId,
    sentiment: payload.sentiment,
    message: payload.message,
    requiresReview: payload.requiresReview || false,
  });

  return true;
}

// ============================================
// Helpers
// ============================================

async function logActivityEvent(
  db: SupabaseClient,
  userId: string,
  source: string,
  eventType: string,
  payload: Record<string, any>
) {
  const { data, error } = await db.from("activity_events").insert({
    user_id: userId,
    source,
    event_type: eventType,
    title: `Hermes: ${eventType.replace(/_/g, " ")}`,
    payload,
    created_by: "hermes",
  });

  if (error) {
    console.error("[Hermes Executor] Failed to log activity_event:", error);
  }

  return data;
}

async function getCurrentNotes(db: SupabaseClient, table: string, id: string): Promise<string> {
  const { data } = await db.from(table).select("notes").eq("id", id).single();
  return data?.notes || "";
}

// ============================================
// New Action Executors (#3)
// ============================================

async function executeScheduleFollowUp(payload: any, context: ExecutionContext): Promise<boolean> {
  const { db, userId, clientId } = context;
  const { weeksFromNow = 4, notes = "" } = payload;

  // Create a new booking in the future (simple implementation)
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + (weeksFromNow * 7));

  const { error } = await db.from("bookings").insert({
    user_id: userId,
    client_id: clientId || null,
    date: futureDate.toISOString().split("T")[0],
    time: "10:00", // default time, user can change
    service: payload.service || "endoPulse Follow-up",
    status: "scheduled",
    notes: `[Hermes] Follow-up scheduled from previous treatment. ${notes}`,
  });

  if (error) throw error;

  await logActivityEvent(db, userId, "hermes", "follow_up_scheduled", {
    weeksFromNow,
    clientName: payload.clientName,
    ...payload,
  });

  return true;
}

async function executeCreateTask(payload: any, context: ExecutionContext): Promise<boolean> {
  const { db, userId } = context;

  // For now we log it as a high-priority activity. Later we can add a proper tasks table.
  await logActivityEvent(db, userId, "hermes", "task_created", {
    title: payload.title || "Hermes Task",
    description: payload.description || payload.note || "",
    due: payload.due || null,
    priority: payload.priority || "medium",
  });

  return true;
}
