import type { Express, Request, Response } from "express";
import {
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from "../config/supabaseEnv";

export function registerPublicConfigRoute(app: Express): void {
  app.get("/api/public-config", (_req: Request, res: Response) => {
    const supabaseUrl = resolveSupabaseUrl();
    const supabaseAnonKey = resolveSupabaseAnonKey();

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
