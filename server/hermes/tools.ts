/**
 * Hermes Tools
 * 
 * This file defines all the actions Hermes is allowed to propose.
 * Each tool represents something Hermes can ask PractiVault to do
 * (after getting user approval).
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, string>; // Simple description of expected params
}

/**
 * Current set of tools Hermes understands.
 * We will expand this list as we add more features to PractiVault.
 */
export const HERMES_TOOLS: ToolDefinition[] = [
  {
    name: "complete_job",
    description: "Mark a job as completed",
    parameters: {
      jobId: "string (ID of the job)",
      notes: "string (optional notes from the technician)",
    },
  },
  {
    name: "deduct_inventory",
    description: "Remove materials/parts from inventory",
    parameters: {
      items: "array of strings (part names)",
      quantities: "array of numbers",
    },
  },
  {
    name: "create_note",
    description: "Add a note to a job or customer record",
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
      status: "string (e.g. 'in_progress', 'on_hold', 'completed')",
    },
  },
  {
    name: "send_customer_message",
    description: "Send a message to the customer",
    parameters: {
      customerId: "string",
      message: "string",
    },
  },
  {
    name: "schedule_technician",
    description: "Assign a technician to a job and set a time",
    parameters: {
      jobId: "string",
      technicianId: "string",
      scheduledDate: "string (YYYY-MM-DD)",
      scheduledTime: "string (HH:MM)",
    },
  },
  {
    name: "create_invoice",
    description: "Generate an invoice for a completed job",
    parameters: {
      jobId: "string",
    },
  },
  {
    name: "request_stock_reorder",
    description: "Create a purchase order suggestion when stock is low",
    parameters: {
      items: "array of strings",
      quantities: "array of numbers",
    },
  },
];