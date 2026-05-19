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
      description: "Mark an endoPulse endolaser treatment session as completed in the system. Use when the practitioner clearly indicates the treatment has finished.",
      parameters: {
        type: "object",
        properties: {
          areasTreated: {
            type: "array",
            items: { type: "string" },
            description: "Body areas treated (e.g. ['lower face', 'jawline', 'submental', 'neck'])"
          },
          clientName: { type: "string", description: "Name of the client" },
          wavelength: { type: "string", description: "Wavelength used (e.g. '1470nm' or '980nm')" },
          energyJoules: { type: "number", description: "Total energy delivered in Joules" },
          powerWatts: { type: "number", description: "Power setting in Watts" },
          numPasses: { type: "number", description: "Number of passes performed" },
          clinicalEndpointReached: { type: "boolean", description: "Whether the practitioner indicated clinical endpoint was reached (tissue softening, erythema, etc.)" },
          notes: { type: "string", description: "Any additional clinical observations" }
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deduct_consumables",
      description: "Deduct consumables used during the endoPulse treatment from inventory (lidocaine, optical fibres, gauze, numbing cream, etc.).",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string" },
            description: "List of consumable names (e.g. ['lidocaine 1%', '200um fibre', 'gauze'])"
          },
          quantities: {
            type: "array",
            items: { type: "number" },
            description: "Corresponding quantities used (must match length of items array)"
          },
        },
        required: ["items", "quantities"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_treatment_note",
      description: "Create a detailed, structured clinical treatment note. Use this for rich documentation of technique, settings, observations, and safety considerations.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string" },
          areasTreated: { type: "array", items: { type: "string" } },
          wavelength: { type: "string", description: "980nm or 1470nm" },
          energyJoules: { type: "number" },
          powerWatts: { type: "number" },
          numPasses: { type: "number" },
          lidocaineVolumeMl: { type: "number" },
          techniqueNotes: { type: "string", description: "Technique details (fan vectors, retrograde passes, danger zones avoided, etc.)" },
          clinicalEndpoint: { type: "string", description: "Description of clinical endpoint reached" },
          compression: { type: "string", description: "Compression garment instructions" },
          additionalNotes: { type: "string" }
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_client_feedback",
      description: "Log the client's feedback and sentiment after the treatment. Flag anything that may require follow-up or review.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string" },
          sentiment: { type: "string", enum: ["positive", "negative", "mixed", "neutral"] },
          message: { type: "string", description: "The client's feedback or the practitioner's observation of client reaction" },
          requiresReview: { type: "boolean", description: "True if anything mentioned suggests the client needs review or follow-up contact" }
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_follow_up",
      description: "Schedule a follow-up or review appointment (typically 4–6 weeks post endoPulse treatment).",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string" },
          weeksFromNow: { type: "number", description: "Recommended weeks until follow-up (usually 4-6)" },
          service: { type: "string", description: "Type of follow-up treatment or review" },
          notes: { type: "string", description: "Any specific instructions or observations for the follow-up" }
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create an internal task or reminder for the clinic (stock ordering, client follow-up, safety review, etc.).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] }
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_safety_observation",
      description: "Record a safety-related observation or near-miss (e.g. proximity to marginal mandibular nerve, unexpected swelling, client discomfort). These are important for risk management.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string" },
          observation: { type: "string", description: "Detailed description of the safety observation or concern" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          actionTaken: { type: "string", description: "What the practitioner did in response" }
        },
      },
    },
  }
];
