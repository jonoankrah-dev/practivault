import type { Express } from 'express';
import { createServer as createViteServer, createLogger } from "vite";
import type { Server } from 'node:http';
import viteConfig from "../vite.config";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  // Same default as server/index.ts — the browser must use this port for HMR WebSockets.
  const publicPort = parseInt(process.env.PORT || "3001", 10);
  const baseServer = viteConfig.server ?? {};

  // Middleware mode: attach HMR to our Express HTTP server. Without explicit host/port,
  // the injected client may try the wrong port (e.g. 5173) and WebSocket upgrades fail.
  const serverOptions = {
    ...baseServer,
    middlewareMode: true as const,
    allowedHosts: true as const,
    hmr: {
      server,
      path: "/vite-hmr",
      host: "localhost",
      port: publicPort,
      clientPort: publicPort,
    },
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
