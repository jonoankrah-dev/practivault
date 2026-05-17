/**
 * Hermes Reasoner - The intelligent core (Aesthetics / EndoPulse focused)
 *
 * This is where the deep understanding happens.
 * Currently a very strong advanced mock tuned for real-world aesthetics clinic language.
 * Later this will be replaced by a real Grok-powered Hermes Agent.
 */

import { HermesResponse, HermesProposal, HermesAction } from "../types";
import { HERMES_CONFIG } from "../config";
import { HERMES_TOOLS } from "../tools";
import { HERMES_SYSTEM_PROMPT } from "../prompts";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

// Auto-load XAI_API_KEY from xai-api-key.txt if not already in env
// (allows `npx tsx server/hermes/test/test-hermes.ts` to work standalone)
try {
  if (!process.env.XAI_API_KEY) {
    const keyFile = resolve(process.cwd(), "xai-api-key.txt");
    if (existsSync(keyFile)) {
      const key = readFileSync(keyFile, "utf8").trim();
      if (key) {
        process.env.XAI_API_KEY = key;
        console.log("[Hermes] Loaded XAI_API_KEY from xai-api-key.txt");
      }
    }
  }
} catch (err) {
  // non-fatal; the callRealGrokHermes will throw a clear error if still missing
}

export interface ReasonerOptions {
  useMock?: boolean;
}

/**
 * Main entry point called by Saffi via sendToHermes().
 */
export async function getHermesReasoning(
  userMessage: string,
  context?: Record<string, any>,
  options: ReasonerOptions = {}
): Promise<HermesResponse> {
  const useMock = options.useMock ?? HERMES_CONFIG.useMock;

  if (HERMES_CONFIG.verboseLogging) {
    console.log("[Hermes Reasoner] Processing aesthetics update:", userMessage);
  }

  if (useMock) {
    return generateAestheticsMockResponse(userMessage, context);
  }

  // === Real Grok-powered Hermes ===
  try {
    return await callRealGrokHermes(userMessage, context);
  } catch (error) {
    console.error("[Hermes] Real Grok call failed, falling back to mock:", error);
    return generateAestheticsMockResponse(userMessage, context);
  }
}

/**
 * Fetches relevant manual chunks via semantic search and formats them for injection into Hermes.
 * This is the key to making Hermes actually "know" the user's uploaded EndoPulse materials.
 */
async function getRelevantManualContext(
  db: SupabaseClient,
  userId: string,
  query: string
): Promise<string> {
  try {
    const { searchManualsSemantic } = await import("../../lib/semanticManualSearch");
    const result = await searchManualsSemantic(db, userId, query, 5);

    if (!result.matches || result.matches.length === 0) {
      return "";
    }

    const excerpts = result.matches
      .slice(0, 4)
      .map((m, i) => {
        const source = m.manual_name ? ` [${m.manual_name}${m.page_number ? `, p.${m.page_number}` : ""}]` : "";
        return `${i + 1}. ${m.content.trim().slice(0, 650)}${source}`;
      })
      .join("\n\n");

    return `\n\n## Relevant Manual Excerpts (from user's uploaded documents)\nUse this information to inform your reasoning. Cite the source when relevant.\n\n${excerpts}\n`;
  } catch (err) {
    console.warn("[Hermes] Failed to fetch manual context for RAG:", err);
    return "";
  }
}

/**
 * Calls the real xAI Grok API with tool calling for structured Hermes proposals.
 */
