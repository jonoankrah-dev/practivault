/**
 * PAI Skills for PractiVault / Saffi
 *
 * These are the capabilities that Saffi (running on OurPai.ai) can use.
 * Each skill should be self-describing and return structured data.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface PaiSkillContext {
  userId: string;
  db: SupabaseClient;
  businessInfo?: any;
}

/**
 * Skill definition format (inspired by PAI + OpenAI function calling)
 */
export interface PaiSkill {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any, context: PaiSkillContext) => Promise<any>;
}

// Re-export all skills
export * from "./business";
export * from "./clients";
export * from "./quotes-invoices";
export * from "./bookings";
export * from "./memory";
