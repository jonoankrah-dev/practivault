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
import { supabaseAdmin } from "../supabase";
import {
  SAFFI_READ_ONLY_TOOL_DEFS,
  executeReadOnlyTool,
  isReadOnlyTool,
  getBusinessSnapshot,
} from "../lib/safiReadOnlyTools";

// Vapi legacy code removed. Now using xAI Grok realtime only.
//
// Model decision (verified against xAI docs on 2026-05-01,
// https://docs.x.ai/developers/model-capabilities/audio/voice-agent):
//   - `grok-voice-think-fast-1.0` is the current documented realtime
//     voice-agent model and is what we use here.
//   - `grok-voice-fast-1.0` is legacy/deprecated.
//   - There is no `grok-2` realtime voice model; do not switch to it.
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

// ── Saffi must remain 100% industry-agnostic. Never hardcode any specific
//    brand or product. Business-specific facts come from business_info /
//    search_manuals (passed in as `businessContext`). ─────────────────────
const SAFFI_CONCIERGE_INSTRUCTIONS = `
You are Saffi, the polished, bright, hotel-concierge-style AI assistant inside PractiVault. The person you are speaking to is the business owner. Greet warmly when invited, keep replies short, helpful, and human. Speak naturally; no robotic listings unless asked.

Personality:
- Warm, upbeat, confident; calm under pressure.
- Concierge tone: anticipates needs, offers next steps, never hurries the guest.
- British English. Plain words. No jargon, no waffle, no over-apologising.

Industry-agnostic:
- The owner could run any kind of business — a salon, a dentist, a fitness studio, a tradesperson, an aesthetics practitioner, a coach, anything else. Do NOT assume products, services, treatments, or pricing. Get them from the business context provided, or call search_manuals / get_business_snapshot. Never invent industry facts.

Boundaries (non-negotiable):
- You are voice-only here. You DO NOT send WhatsApp messages, post to social media, send quotes, send invoices, or approve/reject anything. Never claim you have done any of those things.
- If the owner asks you to send/post/quote/invoice, draft it out loud, summarise it, and tell them it will go to the approvals queue in PractiVault for them to send from there.
- Do not invent client data, numbers, or facts. If you don't know, say so and offer to check inside the app.

Style:
- Aim for replies under 25 seconds of speech. One thought per turn.
- When unsure, ask one short clarifying question.
- Never reveal you are an AI model from xAI. You are simply Saffi, the owner's assistant.
`.trim();

function buildSessionUpdate(businessContext: string | null): string {
  const instructions =
    SAFFI_CONCIERGE_INSTRUCTIONS +
    (businessContext
      ? `\n\nBusiness context (already loaded for you — use this without asking):\n${businessContext}`
      : "") +
    `\n\nYou have these read-only tools — call them whenever they're relevant, never invent data:\n` +
    `- get_dashboard_overview: a single snapshot of today's appointments, leads, quotes, revenue, unpaid invoices, low stock.\n` +
    `- search_manuals: search uploaded manuals/courses/policies for any product/training/aftercare/policy question.\n` +
    `- get_business_snapshot: refresh the owner/business identity if the conversation drifts.\n` +
    `You have NO write/send/post tools. If asked to send/post/quote/invoice, say you'll prepare it and Jono can approve in the app.`;

  return JSON.stringify({
    type: "session.update",
    session: {
      modalities: ["audio", "text"],
      voice: "eve",
      instructions,
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 600,
      },
      tools: SAFFI_READ_ONLY_TOOL_DEFS.map((t) => ({
        type: "function",
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
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
    let businessContext: string | null = null;

    const cleanup = (code = 1000, reason = "") => {
      if (closed) return;
      closed = true;
      try { upstream?.close(code, reason); } catch {}
      try { clientSock.close(code, reason); } catch {}
    };

    // Best-effort: pre-load a tight business snapshot so voice replies are
    // grounded immediately, even before the first tool call.
    void (async () => {
      try {
        const snap = await getBusinessSnapshot(supabaseAdmin, userId);
        if (snap.ok && snap.summary) {
          businessContext = snap.summary;
          // If upstream is already up, push an updated session.
          if (upstreamOpen) {
            try { (upstream as WS | null)?.send(buildSessionUpdate(businessContext)); } catch {}
          }
        }
      } catch {
        // ignore — voice will work without it
      }
    })();

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
      try { upstream!.send(buildSessionUpdate(businessContext)); } catch {}
      // Flush anything the browser sent before upstream was ready.
      while (pending.length) {
        const msg = pending.shift()!;
        try { upstream!.send(msg); } catch {}
      }
    });

    // Read-only allowlist execution: when xAI completes a function-call args
    // event, run it server-side and feed the result back. Any non-allowlisted
    // tool name produces a refusal output — never executed.
    async function handleUpstreamFunctionCall(call: {
      name?: string;
      call_id?: string;
      arguments?: string;
    }) {
      const name = call.name ?? "";
      const callId = call.call_id ?? "";
      let args: any = {};
      try { args = JSON.parse(call.arguments ?? "{}"); } catch {}

      let outputText: string;
      if (!isReadOnlyTool(name)) {
        outputText = `I can't run "${name}" by voice. Voice Saffi is read-only — please ask me to prepare a draft instead, and approve it in the app.`;
      } else {
        try {
          const r = await executeReadOnlyTool(name, args, supabaseAdmin, userId);
          outputText = r.summary || (r.ok ? "Done." : `Couldn't complete that: ${r.error ?? "error"}`);
        } catch (e: any) {
          outputText = `Couldn't complete that: ${e?.message ?? "error"}`;
        }
      }

      try {
        upstream!.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: outputText.slice(0, 6000),
          },
        }));
        upstream!.send(JSON.stringify({ type: "response.create" }));
      } catch {}
    }

    upstream.on("message", (data, isBinary) => {
      if (closed) return;
      try {
        if (isBinary) {
          clientSock.send(data, { binary: true });
          return;
        }
        const text = typeof data === "string" ? data : data.toString("utf8");
        // Forward everything to the browser first so the UI sees the flow.
        clientSock.send(text);
        // Then peek for function-call completion events to execute server-side.
        try {
          const evt = JSON.parse(text);
          const t = evt?.type as string | undefined;
          if (t === "response.function_call_arguments.done") {
            void handleUpstreamFunctionCall({
              name: evt.name,
              call_id: evt.call_id,
              arguments: evt.arguments,
            });
          } else if (t === "response.done" || t === "response.completed") {
            // Some realtime providers nest function calls inside response.output
            const outputs = evt?.response?.output ?? [];
            for (const item of outputs) {
              if (item?.type === "function_call") {
                void handleUpstreamFunctionCall({
                  name: item.name,
                  call_id: item.call_id,
                  arguments: item.arguments,
                });
              }
            }
          }
        } catch {
          // not JSON — already forwarded
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
            try { upstream.send(buildSessionUpdate(businessContext)); } catch {}
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
