/**
 * Saffi read-only tools — shared between text chat and voice realtime.
 *
 * Strict rules:
 *   - READ ONLY. No writes, no sends, no posts, no quotes/invoices/approvals.
 *   - All queries are scoped to the caller's userId; never accept a userId from
 *     the model. Callers must inject the verified userId at call time.
 *   - Each function returns a compact `summary` string the model can speak,
 *     plus structured `data` for richer text rendering.
 */

import type { PostgrestResponse, SupabaseClient } from "@supabase/supabase-js";

export interface ToolResult {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
}

export const SAFFI_READ_ONLY_TOOLS = [
  "get_dashboard_overview",
  "search_manuals",
  "get_business_snapshot",
] as const;
export type SaffiReadOnlyTool = (typeof SAFFI_READ_ONLY_TOOLS)[number];

export function isReadOnlyTool(name: string): name is SaffiReadOnlyTool {
  return (SAFFI_READ_ONLY_TOOLS as readonly string[]).includes(name);
}

const SHORT_DATE = (iso: string | null | undefined): string => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
};

const TOOL_TIMEOUT_MS = 8_000;

function withTimeout<T>(p: PromiseLike<T>, ms = TOOL_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("tool_timeout")), ms),
    ),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// get_dashboard_overview — single aggregated read so the model doesn't have to
