/**
 * Hermes Tools - Advanced Tool Calling Structure
 * 
 * This file defines tools in a format that works well with Grok's function calling.
 * Later, when we connect the real Hermes Agent, these definitions can be sent
 * directly to Grok so it knows what actions it can propose.
 */

export interface HermesTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Current Hermes tools in proper function calling format.
 * This structure is compatible with how Grok expects tools to be defined.
 */
export const HERMES_TOOLS: HermesTool[] = [
  {
    type: "function",
    function: {
      name: "complete_job",
      description: "Mark a job as completed. Use this when the user indicates a job is finished.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "The ID of the job to complete" },
          notes: { type: "string", description: "Optional notes from the technician or user" },
        },
        required: ["jobId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deduct_inventory",
      description: "Remove materials or parts from inventory/stock.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string" },
            description: "List of part names to deduct",
          },
          quantities: {
            type: "array",
            items: { type: "number" },
            description: "Corresponding quantities for each item",
          },
        },
        required: ["items", "quantities"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Add a note to a job or customer record.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "ID of the job" },
          note: { type: "string", description: "The note content" },
        },
        required: ["jobId", "note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_customer_message",
      description: "Send a message or update to the customer.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          message: { type: "string" },
        },
        required: ["customerId", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_job_status",
      description: "Change the status of a job (e.g. in_progress, on_hold, completed).",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          status: { type: "string" },
        },
        required: ["jobId", "status"],
      },
    },
  },
];