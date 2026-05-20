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

/** True when SUPABASE_* env vars are set (not using built-in defaults). */
export function isSupabaseConfiguredFromEnv(): boolean {
  return Boolean(
    fromEnv("SUPABASE_URL", "VITE_SUPABASE_URL") &&
      fromEnv("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"),
  );
}

/** Resolve Supabase URL: env first, then built-in project default. */
export function resolveSupabaseUrl(): string {
  const fromEnvironment = fromEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  if (fromEnvironment) return normalizeSupabaseUrl(fromEnvironment);
  return PRACTIVAULT_SUPABASE_URL;
}

/** Resolve anon key: env first, then built-in project default. */
export function resolveSupabaseAnonKey(): string {
  const fromEnvironment = fromEnv(
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
  );
  if (fromEnvironment) return fromEnvironment;
  return PRACTIVAULT_SUPABASE_ANON_KEY;
}

export function resolveSupabaseServiceRoleKey(): string {
  return fromEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function supabaseConfigSource(): "env" | "builtin" {
  return isSupabaseConfiguredFromEnv() ? "env" : "builtin";
}
