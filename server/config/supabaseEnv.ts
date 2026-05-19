import {
  PRACTIVAULT_SUPABASE_ANON_KEY,
  PRACTIVAULT_SUPABASE_URL,
} from "./practivaultSupabase.public";

function fromEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

/** Resolve Supabase URL: env first, then production project default. */
export function resolveSupabaseUrl(): string {
  const fromEnvironment = fromEnv(
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
  );
  if (fromEnvironment) return fromEnvironment;
  if (process.env.NODE_ENV === "production") return PRACTIVAULT_SUPABASE_URL;
  return "";
}

/** Resolve anon key: env first, then production project default. */
export function resolveSupabaseAnonKey(): string {
  const fromEnvironment = fromEnv(
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
  );
  if (fromEnvironment) return fromEnvironment;
  if (process.env.NODE_ENV === "production") return PRACTIVAULT_SUPABASE_ANON_KEY;
  return "";
}

export function resolveSupabaseServiceRoleKey(): string {
  return fromEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function isSupabaseConfigured(): boolean {
  return Boolean(resolveSupabaseUrl() && resolveSupabaseAnonKey());
}
