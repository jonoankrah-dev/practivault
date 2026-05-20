import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseConfiguredFromEnv,
  resolveSupabaseAnonKey,
  resolveSupabaseServiceRoleKey,
  resolveSupabaseUrl,
  supabaseConfigSource,
} from "./config/supabaseEnv";

const SUPABASE_URL = resolveSupabaseUrl();
const SUPABASE_ANON_KEY = resolveSupabaseAnonKey();

if (!isSupabaseConfiguredFromEnv()) {
  console.warn(
    "[supabase] SUPABASE_URL / SUPABASE_ANON_KEY not in env — using built-in project defaults",
  );
}

console.log(
  `[supabase] boot ok (source=${supabaseConfigSource()}, url=${SUPABASE_URL.replace(/https?:\/\//, "")})`,
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const serviceKey = resolveSupabaseServiceRoleKey() || SUPABASE_ANON_KEY;

export const supabaseAdmin = createClient(SUPABASE_URL, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function getSupabase(): SupabaseClient {
  return supabase;
}

export function getSupabaseAdmin(): SupabaseClient {
  return supabaseAdmin;
}

// Build a supabase client that forwards the user's JWT so RLS policies
// evaluate the correct auth.uid(). We still use the anon key, but attach the
// Authorization header so row-level security picks up the authenticated user.
export function supabaseForUser(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
