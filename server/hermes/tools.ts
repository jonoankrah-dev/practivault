/**
 * Hermes Tools
 * 
 * This file will eventually define all the actions Hermes is allowed to propose.
 * 
 * Each tool represents something Hermes can ask PractiVault to do
 * (after user approval).
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

/**
 * Current list of tools Hermes understands.
 * We will expand this significantly as we add more features.
 */
export const HERMES_TOOLS: ToolDefinition[] = [
  {
    name: "complete_job",
    description: "Mark a job as completed",
    parameters: {
      jobId: "string",
      notes: "string (optional)",
    },
  },
  {
    name: "deduct_inventory",
    description: "Remove items from inventory/stock",
    parameters: {
      items: "array of strings",
      quantities: "array of numbers",
    },
  },
  {
    name: "create_note",
    description: "Add a note to a job or customer",
    parameters: {
      jobId: "string",
      note: "string",
    },
  },
  {
    name: "update_job_status",
    description: "Change the status of a job",
    parameters: {
      jobId: "string",
      status: "string",
    },
  },
];

// Future tools ideas (to be added later):
// - schedule_technician
// - create_invoice
// - send_customer_message
// - reorder_stock
// - assign_job_to_technician
