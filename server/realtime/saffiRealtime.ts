/**
 * Saffi spoken conversation — server-side WebSocket proxy to xAI Realtime.
 *
 * Architecture:
 *   1. POST /api/saffi/realtime/token (auth required) — issues a 60s HMAC-signed
 *      connect token bound to the caller's userId.
 *   2. WSS /ws/saffi/realtime?token=... — verifies the token, opens an upstream
 *      WebSocket to wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-1.0
 *      with Authorization: Bearer XAI_API_KEY, and bridges JSON events both
 *      directions. The xAI key never reaches the browser.
 *
 * Safety:
 *   - The session.update we inject pins the concierge persona AND the approval
 *     rule: spoken Saffi must NEVER send WhatsApps, post social, send quotes,
 *     send invoices, or approve/reject queued actions. She prepares only.
 *   - No tools are exposed on this realtime session — tool use stays on the
 *     existing /api/safi/chat text endpoint, where approvals are enforced.
 */

import type { Server as HttpServer, IncomingMessage } from "node:http";
import type { Express, Request, Response } from "express";
import { WebSocketServer, WebSocket as WS } from "ws";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const XAI_REALTIME_URL =
  "wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-1.0";
const TOKEN_TTL_SECONDS = 60;

function getSigningSecret(): string | null {
  const explicit = process.env.SAFFI_REALTIME_SECRET;
  if (explicit && explicit.length >= 16) return explicit;
  const apiKey = process.env.XAI_API_KEY;
  if (apiKey && apiKey.length >= 16) return `saffi-realtime:${apiKey}`;
  return null;
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payload).digest());
}