async function callRealGrokHermes(
  userMessage: string,
  context?: Record<string, any>
): Promise<HermesResponse> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY not configured. Place your key in xai-api-key.txt in the project root (or set the XAI_API_KEY environment variable).");
  }

  const db: SupabaseClient | undefined = context?.db;
  const userId: string | undefined = context?.userId;

  // === Pass 2: Inject relevant manual content via RAG when available ===
  // This is the key integration — Hermes now reasons with the user's actual uploaded manuals
  // (especially powerful when they upload the official EndoPulse tutor manual / course).
  let enhancedSystemPrompt = HERMES_SYSTEM_PROMPT;

  if (db && userId) {
    const manualContext = await getRelevantManualContext(db, userId, userMessage);
    if (manualContext) {
      enhancedSystemPrompt = HERMES_SYSTEM_PROMPT + manualContext;
      if (HERMES_CONFIG.verboseLogging) {
        console.log("[Hermes] Injected relevant manual excerpts from user's RAG for this reasoning call.");
      }
    }
  }

  const messages = [
    { role: "system", content: enhancedSystemPrompt },
    { role: "user", content: userMessage },
  ];

  // Add a high-quality few-shot example using the improved EndoPulse-specific tool schemas
  const fewShotMessages = [
    { role: "system", content: enhancedSystemPrompt },
    { 
      role: "user", 
      content: "Just finished lower face and jawline on Mrs Thompson, endoPulse 1470nm, total 950J at 8W, 3 passes, 6ml 1% lidocaine, compression garment applied, client tolerated well and was pleased" 
    },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: {
            name: "complete_treatment",
            arguments: JSON.stringify({ 
              areasTreated: ["lower face", "jawline"], 
              clientName: "Mrs Thompson", 
              wavelength: "1470nm", 
              energyJoules: 950, 
              powerWatts: 8, 
              numPasses: 3,
              clinicalEndpointReached: true 
            })
          }
        },
        {
          id: "call_2",
          type: "function",
          function: {
            name: "deduct_consumables",
            arguments: JSON.stringify({ 
              items: ["lidocaine 1%"], 
              quantities: [6] 
            })
          }
        },
        {
          id: "call_3",
          type: "function",
          function: {
            name: "record_treatment_note",
            arguments: JSON.stringify({ 
              clientName: "Mrs Thompson",
              areasTreated: ["lower face", "jawline"],
              wavelength: "1470nm",
              energyJoules: 950,
              powerWatts: 8,
              numPasses: 3,
              lidocaineVolumeMl: 6,
              techniqueNotes: "Fan vectors used, clinical endpoint reached (good erythema and tissue softening)",
              compression: "Applied, 24h recommended",
              additionalNotes: "Client tolerated well and was pleased with tightening result"
            })
          }
        },
        {
          id: "call_4",
          type: "function",
          function: {
            name: "log_client_feedback",
            arguments: JSON.stringify({ 
              clientName: "Mrs Thompson", 
              sentiment: "positive", 
              message: "client tolerated well and was pleased",
              requiresReview: false 
            })
          }
        }
      ]
    },
    { role: "user", content: userMessage }
  ];

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-3",
      messages: fewShotMessages,
      tools: HERMES_TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`xAI API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error("No response from Grok");
  }

  const toolCalls = choice.message?.tool_calls || [];

  if (toolCalls.length === 0) {
    return {
      shouldEscalate: false,
      directReply: choice.message?.content || "Hermes understood the message but did not propose actions.",
    };
  }

  // Convert Grok tool calls into Hermes actions
  const actions: HermesAction[] = toolCalls.map((tc: any) => {
    const args = JSON.parse(tc.function.arguments || "{}");
    return {
      type: tc.function.name,
      payload: args,
      description: generateDescriptionForAction(tc.function.name, args),
    };
  });

  const proposal: HermesProposal = {
    summary: `Hermes (Grok) proposed ${actions.length} action(s)`,
    actions,
    reasoning: "Analyzed using real Grok model with EndoPulse knowledge.",
    confidence: 0.85,
  };

  return {
    shouldEscalate: true,
    proposal,
  };
}

function generateDescriptionForAction(actionType: string, args: any): string {
  switch (actionType) {
    case "complete_treatment":
      const areas = args.areasTreated?.join(", ") || "";
      const wl = args.wavelength ? ` (${args.wavelength})` : "";
      return `Complete EndoPulse treatment${areas ? ` on ${areas}` : ""}${wl}`;
    case "deduct_consumables":
      return `Deduct consumables: ${args.items?.join(", ") || "items"}`;
    case "record_treatment_note":
      return "Record detailed clinical EndoPulse treatment note";
    case "log_client_feedback":
      return `${args.sentiment || "Client"} feedback logged`;
    case "schedule_follow_up":
      return `Schedule follow-up in ${args.weeksFromNow || 4} weeks`;
    case "create_task":
      return `Create task: ${args.title || "Internal task"}`;
    case "record_safety_observation":
      return `Safety observation recorded${args.severity ? ` (${args.severity})` : ""}`;
    default:
      return `Execute ${actionType}`;
  }
}

// ============================================
// Advanced Aesthetics / EndoPulse Mock Reasoner
// ============================================

interface ExtractedDetails {
  areasTreated: string[];
  clientName: string | null;
  productsUsed: Array<{ name: string; quantity: number }>;
  passesOrSettings: string | null;
  totalEnergy: string | null;
  powerWatts: string | null;
  numPasses: number | null;
  wavelength: string | null;            // "1470nm" or "980nm"
  lidocaineUsed: string | null;
  compressionApplied: boolean;
  reachedClinicalEndpoint: boolean;
  duration: string | null;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  hasCompletionSignal: boolean;
  hasIssues: boolean;
  followUpMentioned: boolean;
}

function generateAestheticsMockResponse(
  userMessage: string,
  context?: Record<string, any>
): HermesResponse {
  const lower = userMessage.toLowerCase();
  const details = extractAestheticsDetails(userMessage, lower);

  const actions: HermesAction[] = [];
  let confidence = 0.55;
  const reasoningParts: string[] = ["Hermes analysed the practitioner update:"];

  // === 1. Treatment Completion (aesthetics-specific) ===
  if (details.hasCompletionSignal) {
    actions.push({
      type: "complete_treatment",
      payload: {
        areasTreated: details.areasTreated,
        clientName: details.clientName,
        energy: details.totalEnergy,
        passes: details.numPasses,
        settings: details.passesOrSettings,
      },
      description: `Complete EndoPulse treatment${
        details.areasTreated.length > 0 ? ` — ${details.areasTreated.join(", ")}` : ""
      }${details.clientName ? ` for ${details.clientName}` : ""}`,
    });
    confidence += 0.22;
    reasoningParts.push("Clear completion language detected.");
  }

  // === 2. Consumables Deduction (tailored for aesthetics) ===
  if (details.productsUsed.length > 0) {
    actions.push({
      type: "deduct_consumables",
      payload: {
        items: details.productsUsed.map((p) => p.name),
        quantities: details.productsUsed.map((p) => p.quantity),
      },
      description: `Deduct from stock: ${details.productsUsed
        .map((p) => `${p.quantity}× ${p.name}`)
        .join(", ")}`,
    });
    confidence += 0.18;
    reasoningParts.push("Specific consumables mentioned that should be deducted from stock.");
  }

  // === 3. Structured Treatment Record ===
  const treatmentNote = buildRichTreatmentNote(userMessage, details);
  actions.push({
    type: "record_treatment_note",
    payload: {
      note: treatmentNote,
      clientName: details.clientName,
      areasTreated: details.areasTreated,
      energy: details.totalEnergy,
      passes: details.numPasses,
      lidocaine: details.lidocaineUsed,
      compression: details.compressionApplied,
    },
    description: "Record detailed EndoPulse treatment note (energy, passes, anaesthetic, post-care)",
  });
  confidence += 0.12;

  // === 4. Client Feedback (separate high-value log) ===
  if (details.sentiment === "positive") {
    actions.push({
      type: "log_client_feedback",
      payload: {
        clientName: details.clientName,
        sentiment: "positive",
        message: userMessage,
      },
      description: "Log positive client experience and tolerance",
    });
    confidence += 0.08;
    reasoningParts.push("Client was happy / tolerated treatment well.");
  }

  if (details.hasIssues || details.sentiment === "negative") {
    actions.push({
      type: "log_client_feedback",
      payload: {
        clientName: details.clientName,
        sentiment: "negative",
        message: userMessage,
        requiresReview: true,
      },
      description: "Flag client issue / adverse reaction for review",
    });
    confidence += 0.05;
    reasoningParts.push("Possible adverse reaction or complaint noted — flagged for attention.");
  }

  // === 5. Follow-up detection (future action) ===
  if (details.followUpMentioned) {
    reasoningParts.push("Follow-up appointment was mentioned.");
    confidence += 0.05;
  }

  // === Final Decision ===
  const shouldEscalate = actions.length >= 2 && confidence >= 0.68;

  if (!shouldEscalate) {
    return {
      shouldEscalate: false,
      directReply:
        "I understood the message but wasn't confident enough to propose actions. Would you like me to log this anyway?",
    };
  }

  const proposal: HermesProposal = {
    summary: buildSummary(details, actions),
    actions,
    reasoning: reasoningParts.join(" "),
    confidence: Math.min(Math.round(confidence * 100) / 100, 0.97),
    extractedDetails: details, // helpful for UI later
  };

  return {
    shouldEscalate: true,
    proposal,
  };
}

// ============================================
// Smart Extraction for Aesthetics / Laser Clinics
// ============================================

function extractAestheticsDetails(message: string, lower: string): ExtractedDetails {
  // === 1. Areas (with normalization) ===
  const rawAreaPatterns = [
    "full face", "face", "neck", "décolleté", "chest", "underarms", "axilla",
    "full legs", "lower legs", "upper legs", "legs", "bikini", "brazilian",
    "back", "shoulders", "arms", "upper lip", "chin", "jawline", "forehead",
    "abdomen", "stomach", "hands"
  ];

  let areasTreated: string[] = [];
  rawAreaPatterns.forEach((area) => {
    if (lower.includes(area) && !areasTreated.includes(area)) {
      areasTreated.push(area);
    }
  });

  // Normalize & deduplicate areas (prefer more specific)
  areasTreated = normalizeAreas(areasTreated);

  // === 2. Much smarter client name extraction ===
  let clientName = extractClientName(message);

  // === 3. Robust consumables + quantity extraction ===
  const productsUsed = extractConsumablesWithQuantity(message, lower);

  // === 4. Passes / settings / machine + real EndoPulse parameters ===
  let passesOrSettings: string | null = null;
  const settingsMatch = message.match(/(\d+)\s*(?:passes?|pass)|settings?\s*[:=]?\s*([^,\.]+)/i);
  if (settingsMatch) {
    passesOrSettings = settingsMatch[0];
  }

  // Total energy (Joules)
  let totalEnergy: string | null = null;
  const energyMatch = message.match(/(\d+)\s*(?:J|joules?|kJ)/i);
  if (energyMatch) totalEnergy = `${energyMatch[1]}J`;

  // Power in Watts
  let powerWatts: string | null = null;
  const wattsMatch = message.match(/(\d+(?:\.\d+)?)\s*W(?:atts?)?/i);
  if (wattsMatch) powerWatts = `${wattsMatch[1]}W`;

  // Number of passes
  let numPasses: number | null = null;
  const passesMatch = message.match(/(\d+)\s*(?:passes?|pass(?:es)?)/i);
  if (passesMatch) numPasses = parseInt(passesMatch[1]);

  // Wavelength (very important from the course)
  let wavelength: string | null = null;
  if (lower.includes("1470")) wavelength = "1470nm";
  else if (lower.includes("980")) wavelength = "980nm";

  // Clinical endpoint language (from tutor manual)
  const reachedClinicalEndpoint = lower.includes("clinical endpoint") || 
    lower.includes("tissue softer") || 
    lower.includes("erythema") && lower.includes("endpoint");

  if (lower.includes("endopulse") || lower.includes("endo pulse")) {
    passesOrSettings = passesOrSettings ? `endoPulse ${passesOrSettings}` : "endoPulse";
  }

  // === 5. Lidocaine / Anaesthetic (very important from Tutor Manual) ===
  let lidocaineUsed: string | null = null;
  const lidoMatch = message.match(/(\d+(?:\.\d+)?)\s*ml\s*(?:of\s*)?(?:1%|2%)?\s*(?:lidocaine|anaesthetic|numbing)/i);
  if (lidoMatch) {
    lidocaineUsed = lidoMatch[0];
  } else if (lower.includes("lidocaine") || lower.includes("anaesthetic")) {
    lidocaineUsed = "lidocaine used";
  }

  // Compression garment / bandage
  const compressionApplied = lower.includes("compression") || lower.includes("bandage") || lower.includes("garment");

  // === 6. Duration ===
  let duration: string | null = null;
  const durMatch = message.match(/(\d+)\s*(?:min|minutes|hrs|hours)/i);
  if (durMatch) duration = durMatch[0];

  // === 6. Sentiment (improved negation handling) ===
  let sentiment: "positive" | "negative" | "neutral" | "mixed" = "neutral";

  const positiveSignals = ["happy", "pleased", "satisfied", "tolerated well", "great", "excellent", "no issues", "minimal discomfort", "very happy", "lovely", "fine"];
  const negativeSignals = ["unhappy", "bad", "issue", "problem", "adverse", "reaction", "not happy", "painful"];

  const hasPositive = positiveSignals.some((w) => lower.includes(w));
  const hasNegativeWord = negativeSignals.some((w) => lower.includes(w));

  const hasProblematicReaction = (lower.includes("redness") || lower.includes("swelling")) &&
    !lower.includes("no redness") && !lower.includes("minimal redness") && !lower.includes("no swelling");

  const hasNegative = hasNegativeWord || hasProblematicReaction;

  if (hasPositive && hasNegative) sentiment = "mixed";
  else if (hasPositive) sentiment = "positive";
  else if (hasNegative) sentiment = "negative";

  // === 7. Completion + other signals ===
  const hasCompletionSignal = ["finished", "completed", "done", "all done", "wrapped up", "session complete", "treatment done"].some((w) =>
    lower.includes(w)
  );

  const hasIssues = hasNegative;
  const followUpMentioned = ["follow up", "follow-up", "next week", "in 4 weeks", "booked", "rebook", "return"].some((w) => lower.includes(w));

  return {
    areasTreated,
    clientName,
    productsUsed,
    passesOrSettings,
    totalEnergy,
    powerWatts,
    numPasses,
    wavelength,
    lidocaineUsed,
    compressionApplied,
    reachedClinicalEndpoint,
    duration,
    sentiment,
    hasCompletionSignal,
    hasIssues,
    followUpMentioned,
  };
}

/**
 * Normalize areas: remove duplicates and prefer more specific versions.
 */
function normalizeAreas(areas: string[]): string[] {
  const preferred = new Set<string>();

  const hasFull = (base: string) => areas.some(a => a.includes(base) && a.includes("full"));

  areas.forEach(area => {
    if (area === "legs" && hasFull("legs")) return;
    if (area === "face" && hasFull("face")) return;
    preferred.add(area);
  });

  return Array.from(preferred);
}

/**
 * Significantly improved client name extraction (multiple strategies).
 */
function extractClientName(message: string): string | null {
  const lower = message.toLowerCase();

  // Strategy 1: Title + Name (Mrs Thompson, Mr Patel, Ms Jane)
  const titleMatch = message.match(/\b(mrs\.?|mr\.?|ms\.?|miss)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)/i);
  if (titleMatch && titleMatch[2]) {
    return titleMatch[2];
  }

  // Strategy 2: "on [Name]", "for [Name]" with strong boundaries
  const onForMatch = message.match(/\b(?:on|for)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b(?=\s*(?:,|\.|with|using|after|today|done|completed|the|and|face|neck|jawline|arms|legs|submental|jowls)|$)/i);
  if (onForMatch && onForMatch[1]) {
    const name = onForMatch[1].trim();
    if (name.length >= 3 && !["the", "back", "face", "neck", "legs", "arms", "jowls"].includes(name.toLowerCase())) {
      return name;
    }
  }

  // Strategy 3: "client [Name]" or "[Name] was happy"
  const clientMatch = message.match(/\bclient\s+(?:was|is|named|called)?\s*([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)/i);
  if (clientMatch && clientMatch[1]) {
    return clientMatch[1];
  }

  // Strategy 4: Look for capitalized names near treatment words
  const treatmentContext = /(?:treatment|session|done|finished|completed)\s+(?:on|for)?\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)/i;
  const treatmentMatch = message.match(treatmentContext);
  if (treatmentMatch && treatmentMatch[1]) {
    const name = treatmentMatch[1];
    if (!["the", "back", "face"].includes(name.toLowerCase())) return name;
  }

  return null;
}

/**
 * Robust extraction of consumables with quantities for aesthetics.
 * Avoids double-counting by preferring longer/specific matches.
 */
function extractConsumablesWithQuantity(message: string, lower: string) {
  const productsUsed: Array<{ name: string; quantity: number }> = [];
  const alreadyMatched = new Set<string>();

  // Order matters — more specific first
  const consumables = [
    { trigger: "numbing cream", canonical: "numbing cream" },
    { trigger: "anaesthetic cream", canonical: "numbing cream" },
    { trigger: "vials of numbing", canonical: "numbing cream" },
    { trigger: "vial of numbing", canonical: "numbing cream" },
    { trigger: "numbing", canonical: "numbing cream" },
    { trigger: "aloe vera gel", canonical: "aloe vera gel" },
    { trigger: "aloe vera", canonical: "aloe vera gel" },
    { trigger: "post care gel", canonical: "post-care gel" },
    { trigger: "cooling gel", canonical: "cooling gel" },
    { trigger: "disposable tip", canonical: "disposable tip" },
    { trigger: "cartridge", canonical: "cartridge" },
  ];

  consumables.forEach(({ trigger, canonical }) => {
    if (lower.includes(trigger) && !alreadyMatched.has(canonical)) {
      let qty = 1;

      // Try to find a number near the trigger
      const numMatch = message.match(new RegExp(`(\\d+)\\s*(?:x|×)?\\s*(?:vials?|tubes?|bottles?)?\\s*(?:of\\s+)?${trigger.replace(/\s+/g, '\\s+')}`, "i"));
      if (numMatch) {
        qty = parseInt(numMatch[1]);
      } else {
        // Fallback: number immediately before
        const simple = message.match(new RegExp(`(\\d+)\\s*${trigger.replace(/\s+/g, '\\s+')}`, "i"));
        if (simple) qty = parseInt(simple[1]);
      }

      // Word numbers fallback
      if (qty === 1) {
        const wordMatch = lower.match(new RegExp(`(one|two|three|four|five)\\s+${trigger.replace(/\s+/g, '\\s+')}`));
        if (wordMatch) {
          const map: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
          qty = map[wordMatch[1]] || 1;
        }
      }

      productsUsed.push({ name: canonical, quantity: qty });
      alreadyMatched.add(canonical);
    }
  });

  return productsUsed;
}

function buildRichTreatmentNote(originalMessage: string, details: ExtractedDetails): string {
  const parts: string[] = [];

  if (details.clientName) parts.push(`Client: ${details.clientName}`);
  if (details.areasTreated.length > 0) parts.push(`Areas: ${details.areasTreated.join(", ")}`);
  if (details.passesOrSettings) parts.push(`Settings: ${details.passesOrSettings}`);
  if (details.totalEnergy) parts.push(`Energy: ${details.totalEnergy}`);
  if (details.powerWatts) parts.push(`Power: ${details.powerWatts}`);
  if (details.numPasses) parts.push(`Passes: ${details.numPasses}`);
  if (details.wavelength) parts.push(`Wavelength: ${details.wavelength}`);
  if (details.lidocaineUsed) parts.push(`Anaesthetic: ${details.lidocaineUsed}`);
  if (details.duration) parts.push(`Duration: ${details.duration}`);
  if (details.compressionApplied) parts.push(`Post-care: Compression garment applied`);
  if (details.reachedClinicalEndpoint) parts.push(`Clinical endpoint reached`);
  if (details.productsUsed.length > 0) {
    parts.push(`Consumables: ${details.productsUsed.map(p => `${p.quantity}× ${p.name}`).join(", ")}`);
  }

  parts.push(`Practitioner note: ${originalMessage}`);

  if (details.sentiment === "positive") parts.push("Client feedback: Positive experience");
  if (details.sentiment === "negative") parts.push("⚠ Client feedback: Issues reported — review recommended");

  return parts.join(" | ");
}

function buildSummary(details: ExtractedDetails, actions: HermesAction[]): string {
  const actionTypes = actions.map((a) => a.type.replace(/_/g, " "));

  let summary = `Proposed: ${actionTypes.join(" + ")}`;

  if (details.areasTreated.length > 0) {
    summary += ` — ${details.areasTreated.slice(0, 3).join(", ")}`;
    if (details.areasTreated.length > 3) summary += ` +${details.areasTreated.length - 3} more`;
  }
  if (details.clientName) {
    summary += ` for ${details.clientName}`;
  }

  return summary;
}
