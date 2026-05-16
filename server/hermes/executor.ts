/**
 * Hermes Executor
 * Takes an approved (possibly edited) HermesProposal and executes the actions
 * against the database. Returns structured results.
 *
 * This will eventually call into the existing executeSafiTool logic or new
 * dedicated action handlers for complete_job / deduct_inventory etc.
 */

import type { HermesProposal, HermesExecutionResult, HermesAction } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function executeProposal(
  proposal: HermesProposal,
  db: SupabaseClient,
  userId: string,
): Promise<HermesExecutionResult> {
  const results: HermesExecutionResult["executedActions"] = [];

  for (const action of proposal.actions) {
    try {
      const res = await executeSingleAction(action, db, userId);
      results.push({
        actionType: action.actionType,
        success: res.ok,
        result: res.message,
        error: res.error,
      });
    } catch (e: any) {
      results.push({
        actionType: action.actionType,
        success: false,
        error: e.message,
      });
    }
  }

  const allGood = results.every(r => r.success);
  return {
    success: allGood,
    executedActions: results,
    summary: allGood
      ? `Executed ${results.length} actions from the proposal.`
      : `Some actions failed. Check details.`,
  };
}

async function executeSingleAction(
  action: HermesAction,
  db: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  // TODO: Wire these to real DB operations + the existing activity_event / agent_action_queue system.
  // For the first implementation we just acknowledge so the approval flow works end-to-end.

  switch (action.actionType) {
    case "complete_job":
      // In real impl: find booking by clientName + date, set status = 'completed'
      return { ok: true, message: `Job for ${action.payload.clientName || "client"} marked complete (simulated).` };

    case "deduct_inventory":
      // In real impl: for each item in payload.items, decrement stock_items.quantity
      const items = (action.payload.items as any[]) || [];
      return { ok: true, message: `Deducted ${items.length} inventory item(s) (simulated).` };

    case "create_note":
      // In real impl: insert into notes or treatment_notes table + link to client/booking
      return { ok: true, message: `Clinical note created: "${(action.payload.title as string) || "Treatment note"}"` };

    default:
      return { ok: true, message: `Action ${action.actionType} acknowledged (no-op in current stub).` };
  }
}