function issueToken(userId: string): string {
  const secret = getSigningSecret();
  if (!secret) throw new Error("voice_unavailable");
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const nonce = base64url(randomBytes(9));
  const payload = `${userId}.${exp}.${nonce}`;
  const sig = sign(payload, secret);
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { userId: string } | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, expStr, nonce, sig] = parts;
  if (!userId || !expStr || !nonce || !sig) return null;
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const expected = sign(`${userId}.${expStr}.${nonce}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return { userId };
}

const SAFFI_CONCIERGE_INSTRUCTIONS = `
You are Saffi, the polished, bright, hotel-concierge-style AI assistant inside PractiVault. The person you are speaking to is Jono — the business owner. Greet warmly when invited, keep replies short, helpful, and human. Speak naturally; no robotic listings unless asked.

Personality:
- Warm, upbeat, confident; calm under pressure.
- Concierge tone: anticipates needs, offers next steps, never hurries the guest.
- British English. Plain words. No jargon, no waffle, no over-apologising.

Boundaries (non-negotiable):
- You are voice-only here. You DO NOT send WhatsApp messages, post to social media, send quotes, send invoices, or approve/reject anything. Never claim you have done any of those things.
- If Jono asks you to send/post/quote/invoice, draft it out loud, summarise it, and tell him it will go to the approvals queue in PractiVault for him to send from there.
- Do not invent client data, numbers, or facts. If you don't know, say so and offer to check inside the app.

Style:
- Aim for replies under 25 seconds of speech. One thought per turn.
- When unsure what Jono wants, ask one short clarifying question.
- Never reveal you are an AI model from xAI. You are simply Saffi, his assistant.
`.trim();

function buildSessionUpdate(): string {
  return JSON.stringify({
    type: "session.update",
    session: {
      modalities: ["audio", "text"],
      voice: "eve",
      instructions: SAFFI_CONCIERGE_INSTRUCTIONS,
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 600,
      },
      tools: [],
    },
  });
}

/**
 * Express handler factory for POST /api/saffi/realtime/token.
 * Caller is expected to apply requireAuth so req.user.id is populated.
 */
export function saffiRealtimeTokenHandler(req: Request, res: Response) {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) return res.status(401).json({ message: "Missing auth token" });
  if (!process.env.XAI_API_KEY) {
    return res.status(503).json({
      message: "voice_unavailable",
      detail: "Saffi voice is not configured on this server (XAI_API_KEY missing).",
    });
  }
  try {
    const token = issueToken(userId);
    return res.json({
      token,
      wsPath: "/ws/saffi/realtime",
      expiresIn: TOKEN_TTL_SECONDS,
      model: "grok-voice-think-fast-1.0",
    });
  } catch {
    return res.status(503).json({ message: "voice_unavailable" });
  }
}

export function registerSaffiRealtime(httpServer: HttpServer, _app: Express): void {
  // ── WSS: bridge browser <-> xAI realtime ──────────────────────────────────
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket, head) => {
    try {
      const url = new URL(req.url ?? "", "http://internal");
      if (url.pathname !== "/ws/saffi/realtime") return; // not for us
      const token = url.searchParams.get("token") ?? "";
      const verified = verifyToken(token);
      const apiKey = process.env.XAI_API_KEY;
      if (!verified || !apiKey) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (clientSock) => {
        wss.emit("connection", clientSock, req, verified.userId);
      });
    } catch {
      try {
        socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      } catch {}
      socket.destroy();
    }
  });

  wss.on("connection", (clientSock: WS, _req: IncomingMessage, userId: string) => {
    const apiKey = process.env.XAI_API_KEY!;
    let upstream: WS | null = null;
    let upstreamOpen = false;
    let closed = false;
    const pending: string[] = [];

    const cleanup = (code = 1000, reason = "") => {
      if (closed) return;
      closed = true;
      try { upstream?.close(code, reason); } catch {}
      try { clientSock.close(code, reason); } catch {}
    };

    try {
      upstream = new WS(XAI_REALTIME_URL, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch (e: any) {
      console.warn("[saffi-realtime] upstream construct failed:", e?.message);
      try { clientSock.send(JSON.stringify({ type: "error", error: { message: "voice_provider_error" } })); } catch {}
      cleanup(1011, "upstream_failed");
      return;
    }

    upstream.on("open", () => {
      upstreamOpen = true;
      // Always pin our session config first so personality + safety apply.
      try { upstream!.send(buildSessionUpdate()); } catch {}
      // Flush anything the browser sent before upstream was ready.
      while (pending.length) {
        const msg = pending.shift()!;
        try { upstream!.send(msg); } catch {}
      }
    });

    upstream.on("message", (data, isBinary) => {
      if (closed) return;
      try {
        if (isBinary) {
          clientSock.send(data, { binary: true });
        } else {
          clientSock.send(typeof data === "string" ? data : data.toString("utf8"));
        }
      } catch {}
    });

    upstream.on("close", (code, reason) => {
      cleanup(code, reason?.toString() ?? "");
    });

    upstream.on("error", (err) => {
      console.warn("[saffi-realtime] upstream error:", err?.message);
      try {
        clientSock.send(JSON.stringify({
          type: "error",
          error: { message: "voice_provider_error" },
        }));
      } catch {}
      cleanup(1011, "upstream_error");
    });

    clientSock.on("message", (data, isBinary) => {
      if (closed || !upstream) return;
      const text = isBinary ? null : (typeof data === "string" ? data : data.toString("utf8"));
      // Only forward JSON text frames (xAI realtime is JSON-based).
      if (text === null) return;
      // Block any attempt by the browser to override session safety:
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.type === "session.update") {
          // Re-apply our authoritative session config; ignore client overrides.
          if (upstreamOpen) {
            try { upstream.send(buildSessionUpdate()); } catch {}
          }
          return;
        }
      } catch {
        return; // drop malformed frames
      }
      if (upstreamOpen) {
        try { upstream.send(text); } catch {}
      } else {
        if (pending.length < 64) pending.push(text);
      }
    });

    clientSock.on("close", () => cleanup(1000, "client_closed"));
    clientSock.on("error", () => cleanup(1011, "client_error"));

    // Idle safety: cap a single voice session at 10 minutes.
    const cap = setTimeout(() => cleanup(1000, "session_cap"), 10 * 60 * 1000);
    clientSock.once("close", () => clearTimeout(cap));
  });

  console.log("[saffi-realtime] WSS attached at /ws/saffi/realtime");
}
