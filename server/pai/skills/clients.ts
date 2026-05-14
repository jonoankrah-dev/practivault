/**
 * Client-related PAI Skills
 */

import type { PaiSkill, PaiSkillContext } from "./index";

export const searchClients: PaiSkill = {
  name: "search_clients",
  description: "Search for clients by name, phone, or email. Returns matching clients with basic info and recent activity summary. Use when the user mentions a specific person or needs to look someone up.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Name, phone, or email fragment to search for" },
      limit: { type: "number", description: "Max results to return" }
    },
    required: ["query"]
  },
  async execute(args: { query: string; limit?: number }, context: PaiSkillContext) {
    const { userId, db } = context;
    const q = args.query.toLowerCase();

    const { data } = await db
      .from("clients")
      .select("id, name, phone, email, stage, created_at")
      .eq("user_id", userId)
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(args.limit ?? 8);

    return data ?? [];
  },
};
