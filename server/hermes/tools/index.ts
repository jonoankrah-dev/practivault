/**
 * Hermes Tools - Function Calling Definitions
 *
 * These tool definitions are designed to be compatible with Grok's function calling format.
 * When we connect the real Hermes Agent, we can pass these directly to the model.
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
 * Current set of tools Hermes can propose actions for.
 */
export const HERMES_TOOLS: HermesTool[] = [
  {
    type: "function",
    function: {
      name: "complete_treatment",
      description: "Mark an aesthetics treatment / laser session as completed. Use when the practitioner says a treatment is finished.",
      parameters: {
        type: "object",
        properties: {
          areasTreated: { type: "array", items: { type: "string" }, description: "Body areas treated (face, neck, legs, etc.)" },
          clientName: { type: "string", description: "Name of the client" },
          settings: { type: "string", description: "Machine settings or passes used" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deduct_consumables",
      description: "Remove consumables used during an aesthetics treatment from inventory (numbing cream, gel, tips, cartridges, etc.).",
      parameters: {
        type: "object",
        properties: {
          items: { type: "array", items: { type: "string" }, description: "Consumable names" },
          quantities: { type: "array", items: { type: "number" }, description: "Quantities used" },
        },
        required: ["items", "quantities"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_treatment_note",
      description: "Create a rich, structured treatment note containing areas treated, settings, consumables, and practitioner observations.",
      parameters: {
        type: "object",
        properties: {
          note: { type: "string", description: "The full structured note" },
          clientName: { type: "string" },
          areasTreated: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_client_feedback",
      description: "Record client sentiment and feedback after a treatment (positive or negative).",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string" },
          sentiment: { type: "string", enum: ["positive", "negative", "mixed"] },
          message: { type: "string", description: "Original practitioner message" },
          requiresReview: { type: "boolean" },
        },
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
  {
    type: "function",
    function: {
      name: "schedule_follow_up",
      description: "Schedule a follow-up EndoPulse or review appointment (usually 4-6 weeks later). Use when practitioner mentions rebooking or follow-up.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string" },
          weeksFromNow: { type: "number", description: "How many weeks from today" },
          service: { type: "string", description: "Type of follow-up treatment" },
          notes: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create an internal reminder or task for the clinic owner (e.g. 'order more sterile fibres', 'review client complaint').",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
  },
];
