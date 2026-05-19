import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../shared/supabaseUrl";

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("[supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Server-side best-effort writes that need to happen outside a user's request
// can use the service role key when it is available. If it is not configured,
// this falls back to the anon key and RLS may reject those writes safely.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Build a supabase client that forwards the user's JWT so RLS policies
// evaluate the correct auth.uid(). We still use the anon key, but attach the
// Authorization header so row-level security picks up the authenticated user.
export function supabaseForUser(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
