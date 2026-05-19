/**
 * Supabase JS expects the project URL (e.g. https://xxx.supabase.co), not the REST path.
 * Copy-paste from the API docs often includes `/rest/v1`, which breaks auth.
 */
export function normalizeSupabaseUrl(url: string): string {
  let u = url.trim();
  if (!u) return u;
  u = u.replace(/\/rest\/v1\/?$/i, "");
  u = u.replace(/\/+$/, "");
  return u;
}
