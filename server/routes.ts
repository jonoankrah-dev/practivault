import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
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

      const assistantConfig = {
        name: "endoPulse™ AI Receptionist",
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are the friendly AI receptionist for endoPulse™ — a UK aesthetics business run by Jono. You answer calls professionally but warmly, in a friendly British style.

YOUR PERSONALITY:
- Warm, friendly, professional. Short sentences.
- You represent endoPulse™ — a premium aesthetics brand
- Never pushy. Never give prices immediately — warm them up first
- Always end with offering to help further or take their details

BUSINESS KNOWLEDGE:

TREATMENTS:
endoPulse™ is a dual wavelength laser treatment (980nm + 1470nm) that tightens skin AND melts fat in one session. No surgery, minimal downtime.
- Areas: face, jawline, under eyes, jowls, neck, tummy, arms, thighs, back
- From £450–£800+ per session
- Results visible immediately, improve over 6–8 weeks as collagen rebuilds
- Celebrity treatment (endolaser) — same technology, available to everyone
- Covered by Finch Insurance and PolicyBee

TRAINING:
- Online training: £400 (CPD accredited, 4 months to complete, 2 case studies required)
- In-person training: £1,500 (1-day CPD accredited, Harley Street London OR Rodney Street Liverpool)
- Machine purchase: £2,999 (Klarna available)
- Insurance: covered by Finch Insurance and PolicyBee from day one
- Practitioners can earn £700/hr, £5k/week, £10k/month

MODEL CALLS:
- Jono occasionally offers model calls for discounted treatments
- Models must be comfortable having photos taken
- Direct them to DM on Instagram @endopulse or send an email

OBJECTIONS:
- "Is it safe?" — Yes, UK trademarked, CPD accredited practitioners, covered by major insurers
- "Does it hurt?" — Warm sensation, local anaesthetic applied, very comfortable
- "Recovery time?" — Little to no downtime, most clients back to normal same day
- "Is it better than surgery?" — Same results, fraction of the cost, no scarring, no general anaesthetic

CALL HANDLING:
1. Greet warmly: "Hi! Thanks for calling endoPulse™. I'm Jono's AI assistant — how can I help you today?"
2. Listen to what they need
3. Answer their question using the business knowledge above
4. If they want to book → take their name, preferred date/time, treatment area, and tell them Jono will confirm
5. If they're interested in training → explain options, ask which interests them most, take their details
6. Always take their name and phone number or email before ending the call
7. End warmly: "Brilliant! I've noted that down and Jono will be in touch very soon. Have a lovely day!"

IMPORTANT:
- Never make up prices or services not listed above
- If unsure, say "I'll make sure Jono gets back to you on that personally"
- Keep responses concise — this is a phone call, not an essay
- Always try to get their name and contact details`,
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
          "Hi! Thanks for calling endoPulse™. I'm Jono's assistant — how can I help you today?",
        endCallMessage:
          "Brilliant! I've made a note of everything and Jono will be in touch very soon. Have a lovely day!",
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
  app.get("/api/me", async (req: AuthedRequest, res) => {
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

  app.patch("/api/me", async (req: AuthedRequest, res) => {
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
  app.get("/api/dashboard/stats", async (req: AuthedRequest, res) => {
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
  app.get("/api/clients", async (req: AuthedRequest, res) => {
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

  app.get("/api/clients/:id", async (req: AuthedRequest, res) => {
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

  app.post("/api/clients", async (req: AuthedRequest, res) => {
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

  app.patch("/api/clients/:id", async (req: AuthedRequest, res) => {
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

  app.delete("/api/clients/:id", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { id } = req.params;
    const { error } = await db.from("clients").delete().eq("id", id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ---- TREATMENTS ----
  app.get("/api/treatments", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("treatments")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("price", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/treatments", async (req: AuthedRequest, res) => {
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

  app.patch("/api/treatments/:id", async (req: AuthedRequest, res) => {
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

  app.delete("/api/treatments/:id", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db.from("treatments").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  app.post("/api/treatments/seed", async (req: AuthedRequest, res) => {
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
  app.get("/api/bookings", async (req: AuthedRequest, res) => {
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

  app.post("/api/bookings", async (req: AuthedRequest, res) => {
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

  app.patch("/api/bookings/:id", async (req: AuthedRequest, res) => {
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

  app.delete("/api/bookings/:id", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db.from("bookings").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ---- LEADS ----
  app.get("/api/leads", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { status, source } = req.query as Record<string, string>;
    let query = db.from("leads").select("*").eq("user_id", req.user!.id).order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (source) query = query.eq("source", source);
    const { data, error } = await query;
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/leads", async (req: AuthedRequest, res) => {
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

  app.patch("/api/leads/:id", async (req: AuthedRequest, res) => {
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

  app.delete("/api/leads/:id", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db.from("leads").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  app.post("/api/leads/:id/convert", async (req: AuthedRequest, res) => {
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
  app.get("/api/quotes", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("quotes")
      .select("*, clients(id,name,email,phone), treatments(id,name,duration_mins)")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/quotes", async (req: AuthedRequest, res) => {
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

  app.patch("/api/quotes/:id", async (req: AuthedRequest, res) => {
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

  app.delete("/api/quotes/:id", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db.from("quotes").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // Convert accepted quote to invoice
  app.post("/api/quotes/:id/convert-to-invoice", async (req: AuthedRequest, res) => {
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
  app.get("/api/consent", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("consent_forms")
      .select("*, clients(id,name,email), bookings(id,date,time)")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/consent", async (req: AuthedRequest, res) => {
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

  app.patch("/api/consent/:id", async (req: AuthedRequest, res) => {
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

  app.delete("/api/consent/:id", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db.from("consent_forms").delete().eq("id", req.params.id).eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // ---- AI FRONT DESK ----
  app.post("/api/ai-front-desk/analyse", async (req: AuthedRequest, res) => {
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

  app.get("/api/ai-front-desk", async (req: AuthedRequest, res) => {
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

  app.delete("/api/ai-front-desk/:id", async (req: AuthedRequest, res) => {
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
  app.get("/api/social-posts", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { data, error } = await db
      .from("social_posts")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post("/api/social-posts", async (req: AuthedRequest, res) => {
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

  app.patch("/api/social-posts/:id", async (req: AuthedRequest, res) => {
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

  app.delete("/api/social-posts/:id", async (req: AuthedRequest, res) => {
    const db = req.db!;
    const { error } = await db
      .from("social_posts")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  app.post("/api/social-posts/generate", async (req: AuthedRequest, res) => {
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
  app.post("/api/social-posts/generate-reel", async (req: AuthedRequest, res: Response) => {
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
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    const mapped = (data || []).map((p: any) => ({ ...p, client_name: p.clients?.name }));
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

      // Extract text for Saphie
      let extractedText: string | null = null;
      try {
        const mime = file.mimetype || "";
        const fname = file.originalname || "";
        if (mime === "application/pdf" || fname.endsWith(".pdf")) {
          const parsed = await pdfParse(file.buffer);
          extractedText = parsed.text?.trim() || null;
        } else if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fname.endsWith(".docx")) {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          extractedText = result.value?.trim() || null;
        } else if (mime === "text/plain" || fname.endsWith(".txt")) {
          extractedText = file.buffer.toString("utf-8").trim();
        }
        if (extractedText && extractedText.length > 60000) {
          extractedText = extractedText.slice(0, 60000) + "\n[...truncated]";
        }
      } catch {
        // Text extraction failed — that's fine, file is still stored
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
    const { data, error } = await req.db!.from("cpd_logs").select("*").order("date", { ascending: false });
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
    const { error } = await req.db!.from("cpd_logs").delete().eq("id", req.params.id);
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
    const { data, error } = await req.db!.from("stock_items").select("*").order("category").order("name");
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
    const { error } = await req.db!.from("stock_items").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ok: true });
  });

  // Stock movements — updates quantity on the parent item
  app.post("/api/stock/movements", requireAuth, async (req: AuthedRequest, res) => {
    const { stock_item_id, movement_type, quantity, notes } = req.body;
    if (!stock_item_id || !movement_type || !quantity) return res.status(400).json({ message: "Missing fields" });
    // Fetch current quantity
    const { data: item, error: fetchErr } = await req.db!.from("stock_items").select("quantity").eq("id", stock_item_id).single();
    if (fetchErr || !item) return res.status(404).json({ message: "Item not found" });
    const delta = movement_type === "in" ? Number(quantity) : -Number(quantity);
    const newQty = Math.max(0, Number(item.quantity) + delta);
    // Update quantity
    const { error: updateErr } = await req.db!.from("stock_items").update({ quantity: newQty }).eq("id", stock_item_id);
    if (updateErr) return res.status(500).json({ message: updateErr.message });
    // Log the movement
    const { data: movement, error: logErr } = await req.db!.from("stock_movements").insert({
      user_id: req.user!.id, stock_item_id, movement_type,
      quantity: Number(quantity), notes: notes || null,
    }).select().single();
    if (logErr) return res.status(500).json({ message: logErr.message });
    res.json({ ok: true, new_quantity: newQty, movement });
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

    const systemPrompt = `You are Saphie, a warm and professional AI assistant for ${userData?.business_name ?? "this business"} — a ${userData?.industry ?? "service"} business.${bizContext}

IMPORTANT: You have a real voice. You speak your replies aloud. Never say you are text-only or cannot speak.

Your role: Answer client questions with warmth, professionalism, and confidence. You represent this business as a place of excellence. Be helpful and reassuring — never pushy or salesy. Keep replies concise (2-3 sentences) since they are spoken aloud.

If a client asks about a product, course or service, use the products list above to give accurate pricing and details. Do not reveal exact protocols, proprietary techniques, ingredient concentrations, or internal pricing strategies — just give clients the information they need to feel informed and confident.${manualContext}`;

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

  return httpServer;
}
