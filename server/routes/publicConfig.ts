import type { Express, Request, Response } from "express";

export function registerPublicConfigRoute(app: Express): void {
  app.get("/api/public-config", (_req: Request, res: Response) => {
    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey =
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "";

    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");

    if (!supabaseUrl || !supabaseAnonKey) {
      res.status(500).json({
        ok: false,
        error: "supabase_config_missing",
        missing: {
          supabaseUrl: !supabaseUrl,
          supabaseAnonKey: !supabaseAnonKey,
        },
      });
      return;
    }

    res.status(200).json({
      ok: true,
      supabaseUrl,
      supabaseAnonKey,
    });
  });
}
