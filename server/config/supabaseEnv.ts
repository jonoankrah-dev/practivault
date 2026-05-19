import { normalizeSupabaseUrl } from "../../shared/supabaseUrl";
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

function useBuiltInDefaults(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.RAILWAY_ENVIRONMENT) return true;
  if (process.env.RAILWAY_PROJECT_ID) return true;
  if (process.env.RAILWAY_SERVICE_ID) return true;
  return false;
}

/** Resolve Supabase URL: env first, then Railway/production project default. */
export function resolveSupabaseUrl(): string {
  const fromEnvironment = fromEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  if (fromEnvironment) return normalizeSupabaseUrl(fromEnvironment);
  if (useBuiltInDefaults()) return PRACTIVAULT_SUPABASE_URL;
  return "";
}

/** Resolve anon key: env first, then Railway/production project default. */
export function resolveSupabaseAnonKey(): string {
  const fromEnvironment = fromEnv(
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
  );
  if (fromEnvironment) return fromEnvironment;
  if (useBuiltInDefaults()) return PRACTIVAULT_SUPABASE_ANON_KEY;
  return "";
}

export function resolveSupabaseServiceRoleKey(): string {
  return fromEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function isSupabaseConfigured(): boolean {
  return Boolean(resolveSupabaseUrl() && resolveSupabaseAnonKey());
}
