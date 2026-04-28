import type { Express, Request, Response, NextFunction } from "express";
import { Resend } from "resend";
import type { Server } from "node:http";
import { WebSocketServer, WebSocket as WS } from "ws";
import multer from "multer";
import Groq from "groq-sdk";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { supabase, supabaseForUser } from "./supabase";
import {
  clientInsertSchema,
  treatmentInsertSchema,
  bookingInsertSchema,
  leadInsertSchema,
  quoteInsertSchema,
  consentInsertSchema,
  aiFrontDeskAnalyseSchema,
  socialPostInsertSchema,
  socialPostGenerateSchema,
} from "../shared/schema";
import { randomUUID } from "node:crypto";
import { DEMO_INDUSTRIES } from "./demoData";

// --- AUTH MIDDLEWARE ---
type AuthedRequest = Request & {
  user?: { id: string; email: string | null };
  token?: string;
  db?: ReturnType<typeof supabaseForUser>;
};

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ message: "Missing auth token" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    req.user = { id: data.user.id, email: data.user.email ?? null };
    req.token = token;
    req.db = supabaseForUser(token);
    next();
  } catch (e: any) {
    res.status(401).json({ message: e.message || "Auth failed" });
  }
}

// Helper: AI score for leads
function computeAiScore(lead: {
  phone?: string | null;
  email?: string | null;
  treatment_interest?: string | null;
  source?: string | null;
  created_at?: string;
}): number {
  let s = 50;
  if (lead.phone) s += 15;
  if (lead.email) s += 10;
  if (lead.treatment_interest) s += 10;
  if (lead.source === "referral") s += 15;
  const createdAt = lead.created_at ? new Date(lead.created_at).getTime() : Date.now();
  const ageHrs = (Date.now() - createdAt) / 36e5;
  if (ageHrs < 24) s += 10;
  if (ageHrs > 72) s -= 10;
  return Math.min(100, Math.max(0, s));
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Health
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // ========== VAPI AI RECEPTIONIST ==========

  // PUBLIC webhook — Vapi posts here after every call
  app.post("/api/vapi/webhook", async (req: Request, res: Response) => {
    try {
      const event = req.body;
      const type = event?.message?.type;

      if (type === "end-of-call-report") {
        const msg = event.message;
        const callId = msg.call?.id;
        const callerNumber = msg.call?.customer?.number || "Unknown";
        const startedAt = msg.call?.startedAt || msg.startedAt;
        const endedAt = msg.call?.endedAt || msg.endedAt;
        const durationSecs = Math.round(
          startedAt && endedAt
            ? (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
            : 0,
        );
        const summary = msg.summary || "";
        const transcript = msg.transcript || "";
        const recordingUrl = msg.recordingUrl || msg.stereoRecordingUrl || null;

        // Parse enquiry type from summary using simple keyword matching
        const summaryLower = summary.toLowerCase();
        let enquiryType = "other";
        if (summaryLower.includes("training")) enquiryType = "training";
        else if (summaryLower.includes("machine") || summaryLower.includes("device"))
          enquiryType = "machine";
        else if (summaryLower.includes("model call") || summaryLower.includes("model"))
          enquiryType = "model_call";
        else if (
          summaryLower.includes("price") ||
          summaryLower.includes("cost") ||
          summaryLower.includes("how much")
        )
          enquiryType = "pricing";
        else if (summaryLower.includes("book") || summaryLower.includes("appointment"))
          enquiryType = "booking";
        else if (summaryLower.includes("insurance")) enquiryType = "insurance";
        else if (
          summaryLower.includes("treatment") ||
          summaryLower.includes("skin") ||
          summaryLower.includes("fat")
        )
          enquiryType = "treatment";

        // Extract caller name from transcript if mentioned
        let callerName: string | null = null;
        const nameMatch = transcript.match(
          /(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)/i,
        );
        if (nameMatch) callerName = nameMatch[1];

        // Insert call log (webhook doesn't know which user — user_id left null)
        await supabase.from("call_logs").insert({
          vapi_call_id: callId,
          caller_number: callerNumber,
          caller_name: callerName,
          duration_secs: durationSecs,
          status: "completed",
          summary,
          transcript,
          enquiry_type: enquiryType,
          recording_url: recordingUrl,
          metadata: { raw: msg },
        } as any);

        // Auto-create lead if caller seems interested and gave their name
        if (
          callerName &&
          ["training", "machine", "treatment", "pricing"].includes(enquiryType)
        ) {
          const { data: lead } = await supabase
            .from("leads")
            .insert({
              name: callerName,
              phone: callerNumber,
              source: "manual",
              treatment_interest:
                enquiryType === "training"
                  ? "endoPulse™ Training"
                  : "endoPulse™ Treatment",
              status: "new",
              ai_score: 65,
              notes: `Auto-created from phone call. Summary: ${summary.slice(0, 200)}`,
            } as any)
            .select()
            .single();

          if (lead) {
            await supabase
              .from("call_logs")
              .update({ lead_created: true, lead_id: (lead as any).id } as any)
              .eq("vapi_call_id", callId);
          }
        }
      }

      res.json({ received: true });
    } catch (e: any) {
      console.error("Vapi webhook error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Get call logs for authenticated user
  app.get("/api/calls", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data, error } = await supabaseForUser(req.token!)
      .from("call_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  // Store Vapi key against user (in users.metadata)
  app.post("/api/settings/vapi-key", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { vapi_key, assistant_id, phone_number_id, phone_number } = req.body || {};
    const db = supabaseForUser(req.token!);
    // Fetch current metadata first
    const { data: current } = await db
      .from("users")
      .select("metadata")
      .eq("id", req.user!.id)
      .single();
    const next = {
      ...((current as any)?.metadata || {}),
      ...(vapi_key !== undefined ? { vapi_key } : {}),
      ...(assistant_id !== undefined ? { vapi_assistant_id: assistant_id } : {}),
      ...(phone_number_id !== undefined ? { vapi_phone_number_id: phone_number_id } : {}),
      ...(phone_number !== undefined ? { vapi_phone_number: phone_number } : {}),
    };
    const { error } = await db
      .from("users")
      .update({ metadata: next } as any)
      .eq("id", req.user!.id);
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true });
  });

  app.get("/api/settings/vapi-key", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data } = await supabaseForUser(req.token!)
      .from("users")
      .select("metadata")
      .eq("id", req.user!.id)
      .single();
    const md = (data as any)?.metadata || {};
    res.json({
      vapi_key: md.vapi_key || null,
      assistant_id: md.vapi_assistant_id || null,
      phone_number_id: md.vapi_phone_number_id || null,
      phone_number: md.vapi_phone_number || null,
    });
  });

  app.delete("/api/settings/vapi-key", requireAuth, async (req: AuthedRequest, res: Response) => {
    const db = supabaseForUser(req.token!);
    const { data: current } = await db
      .from("users")
      .select("metadata")
      .eq("id", req.user!.id)
      .single();
    const md = { ...((current as any)?.metadata || {}) };
    delete md.vapi_key;
    delete md.vapi_assistant_id;
    delete md.vapi_phone_number_id;
    delete md.vapi_phone_number;
    const { error } = await db
      .from("users")
      .update({ metadata: md } as any)
      .eq("id", req.user!.id);
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true });
  });

  // Create/update Vapi assistant via Vapi API
  app.post(
    "/api/vapi/create-assistant",
    requireAuth,
    async (req: AuthedRequest, res: Response) => {
      const vapiKey = req.body.api_key;
      if (!vapiKey) return res.status(400).json({ message: "Vapi API key required" });

      const origin =
        (req.headers.origin as string) ||
        `${req.protocol}://${req.headers.host}` ||
        "https://fieldflow.app";

      // Pull business info to personalise the assistant
      let bizProducts = "";
      let bizFaqs = "";
      let bizWebsite = "";
      let bizName = "this business";
      try {
        const { data: userInfo } = await supabaseForUser(req.token!)
          .from("users")
          .select("business_name")
          .eq("id", req.user!.id)
          .single();
        if (userInfo?.business_name) bizName = userInfo.business_name;

        const { data: bizInfo } = await supabaseForUser(req.token!)
          .from("business_info")
          .select("*")
          .eq("user_id", req.user!.id)
          .single();
        if (bizInfo?.products?.length) {
          bizProducts = (bizInfo.products as any[]).map((p: any) =>
            `- ${p.name}${p.price ? ` — ${p.price}` : ""}${p.description ? `: ${p.description}` : ""}`
          ).join("\n");
        }
        if (bizInfo?.faqs?.length) {
          bizFaqs = (bizInfo.faqs as any[]).map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
        }
        if (bizInfo?.website_url) bizWebsite = bizInfo.website_url;
      } catch {}

      const assistantConfig = {
        name: `Safi — ${bizName}`,
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are Safi, the friendly AI phone assistant for ${bizName}.

YOUR PERSONALITY:
- Warm, confident, professional. Short conversational sentences — this is a phone call.
- You are a knowledgeable sales assistant, not a gatekeeper
- Give prices confidently and directly when asked — never be vague
- Be helpful and informative, not pushy

KEY FACTS:
- All courses are 100% online, self-paced, and CPD accredited
- No licence is required in the UK to purchase or complete any of these courses
- No consultation needed — courses can be purchased directly from the website
- Payment plans available via Clearpay and Klarna (3–4 interest-free payments)
- All purchases are non-refundable
- Website: ${bizWebsite || "your website"}

PRODUCTS & PRICES:
${bizProducts || `- Nose Slimming Course — £499
- Dry Needling Course — £399
- Skinny IV Drip Course — £499
- Vaginal HIFU Course — £599
- Hollywood 8-Point Facelift Course — £399
- Microblading Course — £499
- Sculptra® Course — £299
- Breast Filler Course — £599
- BBL Dermal Filler Course — £699
- Online Lip Blush Training Course — £599
- Methylene Blue IV Drip Course — £399.99
- Endopulse 980nm + 1470nm Dual Wavelength Machine — £2,999
- JARO DROPS (wellness supplement) — £99
- Model Booking (EndoPulse under-eye treatment) — £500`}
${bizFaqs ? `\nFREQUENTLY ASKED QUESTIONS:\n${bizFaqs}` : ""}

CALL HANDLING:
1. Greet warmly: "Hi, thanks for calling ${bizName}! I'm Safi, how can I help you today?"
2. Answer their question directly using the knowledge above
3. If they ask about a course — give the name, price, one sentence on what it covers, and direct them to the website to purchase
4. If they want to know more — offer to go through the details with them
5. Always offer to take their name and email so the team can follow up if needed
6. End warmly: "Brilliant! Is there anything else I can help you with today?"

IMPORTANT:
- Never make up products or prices not listed above
- If unsure on anything, say "I'll make sure the team gets back to you on that personally"
- Keep responses short — this is a phone call, not an essay
- Always direct people to the website to purchase`,
            },
          ],
          temperature: 0.7,
          maxTokens: 250,
        },
        voice: {
          provider: "11labs",
          voiceId: "rachel",
          stability: 0.5,
          similarityBoost: 0.75,
        },
        firstMessage:
          `Hi, thanks for calling ${bizName}! I'm Safi, how can I help you today?`,
        endCallMessage:
          "Brilliant! Thanks so much for calling. Have a lovely day!",
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en-GB",
        },
        serverUrl: `${origin}/api/vapi/webhook`,
        recordingEnabled: true,
        endCallPhrases: ["goodbye", "bye", "thank you goodbye", "thanks bye"],
        maxDurationSeconds: 600,
        backgroundSound: "off",
        hipaaEnabled: false,
        silenceTimeoutSeconds: 30,
        responseDelaySeconds: 0.4,
        llmRequestDelaySeconds: 0.1,
        numWordsToInterruptAssistant: 3,
        metadata: { business: "endoPulse" },
      };

      try {
        const response = await fetch("https://api.vapi.ai/assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${vapiKey}`,
          },
          body: JSON.stringify(assistantConfig),
        });
        const data: any = await response.json();
        if (!response.ok)
          return res.status(response.status).json({ message: data.message || "Vapi error" });
        res.json({ assistant_id: data.id, assistant: data });
      } catch (e: any) {
        res.status(502).json({ message: "Failed to create Vapi assistant: " + e.message });
      }
    },
  );

  // Get Vapi phone numbers
  app.get("/api/vapi/phone-numbers", requireAuth, async (req: AuthedRequest, res: Response) => {
    const vapiKey = req.headers["x-vapi-key"] as string;
    if (!vapiKey) return res.status(400).json({ message: "Vapi API key required" });
    try {
      const response = await fetch("https://api.vapi.ai/phone-number", {
        headers: { Authorization: `Bearer ${vapiKey}` },
      });
      const data = await response.json();
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: e.message });
    }
  });

  // Buy a UK phone number via Vapi
  app.post("/api/vapi/buy-number", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { api_key, assistant_id } = req.body;
    if (!api_key) return res.status(400).json({ message: "Vapi API key required" });
    try {
      const response = await fetch("https://api.vapi.ai/phone-number/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api_key}`,
        },
        body: JSON.stringify({
          provider: "twilio",
          numberDesiredAreaCode: "020",
          assistantId: assistant_id,
          name: "endoPulse™ Receptionist Line",
        }),
      });
      const data: any = await response.json();
      if (!response.ok)
        return res.status(response.status).json({ message: data.message || "Vapi error" });
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: e.message });
    }
  });

  // Create a lead from a call log
  app.post(
    "/api/calls/:id/create-lead",
    requireAuth,
    async (req: AuthedRequest, res: Response) => {
      const db = supabaseForUser(req.token!);
      const { data: call } = await db
        .from("call_logs")
        .select("*")
        .eq("id", req.params.id)
        .single();
      if (!call) return res.status(404).json({ message: "Call not found" });
      const c: any = call;
      const { data: lead, error } = await db
        .from("leads")
        .insert({
          name: c.caller_name || "Unknown caller",
          phone: c.caller_number,
          source: "manual",
          treatment_interest:
            c.enquiry_type === "training"
              ? "endoPulse™ Training"
              : "endoPulse™ Treatment",
          status: "new",
          ai_score: 65,
          notes: `Created from phone call. ${c.summary ? `Summary: ${c.summary}` : ""}`,
        } as any)
        .select()
        .single();
      if (error) return res.status(500).json({ message: error.message });
      await db
        .from("call_logs")
        .update({ lead_created: true, lead_id: (lead as any).id } as any)
        .eq("id", req.params.id);
      res.json(lead);
    },
  );

  // ========== END VAPI ==========


  // === Auth-free public consent endpoints (token-based) ===
  app.get("/api/consent/sign/:token", async (req, res) => {
    const { token } = req.params;
    const { data, error } = await supabase
      .from("consent_forms")
      .select("*, clients(name,email), bookings(date,time)")
      .eq("token", token)
      .maybeSingle();
    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(404).json({ message: "Not found" });
    // Mark viewed if pending/sent
    if (data.status === "sent" || data.status === "pending") {
      await supabase.from("consent_forms").update({ status: "viewed" }).eq("token", token);
    }
    res.json(data);
  });

  app.patch("/api/consent/sign/:token", async (req, res) => {
    const { token } = req.params;
    const { form_data } = req.body || {};
    const { data, error } = await supabase
      .from("consent_forms")
      .update({ status: "signed", signed_at: new Date().toISOString(), form_data })
      .eq("token", token)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  // ============ AUTHED ROUTES =============
  app.use("/api", (req, res, next) => {
    // Skip auth for public consent endpoints and health
    if (req.path.startsWith("/consent/sign/") || req.path === "/health") return next();
    return requireAuth(req as AuthedRequest, res, next);
  });

  // ---- USERS / PROFILE ----
  app.get("/api/me", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    // Ensure a users row exists for this auth user
    const { data: existing } = await db.from("users").select("*").eq("id", req.user!.id).maybeSingle();
    if (!existing) {
      const { data: created, error } = await db
        .from("users")
        .insert({ id: req.user!.id, email: req.user!.email, name: req.user!.email?.split("@")[0] || "User" })
        .select()
        .single();
      if (error) return res.status(500).json({ message: error.message });
      return res.json(created);
    }
    res.json(existing);
  });

  app.patch("/api/me", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const allowed = [
      "name", "avatar_url",
      "business_name", "business_phone", "business_address", "business_website",
      "payment_terms", "bank_details", "logo_url", "vat_number", "company_number",
    ];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (key in (req.body || {})) updates[key] = req.body[key];
    }
    const { data, error } = await db
      .from("users")
      .update(updates)
      .eq("id", req.user!.id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  // Upload business logo to client-photos bucket and return public URL
  app.post("/api/me/logo", requireAuth, async (req: AuthedRequest, res: Response) => {
    const db = req.db!;
    const contentType = req.headers["content-type"] || "image/png";
    const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("png") ? "png" : "webp";
    const path = `logos/${req.user!.id}.${ext}`;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    await new Promise((r) => req.on("end", r));
    const buf = Buffer.concat(chunks);
    const { error: upErr } = await db.storage.from("client-photos").upload(path, buf, { contentType, upsert: true });
    if (upErr) return res.status(500).json({ message: upErr.message });
    const { data: urlData } = db.storage.from("client-photos").getPublicUrl(path);
    const logoUrl = urlData.publicUrl;
    await db.from("users").update({ logo_url: logoUrl }).eq("id", req.user!.id);
    res.json({ logo_url: logoUrl });
  });

  // ---- DASHBOARD STATS ----
  app.get("/api/dashboard/stats", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const userId = req.user!.id;
    const today = new Date().toISOString().slice(0, 10);

    const sixMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString().slice(0, 10);

    const [bookingsToday, activeClients, newLeads, pendingQuotes, highScoreLeads, paidInvoices, todayInvoices] =
      await Promise.all([
        db
          .from("bookings")
          .select("*, clients(name), treatments(name,price,duration_mins)")
          .eq("user_id", userId)
          .eq("date", today)
          .order("time", { ascending: true }),
        db.from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId).in("stage", ["active", "vip", "prospect"]),
        db.from("leads").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "new"),
        db.from("quotes").select("amount").eq("user_id", userId).in("status", ["draft", "sent", "viewed"]),
        db
          .from("leads")
          .select("*")
          .eq("user_id", userId)
          .gte("ai_score", 80)
          .in("status", ["new", "contacted"])
          .order("ai_score", { ascending: false })
          .limit(5),
        // Revenue chart: paid invoices last 6 months
        db
          .from("invoices")
          .select("total, paid_at, issue_date")
          .eq("user_id", userId)
          .eq("status", "paid")
          .gte("issue_date", sixMonthsAgo),
        // Today's revenue: invoices paid today OR issued today and paid
        db
          .from("invoices")
          .select("total")
          .eq("user_id", userId)
          .eq("status", "paid")
          .eq("issue_date", today),
      ]);

    const todaysRevenue =
      todayInvoices.data?.reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0) || 0;

    const pendingQuotesValue =
      pendingQuotes.data?.reduce((sum: number, q: any) => sum + Number(q.amount || 0), 0) || 0;

    // Revenue last 6 months — bucketed by invoice issue_date month
    const now = new Date();
    const months: { key: string; label: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: d.toLocaleString("en-GB", { month: "short" }), revenue: 0 });
    }
    paidInvoices.data?.forEach((inv: any) => {
      const dateStr = inv.paid_at ? inv.paid_at.slice(0, 7) : inv.issue_date?.slice(0, 7);
      if (!dateStr) return;
      const m = months.find((x) => x.key === dateStr);
      if (m) m.revenue += Number(inv.total || 0);
    });

    res.json({
      todaysRevenue,
      activeClientsCount: activeClients.count || 0,
      newLeadsCount: newLeads.count || 0,
      pendingQuotesValue,
      pendingQuotesCount: pendingQuotes.data?.length || 0,
      todaysBookings: bookingsToday.data || [],
      highScoreLeads: highScoreLeads.data || [],
      revenueByMonth: months,
    });
  });

  // ---- CLIENTS ----
  app.get("/api/clients", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { q, stage } = req.query as Record<string, string>;
    let query = db.from("clients").select("*").eq("user_id", req.user!.id).order("created_at", { ascending: false });
    if (stage) query = query.eq("stage", stage);
    const { data, error } = await query;
    if (error) return res.status(500).json({ message: error.message });
    let list = data || [];
    if (q) {
      const qq = q.toLowerCase();
      list = list.filter(
        (c: any) =>
          c.name?.toLowerCase().includes(qq) ||
          c.email?.toLowerCase().includes(qq) ||
          c.phone?.toLowerCase().includes(qq),
      );
    }
    res.json(list);
  });

  app.get("/api/clients/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { id } = req.params;
    const [client, bookings, timeline] = await Promise.all([
      db.from("clients").select("*").eq("id", id).eq("user_id", req.user!.id).single(),
      db
        .from("bookings")
        .select("*, treatments(name,price,duration_mins)")
        .eq("client_id", id)
        .order("date", { ascending: false })
        .limit(20),
      db.from("client_timeline").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(30),
    ]);
    if (client.error) return res.status(404).json({ message: client.error.message });
    res.json({ client: client.data, bookings: bookings.data || [], timeline: timeline.data || [] });
  });

  app.post("/api/clients", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const parsed = clientInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { data, error } = await db
      .from("clients")
      .insert({ ...parsed.data, user_id: req.user!.id, stage: parsed.data.stage || "prospect" })
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.patch("/api/clients/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { id } = req.params;
    const { data, error } = await db
      .from("clients")
      .update(req.body || {})
      .eq("id", id)
      .eq("user_id", req.user!.id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.delete("/api/clients/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { id } = req.params;
    const { error } = await db.from("clients").delete().eq("id", id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ---- TREATMENTS ----
  app.get("/api/treatments", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("treatments")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("price", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/treatments", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const parsed = treatmentInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { data, error } = await db
      .from("treatments")
      .insert({ ...parsed.data, user_id: req.user!.id, is_active: parsed.data.is_active ?? true })
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.patch("/api/treatments/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("treatments")
      .update(req.body || {})
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.delete("/api/treatments/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db.from("treatments").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  app.post("/api/treatments/seed", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data: existing } = await db.from("treatments").select("id").eq("user_id", req.user!.id).limit(1);
    if (existing && existing.length > 0) return res.json({ seeded: false, existing: true });
    const seeds = [
      { name: "endoPulse™ Full Body Laser Skin Tightening", duration_mins: 90, price: 650, description: "Full body non-invasive laser skin tightening treatment." },
      { name: "endoPulse™ Abdomen Laser Fat Melting", duration_mins: 60, price: 450, description: "Targeted abdominal fat melting with laser technology." },
      { name: "endoPulse™ Arms Laser Contouring", duration_mins: 45, price: 350, description: "Laser contouring for upper arms." },
      { name: "endoPulse™ Thighs Laser Contouring", duration_mins: 60, price: 420, description: "Laser contouring for thighs." },
      { name: "endoPulse™ Face & Neck Skin Tightening", duration_mins: 45, price: 380, description: "Face and neck skin tightening." },
      { name: "Patch Test", duration_mins: 15, price: 0, description: "Required patch test before treatment." },
    ].map((t) => ({ ...t, user_id: req.user!.id, is_active: true }));
    const { data, error } = await db.from("treatments").insert(seeds).select();
    if (error) return res.status(500).json({ message: error.message });
    res.json({ seeded: true, treatments: data });
  });

  // ---- BOOKINGS ----
  app.get("/api/bookings", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { from, to } = req.query as Record<string, string>;
    let query = db
      .from("bookings")
      .select("*, clients(id,name,phone,email), treatments(id,name,duration_mins,price)")
      .eq("user_id", req.user!.id)
      .order("date", { ascending: true })
      .order("time", { ascending: true });
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    const { data, error } = await query;
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/bookings", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const parsed = bookingInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { data, error } = await db
      .from("bookings")
      .insert({
        ...parsed.data,
        user_id: req.user!.id,
        status: parsed.data.status || "confirmed",
        deposit_paid: parsed.data.deposit_paid ?? false,
        deposit_amount: parsed.data.deposit_amount ?? 0,
      })
      .select("*, clients(name), treatments(name,price)")
      .single();
    if (error) return res.status(500).json({ message: error.message });
    // Timeline event
    await db.from("client_timeline").insert({
      client_id: parsed.data.client_id,
      user_id: req.user!.id,
      type: "booking",
      description: `Booking created for ${data.treatments?.name || "treatment"} on ${parsed.data.date} ${parsed.data.time}`,
      amount: Number(data.treatments?.price || 0),
      metadata: { booking_id: data.id },
    });
    res.json(data);
  });

  app.patch("/api/bookings/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { id } = req.params;
    const { data, error } = await db
      .from("bookings")
      .update(req.body || {})
      .eq("id", id)
      .eq("user_id", req.user!.id)
      .select("*, clients(name), treatments(name,price)")
      .single();
    if (error) return res.status(500).json({ message: error.message });
    if (req.body?.status === "completed") {
      await db.from("client_timeline").insert({
        client_id: data.client_id,
        user_id: req.user!.id,
        type: "treatment_completed",
        description: `${data.treatments?.name || "Treatment"} completed`,
        amount: Number(data.treatments?.price || 0),
        metadata: { booking_id: id },
      });
    }
    res.json(data);
  });

  app.delete("/api/bookings/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db.from("bookings").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ---- LEADS ----
  app.get("/api/leads", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { status, source } = req.query as Record<string, string>;
    let query = db.from("leads").select("*").eq("user_id", req.user!.id).order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (source) query = query.eq("source", source);
    const { data, error } = await query;
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/leads", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const parsed = leadInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const ai_score = computeAiScore({ ...parsed.data, created_at: new Date().toISOString() });
    const { data, error } = await db
      .from("leads")
      .insert({
        ...parsed.data,
        user_id: req.user!.id,
        status: parsed.data.status || "new",
        source: parsed.data.source || "manual",
        ai_score,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.patch("/api/leads/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("leads")
      .update(req.body || {})
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.delete("/api/leads/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db.from("leads").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  app.post("/api/leads/:id/convert", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { id } = req.params;
    const { data: lead, error: leadErr } = await db
      .from("leads")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user!.id)
      .single();
    if (leadErr || !lead) return res.status(404).json({ message: "Lead not found" });

    const { data: client, error: clientErr } = await db
      .from("clients")
      .insert({
        user_id: req.user!.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        notes: lead.notes ? `Converted from lead. Notes: ${lead.notes}` : "Converted from lead",
        stage: "prospect",
      })
      .select()
      .single();
    if (clientErr) return res.status(500).json({ message: clientErr.message });

    await db.from("leads").update({ status: "converted" }).eq("id", id);
    await db.from("client_timeline").insert({
      client_id: client.id,
      user_id: req.user!.id,
      type: "lead_converted",
      description: `Converted from ${lead.source} lead`,
      metadata: { lead_id: id },
    });
    res.json({ client, lead_id: id });
  });

  // ---- QUOTES ----
  app.get("/api/quotes", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("quotes")
      .select("*, clients(id,name,email,phone), treatments(id,name,duration_mins)")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/quotes", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const parsed = quoteInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const insert: any = { ...parsed.data, user_id: req.user!.id, status: parsed.data.status || "draft" };
    if (insert.status === "sent") insert.sent_at = new Date().toISOString();
    const { data, error } = await db
      .from("quotes")
      .insert(insert)
      .select("*, clients(name), treatments(name)")
      .single();
    if (error) return res.status(500).json({ message: error.message });
    await db.from("client_timeline").insert({
      client_id: parsed.data.client_id,
      user_id: req.user!.id,
      type: "quote",
      description: `Quote created for £${parsed.data.amount}`,
      amount: parsed.data.amount,
      metadata: { quote_id: data.id },
    });
    res.json(data);
  });

  app.patch("/api/quotes/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const updates: any = { ...(req.body || {}) };
    if (updates.status === "sent" && !updates.sent_at) updates.sent_at = new Date().toISOString();
    if (updates.status === "viewed" && !updates.viewed_at) updates.viewed_at = new Date().toISOString();
    const { data, error } = await db
      .from("quotes")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.delete("/api/quotes/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db.from("quotes").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // Convert accepted quote to invoice
  app.post("/api/quotes/:id/convert-to-invoice", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const userId = req.user!.id;

    // Fetch the quote with client details
    const { data: quote, error: qErr } = await db
      .from("quotes")
      .select("*, clients(id, name, email)")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();
    if (qErr || !quote) return res.status(404).json({ message: "Quote not found" });
    if (!(["accepted", "invoiced"].includes(quote.status))) {
      return res.status(400).json({ message: "Only accepted quotes can be converted to invoices" });
    }

    // Build line items from quote line_items or fall back to single description row
    let rawItems: any[] = [];
    try {
      const parsed = typeof quote.line_items === "string" ? JSON.parse(quote.line_items) : (quote.line_items || []);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Quote items have { item, qty, unitPrice } — map to invoice format { description, quantity, unit_price, total }
        rawItems = parsed.map((li: any) => ({
          description: li.item,
          quantity: li.qty ?? 1,
          unit_price: li.unitPrice ?? 0,
          total: (li.qty ?? 1) * (li.unitPrice ?? 0),
        }));
      }
    } catch (_) {}

    // Fall back: single line item from description + amount
    if (rawItems.length === 0) {
      rawItems = [{
        description: quote.description || "Services",
        quantity: 1,
        unit_price: Number(quote.amount),
        total: Number(quote.amount),
      }];
    }

    const subtotal = rawItems.reduce((s: number, i: any) => s + (i.total || 0), 0);

    // Generate invoice number
    const { count } = await db.from("invoices").select("*", { count: "exact", head: true }).eq("user_id", userId);
    const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, "0")}`;

    const due = new Date();
    due.setDate(due.getDate() + 30);
    const dueDate = due.toISOString().split("T")[0];
    const issueDate = new Date().toISOString().split("T")[0];

    const clientId = quote.client_id || null;
    const clientName = quote.clients?.name || null;
    const clientEmail = quote.clients?.email || null;

    // Create the invoice
    const { data: invoice, error: invErr } = await db
      .from("invoices")
      .insert({
        user_id: userId,
        client_id: clientId,
        client_name: clientName,
        client_email: clientEmail,
        invoice_number: invoiceNumber,
        status: "draft",
        issue_date: issueDate,
        due_date: dueDate,
        items: JSON.stringify(rawItems),
        subtotal,
        tax_rate: 0,
        tax_amount: 0,
        total: subtotal,
        notes: quote.description ? `Converted from quote: ${quote.description}` : null,
      })
      .select()
      .single();
    if (invErr) return res.status(500).json({ message: invErr.message });

    // Mark quote as invoiced
    await db.from("quotes").update({ status: "invoiced" }).eq("id", req.params.id).eq("user_id", userId);

    res.json({ invoice, invoiceNumber });
  });

  // ---- CONSENT ----
  app.get("/api/consent", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("consent_forms")
      .select("*, clients(id,name,email), bookings(id,date,time)")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/consent", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const parsed = consentInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const token = randomUUID().replace(/-/g, "");
    const { data, error } = await db
      .from("consent_forms")
      .insert({
        ...parsed.data,
        user_id: req.user!.id,
        token,
        status: "sent",
      })
      .select("*, clients(name,email)")
      .single();
    if (error) return res.status(500).json({ message: error.message });
    await db.from("client_timeline").insert({
      client_id: parsed.data.client_id,
      user_id: req.user!.id,
      type: "consent",
      description: `Consent form sent: ${parsed.data.form_type}`,
      metadata: { consent_id: data.id, token },
    });
    res.json(data);
  });

  app.patch("/api/consent/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("consent_forms")
      .update(req.body || {})
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.delete("/api/consent/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db.from("consent_forms").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ---- AI FRONT DESK ----
  app.post("/api/ai-front-desk/analyse", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const parsed = aiFrontDeskAnalyseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { message, channel = "manual" } = parsed.data;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "placeholder_will_be_injected" || apiKey.length < 10) {
      return res.status(503).json({
        message:
          "AI assistant unavailable — GROQ_API_KEY is not configured on the server.",
      });
    }

    const systemPrompt = `You are Jono's AI assistant for endoPulse\u2122 \u2014 a UK aesthetics business. Your job is to analyse incoming messages and draft replies in Jono's exact voice.

Jono's voice:
- Warm, short sentences. Gets to the point fast.
- Ends messages with "xx"
- Uses \u2b50\ufe0f for quality/excitement, \u26a0\ufe0f for exclusivity/urgency, \ud83d\ude0a to soften pricing
- Creates urgency: "high volume of messages", "just 1 space left"
- Never lists prices upfront \u2014 gets them to engage first
- Asks for a photo to qualify model candidates
- Never pushes when someone can't afford it \u2014 lets them go warmly

Business info:
- endoPulse\u2122 dual wavelength laser (980nm fat melting + 1470nm skin tightening)
- Online training: \u00a3400 | In-house training (Harley Street/Liverpool): \u00a31,500 | Machine: \u00a32,999 | Klarna available
- Insurance: Finch Insurance, PolicyBee
- Instagram: @endopulse

Respond ONLY with a JSON object (no markdown, no code blocks) with exactly these fields:
{
  "category": one of ["Training Enquiry", "Model Call", "Pricing", "Insurance", "Machine Purchase", "Follow-up", "Other"],
  "drafted_reply": "the reply message in Jono's voice",
  "next_action": one of ["Add to Leads", "Create Booking", "Send Quote", "No action needed"]
}`;

    let aiResult: { category: string; drafted_reply: string; next_action: string };
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Analyse this incoming message and draft a reply:\n\n"${message}"`,
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        return res.status(502).json({
          message: `AI service error (${response.status}). ${errText.slice(0, 200)}`,
        });
      }
      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content || "{}";
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      // Try to locate a JSON object if the model wrapped prose
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      const jsonSlice =
        jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
      aiResult = JSON.parse(jsonSlice);
    } catch (err: any) {
      return res.status(502).json({
        message: `AI service call failed: ${err?.message || "unknown error"}`,
      });
    }

    const validCategories = [
      "Training Enquiry",
      "Model Call",
      "Pricing",
      "Insurance",
      "Machine Purchase",
      "Follow-up",
      "Other",
    ];
    const validActions = [
      "Add to Leads",
      "Create Booking",
      "Send Quote",
      "No action needed",
    ];
    const category = validCategories.includes(aiResult.category) ? aiResult.category : "Other";
    const next_action = validActions.includes(aiResult.next_action)
      ? aiResult.next_action
      : "No action needed";
    const drafted_reply = String(aiResult.drafted_reply || "").trim();

    const { data: saved, error } = await db
      .from("ai_front_desk")
      .insert({
        user_id: req.user!.id,
        channel,
        message_in: message,
        category,
        drafted_reply,
        next_action,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(saved);
  });

  app.get("/api/ai-front-desk", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("ai_front_desk")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.delete("/api/ai-front-desk/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db
      .from("ai_front_desk")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ---- SOCIAL POSTS ----
  app.get("/api/social-posts", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("social_posts")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/social-posts", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const parsed = socialPostInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { data, error } = await db
      .from("social_posts")
      .insert({
        ...parsed.data,
        user_id: req.user!.id,
        status: parsed.data.status || "draft",
      })
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.patch("/api/social-posts/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const updates: any = { ...(req.body || {}) };
    if (updates.status === "posted" && !updates.posted_at) {
      updates.posted_at = new Date().toISOString();
    }
    const { data, error } = await db
      .from("social_posts")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.delete("/api/social-posts/:id", requireAuth, async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db
      .from("social_posts")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  app.post("/api/social-posts/generate", requireAuth, async (req: AuthedRequest, res) => {
    const parsed = socialPostGenerateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { post_type, platform, topic, extra_context } = parsed.data;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "placeholder_will_be_injected" || apiKey.length < 10) {
      return res.status(503).json({
        message:
          "AI generation unavailable — GROQ_API_KEY is not configured on the server.",
      });
    }

    const SYSTEM_PROMPT = `You are a social media expert for endoPulse\u2122 \u2014 a UK aesthetics business run by Jono.

JONO'S VOICE (follow exactly):
- Warm, punchy, short sentences. Gets to the point fast. No waffle.
- Casual \u2014 occasional typos like "your" instead of "you're" feel authentic
- Ends some posts with "xx" for warmth
- Uses \u2b50\ufe0f for quality, \u26a0\ufe0f for exclusivity/urgency, \ud83e\udd8b for warmth, \ud83e\udde0 for insight
- Income claims: "\u00a35k a week", "10k a month", "\u00a3800 per treatment"
- Never lists prices upfront \u2014 gets them to comment/DM first
- Challenges practitioners: "if you're not offering this, why not?"
- Creates FOMO: "celebrities are paying thousands for this"
- CTA: always ends with comment keyword OR DM instruction
- Hashtags: exactly 5, always include #fyp, mix niche + broad

BUSINESS FACTS:
- endoPulse\u2122 dual wavelength laser (980nm fat melting + 1470nm skin tightening)
- Can't be replicated by single-wavelength devices
- Treatments: face, neck, jawline, under eyes, jowls, tummy, arms, thighs, back
- Client pricing: from \u00a3450\u2013\u00a3800+ per session
- Training: online \u00a3400, in-house \u00a31,500 (Harley Street London + Rodney Street Liverpool)
- Machine: \u00a32,999, breaks even in 4 sessions
- CPD accredited, covered by Finch Insurance and PolicyBee
- Results visible immediately, improve over weeks as collagen rebuilds
- UK trademarked

POST TYPES:
- practitioner_pitch: Challenge practitioners to add endoPulse\u2122, income claims, FOMO
- client_results: Speak to clients about results, no surgery needed, transformation
- model_call: Urgency + half price + specific date/location (use placeholder [DATE] [LOCATION])
- income_claim: Comparison to filler/tox, maths showing \u00a3800 per session ROI
- educational: Explain dual wavelength technology simply, credibility building
- training_promo: Harley Street credibility, CPD, student success stories
- machine_sale: ROI calculation, break-even in 4 sessions, £400 online training sold separately
- objection_handling: Answer "is it safe?", "does it hurt?", "what's recovery like?" honestly
- before_after: Hook to make people swipe, results description, DM CTA
- tiktok: POV format, fast punchy rhythm, dual audience (practitioners + clients)

Respond ONLY with a JSON object (no markdown, no code blocks):
{
  "caption": "full ready-to-post caption with emojis and hashtags",
  "hook": "the opening line that stops the scroll",
  "hashtags": "#tag1 #tag2 #tag3 #tag4 #fyp",
  "keyword_cta": "the comment keyword e.g. ENDOPULSE, MACHINE, HARLEY"
}`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Generate a ${post_type} post for ${platform}. ${
                topic ? `Topic/angle: ${topic}.` : ""
              } ${extra_context ? `Extra context: ${extra_context}.` : ""}`,
            },
          ],
          max_tokens: 600,
          temperature: 0.8,
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        return res.status(502).json({
          message: `AI service error (${response.status}). ${errText.slice(0, 200)}`,
        });
      }
      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content || "{}";
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      const jsonSlice =
        jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
      const result = JSON.parse(jsonSlice);
      res.json({
        caption: String(result.caption || ""),
        hook: String(result.hook || ""),
        hashtags: String(result.hashtags || ""),
        keyword_cta: String(result.keyword_cta || ""),
      });
    } catch (e: any) {
      res.status(502).json({ message: "AI generation failed: " + (e?.message || "unknown error") });
    }
  });

  // ---- SOCIAL REEL GENERATOR ----
  app.post("/api/social-posts/generate-reel", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { reel_type, duration, style, topic } = req.body || {};

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "placeholder_will_be_injected" || apiKey.length < 10) {
      return res.status(503).json({
        message:
          "AI generation unavailable \u2014 GROQ_API_KEY is not configured on the server.",
      });
    }

    const dur = Number(duration) || 10;
    const SYSTEM_PROMPT = `You are a social media reel expert for endoPulse\u2122 \u2014 a UK aesthetics business run by Jono. You create scroll-stopping Instagram Reels and TikTok scripts.

JONO'S VOICE:
- Warm, punchy, short sentences
- Ends with "xx" for warmth on some posts
- Uses \u2b50\ufe0f \u26a0\ufe0f \ud83e\udd8d emojis strategically
- Income claims: "\u00a35k a week", "10k a month", "\u00a3800 per treatment"
- Creates FOMO: "celebrities pay thousands for this"
- CTA: comment a keyword or DM

BUSINESS FACTS:
- endoPulse\u2122 dual wavelength laser (980nm fat melting + 1470nm skin tightening)
- Dual wavelength = results no single-wavelength device can match
- Client treatments: from \u00a3450\u2013\u00a3800+ per session
- Training: online \u00a3400, in-house \u00a31,500 (Harley Street London + Rodney Street Liverpool)
- Machine: \u00a32,999 \u2014 breaks even in just 4 client sessions
- CPD accredited, covered by Finch Insurance + PolicyBee
- UK trademarked
- Results visible immediately, improve over weeks

VEO 3 PROMPT GUIDE:
Write cinematic, specific Veo 3 prompts. Include:
- Camera style (close-up, wide shot, slow motion, dolly shot)
- Lighting (soft natural light, ring light glow, warm golden hour)
- Subject (aesthetics clinic setting, treatment being performed, before/after reveal, practitioner confident at work)
- Mood (aspirational, professional, transformative, luxurious)
- Movement (smooth pan, zoom in, handheld documentary style)
- Duration hint (${dur} seconds)
- Vertical 9:16 format for Reels/TikTok
- Style: photorealistic, cinematic quality, 4K

For endoPulse\u2122 content, good visual themes:
- Close-up of laser device with soft glow
- Client lying peacefully during treatment, clinic setting
- Before/after skin reveal with dramatic lighting
- Confident practitioner in white coat at Harley Street
- Luxury aesthetics clinic interior
- Money/income lifestyle shots (tasteful, aspirational)

Respond ONLY with a valid JSON object (no markdown, no code blocks, no extra text):
{
  "hook": "the 2-second opening line that stops the scroll",
  "script": [
    {"time": "0-2s", "line": "spoken or on-screen text"},
    {"time": "2-6s", "line": "spoken or on-screen text"},
    {"time": "6-9s", "line": "call to action"}
  ],
  "overlays": [
    {"time": "0s", "text": "ON SCREEN TEXT"},
    {"time": "3s", "text": "Supporting point"},
    {"time": "7s", "text": "Comment ENDOPULSE \u2b07\ufe0f"}
  ],
  "veo3_prompt": "Full cinematic Veo 3 video prompt here \u2014 detailed, specific, 3-5 sentences",
  "caption": "Full ready-to-post Instagram/TikTok caption with emojis and hashtags",
  "keyword_cta": "comment keyword e.g. ENDOPULSE"
}`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Create a ${dur}-second ${style || "talking head"} reel for: ${reel_type}. ${topic ? `Angle/topic: ${topic}.` : ""} Make it scroll-stopping and authentic to Jono's voice.`,
            },
          ],
          max_tokens: 900,
          temperature: 0.85,
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        return res.status(502).json({
          message: `AI service error (${response.status}). ${errText.slice(0, 200)}`,
        });
      }
      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content || "{}";
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      const jsonSlice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
      const result = JSON.parse(jsonSlice);
      res.json({
        hook: String(result.hook || ""),
        script: Array.isArray(result.script) ? result.script : [],
        overlays: Array.isArray(result.overlays) ? result.overlays : [],
        veo3_prompt: String(result.veo3_prompt || ""),
        caption: String(result.caption || ""),
        keyword_cta: String(result.keyword_cta || ""),
      });
    } catch (e: any) {
      res.status(502).json({ message: "Reel generation failed: " + (e?.message || "unknown error") });
    }
  });

  // ========== TEAM MEMBERS ==========

  // List team
  app.get("/api/team", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data, error } = await req.db!
      .from("team_members")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  // Invite team member
  app.post("/api/team/invite", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { name, email, role } = req.body;
    if (!name || !email) return res.status(400).json({ message: "Name and email required" });
    const token = require("crypto").randomBytes(24).toString("hex");
    const { data, error } = await req.db!
      .from("team_members")
      .insert({ owner_id: req.user!.id, name, email, role: role || "practitioner", status: "pending", invite_token: token })
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  // Update team member role
  app.patch("/api/team/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data, error } = await req.db!
      .from("team_members")
      .update(req.body)
      .eq("id", req.params.id)
      .eq("owner_id", req.user!.id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  // Remove team member
  app.delete("/api/team/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { error } = await req.db!
      .from("team_members")
      .delete()
      .eq("id", req.params.id)
      .eq("owner_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // Accept invite (public route)
  app.get("/api/team/join/:token", async (req: Request, res: Response) => {
    const { data, error } = await supabase
      .from("team_members")
      .update({ status: "active", joined_at: new Date().toISOString(), invite_token: null })
      .eq("invite_token", req.params.token)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ message: "Invalid or expired invite" });
    res.json({ ok: true, name: (data as any).name, role: (data as any).role });
  });

  // ========== INVOICES ==========

  // List invoices
  app.get("/api/invoices", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data, error } = await req.db!
      .from("invoices")
      .select("*, clients(name, email)")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    // Auto-mark overdue
    const today = new Date().toISOString().split("T")[0];
    const mapped = (data || []).map((inv: any) => ({
      ...inv,
      client_name: inv.clients?.name,
      client_email: inv.clients?.email,
      status: inv.status === "sent" && inv.due_date && inv.due_date < today ? "overdue" : inv.status,
    }));
    res.json(mapped);
  });

  // Create invoice
  app.post("/api/invoices", requireAuth, async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id;
    // Generate invoice number
    const { count } = await req.db!.from("invoices").select("*", { count: "exact", head: true }).eq("user_id", userId);
    const num = String((count || 0) + 1).padStart(4, "0");
    const invoiceNumber = `INV-${num}`;
    const { data, error } = await req.db!
      .from("invoices")
      .insert({ ...req.body, user_id: userId, invoice_number: invoiceNumber })
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  // Update invoice status
  app.patch("/api/invoices/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
    const updates: any = { ...req.body };
    if (req.body.status === "paid") updates.paid_at = new Date().toISOString();
    const { data, error } = await req.db!
      .from("invoices")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  // Delete invoice
  app.delete("/api/invoices/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { error } = await req.db!
      .from("invoices")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ========== BEFORE & AFTER PHOTOS ==========
  const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

  // List photos
  app.get("/api/photos", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data, error } = await req.db!
      .from("client_photos")
      .select("*, clients(name)")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    const mapped = (data || []).map((p: any) => ({ ...p, client_name: (p.clients as any)?.name ?? null }));
    res.json(mapped);
  });

  // Upload photos
  app.post("/api/photos/upload", requireAuth, photoUpload.fields([{ name: "before", maxCount: 1 }, { name: "after", maxCount: 1 }]), async (req: AuthedRequest, res: Response) => {
    try {
      const files = (req as any).files as Record<string, Express.Multer.File[]>;
      const { client_id, treatment_type, notes, taken_at } = req.body;
      if (!client_id) return res.status(400).json({ message: "client_id required" });

      const userId = req.user!.id;
      let beforeUrl: string | null = null;
      let afterUrl: string | null = null;

      for (const [key, fileArr] of Object.entries(files || {})) {
        const file = fileArr[0];
        const path = `${userId}/${Date.now()}_${key}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("client-photos").upload(path, file.buffer, { contentType: file.mimetype });
        if (error) throw new Error(error.message);
        const { data: urlData } = supabase.storage.from("client-photos").getPublicUrl(path);
        if (key === "before") beforeUrl = urlData.publicUrl;
        if (key === "after") afterUrl = urlData.publicUrl;
      }

      const { data, error } = await req.db!
        .from("client_photos")
        .insert({ user_id: userId, client_id, treatment_type: treatment_type || null, notes: notes || null, taken_at: taken_at || new Date().toISOString().split("T")[0], before_url: beforeUrl, after_url: afterUrl })
        .select()
        .single();

      if (error) throw new Error(error.message);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Delete photo set
  app.delete("/api/photos/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data: photo } = await req.db!.from("client_photos").select("before_url, after_url").eq("id", req.params.id).eq("user_id", req.user!.id).single();
    for (const url of [photo?.before_url, photo?.after_url]) {
      if (url) {
        const match = (url as string).match(/\/client-photos\/(.+)$/);
        if (match) await supabase.storage.from("client-photos").remove([match[1]]);
      }
    }
    const { error } = await req.db!.from("client_photos").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ========== BUSINESS INFO ==========
  app.get("/api/business-info", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data, error } = await req.db!
      .from("business_info")
      .select("*")
      .eq("user_id", req.user!.id)
      .single();
    if (error && error.code !== "PGRST116") return res.status(500).json({ message: error.message });
    res.json(data ?? { products: [], faqs: [] });
  });

  app.post("/api/business-info", requireAuth, async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id;
    const { tagline, about, logo_url, website_url, instagram_url, tiktok_url, facebook_url, youtube_url, products, faqs } = req.body;
    const payload = { user_id: userId, tagline, about, logo_url, website_url, instagram_url, tiktok_url, facebook_url, youtube_url, products: products ?? [], faqs: faqs ?? [], updated_at: new Date().toISOString() };
    const { data, error } = await req.db!
      .from("business_info")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  // ========== MANUALS ==========
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

  // List manuals
  app.get("/api/manuals", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data, error } = await req.db!
      .from("manuals")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  // Upload manual
  app.post("/api/manuals/upload", requireAuth, upload.single("file"), async (req: AuthedRequest, res: Response) => {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "No file provided" });

      const { name, description, category } = req.body;
      if (!name) return res.status(400).json({ message: "Name required" });

      const userId = req.user!.id;
      const fileName = `${userId}/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      // Upload to Supabase Storage using the authenticated user client so that
      // storage RLS policies (which check auth.uid()) are satisfied.
      const { error: storageError } = await req.db!.storage
        .from("manuals")
        .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

      if (storageError) throw new Error(storageError.message);

      const { data: urlData } = req.db!.storage.from("manuals").getPublicUrl(fileName);
      const fileUrl = urlData.publicUrl;

      // Extract text for Safi (with hard timeout so a bad PDF never hangs the route)
      let extractedText: string | null = null;
      try {
        const mime = file.mimetype || "";
        const fname = file.originalname || "";
        const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
          Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
        if (mime === "application/pdf" || fname.endsWith(".pdf")) {
          const parsed = await withTimeout(pdfParse(file.buffer), 10_000);
          extractedText = (parsed as any).text?.trim() || null;
        } else if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fname.endsWith(".docx")) {
          const result = await withTimeout(mammoth.extractRawText({ buffer: file.buffer }), 10_000);
          extractedText = (result as any).value?.trim() || null;
        } else if (mime === "text/plain" || fname.endsWith(".txt")) {
          extractedText = file.buffer.toString("utf-8").trim();
        }
        if (extractedText && extractedText.length > 60000) {
          extractedText = extractedText.slice(0, 60000) + "\n[...truncated]";
        }
      } catch {
        // Text extraction failed or timed out — file is still stored, Safi just won't have text
        extractedText = null;
      }

      const { data, error } = await req.db!
        .from("manuals")
        .insert({
          user_id: userId,
          name: name.trim(),
          description: description?.trim() || null,
          category: category || "other",
          file_url: fileUrl,
          file_name: file.originalname,
          file_size: file.size,
          extracted_text: extractedText,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Upload failed" });
    }
  });

  // Delete manual
  app.delete("/api/manuals/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    // Get the file path first
    const { data: manual } = await req.db!
      .from("manuals")
      .select("file_url, user_id")
      .eq("id", id)
      .eq("user_id", req.user!.id)
      .single();

    if (manual?.file_url) {
      // Extract path from URL
      const url = manual.file_url as string;
      const pathMatch = url.match(/\/manuals\/(.+)$/);
      if (pathMatch) {
        await req.db!.storage.from("manuals").remove([pathMatch[1]]);
      }
    }

    const { error } = await req.db!
      .from("manuals")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user!.id);

    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ========== CLIENT PORTAL ==========

  // Create or return existing portal session for a client
  app.post("/api/portal/generate", requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { client_id } = req.body;
      if (!client_id) return res.status(400).json({ message: "client_id required" });

      // Check if client belongs to practitioner
      const { data: client, error: clientError } = await req.db!
        .from("clients")
        .select("id, name")
        .eq("id", client_id)
        .eq("user_id", req.user!.id)
        .single();

      if (clientError || !client) return res.status(404).json({ message: "Client not found" });

      // Upsert: delete old session and create fresh one with new 30-day expiry
      await req.db!.from("client_portal_sessions").delete().eq("client_id", client_id).eq("practitioner_id", req.user!.id);

      const { data: session, error } = await req.db!
        .from("client_portal_sessions")
        .insert({ client_id, practitioner_id: req.user!.id })
        .select()
        .single();

      if (error) return res.status(500).json({ message: error.message });
      res.json(session);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to generate portal link" });
    }
  });

  // Public portal data endpoint — no auth required, uses token
  app.get("/api/portal/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      // Look up session (public policy allows this)
      const { data: session, error: sessionError } = await supabase
        .from("client_portal_sessions")
        .select("*")
        .eq("token", token)
        .single();

      if (sessionError || !session) return res.status(404).json({ message: "Portal link not found or expired" });

      // Check expiry
      if (new Date(session.expires_at) < new Date()) {
        return res.status(410).json({ message: "This portal link has expired. Please contact your practitioner for a new link." });
      }

      const clientId = session.client_id;
      const practitionerId = session.practitioner_id;

      // Fetch client details
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, email, phone, stage, created_at")
        .eq("id", clientId)
        .single();

      // Fetch bookings
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, treatment_name, date, time, status, notes")
        .eq("client_id", clientId)
        .eq("user_id", practitionerId)
        .order("date", { ascending: false })
        .limit(20);

      // Fetch invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, amount, vat_amount, total_amount, status, issue_date, due_date, items")
        .eq("client_id", clientId)
        .eq("user_id", practitionerId)
        .order("issue_date", { ascending: false })
        .limit(20);

      // Fetch consent forms
      const { data: consent } = await supabase
        .from("consent_forms")
        .select("id, treatment, status, signed_at, created_at")
        .eq("client_id", clientId)
        .eq("user_id", practitionerId)
        .order("created_at", { ascending: false })
        .limit(20);

      // Fetch before/after photos
      const { data: photos } = await supabase
        .from("client_photos")
        .select("id, treatment_tag, before_url, after_url, notes, taken_at")
        .eq("client_id", clientId)
        .eq("user_id", practitionerId)
        .order("taken_at", { ascending: false })
        .limit(20);

      res.json({
        client,
        bookings: bookings || [],
        invoices: invoices || [],
        consent: consent || [],
        photos: photos || [],
        expires_at: session.expires_at,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load portal" });
    }
  });

  // ========== TRAINING VIDEOS ==========
  const videoUploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

  app.get("/api/videos", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data, error } = await req.db!.from("training_videos").select("*").eq("user_id", req.user!.id).order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/videos", requireAuth, videoUploadMiddleware.single("file"), async (req: AuthedRequest, res: Response) => {
    try {
      const file = (req as any).file;
      const body = req.body;
      const userId = req.user!.id;
      let fileUrl: string | null = null;

      if (file) {
        const fileName = `${userId}/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: storageError } = await supabase.storage.from("training-videos").upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });
        if (storageError) throw new Error(storageError.message);
        const { data: urlData } = supabase.storage.from("training-videos").getPublicUrl(fileName);
        fileUrl = urlData.publicUrl;
      }

      const { data, error } = await req.db!.from("training_videos").insert({
        user_id: userId,
        title: body.title,
        description: body.description || null,
        category: body.category || "general",
        video_type: body.video_type || "link",
        video_url: body.video_url || null,
        file_url: fileUrl,
        duration_mins: body.duration_mins ? Number(body.duration_mins) : null,
        price: Number(body.price || 0),
        is_free: body.is_free === "true" || body.is_free === true,
      }).select().single();

      if (error) return res.status(500).json({ message: error.message });
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to save video" });
    }
  });

  app.delete("/api/videos/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data: video } = await req.db!.from("training_videos").select("file_url").eq("id", req.params.id).eq("user_id", req.user!.id).single();
    if (video?.file_url) {
      const match = (video.file_url as string).match(/\/training-videos\/(.+)$/);
      if (match) await supabase.storage.from("training-videos").remove([match[1]]);
    }
    const { error } = await req.db!.from("training_videos").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ========== TRAINING PACKAGES ==========

  app.get("/api/packages", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data, error } = await req.db!.from("training_packages").select("*").eq("user_id", req.user!.id).order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/packages", requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { title, description, price, is_free, video_ids, manual_ids } = req.body;
      if (!title) return res.status(400).json({ message: "Title required" });
      const { data, error } = await req.db!.from("training_packages").insert({
        user_id: req.user!.id,
        title, description: description || null,
        price: Number(price || 0),
        is_free: !!is_free,
        video_ids: JSON.stringify(video_ids || []),
        manual_ids: JSON.stringify(manual_ids || []),
      }).select().single();
      if (error) return res.status(500).json({ message: error.message });
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to create package" });
    }
  });

  app.delete("/api/packages/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { error } = await req.db!.from("training_packages").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ========== COMPUTER VOICE ASSISTANT ==========
  const voiceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

  // Step 1: Transcribe audio with Whisper, then parse intent with Groq
  app.post("/api/voice/parse", requireAuth, voiceUpload.single("audio"), async (req: AuthedRequest, res: Response) => {
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const file = (req as any).file;

      let transcript = "";

      if (file) {
        // Transcribe audio using Whisper via Groq
        const audioFile = new File([file.buffer], file.originalname || "audio.webm", { type: file.mimetype || "audio/webm" });
        const transcription = await groq.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-large-v3-turbo",
          response_format: "json",
          language: "en",
        });
        transcript = transcription.text;
      } else if (req.body.text) {
        // Fallback: plain text passed directly (for testing)
        transcript = req.body.text;
      } else {
        return res.status(400).json({ message: "No audio or text provided" });
      }

      // Fetch context data for the user so AI can resolve names
      const [clientsRes, treatmentsRes] = await Promise.all([
        req.db!.from("clients").select("id, name, email, phone").eq("user_id", req.user!.id).limit(100),
        req.db!.from("treatments").select("id, name, price").eq("user_id", req.user!.id).limit(50),
      ]);

      const clients = clientsRes.data || [];
      const treatments = treatmentsRes.data || [];

      const clientList = clients.map((c: any) => `${c.name} (id:${c.id})`).join(", ") || "none";
      const treatmentList = treatments.map((t: any) => `${t.name} £${t.price}`).join(", ") || "none";

      // Use Groq (llama-3.3-70b) to parse intent and extract structured data
      const today = new Date().toISOString().split("T")[0];
      const systemPrompt = `You are the "Buddy" voice assistant inside PractiVault, a business management app used by tradespeople (plumbers, joiners, electricians) and beauty/aesthetics practitioners (salon owners, aestheticians, hairdressers).

Today's date: ${today}

User's clients: ${clientList}
User's services/treatments: ${treatmentList}

Your job: Parse the user's spoken command and return a JSON object with the intent and all extracted data. Be smart about resolving client names (fuzzy match from the client list). Infer missing data where possible.

Return ONLY valid JSON in this exact shape:
{
  "intent": "invoice" | "booking" | "quote" | "lead" | "reminder" | "unknown",
  "confidence": 0.0-1.0,
  "transcript": "<the original transcript>",
  "reply": "<a short friendly confirmation message to show the user, 1-2 sentences, conversational>",
  "missing": ["<list of required fields that are missing>"],
  "followup": "<if missing fields, ask this question>",
  "data": {
    // For invoice:
    "client_name": "", "client_id": "", "description": "", "amount": 0, "vat": false,
    // For booking:
    "client_name": "", "client_id": "", "treatment": "", "date": "YYYY-MM-DD", "time": "HH:MM",
    // For quote:
    "client_name": "", "client_id": "", "description": "", "amount": 0,
    // For lead:
    "name": "", "phone": "", "email": "", "interest": "", "notes": "",
    // For reminder:
    "text": "", "date": "YYYY-MM-DD", "time": "HH:MM", "linked_client": ""
  }
}

Rules:
- Match client names fuzzily ("Dave" might be "David Smith", "Mrs Henderson" might be "Sarah Henderson")
- For dates like "next Thursday", "tomorrow", "Monday" — resolve to YYYY-MM-DD relative to today (${today})
- If the user says an all-in price, use that as the amount — don't try to re-calculate
- Keep reply warm, brief, human. Not robotic.
- If intent is unclear, set intent to "unknown" and ask what they meant in followup`;

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse this command: "${transcript}"` },
        ],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { parsed = { intent: "unknown", reply: "Sorry, I didn\'t catch that. Could you say it again?", transcript }; }

      res.json({ ...parsed, transcript });
    } catch (e: any) {
      console.error("Voice parse error:", e);
      res.status(500).json({ message: e.message || "Voice processing failed" });
    }
  });

  // Step 2: Execute a parsed voice action (after user confirms in the UI)
  app.post("/api/voice/execute", requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { intent, data } = req.body;
      const userId = req.user!.id;

      if (intent === "invoice") {
        // Generate next invoice number
        const { data: last } = await req.db!.from("invoices").select("invoice_number").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
        const lastNum = last?.[0]?.invoice_number ? parseInt((last[0].invoice_number as string).replace("INV-", "")) || 0 : 0;
        const invoiceNumber = `INV-${String(lastNum + 1).padStart(4, "0")}`;
        const amount = Number(data.amount) || 0;
        const vatAmt = data.vat ? Math.round(amount * 0.2 * 100) / 100 : 0;
        const today = new Date().toISOString().split("T")[0];
        const due = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
        const { data: inv, error } = await req.db!.from("invoices").insert({
          user_id: userId, client_id: data.client_id || null,
          invoice_number: invoiceNumber, status: "draft",
          amount, vat_amount: vatAmt, total_amount: amount + vatAmt,
          items: JSON.stringify([{ description: data.description || "Service", quantity: 1, unit_price: amount, total: amount }]),
          notes: data.description || null, issue_date: today, due_date: due,
        }).select().single();
        if (error) return res.status(500).json({ message: error.message });
        return res.json({ ok: true, record: inv, message: `Invoice ${invoiceNumber} created` });
      }

      if (intent === "booking") {
        const { data: bk, error } = await req.db!.from("bookings").insert({
          user_id: userId, client_id: data.client_id || null,
          treatment_name: data.treatment || "Service",
          date: data.date, time: data.time || "09:00", status: "confirmed", notes: "",
        }).select().single();
        if (error) return res.status(500).json({ message: error.message });
        return res.json({ ok: true, record: bk, message: "Booking confirmed" });
      }

      if (intent === "quote") {
        const { data: qt, error } = await req.db!.from("quotes").insert({
          user_id: userId, client_id: data.client_id || null,
          client_name: data.client_name || "Unknown",
          description: data.description || "Service",
          amount: Number(data.amount) || 0, status: "draft",
        }).select().single();
        if (error) return res.status(500).json({ message: error.message });
        return res.json({ ok: true, record: qt, message: "Quote created" });
      }

      if (intent === "lead") {
        const { data: ld, error } = await req.db!.from("leads").insert({
          user_id: userId, name: data.name || "Unknown",
          phone: data.phone || null, email: data.email || null,
          treatment_interest: data.interest || null,
          notes: data.notes || null, source: "voice", status: "new",
        }).select().single();
        if (error) return res.status(500).json({ message: error.message });
        return res.json({ ok: true, record: ld, message: `Lead saved for ${data.name}` });
      }

      if (intent === "reminder") {
        // Store as a note in ai_front_desk log for now (reminders table not yet built)
        return res.json({ ok: true, message: `Reminder set: ${data.text} on ${data.date}` });
      }

      res.status(400).json({ message: "Unknown intent" });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Execution failed" });
    }
  });

  // ============================================================
  // CPD LOGS
  // ============================================================
  app.get("/api/cpd", requireAuth, async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.from("cpd_logs").select("*").eq("user_id", req.user!.id).order("date", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.post("/api/cpd", requireAuth, async (req: AuthedRequest, res) => {
    const { course_name, provider, date, hours, category, notes, certificate_url } = req.body;
    if (!course_name || !date) return res.status(400).json({ message: "course_name and date required" });
    const { data, error } = await req.db!.from("cpd_logs").insert({
      user_id: req.user!.id, course_name, provider: provider || null,
      date, hours: Number(hours) || 0, category: category || null,
      notes: notes || null, certificate_url: certificate_url || null,
    }).select().single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.delete("/api/cpd/:id", requireAuth, async (req: AuthedRequest, res) => {
    const { error } = await req.db!.from("cpd_logs").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ============================================================
  // LOCATIONS
  // ============================================================
  app.get("/api/locations", requireAuth, async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.from("locations").select("*").order("is_default", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.post("/api/locations", requireAuth, async (req: AuthedRequest, res) => {
    const { name, address, phone, email, is_default } = req.body;
    if (!name) return res.status(400).json({ message: "name required" });
    // If setting as default, clear others first
    if (is_default) {
      await req.db!.from("locations").update({ is_default: false }).eq("user_id", req.user!.id);
    }
    const { data, error } = await req.db!.from("locations").insert({
      user_id: req.user!.id, name, address: address || null,
      phone: phone || null, email: email || null, is_default: !!is_default,
    }).select().single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.patch("/api/locations/:id", requireAuth, async (req: AuthedRequest, res) => {
    const { is_default, name, address, phone, email } = req.body;
    // If setting as default, clear others first
    if (is_default) {
      await req.db!.from("locations").update({ is_default: false }).eq("user_id", req.user!.id);
    }
    const updates: any = {};
    if (is_default !== undefined) updates.is_default = is_default;
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    const { data, error } = await req.db!.from("locations").update(updates).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.delete("/api/locations/:id", requireAuth, async (req: AuthedRequest, res) => {
    const { error } = await req.db!.from("locations").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ============================================================
  // DEMO SYSTEM — public, no auth required
  // ============================================================
  app.get("/api/demo/seed/:industry", async (req: Request, res: Response) => {
    const { industry } = req.params;
    const demo = DEMO_INDUSTRIES[industry];
    if (!demo) return res.status(404).json({ message: `Unknown industry: ${industry}` });

    try {
      // Use a fixed demo email per industry so we reuse the same user
      const demoEmail = `demo-${industry}@practivault-demo.app`;
      const demoPassword = `DemoPass2026!${industry}`;

      // Try to sign in first (user already exists)
      let token: string | null = null;
      let userId: string | null = null;

      const signInRes = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (signInRes.data?.session) {
        token = signInRes.data.session.access_token;
        userId = signInRes.data.session.user.id;
      } else {
        // Create the demo user via standard signUp (no admin key needed)
        const signUpRes = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
        });
        if (signUpRes.error || !signUpRes.data.user) {
          return res.status(500).json({ message: signUpRes.error?.message || "Failed to create demo user" });
        }
        userId = signUpRes.data.user.id;
        // If session returned immediately (email confirm disabled), use it
        if (signUpRes.data.session) {
          token = signUpRes.data.session.access_token;
        } else {
          // Email confirm is on — sign in directly (Supabase allows this for programmatic signups)
          const si2 = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword });
          if (!si2.data?.session) {
            // Confirm email via SQL then sign in
            await supabase.rpc("confirm_user_email" as any, { user_email: demoEmail }).catch(() => {});
            const si3 = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword });
            if (!si3.data?.session) return res.status(500).json({ message: "Demo user created but could not sign in. Please disable email confirmation in Supabase Auth settings." });
            token = si3.data.session.access_token;
            userId = si3.data.session.user.id;
          } else {
            token = si2.data.session.access_token;
            userId = si2.data.session.user.id;
          }
        }
      }

      const db = supabaseForUser(token!);

      // ── Wipe existing demo data so each visit gets fresh data ─────────
      await db.from("bookings").delete().eq("user_id", userId!);
      await db.from("invoices").delete().eq("user_id", userId!);
      await db.from("leads").delete().eq("user_id", userId!);
      await db.from("quotes").delete().eq("user_id", userId!);
      await db.from("consent_forms").delete().eq("user_id", userId!);
      await db.from("clients").delete().eq("user_id", userId!);

      // ── Seed clients ──────────────────────────────────────────────────
      const clientIds: string[] = [];
      for (const c of demo.clients) {
        const { data, error } = await db.from("clients").insert({
          user_id: userId, name: c.name, email: c.email, phone: c.phone,
          stage: c.stage, notes: c.notes, ltv: c.ltv,
        }).select("id").single();
        if (error) { console.error("client seed error", error.message); clientIds.push(""); continue; }
        clientIds.push(data.id);
      }

      // ── Seed bookings ─────────────────────────────────────────────────
      for (const b of demo.bookings) {
        const cid = clientIds[b.clientIndex];
        if (!cid) continue;
        await db.from("bookings").insert({
          user_id: userId, client_id: cid,
          treatment_name: b.treatment,
          date: b.date, time: b.time, status: b.status, notes: b.notes,
        });
      }

      // ── Seed invoices ─────────────────────────────────────────────────
      let invNum = 1;
      for (const inv of demo.invoices) {
        const cid = clientIds[inv.clientIndex];
        const client = demo.clients[inv.clientIndex];
        const issueDate = new Date();
        issueDate.setDate(issueDate.getDate() - inv.daysAgo);
        const vatAmount = inv.vat ? inv.amount * 0.2 : 0;
        const total = inv.amount + vatAmount;
        await db.from("invoices").insert({
          user_id: userId, client_id: cid || null,
          client_name: client?.name || "Client",
          client_email: client?.email || null,
          invoice_number: `DEMO-${String(invNum++).padStart(4, "0")}`,
          status: inv.status,
          issue_date: issueDate.toISOString().split("T")[0],
          due_date: null,
          items: JSON.stringify([{ description: inv.description, quantity: 1, unit_price: inv.amount, total: inv.amount }]),
          subtotal: inv.amount,
          tax_rate: inv.vat ? 20 : 0,
          tax_amount: vatAmount,
          total,
          notes: null,
        });
      }

      // ── Seed leads ────────────────────────────────────────────────────
      for (const l of demo.leads) {
        await db.from("leads").insert({
          user_id: userId, name: l.name, phone: l.phone,
          email: null, treatment_interest: l.interest,
          source: l.source, notes: l.notes, status: "new",
        });
      }

      // ── Seed quotes ───────────────────────────────────────────────────
      for (const q of demo.quotes) {
        await db.from("quotes").insert({
          user_id: userId, client_id: null,
          client_name: q.clientName,
          description: q.description,
          amount: q.amount, status: q.status,
        });
      }

      return res.json({ ok: true, token, industry, businessName: demo.businessName });
    } catch (e: any) {
      console.error("Demo seed error:", e);
      return res.status(500).json({ message: e.message || "Demo seed failed" });
    }
  });

  // ============================================================
  // STOCK & INVENTORY
  // ============================================================
  app.get("/api/stock", requireAuth, async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.from("stock_items").select("*").eq("user_id", req.user!.id).order("category").order("name");
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.post("/api/stock", requireAuth, async (req: AuthedRequest, res) => {
    const { name, category, unit, quantity, low_stock_threshold, cost_price, supplier, notes } = req.body;
    if (!name) return res.status(400).json({ message: "name required" });
    const { data, error } = await req.db!.from("stock_items").insert({
      user_id: req.user!.id, name, category: category || "General",
      unit: unit || "units", quantity: Number(quantity) || 0,
      low_stock_threshold: Number(low_stock_threshold) || 5,
      cost_price: Number(cost_price) || 0,
      supplier: supplier || null, notes: notes || null,
    }).select().single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.delete("/api/stock/:id", requireAuth, async (req: AuthedRequest, res) => {
    const { error } = await req.db!.from("stock_items").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // Stock movements — updates quantity on the parent item
  app.post("/api/stock/movements", requireAuth, async (req: AuthedRequest, res) => {
    const { stock_item_id, movement_type, quantity, notes } = req.body;
    if (!stock_item_id || !movement_type || !quantity) return res.status(400).json({ message: "Missing fields" });
    // Fetch current quantity — also verifies ownership
    const { data: item, error: fetchErr } = await req.db!.from("stock_items").select("quantity").eq("id", stock_item_id).eq("user_id", req.user!.id).single();
    if (fetchErr || !item) return res.status(404).json({ message: "Item not found" });
    const delta = movement_type === "in" ? Number(quantity) : -Number(quantity);
    const newQty = Math.max(0, Number(item.quantity) + delta);
    // Update quantity
    const { error: updateErr } = await req.db!.from("stock_items").update({ quantity: newQty }).eq("id", stock_item_id).eq("user_id", req.user!.id);
    if (updateErr) return res.status(500).json({ message: updateErr.message });
    // Log the movement
    const { data: movement, error: logErr } = await req.db!.from("stock_movements").insert({
      user_id: req.user!.id, stock_item_id, movement_type,
      quantity: Number(quantity), notes: notes || null,
    }).select().single();
    if (logErr) return res.status(500).json({ message: logErr.message });
    res.json({ ok: true, new_quantity: newQty, movement });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SAFI — Fully Agentic AI (xAI grok-voice-think-fast-1.0 Realtime)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Safi tool definitions (sent to xAI in session config) ─────────────────
  const SAFI_TOOLS = [
    {
      type: "function",
      name: "get_appointments",
      description: "List upcoming or recent appointments/bookings. Use to answer 'what jobs do I have today', 'show upcoming bookings' etc.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", enum: ["upcoming", "today", "recent", "all"], description: "Which appointments to fetch" },
          limit: { type: "number", description: "Max number to return, default 10" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "get_clients",
      description: "Search or list clients/customers. Use to look up a specific client or show recent clients.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Name, email or phone to search for" },
          limit: { type: "number", description: "Max results, default 10" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "get_invoices",
      description: "List invoices. Can filter by status (overdue, unpaid, paid). Use for 'show overdue invoices', 'who owes me money' etc.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["all", "unpaid", "paid", "overdue"], description: "Invoice status filter" },
          limit: { type: "number", description: "Max results, default 10" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "get_quotes",
      description: "List quotes/estimates. Use for 'show pending quotes', 'any quotes outstanding' etc.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["all", "draft", "sent", "accepted", "declined"], description: "Quote status filter" },
          limit: { type: "number", description: "Max results, default 10" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "get_stock",
      description: "Check stock levels. Use for 'what stock do I have', 'anything running low' etc.",
      parameters: {
        type: "object",
        properties: {
          low_stock_only: { type: "boolean", description: "If true, only return items below their low stock threshold" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "get_report",
      description: "Generate a business summary report — revenue, jobs completed, outstanding invoices, new clients.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "this_week", "this_month", "last_month"], description: "Report period" },
        },
        required: ["period"],
      },
    },
    {
      type: "function",
      name: "get_leads",
      description: "List leads or enquiries. Use for 'show new leads', 'any new enquiries' etc.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results, default 10" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "create_lead",
      description: "Create a new lead/enquiry. Use when user wants to add a lead.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Lead name (required)" },
          source: { type: "string", enum: ["instagram","facebook","referral","website","walk_in","manual","other"], description: "Where the lead came from" },
          status: { type: "string", enum: ["new","contacted","qualified","converted","lost"], description: "Lead status, default new" },
          notes: { type: "string", description: "Any notes about this lead" },
        },
        required: ["name"],
      },
    },
    {
      type: "function",
      name: "update_lead",
      description: "Update an existing lead's status or notes.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Lead name to search for" },
          status: { type: "string", enum: ["new","contacted","qualified","converted","lost"], description: "New status" },
          notes: { type: "string", description: "Updated notes" },
        },
        required: ["name"],
      },
    },
    {
      type: "function",
      name: "create_quote",
      description: "Create a new quote/estimate for a client.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Client name" },
          items: { type: "string", description: "Description of items/services being quoted" },
          amount: { type: "number", description: "Total quote amount in GBP" },
          notes: { type: "string", description: "Additional notes" },
        },
        required: ["client_name", "items", "amount"],
      },
    },
    {
      type: "function",
      name: "update_quote",
      description: "Update a quote status (e.g. mark as sent, accepted).",
      parameters: {
        type: "object",
        properties: {
          quote_number: { type: "string", description: "Quote number e.g. QUO-001" },
          status: { type: "string", enum: ["draft","sent","viewed","accepted","rejected","expired","invoiced"], description: "New status" },
          notes: { type: "string", description: "Updated notes" },
        },
        required: ["quote_number", "status"],
      },
    },
    {
      type: "function",
      name: "create_invoice",
      description: "Create a new invoice for a client.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Client name" },
          description: { type: "string", description: "What the invoice is for" },
          amount: { type: "number", description: "Total invoice amount in GBP" },
          due_days: { type: "number", description: "Days until due from today, default 30" },
        },
        required: ["client_name", "description", "amount"],
      },
    },
    {
      type: "function",
      name: "update_invoice",
      description: "Update an invoice status — e.g. mark as paid, send reminder.",
      parameters: {
        type: "object",
        properties: {
          invoice_number: { type: "string", description: "Invoice number e.g. INV-001" },
          status: { type: "string", enum: ["draft","unpaid","paid","cancelled"], description: "New status" },
          notes: { type: "string", description: "Notes to add" },
        },
        required: ["invoice_number", "status"],
      },
    },
    {
      type: "function",
      name: "get_bookings",
      description: "List bookings/appointments. Can filter by date range, status, or client name.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", enum: ["upcoming", "today", "all", "past"], description: "Which bookings to fetch" },
          client_name: { type: "string", description: "Filter by client name" },
          limit: { type: "number", description: "Max results, default 15" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "create_booking",
      description: "Create a new booking/appointment. Requires client name, treatment name, date and time.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Client name to search for" },
          treatment_name: { type: "string", description: "Treatment name to search for" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          time: { type: "string", description: "Time in HH:MM format" },
          status: { type: "string", enum: ["pending","confirmed","completed","cancelled"], description: "Booking status, default confirmed" },
          notes: { type: "string", description: "Optional notes" },
        },
        required: ["client_name", "treatment_name", "date", "time"],
      },
    },
    {
      type: "function",
      name: "update_booking",
      description: "Update an existing booking status — e.g. mark as completed, cancelled, no-show.",
      parameters: {
        type: "object",
        properties: {
          booking_id: { type: "string", description: "Booking ID (use get_bookings to find it)" },
          status: { type: "string", enum: ["pending","confirmed","completed","cancelled","no_show"], description: "New status" },
          notes: { type: "string", description: "Updated notes" },
        },
        required: ["booking_id", "status"],
      },
    },
    {
      type: "function",
      name: "get_clients_detail",
      description: "List or search clients with full details — contact info, stage, booking history. Use for 'show all clients', 'find client X', 'who are my VIP clients' etc.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Name, email or phone to search for" },
          stage: { type: "string", enum: ["all","lead","prospect","active","vip","lapsed","archived"], description: "Filter by client stage" },
          limit: { type: "number", description: "Max results, default 15" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "create_client",
      description: "Create a new client record.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Client full name (required)" },
          email: { type: "string", description: "Email address" },
          phone: { type: "string", description: "Phone number" },
          stage: { type: "string", enum: ["lead","prospect","active","vip","lapsed","archived"], description: "Client stage, default active" },
          notes: { type: "string", description: "Any notes about this client" },
        },
        required: ["name"],
      },
    },
    {
      type: "function",
      name: "update_client",
      description: "Update a client's details or stage.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Client name to search for" },
          new_stage: { type: "string", enum: ["lead","prospect","active","vip","lapsed","archived"], description: "New stage" },
          new_email: { type: "string", description: "New email address" },
          new_phone: { type: "string", description: "New phone number" },
          notes: { type: "string", description: "Updated notes" },
        },
        required: ["name"],
      },
    },
    {
      type: "function",
      name: "get_consent_forms",
      description: "List consent forms. Can filter by status — pending, signed, overdue.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["all","pending","signed","overdue"], description: "Filter by status" },
          client_name: { type: "string", description: "Filter by client name" },
          limit: { type: "number", description: "Max results, default 15" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "send_consent_form",
      description: "Create a consent form and send it directly to the client via email. Composes a friendly email with the signing link and sends it to the client's email address. Use this instead of create_consent_form.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Client name to search for" },
          form_type: { type: "string", enum: ["general_consent","laser_treatment","fat_melting","skin_tightening","medical_history","patch_test"], description: "Type of consent form" },
          business_name: { type: "string", description: "The business name to use in the email (use the business name from context)" },
        },
        required: ["client_name", "form_type"],
      },
    },
    {
      type: "function",
      name: "get_before_after_photos",
      description: "List before & after photo records for clients. Shows treatment type and dates.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Filter by client name" },
          limit: { type: "number", description: "Max results, default 10" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "get_team_analysis",
      description: "Get the full team roster with rich analysis — who is active, who has a pending invite (and how long it has been pending), role breakdown, and any team gaps worth flagging. Always call this proactively when in the Team section.",
      parameters: { type: "object", properties: { status: { type: "string", enum: ["all","active","pending"], description: "Filter by status, default all" } }, required: [] },
    },
    {
      type: "function",
      name: "invite_team_member",
      description: "Send an invite to a new team member by email. Roles: practitioner, receptionist.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name" },
          email: { type: "string", description: "Email address" },
          role: { type: "string", enum: ["practitioner","receptionist"], description: "Role to assign" },
        },
        required: ["name","email","role"],
      },
    },
    {
      type: "function",
      name: "get_manuals",
      description: "List all uploaded manuals/documents. Shows name, category, and upload date.",
      parameters: { type: "object", properties: { category: { type: "string", description: "Filter by category e.g. endopulse, cpd, aesthetics" }, search: { type: "string", description: "Search by name" } }, required: [] },
    },
    {
      type: "function",
      name: "get_videos",
      description: "List all training videos. Shows title, category, type (youtube/vimeo/upload), and access (free/paid).",
      parameters: { type: "object", properties: { category: { type: "string", description: "Filter by category" }, search: { type: "string", description: "Search by title" } }, required: [] },
    },
    {
      type: "function",
      name: "get_packages_analysis",
      description: "Get all training packages with full content analysis — what videos and manuals are in each, pricing breakdown, and gaps. Also shows available videos and manuals that are NOT yet in any package. Call this to get a complete picture of the training offering.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      type: "function",
      name: "create_package",
      description: "Create a new training package. Can bundle existing videos and manuals together.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Package title" },
          description: { type: "string", description: "What the package includes" },
          price: { type: "number", description: "Price in GBP. Use 0 if free." },
          is_free: { type: "boolean", description: "True if the package is free" },
        },
        required: ["title"],
      },
    },
    {
      type: "function",
      name: "get_stock_analysis",
      description: "Get full stock inventory with analysis — total inventory value, items below threshold, usage rate from movement history, reorder recommendations. Proactively surface insights. Call this when the user opens Stock or asks about their inventory.",
      parameters: {
        type: "object",
        properties: {
          low_stock_only: { type: "boolean", description: "If true, only return items at or below their low stock threshold" },
          category: { type: "string", description: "Filter by category" },
          include_movements: { type: "boolean", description: "If true, include recent movement history for each item" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "add_stock_item",
      description: "Add a new stock item to the inventory.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Item name" },
          category: { type: "string", description: "Category" },
          unit: { type: "string", description: "Unit of measurement e.g. units, litres, kg" },
          quantity: { type: "number", description: "Starting quantity" },
          low_stock_threshold: { type: "number", description: "Alert when quantity falls to this level" },
          cost_price: { type: "number", description: "Cost price per unit in GBP" },
          supplier: { type: "string", description: "Supplier name" },
        },
        required: ["name"],
      },
    },
    {
      type: "function",
      name: "update_stock_quantity",
      description: "Record stock coming in (delivery) or going out (used/sold). Updates the item's quantity. Can handle multiple items in notes.",
      parameters: {
        type: "object",
        properties: {
          item_name: { type: "string", description: "Stock item name to search for" },
          movement_type: { type: "string", enum: ["in","out"], description: "in = stock received, out = stock used/sold" },
          quantity: { type: "number", description: "Amount to add or subtract" },
          notes: { type: "string", description: "Reason or notes for this movement" },
        },
        required: ["item_name","movement_type","quantity"],
      },
    },
    {
      type: "function",
      name: "get_cpd_analysis",
      description: "Get full CPD log with rich analysis — total hours by category and tax year, progress toward annual target, category gaps, longest gap since last training, and suggested areas to focus on. Always call this proactively when the user opens CPD Log.",
      parameters: {
        type: "object",
        properties: {
          year_filter: { type: "string", description: "Tax year filter e.g. 2024/2025 or 'all'" },
          annual_target_hours: { type: "number", description: "Target CPD hours per year (default 35 for aesthetics practitioners)" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "add_cpd_entry",
      description: "Add a new CPD log entry for a completed course.",
      parameters: {
        type: "object",
        properties: {
          course_name: { type: "string", description: "Name of the course or training" },
          provider: { type: "string", description: "Training provider name" },
          date: { type: "string", description: "Completion date in YYYY-MM-DD format" },
          hours: { type: "number", description: "CPD hours completed" },
          category: { type: "string", description: "CPD category e.g. Aesthetics & Beauty, First Aid, Legal & Compliance" },
          notes: { type: "string", description: "Any additional notes" },
        },
        required: ["course_name","date","hours"],
      },
    },
    {
      type: "function",
      name: "get_whatsapp_threads",
      description: "List all WhatsApp conversations grouped by contact. Shows the last message and unread count for each thread.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max number of threads to return (default 20)" },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "send_whatsapp_message",
      description: "Send a WhatsApp message to a contact. REQUIRES USER APPROVAL before calling — always show the full message draft and ask for confirmation first.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient phone number in international format e.g. 447537167007" },
          body: { type: "string", description: "The message text to send" },
          contact_name: { type: "string", description: "Name of the contact for display purposes" },
        },
        required: ["to", "body"],
      },
    },
  ];

  // ── Safi tool executor — runs when xAI calls a function mid-conversation ───
  async function executeSafiTool(toolName: string, args: any, db: any): Promise<string> {
    const userId = db._userId;
    try {
      switch (toolName) {
        case "get_appointments": {
          let q = db.from("bookings")
            .select("*, clients(name), treatments(name,price)")
            .eq("user_id", userId)
            .order("start_time", { ascending: true })
            .limit(args.limit ?? 10);
          if (args.filter === "today") {
            const today = new Date(); today.setHours(0,0,0,0);
            const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
            q = q.gte("start_time", today.toISOString()).lt("start_time", tomorrow.toISOString());
          } else if (args.filter === "upcoming") {
            q = q.gte("start_time", new Date().toISOString());
          }
          const { data } = await q;
          if (!data?.length) return "No appointments found.";
          return data.map((b: any) => `${new Date(b.start_time).toLocaleString("en-GB")} — ${(b.clients as any)?.name ?? "Unknown"} — ${(b.treatments as any)?.name ?? "Unknown"} — ${b.status ?? "booked"}`).join("\n");
        }
        case "get_clients": {
          let q = db.from("clients").select("name, email, phone, stage").eq("user_id", userId).limit(args.limit ?? 10);
          if (args.search) q = q.ilike("name", `%${args.search}%`);
          const { data } = await q;
          if (!data?.length) return "No clients found.";
          return data.map((c: any) => `${c.name} — ${c.email ?? "no email"} — ${c.phone ?? "no phone"} — ${c.stage ?? ""}`).join("\n");
        }
        case "get_invoices": {
          let q = db.from("invoices").select("invoice_number, total, status, due_date, clients(name)").eq("user_id", userId).limit(args.limit ?? 10);
          if (args.status === "unpaid" || args.status === "overdue") q = q.eq("status", "unpaid");
          else if (args.status === "paid") q = q.eq("status", "paid");
          const { data } = await q;
          if (!data?.length) return "No invoices found.";
          const now = new Date();
          return data.map((inv: any) => {
            const overdue = inv.status === "unpaid" && inv.due_date && new Date(inv.due_date) < now;
            return `${inv.invoice_number ?? "INV"} — ${(inv.clients as any)?.name ?? "Unknown"} — £${inv.total ?? 0} — ${overdue ? "OVERDUE" : inv.status}`;
          }).join("\n");
        }
        case "get_quotes": {
          let q = db.from("quotes").select("quote_number, amount, status, clients(name)").eq("user_id", userId).limit(args.limit ?? 10);
          if (args.status && args.status !== "all") q = q.eq("status", args.status);
          const { data } = await q;
          if (!data?.length) return "No quotes found.";
          return data.map((qt: any) => `${qt.quote_number ?? "QUO"} — ${(qt.clients as any)?.name ?? "Unknown"} — £${qt.amount ?? 0} — ${qt.status}`).join("\n");
        }
        case "get_stock": {
          const { data } = await db.from("stock_items").select("name, quantity, low_stock_threshold, unit, category").eq("user_id", userId);
          if (!data?.length) return "No stock items found.";
          const items = args.low_stock_only ? data.filter((s: any) => s.quantity <= (s.low_stock_threshold ?? 0)) : data;
          if (!items.length) return "All stock levels are healthy.";
          return items.map((s: any) => `${s.name} — ${s.quantity} ${s.unit ?? "units"}${s.quantity <= (s.low_stock_threshold ?? 0) ? " ⚠️ LOW" : ""}`).join("\n");
        }
        case "get_report": {
          const now = new Date();
          let from: Date;
          let label: string;
          if (args.period === "today") { from = new Date(now); from.setHours(0,0,0,0); label = "Today"; }
          else if (args.period === "this_week") { from = new Date(now); from.setDate(now.getDate() - now.getDay()); from.setHours(0,0,0,0); label = "This week"; }
          else if (args.period === "last_month") { from = new Date(now.getFullYear(), now.getMonth()-1, 1); label = "Last month"; }
          else { from = new Date(now.getFullYear(), now.getMonth(), 1); label = "This month"; }
          const [invRes, bookRes, clientRes] = await Promise.all([
            db.from("invoices").select("total, status").eq("user_id", userId).gte("issue_date", from.toISOString()),
            db.from("bookings").select("id, status").eq("user_id", userId).gte("start_time", from.toISOString()),
            db.from("clients").select("id").eq("user_id", userId).gte("created_at", from.toISOString()),
          ]);
          const revenue = (invRes.data ?? []).filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.total ?? 0), 0);
          const outstanding = (invRes.data ?? []).filter((i: any) => i.status === "unpaid").reduce((s: number, i: any) => s + (i.total ?? 0), 0);
          const jobs = (bookRes.data ?? []).length;
          const newClients = (clientRes.data ?? []).length;
          return `${label} report:\n• Revenue collected: £${revenue.toFixed(2)}\n• Outstanding invoices: £${outstanding.toFixed(2)}\n• Jobs/appointments: ${jobs}\n• New clients: ${newClients}`;
        }
        case "get_leads": {
          const { data } = await db.from("leads").select("id, name, source, status, notes, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(args.limit ?? 10);
          if (!data?.length) return "No leads found.";
          return data.map((l: any) => `${l.name} — ${l.source ?? "unknown"} — ${l.status ?? "new"}${l.notes ? ` — ${l.notes}` : ""}`).join("\n");
        }
        case "create_lead": {
          if (!args.name) return "Lead name is required.";
          const { data, error } = await db.from("leads").insert({
            user_id: userId,
            name: args.name,
            source: args.source ?? "manual",
            status: args.status ?? "new",
            notes: args.notes ?? null,
          }).select().single();
          if (error) return `Failed to create lead: ${error.message}`;
          return `Lead created: ${data.name} — ${data.source} — ${data.status}`;
        }
        case "update_lead": {
          const { data: found } = await db.from("leads").select("id, name, status, notes").eq("user_id", userId).ilike("name", `%${args.name}%`).limit(1).single();
          if (!found) return `No lead found matching "${args.name}".`;
          const updates: any = {};
          if (args.status) updates.status = args.status;
          if (args.notes) updates.notes = args.notes;
          const { data, error } = await db.from("leads").update(updates).eq("id", found.id).select().single();
          if (error) return `Failed to update lead: ${error.message}`;
          return `Lead updated: ${data.name} — now ${data.status}${data.notes ? ` — ${data.notes}` : ""}`;
        }
        case "create_quote": {
          if (!args.client_name || !args.amount) return "Client name and amount are required.";
          const countRes = await db.from("quotes").select("id", { count: "exact", head: true }).eq("user_id", userId);
          const num = (countRes.count ?? 0) + 1;
          const quoteNumber = `QUO-${String(num).padStart(3, "0")}`;
          const { data, error } = await db.from("quotes").insert({
            user_id: userId,
            quote_number: quoteNumber,
            amount: args.amount,
            status: "draft",
            notes: args.notes ?? null,
            description: args.items,
          }).select().single();
          if (error) return `Failed to create quote: ${error.message}`;
          return `Quote created: ${quoteNumber} — ${args.client_name} — £${args.amount} — draft`;
        }
        case "update_quote": {
          const { data: found } = await db.from("quotes").select("id, quote_number, status").eq("user_id", userId).ilike("quote_number", `%${args.quote_number}%`).limit(1).single();
          if (!found) return `No quote found matching "${args.quote_number}".`;
          const updates: any = { status: args.status };
          if (args.notes) updates.notes = args.notes;
          const { data, error } = await db.from("quotes").update(updates).eq("id", found.id).select().single();
          if (error) return `Failed to update quote: ${error.message}`;
          return `Quote ${data.quote_number} updated to ${data.status}.`;
        }
        case "create_invoice": {
          if (!args.client_name || !args.amount) return "Client name and amount are required.";
          const countRes = await db.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId);
          const num = (countRes.count ?? 0) + 1;
          const invoiceNumber = `INV-${String(num).padStart(3, "0")}`;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (args.due_days ?? 30));
          const { data, error } = await db.from("invoices").insert({
            user_id: userId,
            invoice_number: invoiceNumber,
            total: args.amount,
            status: "unpaid",
            description: args.description,
            due_date: dueDate.toISOString().split("T")[0],
            issue_date: new Date().toISOString().split("T")[0],
          }).select().single();
          if (error) return `Failed to create invoice: ${error.message}`;
          return `Invoice created: ${invoiceNumber} — ${args.client_name} — £${args.amount} — due ${dueDate.toLocaleDateString("en-GB")}`;
        }
        case "update_invoice": {
          const { data: found } = await db.from("invoices").select("id, invoice_number, status").eq("user_id", userId).ilike("invoice_number", `%${args.invoice_number}%`).limit(1).single();
          if (!found) return `No invoice found matching "${args.invoice_number}".`;
          const updates: any = { status: args.status };
          if (args.notes) updates.notes = args.notes;
          const { data, error } = await db.from("invoices").update(updates).eq("id", found.id).select().single();
          if (error) return `Failed to update invoice: ${error.message}`;
          return `Invoice ${data.invoice_number} updated to ${data.status}.`;
        }
        case "get_bookings": {
          let q = db.from("bookings")
            .select("id, date, time, status, notes, clients(name, phone), treatments(name, price, duration_mins)")
            .eq("user_id", userId)
            .order("date", { ascending: true })
            .order("time", { ascending: true })
            .limit(args.limit ?? 15);
          if (args.filter === "today") {
            const today = new Date().toISOString().split("T")[0];
            q = q.eq("date", today);
          } else if (args.filter === "upcoming") {
            q = q.gte("date", new Date().toISOString().split("T")[0]).not("status", "eq", "cancelled");
          } else if (args.filter === "past") {
            q = q.lt("date", new Date().toISOString().split("T")[0]);
          }
          if (args.client_name) {
            const { data: cl } = await db.from("clients").select("id").eq("user_id", userId).ilike("name", `%${args.client_name}%`).limit(1).single();
            if (cl) q = q.eq("client_id", cl.id);
          }
          const { data } = await q;
          if (!data?.length) return "No bookings found.";
          return data.map((b: any) => `[${b.id}] ${b.date} ${b.time} — ${(b.clients as any)?.name ?? "Unknown"} — ${(b.treatments as any)?.name ?? "Unknown"} — ${b.status}${b.notes ? ` — Note: ${b.notes}` : ""}`).join("\n");
        }
        case "create_booking": {
          const { data: cl } = await db.from("clients").select("id, name").eq("user_id", userId).ilike("name", `%${args.client_name}%`).limit(1).single();
          if (!cl) return `No client found matching "${args.client_name}". Please create the client first.`;
          const { data: tr } = await db.from("treatments").select("id, name, price").eq("user_id", userId).ilike("name", `%${args.treatment_name}%`).limit(1).single();
          if (!tr) return `No treatment found matching "${args.treatment_name}". Please check treatment names in Settings.`;
          const startTime = new Date(`${args.date}T${args.time}:00`);
          const { data, error } = await db.from("bookings").insert({
            user_id: userId,
            client_id: cl.id,
            treatment_id: tr.id,
            date: args.date,
            time: args.time,
            start_time: startTime.toISOString(),
            status: args.status ?? "confirmed",
            notes: args.notes ?? null,
          }).select("id, date, time, status").single();
          if (error) return `Failed to create booking: ${error.message}`;
          return `Booking created: [${data.id}] ${cl.name} — ${tr.name} — ${args.date} at ${args.time} — ${data.status}`;
        }
        case "update_booking": {
          const updates: any = { status: args.status };
          if (args.notes) updates.notes = args.notes;
          const { data, error } = await db.from("bookings").update(updates).eq("id", args.booking_id).eq("user_id", userId).select("id, date, time, status").single();
          if (error || !data) return `Failed to update booking: ${error?.message ?? "not found"}`;
          return `Booking [${data.id}] on ${data.date} at ${data.time} updated to ${data.status}.`;
        }
        case "get_clients_detail": {
          let q = db.from("clients").select("id, name, email, phone, stage, notes, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(args.limit ?? 15);
          if (args.search) q = q.or(`name.ilike.%${args.search}%,email.ilike.%${args.search}%,phone.ilike.%${args.search}%`);
          if (args.stage && args.stage !== "all") q = q.eq("stage", args.stage);
          const { data } = await q;
          if (!data?.length) return "No clients found.";
          return data.map((c: any) => `[${c.id}] ${c.name} — ${c.email ?? "no email"} — ${c.phone ?? "no phone"} — ${c.stage ?? "active"}${c.notes ? ` — ${c.notes}` : ""}`).join("\n");
        }
        case "create_client": {
          if (!args.name) return "Client name is required.";
          const { data, error } = await db.from("clients").insert({
            user_id: userId,
            name: args.name,
            email: args.email ?? null,
            phone: args.phone ?? null,
            stage: args.stage ?? "active",
            notes: args.notes ?? null,
          }).select("id, name, stage").single();
          if (error) return `Failed to create client: ${error.message}`;
          return `Client created: ${data.name} — stage: ${data.stage} — ID: ${data.id}`;
        }
        case "update_client": {
          const { data: found } = await db.from("clients").select("id, name, stage").eq("user_id", userId).ilike("name", `%${args.name}%`).limit(1).single();
          if (!found) return `No client found matching "${args.name}".`;
          const updates: any = {};
          if (args.new_stage) updates.stage = args.new_stage;
          if (args.new_email) updates.email = args.new_email;
          if (args.new_phone) updates.phone = args.new_phone;
          if (args.notes) updates.notes = args.notes;
          if (!Object.keys(updates).length) return "No updates provided.";
          const { data, error } = await db.from("clients").update(updates).eq("id", found.id).select("name, stage, email, phone").single();
          if (error) return `Failed to update client: ${error.message}`;
          return `Client updated: ${data.name} — stage: ${data.stage} — email: ${data.email ?? "unchanged"} — phone: ${data.phone ?? "unchanged"}`;
        }
        case "get_consent_forms": {
          let q = db.from("consent_forms").select("id, form_type, status, created_at, signed_at, token, clients(name, email)").eq("user_id", userId).order("created_at", { ascending: false }).limit(args.limit ?? 15);
          if (args.status === "signed") q = q.eq("status", "signed");
          else if (args.status === "pending") q = q.in("status", ["sent", "pending", "viewed"]);
          else if (args.status === "overdue") {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            q = q.not("status", "eq", "signed").lt("created_at", sevenDaysAgo);
          }
          if (args.client_name) {
            const { data: cl } = await db.from("clients").select("id").eq("user_id", userId).ilike("name", `%${args.client_name}%`).limit(1).single();
            if (cl) q = q.eq("client_id", cl.id);
          }
          const { data } = await q;
          if (!data?.length) return "No consent forms found.";
          return data.map((f: any) => `${(f.clients as any)?.name ?? "Unknown"} — ${f.form_type.replace(/_/g, " ")} — ${f.status}${f.signed_at ? ` (signed ${new Date(f.signed_at).toLocaleDateString("en-GB")})` : ` (sent ${new Date(f.created_at).toLocaleDateString("en-GB")})`}`).join("\n");
        }
        case "send_consent_form": {
          // Look up client with email
          const { data: cl } = await db.from("clients").select("id, name, email").eq("user_id", userId).ilike("name", `%${args.client_name}%`).limit(1).single();
          if (!cl) return `No client found matching "${args.client_name}". Please create the client first.`;
          if (!cl.email) return `${cl.name} doesn't have an email address on file. Please add their email in the Clients section first, then I can send the form.`;

          // Create the consent form record
          const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
          const { data: form, error: formErr } = await db.from("consent_forms").insert({
            user_id: userId,
            client_id: cl.id,
            form_type: args.form_type,
            status: "sent",
            token,
          }).select("id, token, form_type, status").single();
          if (formErr) return `Failed to create consent form: ${formErr.message}`;

          // Build the signing link
          const appUrl = process.env.RAILWAY_PUBLIC_DOMAIN
            ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
            : "https://practivault-backend-production.up.railway.app";
          const signingLink = `${appUrl}/#/consent/public/${form.token}`;
          const formLabel = form.form_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
          const bizName = args.business_name ?? "your practitioner";

          // Send the email via Resend
          const resendKey = process.env.RESEND_API_KEY;
          if (!resendKey) {
            return `Consent form created for ${cl.name} but email could not be sent — RESEND_API_KEY is not configured. Signing link: ${signingLink}`;
          }

          const resend = new Resend(resendKey);
          const { error: emailErr } = await resend.emails.send({
            from: "Safi <noreply@practivault.com>",
            to: cl.email,
            subject: `Your ${formLabel} form from ${bizName}`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
              <h2 style="color:#b1306f;margin-bottom:8px">${formLabel}</h2>
              <p>Hi ${cl.name},</p>
              <p>Please complete your <strong>${formLabel}</strong> form before your next appointment with <strong>${bizName}</strong>.</p>
              <p>It only takes a minute — just click the button below:</p>
              <p style="text-align:center;margin:32px 0">
                <a href="${signingLink}" style="background:#b1306f;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Complete My Form</a>
              </p>
              <p style="color:#666;font-size:13px">Or copy this link into your browser:<br>${signingLink}</p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
              <p style="color:#999;font-size:12px">Sent on behalf of ${bizName} via PractiVault</p>
            </div>`,
          });

          if (emailErr) return `Consent form created but email failed to send: ${(emailErr as any).message ?? "unknown error"}. Signing link: ${signingLink}`;

          // Log to client timeline
          await db.from("client_timeline").insert({
            client_id: cl.id,
            user_id: userId,
            type: "consent",
            description: `Consent form sent via email: ${form.form_type}`,
            metadata: { consent_id: form.id, token: form.token },
          }).catch(() => {});

          return `Done! I've sent the ${formLabel} consent form to ${cl.name} at ${cl.email}. They'll receive an email with a link to complete it. I'll show it as "sent" in the Consent Forms list.`;
        }
        case "get_before_after_photos": {
          let q = db.from("client_photos").select("id, treatment_type, notes, taken_at, before_url, after_url, clients(name)").eq("user_id", userId).order("taken_at", { ascending: false }).limit(args.limit ?? 10);
          if (args.client_name) {
            const { data: cl } = await db.from("clients").select("id").eq("user_id", userId).ilike("name", `%${args.client_name}%`).limit(1).single();
            if (cl) q = q.eq("client_id", cl.id);
          }
          const { data } = await q;
          if (!data?.length) return "No before & after photos found.";
          return data.map((p: any) => `${(p.clients as any)?.name ?? "Unknown"} — ${p.treatment_type ?? "treatment"} — ${new Date(p.taken_at).toLocaleDateString("en-GB")}${p.notes ? ` — ${p.notes}` : ""} — before: ${p.before_url ? "yes" : "no"}, after: ${p.after_url ? "yes" : "no"}`).join("\n");
        }
        case "get_team_analysis": {
          const { data } = await db.from("team_members").select("id, name, email, role, status, joined_at, created_at").eq("owner_id", userId).order("created_at", { ascending: true });
          if (!data?.length) return "No team members found. You have no team set up yet — would you like to invite your first member?";
          const now = new Date();
          const active = data.filter((m: any) => m.status === "active");
          const pending = data.filter((m: any) => m.status === "pending");
          // Flag stale invites (>7 days)
          const staleThreshold = 7 * 24 * 60 * 60 * 1000;
          const stale = pending.filter((m: any) => {
            const created = new Date(m.created_at);
            return (now.getTime() - created.getTime()) > staleThreshold;
          });
          // Role coverage analysis
          const roles = data.map((m: any) => m.role.toLowerCase());
          const hasReceptionist = roles.includes("receptionist");
          const hasPractitioner = roles.includes("practitioner");
          const roleCounts: Record<string, number> = {};
          for (const r of roles) roleCounts[r] = (roleCounts[r] || 0) + 1;
          const rolesSummary = Object.entries(roleCounts).map(([r, c]) => `${r}: ${c}`).join(", ");
          let analysis = `TEAM ANALYSIS\n============\n`;
          analysis += `Total members: ${data.length} (${active.length} active, ${pending.length} pending invite)\n`;
          analysis += `Roles: ${rolesSummary}\n`;
          if (!hasReceptionist) analysis += `⚠️ No receptionist on your team — consider adding one to manage bookings and enquiries.\n`;
          if (!hasPractitioner) analysis += `⚠️ No practitioners on your team yet.\n`;
          if (stale.length > 0) {
            analysis += `\n⚠️ STALE INVITES (sent >7 days ago, not yet accepted):\n`;
            for (const m of stale) {
              const daysSince = Math.floor((now.getTime() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24));
              analysis += `  • ${m.name} (${m.email}) — ${m.role} — invite sent ${daysSince} days ago\n`;
            }
            analysis += `  → Consider re-sending invites to these members.\n`;
          }
          analysis += `\nFULL TEAM LIST:\n`;
          analysis += data.map((m: any) => {
            const daysPending = m.status === "pending" ? Math.floor((now.getTime() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null;
            return `  • ${m.name} — ${m.role} — ${m.status === "active" ? `✅ Active${m.joined_at ? ` (joined ${new Date(m.joined_at).toLocaleDateString("en-GB")})` : ""}` : `⏳ Pending${daysPending !== null ? ` (${daysPending}d ago)` : ""}`} — ${m.email}`;
          }).join("\n");
          return analysis;
        }
        case "invite_team_member": {
          const token = require("crypto").randomBytes(24).toString("hex");
          const { data, error } = await db.from("team_members").insert({ owner_id: userId, name: args.name, email: args.email, role: args.role, status: "pending", invite_token: token }).select("id, name, email, role").single();
          if (error) return `Failed to send invite: ${error.message}`;
          return `Invite sent to ${data.name} (${data.email}) as ${data.role}. They'll receive a join link to activate their account.`;
        }
        case "get_manuals": {
          let q = db.from("manuals").select("id, name, description, category, file_name, file_url, created_at").eq("user_id", userId).order("created_at", { ascending: false });
          if (args.category) q = q.ilike("category", `%${args.category}%`);
          if (args.search) q = q.ilike("name", `%${args.search}%`);
          const { data } = await q;
          if (!data?.length) return "No manuals found.";
          return data.map((m: any) => `${m.name} — ${m.category} — uploaded ${new Date(m.created_at).toLocaleDateString("en-GB")}${m.description ? ` — ${m.description}` : ""}`).join("\n");
        }
        case "get_videos": {
          let q = db.from("training_videos").select("id, title, description, category, video_type, is_free, duration_seconds, created_at").eq("user_id", userId).order("created_at", { ascending: false });
          if (args.category) q = q.ilike("category", `%${args.category}%`);
          if (args.search) q = q.ilike("title", `%${args.search}%`);
          const { data } = await q;
          if (!data?.length) return "No videos found.";
          return data.map((v: any) => `${v.title} — ${v.category} — ${v.video_type} — ${v.is_free ? "Free" : "Paid"}${v.duration_seconds ? ` — ${Math.round(v.duration_seconds / 60)}min` : ""}`).join("\n");
        }
        case "get_packages_analysis": {
          const [pkgRes, vidRes, manRes] = await Promise.all([
            db.from("training_packages").select("id, title, description, price, is_free, video_ids, manual_ids, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
            db.from("training_videos").select("id, title, category, is_free").eq("user_id", userId),
            db.from("manuals").select("id, name, category").eq("user_id", userId),
          ]);
          const packages = pkgRes.data ?? [];
          const allVideos = vidRes.data ?? [];
          const allManuals = manRes.data ?? [];
          // Collect all video/manual IDs that are already in packages
          const bundledVideoIds = new Set<string>();
          const bundledManualIds = new Set<string>();
          let totalRevenuePotential = 0;
          for (const p of packages) {
            const vids: string[] = (() => { try { return JSON.parse(p.video_ids || "[]"); } catch { return []; } })();
            const mans: string[] = (() => { try { return JSON.parse(p.manual_ids || "[]"); } catch { return []; } })();
            vids.forEach((id: string) => bundledVideoIds.add(id));
            mans.forEach((id: string) => bundledManualIds.add(id));
            if (!p.is_free) totalRevenuePotential += Number(p.price || 0);
          }
          const unbundledVideos = allVideos.filter((v: any) => !bundledVideoIds.has(v.id));
          const unbundledManuals = allManuals.filter((m: any) => !bundledManualIds.has(m.id));
          let analysis = `PACKAGES ANALYSIS\n================\n`;
          analysis += `Total packages: ${packages.length} (${packages.filter((p: any) => !p.is_free).length} paid, ${packages.filter((p: any) => p.is_free).length} free)\n`;
          analysis += `Total videos in library: ${allVideos.length} | Manuals: ${allManuals.length}\n`;
          analysis += `Combined price of paid packages: £${totalRevenuePotential.toFixed(2)}\n`;
          if (unbundledVideos.length > 0) {
            analysis += `\n⭐️ UNBUNDLED VIDEOS (${unbundledVideos.length} not in any package — bundling opportunity!):\n`;
            analysis += unbundledVideos.map((v: any) => `  • ${v.title} — ${v.category} — ${v.is_free ? "Free" : "Paid"}`).join("\n") + "\n";
          }
          if (unbundledManuals.length > 0) {
            analysis += `\n⭐️ UNBUNDLED MANUALS (${unbundledManuals.length} not in any package):\n`;
            analysis += unbundledManuals.map((m: any) => `  • ${m.name} — ${m.category}`).join("\n") + "\n";
          }
          if (unbundledVideos.length === 0 && unbundledManuals.length === 0 && packages.length > 0) {
            analysis += `\n✅ Great — every video and manual is included in at least one package.\n`;
          }
          if (packages.length === 0) return `No training packages yet. You have ${allVideos.length} video(s) and ${allManuals.length} manual(s) in your library — I can help you bundle these into packages. Would you like me to suggest one?`;
          analysis += `\nPACKAGES:\n`;
          analysis += packages.map((p: any) => {
            const vids: string[] = (() => { try { return JSON.parse(p.video_ids || "[]"); } catch { return []; } })();
            const mans: string[] = (() => { try { return JSON.parse(p.manual_ids || "[]"); } catch { return []; } })();
            return `  • ${p.title} — ${p.is_free ? "Free" : `£${Number(p.price || 0).toFixed(2)}`} — ${vids.length} video(s), ${mans.length} manual(s)${p.description ? `\n    ${p.description}` : ""}`;
          }).join("\n");
          return analysis;
        }
        case "create_package": {
          const { data, error } = await db.from("training_packages").insert({ user_id: userId, title: args.title, description: args.description ?? null, price: Number(args.price ?? 0), is_free: args.is_free ?? (Number(args.price ?? 0) === 0), video_ids: "[]", manual_ids: "[]" }).select("id, title, price, is_free").single();
          if (error) return `Failed to create package: ${error.message}`;
          return `Package created: "${data.title}" — ${data.is_free ? "Free" : `£${Number(data.price).toFixed(2)}`}`;
        }
        case "get_stock_analysis": {
          let q = db.from("stock_items").select("id, name, category, unit, quantity, low_stock_threshold, cost_price, supplier, notes").eq("user_id", userId).order("category").order("name");
          if (args.category) q = q.ilike("category", `%${args.category}%`);
          const { data: items } = await q;
          if (!items?.length) return "No stock items found. Your stock list is empty — would you like me to help you add your first items?";
          // Recent movements for usage insights
          const { data: movements } = await db.from("stock_movements").select("stock_item_id, movement_type, quantity, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
          // Calculate per-item usage (last 30 days)
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const usageMap: Record<string, number> = {};
          if (movements) {
            for (const mv of movements) {
              if (mv.movement_type === "out" && new Date(mv.created_at) >= thirtyDaysAgo) {
                usageMap[mv.stock_item_id] = (usageMap[mv.stock_item_id] || 0) + mv.quantity;
              }
            }
          }
          const lowStock = items.filter((s: any) => s.quantity <= (s.low_stock_threshold ?? 5));
          const totalInventoryValue = items.reduce((sum: number, s: any) => sum + (Number(s.cost_price || 0) * Number(s.quantity || 0)), 0);
          const reorderCost = lowStock.reduce((sum: number, s: any) => {
            const toOrder = Math.max(0, (Number(s.low_stock_threshold ?? 5) * 2) - Number(s.quantity));
            return sum + (Number(s.cost_price || 0) * toOrder);
          }, 0);
          // Group by category
          const categories: Record<string, any[]> = {};
          for (const s of items) {
            const cat = s.category || "Uncategorised";
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(s);
          }
          let analysis = `STOCK ANALYSIS\n=============\n`;
          analysis += `Total items: ${items.length} across ${Object.keys(categories).length} categor${Object.keys(categories).length === 1 ? "y" : "ies"}\n`;
          analysis += `📦 Total inventory value: £${totalInventoryValue.toFixed(2)}\n`;
          if (lowStock.length > 0) {
            analysis += `\n⚠️ LOW STOCK ALERTS (${lowStock.length} item${lowStock.length === 1 ? "" : "s"} at or below threshold):\n`;
            for (const s of lowStock) {
              const usage30 = usageMap[s.id] || 0;
              const toOrder = Math.max(0, (Number(s.low_stock_threshold ?? 5) * 2) - Number(s.quantity));
              analysis += `  • ${s.name}: ${s.quantity} ${s.unit} remaining (threshold: ${s.low_stock_threshold})`;
              if (usage30 > 0) analysis += ` — used ${usage30} ${s.unit} in last 30 days`;
              if (toOrder > 0) analysis += ` → suggest ordering ${toOrder} ${s.unit} (est. £${(toOrder * Number(s.cost_price || 0)).toFixed(2)})`;
              if (s.supplier) analysis += ` — supplier: ${s.supplier}`;
              analysis += "\n";
            }
            analysis += `  💰 Estimated reorder cost for all low stock: £${reorderCost.toFixed(2)}\n`;
          } else {
            analysis += `\n✅ All stock levels are healthy — nothing below threshold.\n`;
          }
          if (!args.low_stock_only) {
            analysis += `\nFULL STOCK LIST BY CATEGORY:\n`;
            for (const [cat, catItems] of Object.entries(categories)) {
              const catValue = catItems.reduce((s: number, i: any) => s + (Number(i.cost_price || 0) * Number(i.quantity || 0)), 0);
              analysis += `\n${cat} (£${catValue.toFixed(2)} value):\n`;
              for (const s of catItems as any[]) {
                const usage30 = usageMap[s.id] || 0;
                analysis += `  • ${s.name}: ${s.quantity} ${s.unit}${s.quantity <= (s.low_stock_threshold ?? 5) ? " ⚠️" : ""}`;
                analysis += ` — £${Number(s.cost_price || 0).toFixed(2)}/unit`;
                if (usage30 > 0) analysis += ` — ${usage30} used last 30d`;
                if (s.supplier) analysis += ` — ${s.supplier}`;
                analysis += "\n";
              }
            }
          }
          return analysis;
        }
        case "add_stock_item": {
          const { data, error } = await db.from("stock_items").insert({ user_id: userId, name: args.name, category: args.category ?? "General", unit: args.unit ?? "units", quantity: Number(args.quantity ?? 0), low_stock_threshold: Number(args.low_stock_threshold ?? 5), cost_price: Number(args.cost_price ?? 0), supplier: args.supplier ?? null, notes: null }).select("id, name, quantity, unit").single();
          if (error) return `Failed to add stock item: ${error.message}`;
          return `Stock item added: ${data.name} — ${data.quantity} ${data.unit} — ID: ${data.id}`;
        }
        case "update_stock_quantity": {
          const { data: found } = await db.from("stock_items").select("id, name, quantity, unit").eq("user_id", userId).ilike("name", `%${args.item_name}%`).limit(1).single();
          if (!found) return `No stock item found matching "${args.item_name}".`;
          const delta = args.movement_type === "in" ? Number(args.quantity) : -Number(args.quantity);
          const newQty = Math.max(0, Number(found.quantity) + delta);
          await db.from("stock_items").update({ quantity: newQty }).eq("id", found.id);
          await db.from("stock_movements").insert({ user_id: userId, stock_item_id: found.id, movement_type: args.movement_type, quantity: Number(args.quantity), notes: args.notes ?? null }).catch(() => {});
          return `${found.name}: ${args.movement_type === "in" ? "+" : "-"}${args.quantity} ${found.unit}. New quantity: ${newQty} ${found.unit}.`;
        }
        case "get_cpd_analysis": {
          // Determine current CPD year (April 6 to April 5)
          const now2 = new Date();
          const currentYear = now2.getFullYear();
          const cpdYearStart = now2 >= new Date(`${currentYear}-04-06`) ? new Date(`${currentYear}-04-06`) : new Date(`${currentYear - 1}-04-06`);
          const cpdYearEnd = new Date(cpdYearStart);
          cpdYearEnd.setFullYear(cpdYearEnd.getFullYear() + 1);
          const cpdYearLabel = `${cpdYearStart.getFullYear()}/${cpdYearEnd.getFullYear()}`;
          let q = db.from("cpd_logs").select("id, course_name, provider, date, hours, category, notes, certificate_url").eq("user_id", userId).order("date", { ascending: false });
          if (args.category) q = q.ilike("category", `%${args.category}%`);
          if (args.year_filter && args.year_filter !== "all") {
            const parts = args.year_filter.split("/");
            if (parts.length === 2) {
              const from = `${parts[0]}-04-06`;
              const to = `${parts[1]}-04-05`;
              q = q.gte("date", from).lte("date", to);
            }
          }
          const { data: allEntries } = await q;
          const entries = allEntries ?? [];
          // Current year entries
          const currentYearEntries = entries.filter((e: any) => {
            const d = new Date(e.date);
            return d >= cpdYearStart && d < cpdYearEnd;
          });
          const annualTarget = 35;
          const currentYearHours = currentYearEntries.reduce((s: number, e: any) => s + Number(e.hours || 0), 0);
          const hoursRemaining = Math.max(0, annualTarget - currentYearHours);
          const pctComplete = Math.min(100, Math.round((currentYearHours / annualTarget) * 100));
          // Days left in CPD year
          const msLeft = cpdYearEnd.getTime() - now2.getTime();
          const daysLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60 * 24)));
          // Category breakdown for current year
          const catTotals: Record<string, number> = {};
          for (const e of currentYearEntries) {
            const cat = e.category || "Uncategorised";
            catTotals[cat] = (catTotals[cat] || 0) + Number(e.hours || 0);
          }
          // Check for important category gaps (looking at ALL entries, not just current year)
          const allCategories = new Set(entries.map((e: any) => (e.category || "").toLowerCase()));
          const importantCats = ["first aid", "safeguarding", "legal & compliance"];
          const missingImportant: string[] = [];
          for (const cat of importantCats) {
            if (!Array.from(allCategories).some((c: any) => c.includes(cat.split(" ")[0]))) {
              missingImportant.push(cat);
            }
          }
          // Last training date
          const lastEntry = currentYearEntries[0] ?? entries[0];
          const lastTrainingDate = lastEntry ? new Date(lastEntry.date) : null;
          const daysSinceLast = lastTrainingDate ? Math.floor((now2.getTime() - lastTrainingDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
          let analysis = `CPD ANALYSIS — ${cpdYearLabel}\n${"=".repeat(30)}\n`;
          analysis += `Progress: ${currentYearHours}h / ${annualTarget}h target (${pctComplete}%)\n`;
          const bar = "█".repeat(Math.round(pctComplete / 5)) + "░".repeat(20 - Math.round(pctComplete / 5));
          analysis += `[${bar}] ${hoursRemaining > 0 ? `${hoursRemaining}h still needed` : "🎉 Target reached!"}\n`;
          analysis += `CPD year ends: ${cpdYearEnd.toLocaleDateString("en-GB")} (${daysLeft} days left)\n`;
          if (hoursRemaining > 0 && daysLeft > 0) {
            const hrsPerMonth = (hoursRemaining / (daysLeft / 30)).toFixed(1);
            analysis += `→ You need approx. ${hrsPerMonth}h/month to hit your target.\n`;
          }
          if (daysSinceLast !== null) {
            analysis += `\nLast training: ${lastTrainingDate!.toLocaleDateString("en-GB")} (${daysSinceLast} days ago)\n`;
            if (daysSinceLast > 60) analysis += `⚠️ It's been over 2 months since your last CPD — worth scheduling something soon.\n`;
          }
          if (missingImportant.length > 0) {
            analysis += `\n⚠️ CATEGORY GAPS (no record found for these important areas):\n`;
            for (const cat of missingImportant) analysis += `  • ${cat}\n`;
          }
          if (Object.keys(catTotals).length > 0) {
            analysis += `\nCURRENT YEAR BREAKDOWN BY CATEGORY:\n`;
            const sorted = Object.entries(catTotals).sort((a, b) => (b[1] as number) - (a[1] as number));
            for (const [cat, hrs] of sorted) {
              analysis += `  • ${cat}: ${hrs}h\n`;
            }
          }
          if (!entries.length) return `No CPD entries logged yet for ${cpdYearLabel}. Your annual target is ${annualTarget} hours. Would you like me to log your first entry?`;
          analysis += `\nRECENT ENTRIES (this CPD year):\n`;
          if (currentYearEntries.length === 0) {
            analysis += `  None yet this CPD year (${cpdYearLabel}).\n`;
          } else {
            analysis += currentYearEntries.slice(0, 10).map((e: any) => `  • ${new Date(e.date).toLocaleDateString("en-GB")} — ${e.course_name}${e.provider ? ` (${e.provider})` : ""} — ${e.hours}h${e.category ? ` — ${e.category}` : ""}`).join("\n") + "\n";
            if (currentYearEntries.length > 10) analysis += `  ... and ${currentYearEntries.length - 10} more entries this year.\n`;
          }
          return analysis;
        }
        case "add_cpd_entry": {
          const { data, error } = await db.from("cpd_logs").insert({ user_id: userId, course_name: args.course_name, provider: args.provider ?? null, date: args.date, hours: Number(args.hours), category: args.category ?? null, notes: args.notes ?? null, certificate_url: null }).select("id, course_name, date, hours").single();
          if (error) return `Failed to add CPD entry: ${error.message}`;
          return `CPD entry logged: ${data.course_name} — ${new Date(data.date).toLocaleDateString("en-GB")} — ${data.hours} hours`;
        }
        case "get_whatsapp_threads": {
          const { data: msgs } = await db.from("whatsapp_messages").select("*").eq("user_id", userId).order("sent_at", { ascending: false }).limit(200);
          if (!msgs?.length) return "No WhatsApp conversations yet. Once your number is connected and clients message you, threads will appear here.";
          const threadMap: Record<string, any> = {};
          for (const msg of msgs) {
            const key = msg.contact_phone;
            if (!threadMap[key]) {
              threadMap[key] = { name: msg.contact_name || msg.contact_phone, phone: msg.contact_phone, last_msg: msg.body, last_at: msg.sent_at, unread: 0, total: 0 };
            }
            if (!msg.is_read && msg.direction === "inbound") threadMap[key].unread++;
            threadMap[key].total++;
          }
          const threads = Object.values(threadMap).slice(0, args.limit ?? 20);
          const totalUnread = threads.reduce((s: number, t: any) => s + t.unread, 0);
          let out = `WhatsApp Inbox — ${threads.length} conversation${threads.length !== 1 ? "s" : ""}${totalUnread > 0 ? `, ${totalUnread} unread` : ", all read"}:\n\n`;
          for (const t of threads as any[]) {
            const ago = new Date(t.last_at).toLocaleDateString("en-GB");
            out += `• **${t.name}** (${t.phone})${t.unread > 0 ? ` — 🔴 ${t.unread} unread` : ""}\n  Last: "${t.last_msg?.slice(0, 80)}${(t.last_msg?.length ?? 0) > 80 ? "…" : ""}" (${ago})\n`;
          }
          return out;
        }
        case "send_whatsapp_message": {
          const { to, body: msgBody } = args;
          const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
          const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
          if (!phoneNumberId || !accessToken) {
            await db.from("whatsapp_messages").insert({ user_id: userId, contact_phone: to, contact_name: args.contact_name ?? null, direction: "outbound", body: msgBody, sent_at: new Date().toISOString(), is_read: true, status: "pending_credentials" });
            return `Message saved but not sent — WhatsApp credentials (WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN) are not yet configured on the server. Add them to Railway and it will send live.`;
          }
          const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: msgBody } }),
          });
          const metaData = await metaRes.json() as any;
          if (!metaRes.ok) return `WhatsApp send failed: ${metaData.error?.message || "Unknown error"}`;
          await db.from("whatsapp_messages").insert({ user_id: userId, contact_phone: to, contact_name: args.contact_name ?? null, direction: "outbound", body: msgBody, wa_message_id: metaData.messages?.[0]?.id, sent_at: new Date().toISOString(), is_read: true, status: "sent" });
          return `WhatsApp message sent to ${args.contact_name || to}: "${msgBody}"`;
        }
        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (e: any) {
      return `Error running ${toolName}: ${e.message}`;
    }
  }

  // ── /api/safi/chat — agentic text chat with full tool loop ─────────────────
  app.post("/api/safi/chat", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { message, history = [], sectionContext = "" } = req.body as { message: string; history?: {role:string;content:string}[]; sectionContext?: string };
    if (!message?.trim()) return res.status(400).json({ message: "No message" });

    const db = req.db!;
    const userId = req.user!.id;

    // Build system prompt from business info + manuals
    const [userRes, bizRes, manualsRes] = await Promise.all([
      db.from("users").select("name, business_name, industry").eq("id", userId).single(),
      db.from("business_info").select("*").eq("user_id", userId).single(),
      db.from("manuals").select("name, extracted_text").eq("user_id", userId).not("extracted_text", "is", null).order("created_at", { ascending: true }),
    ]);
    const userData = userRes.data;
    const bizInfo = bizRes.data;
    const manuals = manualsRes.data ?? [];

    let bizContext = "";
    if (bizInfo) {
      if (bizInfo.tagline) bizContext += `\nTagline: ${bizInfo.tagline}`;
      if (bizInfo.about) bizContext += `\nAbout: ${bizInfo.about}`;
      if (bizInfo.website_url) bizContext += `\nWebsite: ${bizInfo.website_url}`;
      if (bizInfo.products?.length) bizContext += `\n\nProducts:\n${(bizInfo.products as any[]).map((p:any)=>`- ${p.name}${p.price?` — ${p.price}`:""}${p.description?`: ${p.description}`:""}`).join("\n")}`;
    }
    let manualContext = "";
    if (manuals.length) {
      let total = 0;
      const parts: string[] = [];
      for (const m of manuals) {
        if (total >= 6000) break;
        const chunk = ((m.extracted_text as string) || "").slice(0, 6000 - total);
        parts.push(`=== ${m.name} ===\n${chunk}`);
        total += chunk.length;
      }
      manualContext = `\n\nManuals:\n${parts.join("\n\n")}`;
    }

    const systemPrompt = `You are Safi, the fully agentic AI assistant for ${userData?.business_name ?? "this business"}.${bizContext}${manualContext}

You are a fully autonomous business AI and you're also warm, friendly, and genuinely helpful — like a trusted colleague who knows the business inside out. Keep your tone conversational and natural. Use first names when you know them. Be encouraging but efficient — no waffle, just good energy and clear communication.

APPROVAL RULE (non-negotiable):
Before executing ANY outbound or write action — including sending messages, posting on social media, sending quotes, sending invoices, updating lead status, or creating records — you MUST first show the user exactly what you have prepared and ask for their approval.

How to ask for approval:
1. Show the full prepared content (the post, quote, invoice, message — exactly as it would be sent/created)
2. Ask warmly: "Happy for me to go ahead?" or "Shall I send this?" or "Does this look good to you?"
3. WAIT for the user to say yes (or words like "go ahead", "looks good", "send it", "yes", "do it", "perfect")
4. Only then call the tool to execute the action

If the user says yes/approved: call the tool immediately and confirm it's done with a short friendly confirmation.
If the user edits or asks for changes: update the draft and show it again before executing.
If the user says no/cancel: discard warmly and ask what they'd like to do instead.

Read-only actions (fetching data, showing lists, generating reports) do NOT need approval — do those immediately.

Reply in clear, concise markdown. Use bullet points or short lists where helpful.
When you retrieve data, summarise it clearly and add a brief observation where useful (e.g. "3 invoices overdue — worth chasing those this week").

Key business facts:
- All courses are 100% online, CPD accredited, no UK licence required
- Payment plans via Clearpay and Klarna
- Website: ${bizInfo?.website_url ?? "your website"}${sectionContext ? `\n\n--- CURRENT SECTION CONTEXT ---\n${sectionContext}` : ""}`;

    // Convert OpenAI-style tools for xAI
    const xaiTools = SAFI_TOOLS.map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }
    }));

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10),
      { role: "user", content: message },
    ];

    // Agentic loop — keep calling until no more tool calls
    const MAX_STEPS = 5;
    for (let step = 0; step < MAX_STEPS; step++) {
      const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.XAI_API_KEY}` },
        body: JSON.stringify({ model: "grok-3-mini", messages, tools: xaiTools, tool_choice: "auto", max_tokens: 1000 }),
      });

      if (!grokRes.ok) {
        const err = await grokRes.text();
        return res.status(502).json({ message: `AI error: ${err}` });
      }

      const grokData = await grokRes.json() as any;
      const choice = grokData.choices?.[0];
      const assistantMsg = choice?.message;

      if (!assistantMsg) return res.status(502).json({ message: "No response from AI" });

      messages.push(assistantMsg);

      // No tool calls — we have the final answer
      if (!assistantMsg.tool_calls?.length) {
        return res.json({ reply: assistantMsg.content ?? "", messages });
      }

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        assistantMsg.tool_calls.map(async (tc: any) => {
          const toolName = tc.function?.name ?? tc.name ?? "";
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments ?? tc.arguments ?? "{}"); } catch {}

          // Attach userId to db proxy for tool executor
          const dbWithUser = Object.assign(Object.create(Object.getPrototypeOf(db)), db, { _userId: userId });
          const result = await executeSafiTool(toolName, args, dbWithUser);
          return { tool_call_id: tc.id, role: "tool" as const, content: result };
        })
      );

      messages.push(...toolResults);
    }

    return res.json({ reply: "I've completed the requested tasks.", messages });
  });

    // ─── Saphie AI — chat + voice transcription + manuals ──────────────────────

  const ADMIN_USER_ID = "d76f928a-3d62-4c7c-918b-e66e5760d816";

  const saphieUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

  // GET messages
  app.get("/api/saphie/messages", requireAuth, async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!
      .from("buddy_messages")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data ?? []);
  });

  // DELETE messages
  app.delete("/api/saphie/messages", requireAuth, async (req: AuthedRequest, res) => {
    const { error } = await req.db!
      .from("buddy_messages")
      .delete()
      .eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // POST chat
  app.post("/api/saphie/chat", requireAuth, async (req: AuthedRequest, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "No content" });

    // Fetch all data sources in parallel
    const [userRes, historyRes, manualsRes, bizRes] = await Promise.all([
      req.db!.from("users").select("name, business_name, industry").eq("id", req.user!.id).single(),
      req.db!.from("buddy_messages").select("role, content").eq("user_id", req.user!.id).order("created_at", { ascending: true }).limit(10),
      req.db!.from("manuals").select("name, extracted_text").eq("user_id", req.user!.id).not("extracted_text", "is", null).order("created_at", { ascending: true }),
      req.db!.from("business_info").select("*").eq("user_id", req.user!.id).single(),
    ]);
    const userData = userRes.data;
    const history = historyRes.data;
    const manuals = manualsRes.data;
    const bizInfo = bizRes.data;

    let manualContext = "";
    if (manuals && manuals.length > 0) {
      let totalChars = 0;
      const MAX_MANUAL_CHARS = 12000;
      const sections: string[] = [];
      for (const m of manuals) {
        if (totalChars >= MAX_MANUAL_CHARS) break;
        const text = (m.extracted_text as string) || "";
        const remaining = MAX_MANUAL_CHARS - totalChars;
        const chunk = text.slice(0, remaining);
        sections.push(`=== ${m.name} ===\n${chunk}`);
        totalChars += chunk.length;
      }
      manualContext = `\n\nYou have access to the following treatment/service manuals for this business. Use them to answer client questions accurately and professionally — be helpful and reassuring, not salesy. Never reveal exact protocols, ingredient concentrations, or proprietary steps.\n\n${sections.join("\n\n")}`;
    }

    // Save user message
    await req.db!.from("buddy_messages").insert({
      user_id: req.user!.id, role: "user", content: content.trim(),
    });

    // Build business info context for Saphie
    let bizContext = "";
    if (bizInfo) {
      if (bizInfo.tagline) bizContext += `\nTagline: ${bizInfo.tagline}`;
      if (bizInfo.about) bizContext += `\nAbout: ${bizInfo.about}`;
      if (bizInfo.website_url) bizContext += `\nWebsite: ${bizInfo.website_url}`;
      if (bizInfo.instagram_url) bizContext += `\nInstagram: ${bizInfo.instagram_url}`;
      if (bizInfo.tiktok_url) bizContext += `\nTikTok: ${bizInfo.tiktok_url}`;
      if (bizInfo.products && (bizInfo.products as any[]).length > 0) {
        const productLines = (bizInfo.products as any[]).map((p: any) =>
          `- ${p.name}${p.price ? ` (${p.price})` : ""}${p.category ? ` [${p.category}]` : ""}: ${p.description || ""}`
        ).join("\n");
        bizContext += `\n\nProducts & Services:\n${productLines}`;
      }
      if (bizInfo.faqs && (bizInfo.faqs as any[]).length > 0) {
        const faqLines = (bizInfo.faqs as any[]).map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
        bizContext += `\n\nFrequently Asked Questions:\n${faqLines}`;
      }
    }

    const systemPrompt = `You are Safi, the AI assistant for ${userData?.business_name ?? "this business"}.${bizContext}

