// Plain TypeScript types matching Supabase tables — no Drizzle for this app.
import { z } from "zod";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type ClientStage = "lead" | "prospect" | "active" | "vip" | "lapsed" | "archived";

export type Client = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  stage: ClientStage;
  ltv: number;
  created_at: string;
};

export type Treatment = {
  id: string;
  user_id: string;
  name: string;
  duration_mins: number;
  price: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export type Booking = {
  id: string;
  client_id: string;
  user_id: string;
  treatment_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: BookingStatus;
  deposit_paid: boolean;
  deposit_amount: number;
  notes: string | null;
  created_at: string;
};

export type LeadSource =
  | "instagram"
  | "facebook"
  | "referral"
  | "website"
  | "walk_in"
  | "manual"
  | "other";

export type LeadStatus = "new" | "contacted" | "quoted" | "booked" | "lost" | "converted";

export type Lead = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  treatment_interest: string | null;
  status: LeadStatus;
  ai_score: number;
  notes: string | null;
  created_at: string;
};

export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";

export type Quote = {
  id: string;
  user_id: string;
  client_id: string;
  treatment_id: string | null;
  amount: number;
  status: QuoteStatus;
  sent_at: string | null;
  viewed_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
};

export type ConsentFormType =
  | "general_consent"
  | "laser_treatment"
  | "fat_melting"
  | "skin_tightening"
  | "medical_history"
  | "patch_test";

export type ConsentStatus = "pending" | "sent" | "viewed" | "signed" | "expired";

export type ConsentForm = {
  id: string;
  client_id: string;
  booking_id: string | null;
  user_id: string;
  form_type: ConsentFormType;
  status: ConsentStatus;
  signed_at: string | null;
  form_data: any | null;
  token: string;
  created_at: string;
};

export type AiFrontDeskChannel = "messenger" | "instagram" | "whatsapp" | "manual";

export type AiFrontDeskCategory =
  | "Training Enquiry"
  | "Model Call"
  | "Pricing"
  | "Insurance"
  | "Machine Purchase"
  | "Follow-up"
  | "Other";

export type AiFrontDeskNextAction =
  | "Add to Leads"
  | "Create Booking"
  | "Send Quote"
  | "No action needed";

export type AiFrontDeskRecord = {
  id: string;
  user_id: string;
  channel: AiFrontDeskChannel;
  message_in: string;
  category: AiFrontDeskCategory | null;
  drafted_reply: string | null;
  next_action: AiFrontDeskNextAction | null;
  notes: string | null;
  created_at: string;
};

export const aiFrontDeskAnalyseSchema = z.object({
  message: z.string().min(1),
  channel: z.enum(["messenger", "instagram", "whatsapp", "manual"]).optional(),
});

export type TimelineType =
  | "booking"
  | "payment"
  | "note"
  | "consent"
  | "quote"
  | "lead_converted"
  | "message"
  | "treatment_completed";

export type TimelineEvent = {
  id: string;
  client_id: string;
  user_id: string;
  type: TimelineType;
  description: string;
  amount: number | null;
  metadata: any | null;
  created_at: string;
};

// Zod schemas for validation
export const clientInsertSchema = z.object({
  name: z.string().min(1),
  email: z
    .preprocess(
      (val) => (val === "" || val === undefined || val === null ? null : val),
      z.union([z.string().email(), z.null()]).optional(),
    ),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  stage: z.enum(["lead", "prospect", "active", "vip", "lapsed", "archived"]).optional(),
});

/** PATCH /api/clients/:id — only these fields may be updated from the API. */
export const clientPatchSchema = clientInsertSchema.partial();

export const treatmentInsertSchema = z.object({
  name: z.string().min(1),
  duration_mins: z.number().int().positive(),
  price: z.number().nonnegative(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const bookingInsertSchema = z.object({
  client_id: z.string().uuid(),
  treatment_id: z.string().uuid(),
  date: z.string(),
  time: z.string(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]).optional(),
  deposit_paid: z.boolean().optional(),
  deposit_amount: z.number().nonnegative().optional(),
  notes: z.string().nullable().optional(),
});

export const leadInsertSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  source: z.enum(["instagram", "facebook", "referral", "website", "walk_in", "manual", "other"]).optional(),
  treatment_interest: z.string().nullable().optional(),
  status: z.enum(["new", "contacted", "quoted", "booked", "lost", "converted"]).optional(),
  notes: z.string().nullable().optional(),
});

export const quoteInsertSchema = z.object({
  client_id: z.string().uuid(),
  treatment_id: z.string().uuid().nullable().optional(),
  amount: z.number().nonnegative(),
  status: z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired"]).optional(),
  expires_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const consentInsertSchema = z.object({
  client_id: z.string().uuid(),
  booking_id: z.string().uuid().nullable().optional(),
  form_type: z.enum([
    "general_consent",
    "laser_treatment",
    "fat_melting",
    "skin_tightening",
    "medical_history",
    "patch_test",
  ]),
});

// ---- SOCIAL POSTS ----
export type SocialPlatform = "instagram" | "tiktok" | "facebook" | "all";

export type SocialPostType =
  | "practitioner_pitch"
  | "client_results"
  | "model_call"
  | "income_claim"
  | "educational"
  | "training_promo"
  | "machine_sale"
  | "objection_handling"
  | "before_after"
  | "tiktok"
  | "other";

export type SocialPostStatus = "draft" | "scheduled" | "posted" | "archived";

export type SocialPost = {
  id: string;
  user_id: string;
  caption: string;
  platform: SocialPlatform;
  post_type: SocialPostType;
  hook: string | null;
  hashtags: string | null;
  keyword_cta: string | null;
  status: SocialPostStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  notes: string | null;
  created_at: string;
};

export const socialPostInsertSchema = z.object({
  caption: z.string().min(1),
  platform: z.enum(["instagram", "tiktok", "facebook", "all"]),
  post_type: z.enum([
    "practitioner_pitch",
    "client_results",
    "model_call",
    "income_claim",
    "educational",
    "training_promo",
    "machine_sale",
    "objection_handling",
    "before_after",
    "tiktok",
    "other",
  ]),
  hook: z.string().nullable().optional(),
  hashtags: z.string().nullable().optional(),
  keyword_cta: z.string().nullable().optional(),
  status: z.enum(["draft", "scheduled", "posted", "archived"]).optional(),
  scheduled_at: z.string().nullable().optional(),
  posted_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const socialPostGenerateSchema = z.object({
  post_type: z.enum([
    "practitioner_pitch",
    "client_results",
    "model_call",
    "income_claim",
    "educational",
    "training_promo",
    "machine_sale",
    "objection_handling",
    "before_after",
    "tiktok",
    "other",
  ]),
  platform: z.enum(["instagram", "tiktok", "facebook", "all"]),
  topic: z.string().nullable().optional(),
  extra_context: z.string().nullable().optional(),
});
