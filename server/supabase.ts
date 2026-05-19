import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  resolveSupabaseAnonKey,
  resolveSupabaseServiceRoleKey,
  resolveSupabaseUrl,
} from "./config/supabaseEnv";

let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

function warnIfMissing(): void {
  if (!isSupabaseConfigured()) {
    console.warn("[supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
  }
}

function getUrlAndAnon(): { url: string; anonKey: string } {
  const url = resolveSupabaseUrl();
  const anonKey = resolveSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error(
      "supabaseUrl is required. Set SUPABASE_URL and SUPABASE_ANON_KEY (or run in production with built-in project defaults).",
    );
  }
  return { url, anonKey };
}

function getClient(): SupabaseClient {
  if (!supabaseClient) {
    warnIfMissing();
    const { url, anonKey } = getUrlAndAnon();
    supabaseClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseClient;
}

function getAdminClient(): SupabaseClient {
  if (!supabaseAdminClient) {
    warnIfMissing();
    const { url, anonKey } = getUrlAndAnon();
    const serviceKey = resolveSupabaseServiceRoleKey() || anonKey;
    supabaseAdminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdminClient;
}

/** @deprecated Prefer getSupabase() — kept for existing imports. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** @deprecated Prefer getSupabaseAdmin() — kept for existing imports. */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getAdminClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function getSupabase(): SupabaseClient {
  return getClient();
}

export function getSupabaseAdmin(): SupabaseClient {
  return getAdminClient();
}

// Build a supabase client that forwards the user's JWT so RLS policies
// evaluate the correct auth.uid(). We still use the anon key, but attach the
// Authorization header so row-level security picks up the authenticated user.
export function supabaseForUser(token: string) {
  const { url, anonKey } = getUrlAndAnon();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