// fan out 4–5 tool calls for a "what's happening today?" question.
// ─────────────────────────────────────────────────────────────────────────────
export async function getDashboardOverview(
  db: SupabaseClient,
  userId: string,
): Promise<ToolResult> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [
      bookingsTodayRes,
      activeClientsRes,
      newLeadsRes,
      pendingQuotesRes,
      paidThisMonthRes,
      unpaidInvoicesRes,
      lowStockRes,
    ] = await withTimeout(Promise.all([
      db.from("bookings")
        .select("id, start_time, status, clients(name), treatments(name)")
        .eq("user_id", userId)
        .gte("start_time", todayStart.toISOString())
        .lt("start_time", tomorrowStart.toISOString())
        .order("start_time", { ascending: true })
        .limit(10),
      db.from("clients").select("id", { count: "exact", head: true })
        .eq("user_id", userId).in("stage", ["active", "vip", "prospect"]),
      db.from("leads").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("status", "new"),
      db.from("quotes").select("amount").eq("user_id", userId)
        .in("status", ["draft", "sent", "viewed"]),
      db.from("invoices").select("total").eq("user_id", userId)
        .eq("status", "paid").gte("issue_date", monthStart.toISOString().slice(0, 10)),
      db.from("invoices").select("invoice_number, total, due_date, clients(name)")
        .eq("user_id", userId).eq("status", "unpaid")
        .order("due_date", { ascending: true }).limit(5),
      db.from("stock_items").select("name, quantity, low_stock_threshold, unit")
        .eq("user_id", userId),
    ]));

    const bookingsToday = bookingsTodayRes.data ?? [];
    const activeClients = activeClientsRes.count ?? 0;
    const newLeads = newLeadsRes.count ?? 0;
    const pendingQuotesValue = (pendingQuotesRes.data ?? []).reduce(
      (s: number, q: any) => s + Number(q.amount || 0), 0);
    const pendingQuotesCount = (pendingQuotesRes.data ?? []).length;
    const paidThisMonth = (paidThisMonthRes.data ?? []).reduce(
      (s: number, i: any) => s + Number(i.total || 0), 0);
    const unpaid = unpaidInvoicesRes.data ?? [];
    const now = Date.now();
    const overdueCount = unpaid.filter((i: any) =>
      i.due_date && new Date(i.due_date).getTime() < now).length;
    const lowStock = (lowStockRes.data ?? []).filter((s: any) =>
      typeof s.quantity === "number" &&
      typeof s.low_stock_threshold === "number" &&
      s.quantity <= s.low_stock_threshold);

    const lines: string[] = [];
    lines.push(`Today (${today}):`);
    if (bookingsToday.length === 0) {
      lines.push("• No appointments booked for today.");
    } else {
      lines.push(`• ${bookingsToday.length} appointment${bookingsToday.length === 1 ? "" : "s"} today:`);
      for (const b of bookingsToday.slice(0, 5)) {
        const who = (b.clients as any)?.name ?? "Unknown client";
        const what = (b.treatments as any)?.name ?? "treatment";
        lines.push(`   - ${SHORT_DATE(b.start_time)} — ${who} — ${what} — ${b.status ?? "booked"}`);
      }
      if (bookingsToday.length > 5) lines.push(`   - …and ${bookingsToday.length - 5} more`);
    }
    lines.push(`• Active/VIP/prospect clients: ${activeClients}`);
    lines.push(`• New leads waiting: ${newLeads}`);
    lines.push(`• Pending quotes: ${pendingQuotesCount} worth £${pendingQuotesValue.toFixed(2)}`);
    lines.push(`• Revenue paid this month: £${paidThisMonth.toFixed(2)}`);
    lines.push(`• Unpaid invoices: ${unpaid.length}${overdueCount ? ` (${overdueCount} overdue)` : ""}`);
    if (lowStock.length) {
      lines.push(`• Low stock: ${lowStock.length} item${lowStock.length === 1 ? "" : "s"} — ${lowStock.slice(0, 3).map((s: any) => s.name).join(", ")}${lowStock.length > 3 ? "…" : ""}`);
    } else {
      lines.push("• Stock levels: healthy.");
    }

    return {
      ok: true,
      summary: lines.join("\n"),
      data: {
        bookingsTodayCount: bookingsToday.length,
        bookingsToday,
        activeClientsCount: activeClients,
        newLeadsCount: newLeads,
        pendingQuotesCount,
        pendingQuotesValue,
        paidThisMonth,
        unpaidCount: unpaid.length,
        overdueCount,
        lowStockCount: lowStock.length,
      },
    };
  } catch (e: any) {
    return {
      ok: false,
      summary: "I couldn't load the overview just now.",
      error: e?.message ?? String(e),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// search_manuals — relevance-ranked search over the user's manuals.
// Indicates clearly when a manual is uploaded but text has not been extracted.
// ─────────────────────────────────────────────────────────────────────────────
export async function searchManuals(
  db: SupabaseClient,
  userId: string,
  query: string,
  limit = 5,
): Promise<ToolResult> {
  // Use the new semantic (vector) search as the primary method
  const { searchManualsSemantic } = await import("./semanticManualSearch");
  const semanticResult = await searchManualsSemantic(db, userId, query, limit);

  if (semanticResult.matches.length > 0) {
    return {
      ok: true,
      summary: semanticResult.summary,
      data: { matches: semanticResult.matches },
    };
  }

  // Fallback to old keyword search if semantic returns nothing (e.g. no embeddings yet)
  // ... (existing keyword logic can stay here for backward compatibility if needed)
  return {
    ok: true,
    summary: semanticResult.summary || `I searched your manuals but couldn't find relevant information for "${query}".`,
  };
}
  const q = (query ?? "").trim();
  if (!q) {
    return { ok: false, summary: "Please give me a search term.", error: "empty_query" };
  }
  const cap = Math.max(1, Math.min(limit, 10));
  // Tokenise the query (≤4 terms, alphanum only) so we can OR-match across columns.
  const terms = q
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 4);
  const escapedQ = q.replace(/[%_]/g, (m) => `\\${m}`);

  try {
    // Pull a wide candidate set; project only what we need so we don't drag
    // megabytes of extracted_text across the wire when not necessary.
    type ManualRow = {
      id: string;
      name: string | null;
      description: string | null;
      category: string | null;
      file_name: string | null;
      file_url: string | null;
      extracted_text: string | null;
      created_at: string | null;
    };
    const { data, error }: PostgrestResponse<ManualRow> = await withTimeout(
      db
        .from("manuals")
        .select("id, name, description, category, file_name, file_url, extracted_text, created_at")
        .eq("user_id", userId)
        .or([
          `name.ilike.%${escapedQ}%`,
          `description.ilike.%${escapedQ}%`,
          `category.ilike.%${escapedQ}%`,
          `extracted_text.ilike.%${escapedQ}%`,
        ].join(","))
        .limit(50),
    );

    if (error) {
      console.error("[search_manuals] Database error:", error);
      return { ok: false, summary: "I ran into a technical issue while searching your manuals. Please try again in a moment." };
    }
    const candidates = data ?? [];

    if (candidates.length === 0) {
      // Subtle message for unprocessed manuals (background extraction is running)
      const { data: missingData }: PostgrestResponse<
        Pick<ManualRow, "id" | "name" | "file_name">
      > = await withTimeout(
        db
          .from("manuals")
          .select("id, name, file_name")
          .eq("user_id", userId)
          .or("extracted_text.is.null,extraction_status.eq.pending,extraction_status.eq.processing")
          .limit(5),
      );
      const missing = missingData ?? [];

      if (missing.length > 0) {
        return {
          ok: true,
          summary: `I couldn't find anything about "${q}" yet because ${missing.length} relevant manual${missing.length === 1 ? " is" : "s are"} still being processed in the background. I should have the information ready in a minute or two.`,
          data: { matches: [], missingExtraction: missing },
        };
      }

      return {
        ok: true,
        summary: `I searched your manuals but couldn't find anything relevant to "${q}".`,
        data: { matches: [], missingExtraction: [] },
      };
    }

    // Score: name hit > category > description > extracted_text term-frequency.
    const ql = q.toLowerCase();
    type ScoredManual = {
      m: ManualRow;
      score: number;
      snippet: string | null;
      indexed: boolean;
    };
    const scored: ScoredManual[] = candidates.map((m: ManualRow) => {
      let score = 0;
      const name = (m.name ?? "").toLowerCase();
      const desc = (m.description ?? "").toLowerCase();
      const cat = (m.category ?? "").toLowerCase();
      const text = (m.extracted_text ?? "").toLowerCase();
      if (name.includes(ql)) score += 80;
      if (cat.includes(ql)) score += 40;
      if (desc.includes(ql)) score += 30;
      for (const t of terms) {
        if (name.includes(t)) score += 12;
        if (cat.includes(t)) score += 6;
        if (desc.includes(t)) score += 4;
        if (text) {
          const occ = text.split(t).length - 1;
          score += Math.min(occ, 8) * 2;
        }
      }
      // Build a snippet around the first hit in extracted_text, if any.
      let snippet: string | null = null;
      if (text) {
        let hitIdx = text.indexOf(ql);
        if (hitIdx < 0) {
          for (const t of terms) {
            const i = text.indexOf(t);
            if (i >= 0) { hitIdx = i; break; }
          }
        }
        if (hitIdx >= 0) {
          const start = Math.max(0, hitIdx - 80);
          const end = Math.min(text.length, hitIdx + 200);
          snippet = (start > 0 ? "…" : "") + (m.extracted_text as string).slice(start, end).trim() + (end < text.length ? "…" : "");
        }
      }
      const indexed = !!m.extracted_text && (m.extracted_text as string).length > 0;
      return { m, score, snippet, indexed };
    });

    scored.sort((a: ScoredManual, b: ScoredManual) => b.score - a.score);
    const top = scored.slice(0, cap);

    const lines: string[] = [];
    lines.push(`I found the following manuals that may contain information about "${q}":`);
    for (const { m, snippet, indexed } of top) {
      const cat = m.category ? ` · ${m.category}` : "";
      const status = indexed ? "" : " (still processing)";
      lines.push(`• ${m.name}${cat}${m.description ? ` — ${m.description}` : ""}${status}`);
      if (snippet) lines.push(`  "${snippet}"`);
    }
    const unindexed = top.filter((s: ScoredManual) => !s.indexed).length;
    if (unindexed > 0) {
      lines.push(`\n(Note: ${unindexed} of the above ${unindexed === 1 ? "manual is" : "manuals are"} still being processed in the background.)`);
    }

    return {
      ok: true,
      summary: lines.join("\n"),
      data: {
        matches: top.map(({ m, score, snippet, indexed }: ScoredManual) => ({
          id: m.id, name: m.name, category: m.category,
          description: m.description, file_url: m.file_url,
          score, snippet, indexed,
        })),
      },
    };
  } catch (e: any) {
    return { ok: false, summary: "Manual search failed.", error: e?.message ?? String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// get_business_snapshot — short, model-friendly business identity.
// ─────────────────────────────────────────────────────────────────────────────
export async function getBusinessSnapshot(
  db: SupabaseClient,
  userId: string,
): Promise<ToolResult> {
  try {
    const [userRes, bizRes, treatmentsRes] = await withTimeout(Promise.all([
      db.from("users").select("name, business_name, industry").eq("id", userId).maybeSingle(),
      db.from("business_info").select("tagline, about, website_url, products").eq("user_id", userId).maybeSingle(),
      db.from("treatments")
        .select("name, price, duration_mins, is_active")
        .eq("user_id", userId)
        .or("is_active.is.null,is_active.eq.true")
        .order("name")
        .limit(12),
    ]));

    const u = userRes.data as any;
    const b = bizRes.data as any;
    const treatments = (treatmentsRes.data as any[]) || [];

    const lines: string[] = [];
    if (u?.name) lines.push(`Owner: ${u.name}`);
    if (u?.business_name) lines.push(`Business: ${u.business_name}`);
    if (u?.industry) lines.push(`Industry: ${u.industry}`);
    if (b?.tagline) lines.push(`Tagline: ${b.tagline}`);
    if (b?.about) lines.push(`About: ${String(b.about).slice(0, 450)}`);
    if (b?.website_url) lines.push(`Website: ${b.website_url}`);

    if (treatments.length > 0) {
      const serviceLines = treatments.map((t: any) => {
        const price = t.price != null ? `£${Number(t.price)}` : "";
        const dur = t.duration_mins ? `${t.duration_mins} mins` : "";
        const meta = [price, dur].filter(Boolean).join(" · ");
        return `- ${t.name}${meta ? ` (${meta})` : ""}`;
      });
      lines.push(`Services / Treatments:\n${serviceLines.join("\n")}`);
    }

    if (Array.isArray(b?.products) && b.products.length) {
      lines.push(`Products: ${b.products.slice(0, 6).map((p: any) => p.name).filter(Boolean).join(", ")}`);
    }

    if (lines.length === 0) {
      return { ok: true, summary: "Business profile not fully set up yet. The owner can add services, pricing and details in Business Info." };
    }

    return { ok: true, summary: lines.join("\n"), data: { user: u, business: b, treatments } };
  } catch (e: any) {
    return { ok: false, summary: "I couldn't load the business snapshot.", error: e?.message ?? String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions for chat-completions and realtime.
// Same shape; converted at call sites to the right wire format.
// ─────────────────────────────────────────────────────────────────────────────
export const SAFFI_READ_ONLY_TOOL_DEFS = [
  {
    type: "function" as const,
    name: "get_dashboard_overview",
    description:
      "Read-only single-call snapshot of today's appointments, active clients, new leads, pending quotes, paid revenue this month, unpaid/overdue invoices, and low-stock items. Use this for any 'how is the business looking?' or 'what's happening today?' question instead of calling 4–5 tools.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function" as const,
    name: "search_manuals",
    description:
      "Semantic search over the user's uploaded manuals and documents using vector embeddings (Voyage AI). This is the preferred tool for finding detailed information about treatments, techniques, equipment specifications, aftercare, or policies from the actual manual content.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language query about the manual content (e.g. 'diode laser specifications', 'lip filler aftercare protocol', 'contraindications for microneedling').",
        },
      },
      required: ["query"],
    },
  },
  {
    type: "function" as const,
    name: "get_business_snapshot",
    description:
      "Read-only snapshot of the business: owner, business name, industry, tagline, about, website, products, and active services/treatments with pricing and durations. Use this to ground yourself in what this specific business actually offers.",
    parameters: { type: "object", properties: {}, required: [] },
  },
];

export async function executeReadOnlyTool(
  name: string,
  args: any,
  db: SupabaseClient,
  userId: string,
): Promise<ToolResult> {
  switch (name) {
    case "get_dashboard_overview":
      return getDashboardOverview(db, userId);
    case "search_manuals":
      return searchManuals(db, userId, String(args?.query ?? ""), Number(args?.limit ?? 5));
    case "get_business_snapshot":
      return getBusinessSnapshot(db, userId);
    default:
      return { ok: false, summary: "Unknown read-only tool.", error: "unknown_tool" };
  }
}
