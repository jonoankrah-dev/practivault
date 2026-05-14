/**
 * Business Skills for PAI / Saffi
 */

import type { PaiSkill, PaiSkillContext } from "./index";

export const getBusinessOverview: PaiSkill = {
  name: "get_business_overview",
  description: "Returns a high-level snapshot of the business: client count, revenue this month, outstanding invoices, upcoming bookings, and key health signals. Use this for any 'how is the business doing?' or 'give me an overview' question.",
  parameters: {
    type: "object",
    properties: {
      includeDetails: { type: "boolean", description: "Whether to include more granular breakdowns" }
    }
  },
  async execute(args: { includeDetails?: boolean }, context: PaiSkillContext) {
    const { userId, db } = context;

    const [clients, invoices, bookings] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId),
      db.from("invoices").select("total, status").eq("user_id", userId),
      db.from("bookings").select("id, date, status").eq("user_id", userId).gte("date", new Date().toISOString().slice(0, 10)),
    ]);

    const paidRevenue = (invoices.data ?? [])
      .filter((i: any) => i.status === "paid")
      .reduce((sum: number, i: any) => sum + Number(i.total || 0), 0);

    const outstanding = (invoices.data ?? [])
      .filter((i: any) => i.status !== "paid")
      .reduce((sum: number, i: any) => sum + Number(i.total || 0), 0);

    return {
      clientCount: clients.count ?? 0,
      revenueThisMonth: paidRevenue,
      outstandingInvoices: outstanding,
      upcomingBookings: bookings.data?.length ?? 0,
      health: paidRevenue > 0 ? "healthy" : "quiet",
    };
  },
};
