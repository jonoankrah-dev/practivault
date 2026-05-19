export function normalizeSupabaseUrl(url: string): string {
  let u = url.trim();
  if (!u) return u;
  u = u.replace(/\/rest\/v1\/?$/i, "");
  u = u.replace(/\/+$/, "");
  return u;
}
