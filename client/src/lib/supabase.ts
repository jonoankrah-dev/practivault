import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@shared/supabaseUrl";

type PublicConfig = {
  ok: true;
    supabaseUrl: string;
      supabaseAnonKey: string;
      };

      type PublicConfigError = {
        ok: false;
          error: string;
            missing?: { supabaseUrl: boolean; supabaseAnonKey: boolean };
            };

            let clientPromise: Promise<SupabaseClient> | null = null;
            let cachedClient: SupabaseClient | null = null;
            let cachedConfigError: Error | null = null;

            const BUILD_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "";
            const BUILD_KEY =
              (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "";

              async function fetchRuntimeConfig(): Promise<PublicConfig> {
                const res = await fetch("/api/public-config", {
                    credentials: "same-origin",
                        headers: { Accept: "application/json" },
                            cache: "no-store",
                              });

                                let body: PublicConfig | PublicConfigError | null = null;
                                  try {
                                      body = (await res.json()) as PublicConfig | PublicConfigError;
                                        } catch {
                                            throw new Error(`public-config: non-JSON response (status ${res.status})`);
                                              }

                                                if (!res.ok || !body || body.ok !== true) {
                                                    const err = body && body.ok === false ? body.error : `status_${res.status}`;
                                                        throw new Error(`public-config: ${err}`);
                                                          }

                                                            if (!body.supabaseUrl || !body.supabaseAnonKey) {
                                                                throw new Error("public-config: empty supabase credentials");
                                                                  }

                                                                    return body;
                                                                    }

                                                                    function buildClient(url: string, key: string): SupabaseClient {
                                                                      return createClient(normalizeSupabaseUrl(url), key, {
                                                                          auth: {
                                                                                persistSession: true,
                                                                                      autoRefreshToken: true,
                                                                                            detectSessionInUrl: true,
                                                                                                },
                                                                                                  });
                                                                                                  }

                                                                                                  export async function getSupabaseClient(): Promise<SupabaseClient> {
                                                                                                    if (cachedClient) return cachedClient;
                                                                                                      if (cachedConfigError) throw cachedConfigError;

                                                                                                        if (!clientPromise) {
                                                                                                            clientPromise = (async () => {
                                                                                                                  try {
                                                                                                                          if (BUILD_URL && BUILD_KEY) {
                                                                                                                                    cachedClient = buildClient(BUILD_URL, BUILD_KEY);
                                                                                                                                              return cachedClient;
                                                                                                                                                      }
                                                                                                                                                              const cfg = await fetchRuntimeConfig();
                                                                                                                                                                      cachedClient = buildClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
                                                                                                                                                                              return cachedClient;
                                                                                                                                                                                    } catch (e) {
                                                                                                                                                                                            cachedConfigError = e instanceof Error ? e : new Error(String(e));
                                                                                                                                                                                                    clientPromise = null;
                                                                                                                                                                                                            throw cachedConfigError;
                                                                                                                                                                                                                  }
                                                                                                                                                                                                                      })();
                                                                                                                                                                                                                        }

                                                                                                                                                                                                                          return clientPromise;
                                                                                                                                                                                                                          }

                                                                                                                                                                                                                          export async function ensureSupabaseReady(): Promise<void> {
                                                                                                                                                                                                                            await getSupabaseClient();
                                                                                                                                                                                                                            }

                                                                                                                                                                                                                            /**
                                                                                                                                                                                                                             * Legacy compatibility: some modules import a `supabase` symbol directly.
                                                                                                                                                                                                                              * Throw a clear error instead of silently constructing with undefined.
                                                                                                                                                                                                                               * Prefer `getSupabaseClient()` in new code.
                                                                                                                                                                                                                                */
                                                                                                                                                                                                                                export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
                                                                                                                                                                                                                                  get(_target, prop) {
                                                                                                                                                                                                                                      if (cachedClient) return (cachedClient as any)[prop];
                                                                                                                                                                                                                                          throw new Error(
                                                                                                                                                                                                                                                `supabase client accessed before ensureSupabaseReady() resolved (prop: ${String(prop)})`,
                                                                                                                                                                                                                                                    );
                                                                                                                                                                                                                                                      },
                                                                                                                                                                                                                                                      });