IMPORTANT: You have a real voice. You speak your replies aloud. Never say you are text-only or cannot speak.

Your role: You are a knowledgeable, friendly sales assistant. Your job is to answer questions about the courses and products, share prices confidently, and help interested people understand what they're buying. Keep replies concise (2-3 sentences) since they are spoken aloud.

Key facts:
- All courses are 100% online, self-paced, and CPD accredited
- No licence is required in the UK to purchase or complete these courses
- No consultation is needed — courses can be purchased directly from the website
- Payment plans are available via Clearpay and Klarna (3-4 interest-free payments)
- All purchases are non-refundable
- When someone asks about a course or product, give them the name, price, and a one-sentence summary of what it covers — then let them know they can buy directly from the website
- Always give the actual price when asked — never be vague about pricing
- Do not suggest they need a consultation, a licence, or any prior approval before purchasing${manualContext}`;

    const grokChatRes = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...(history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: content.trim() },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!grokChatRes.ok) {
      const err = await grokChatRes.text();
      return res.status(500).json({ message: "Grok chat error: " + err });
    }

    const grokChatData = await grokChatRes.json() as any;
    const reply = grokChatData.choices?.[0]?.message?.content ?? "Sorry, I couldn't get a response.";

    // Save assistant reply in background — don't await, reply to client immediately
    req.db!.from("buddy_messages").insert({
      user_id: req.user!.id, role: "assistant", content: reply,
    }).then(() => {}).catch(() => {});

    res.json({ reply });
  });

  // POST transcribe — xAI Grok STT (/v1/stt)
  app.post("/api/saphie/transcribe", requireAuth, saphieUpload.single("audio"), async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ message: "No audio file" });

    const ext = req.file.mimetype.includes("mp4") ? "mp4"
      : req.file.mimetype.includes("ogg") ? "ogg" : "webm";

    // Build multipart using native Node — xAI STT needs file last
    const boundary = `----GrokSTTBoundary${Date.now()}`;
    const bodyParts: Buffer[] = [];
    const appendField = (name: string, value: string) => {
      bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    };
    // xAI requires file to be last field
    appendField("language", "en");
    appendField("format", "true");
    bodyParts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${req.file.mimetype}\r\n\r\n`
    ));
    bodyParts.push(req.file.buffer);
    bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const bodyBuffer = Buffer.concat(bodyParts);

    const sttRes = await fetch("https://api.x.ai/v1/stt", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(bodyBuffer.length),
      },
      body: bodyBuffer,
    });

    if (!sttRes.ok) {
      const err = await sttRes.text();
      return res.status(500).json({ message: "Grok STT error: " + err });
    }

    const result = await sttRes.json() as any;
    res.json({ text: result.text ?? "" });
  });

  // POST /api/saphie/speak — Grok (xAI) TTS → returns WAV audio
  app.post("/api/saphie/speak", requireAuth, async (req: AuthedRequest, res) => {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "No text" });

    // xAI TTS supports up to 15,000 chars — truncate to be safe
    const safeText = String(text).slice(0, 1000);

    const ttsRes = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-tts",
        text: safeText,
        voice: "eve",
        language: "en",
      }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error("Grok TTS error:", err);
      return res.status(500).json({ message: "Grok TTS error: " + err });
    }

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "no-cache");
    const arrayBuffer = await ttsRes.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  });

  // ============================================================
  // WHATSAPP INTEGRATION
  // ============================================================

  // GET webhook verification (Meta handshake)
  app.get("/api/whatsapp/webhook", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === (process.env.WHATSAPP_VERIFY_TOKEN || "practivault-verify")) {
      return res.status(200).send(challenge);
    }
    res.sendStatus(403);
  });

  // POST webhook — receives inbound messages from Meta
  app.post("/api/whatsapp/webhook", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (body.object !== "whatsapp_business_account") return res.sendStatus(200);

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (!value?.messages) continue;

          for (const msg of value.messages) {
            const from = msg.from; // phone number e.g. 447911123456
            const text = msg.type === "text" ? msg.text?.body : `[${msg.type} message]`;
            const waMessageId = msg.id;
            const ts = new Date(Number(msg.timestamp) * 1000).toISOString();

            // Find matching user by WhatsApp phone number ID in settings
            const phoneNumberId = value.metadata?.phone_number_id;
            if (!phoneNumberId) continue;

            // Find the PractiVault user who owns this phone number ID
            const { data: settingsRows } = await supabase
              .from("user_settings")
              .select("user_id")
              .eq("key", "whatsapp_phone_number_id")
              .eq("value", phoneNumberId)
              .limit(1);

            const userId = settingsRows?.[0]?.user_id;
            if (!userId) continue;

            const db = supabaseForUser(null); // use service role for webhook inserts

            // Try to match phone to an existing client
            const { data: clientMatch } = await supabase
              .from("clients")
              .select("id, name")
              .eq("user_id", userId)
              .or(`phone.eq.${from},phone.eq.+${from}`)
              .limit(1)
              .single();

            await supabase.from("whatsapp_messages").insert({
              user_id: userId,
              client_id: clientMatch?.id || null,
              contact_name: clientMatch?.name || null,
              contact_phone: from,
              direction: "inbound",
              body: text || "",
              wa_message_id: waMessageId,
              sent_at: ts,
              is_read: false,
            });
          }
        }
      }
      res.sendStatus(200);
    } catch (e) {
      console.error("WhatsApp webhook error:", e);
      res.sendStatus(200); // always 200 to avoid Meta retries
    }
  });

  // GET /api/whatsapp/threads — list all conversations grouped by contact
  app.get("/api/whatsapp/threads", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { data, error } = await req.db!
      .from("whatsapp_messages")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("sent_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });

    // Group into threads by contact_phone
    const threadMap: Record<string, any> = {};
    for (const msg of data || []) {
      const key = msg.contact_phone;
      if (!threadMap[key]) {
        threadMap[key] = {
          contact_phone: msg.contact_phone,
          contact_name: msg.contact_name,
          client_id: msg.client_id,
          last_message: msg.body,
          last_message_at: msg.sent_at,
          unread_count: 0,
          messages: [],
        };
      }
      if (!msg.is_read && msg.direction === "inbound") threadMap[key].unread_count++;
      threadMap[key].messages.push(msg);
    }

    const threads = Object.values(threadMap).sort(
      (a: any, b: any) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );
    res.json(threads);
  });

  // GET /api/whatsapp/messages/:phone — get messages for a specific contact
  app.get("/api/whatsapp/messages/:phone", requireAuth, async (req: AuthedRequest, res: Response) => {
    const phone = req.params.phone;
    const { data, error } = await req.db!
      .from("whatsapp_messages")
      .select("*")
      .eq("user_id", req.user!.id)
      .eq("contact_phone", phone)
      .order("sent_at", { ascending: true });
    if (error) return res.status(500).json({ message: error.message });

    // Mark inbound messages as read
    await req.db!
      .from("whatsapp_messages")
      .update({ is_read: true })
      .eq("user_id", req.user!.id)
      .eq("contact_phone", phone)
      .eq("direction", "inbound")
      .eq("is_read", false);

    res.json(data || []);
  });

  // POST /api/whatsapp/send — send a message to a contact
  app.post("/api/whatsapp/send", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { to, body } = req.body;
    if (!to || !body?.trim()) return res.status(400).json({ message: "to and body are required" });

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      // Store the message as pending even without live credentials (dev mode)
      const { data: stored } = await req.db!.from("whatsapp_messages").insert({
        user_id: req.user!.id,
        contact_phone: to,
        direction: "outbound",
        body: body.trim(),
        sent_at: new Date().toISOString(),
        is_read: true,
        status: "pending_credentials",
      }).select().single();
      return res.json({ ok: true, message: stored, warning: "WhatsApp credentials not yet configured — message saved but not sent." });
    }

    // Send via Meta Cloud API
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: body.trim() },
      }),
    });

    const metaData = await metaRes.json() as any;
    if (!metaRes.ok) {
      return res.status(500).json({ message: metaData.error?.message || "WhatsApp send failed" });
    }

    // Store the sent message
    const { data: stored } = await req.db!.from("whatsapp_messages").insert({
      user_id: req.user!.id,
      contact_phone: to,
      direction: "outbound",
      body: body.trim(),
      wa_message_id: metaData.messages?.[0]?.id,
      sent_at: new Date().toISOString(),
      is_read: true,
      status: "sent",
    }).select().single();

    res.json({ ok: true, message: stored });
  });

  // GET /api/whatsapp/unread-count — badge count for sidebar
  app.get("/api/whatsapp/unread-count", requireAuth, async (req: AuthedRequest, res: Response) => {
    const { count, error } = await req.db!
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user!.id)
      .eq("direction", "inbound")
      .eq("is_read", false);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ count: count || 0 });
  });

  return httpServer;
}
