/**
 * Safi — Fully Agentic AI Assistant
 * Single unified AI. No modes. Safi acts — she doesn't just answer.
 * Powered by xAI grok-voice-think-fast-1.0 realtime WebSocket.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Mic, MicOff, Loader2, Volume2, Trash2, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type ConvoItem = {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  toolName?: string;
};

type ConnState = "idle" | "connecting" | "connected" | "error";

// ── PCM helpers ───────────────────────────────────────────────────────────────
function float32ToBase64Pcm16(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64Pcm16ToFloat32(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;
  return float32;
}

// ── Audio player ──────────────────────────────────────────────────────────────
class AudioPlayer {
  private ctx: AudioContext;
  private nextTime = 0;
  constructor(sr = 24000) { this.ctx = new AudioContext({ sampleRate: sr }); }
  unlock() { if (this.ctx.state === "suspended") this.ctx.resume(); }
  enqueue(f32: Float32Array) {
    this.unlock();
    const buf = this.ctx.createBuffer(1, f32.length, 24000);
    buf.copyToChannel(f32, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    const t = Math.max(now, this.nextTime);
    src.start(t);
    this.nextTime = t + buf.duration;
  }
  clear() { this.nextTime = 0; }
  close() { this.ctx.close(); }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Safi() {
  const { toast } = useToast();

  const [connState, setConnState] = useState<ConnState>("idle");
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [toolRunning, setToolRunning] = useState<string | null>(null);
  const [items, setItems] = useState<ConvoItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const assistantDraftRef = useRef("");

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [items]);

  // ── Connect ──────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (wsRef.current) return;
    setConnState("connecting");
    try {
      const tokenData = await apiRequest("POST", "/api/safi/realtime-token", {}) as any;
      const secret = tokenData.client_secret ?? tokenData.value;
      if (!secret) throw new Error(tokenData.message ?? `Token error: ${JSON.stringify(tokenData)}`);
      const sessionInstructions = tokenData.instructions as string | undefined;
      const sessionTools = tokenData.tools as any[] | undefined;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const jwt = getAuthToken() ?? "";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/safi/realtime?token=${encodeURIComponent(secret)}&auth=${encodeURIComponent(jwt)}`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      playerRef.current = new AudioPlayer(24000);

      ws.onopen = () => {
        setConnState("connected");
        const sessionUpdate: any = {
          type: "session.update",
          session: {
            voice: "eve",
            turn_detection: { type: "server_vad" },
            audio: {
              input:  { format: { type: "audio/pcm", rate: 24000 } },
              output: { format: { type: "audio/pcm", rate: 24000 } },
            },
          },
        };
        if (sessionInstructions) sessionUpdate.session.instructions = sessionInstructions;
        if (sessionTools?.length) sessionUpdate.session.tools = sessionTools;
        ws.send(JSON.stringify(sessionUpdate));

        // Wire mic
        const micCtx = new AudioContext({ sampleRate: 24000 });
        audioCtxRef.current = micCtx;
        const source = micCtx.createMediaStreamSource(stream);
        const processor = micCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(micCtx.destination);
        processor.onaudioprocess = (e) => {
          if (mutedRef.current || ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: float32ToBase64Pcm16(e.inputBuffer.getChannelData(0)),
          }));
        };
      };

      ws.onmessage = (event) => {
        try { handleServerEvent(JSON.parse(event.data as string)); } catch {}
      };
      ws.onclose = () => { setConnState("idle"); cleanup(false); };
      ws.onerror = () => {
        setConnState("error");
        toast({ title: "Connection error", description: "Couldn't connect to Safi.", variant: "destructive" });
        cleanup(false);
      };
    } catch (e: any) {
      setConnState("error");
      toast({ title: "Couldn't start Safi", description: e.message, variant: "destructive" });
      cleanup(false);
    }
  }, []);

  // ── Server events ────────────────────────────────────────────────────────
  const handleServerEvent = useCallback((msg: any) => {
    switch (msg.type) {
      case "conversation.item.input_audio_transcription.completed": {
        const text = msg.transcript?.trim();
        if (text) setItems(prev => [...prev.filter(i => i.id !== "user-draft"), { id: `u-${Date.now()}`, role: "user", text }]);
        break;
      }
      case "response.audio_transcript.delta": {
        assistantDraftRef.current += msg.delta ?? "";
        const id = `a-${msg.response_id ?? "draft"}`;
        setItems(prev => {
          const last = prev[prev.length - 1];
          if (last?.id === id) return [...prev.slice(0, -1), { ...last, text: assistantDraftRef.current }];
          return [...prev, { id, role: "assistant", text: assistantDraftRef.current }];
        });
        setSpeaking(true);
        break;
      }
      case "response.audio_transcript.done":
        assistantDraftRef.current = "";
        setSpeaking(false);
        break;
      case "response.output_audio.delta":
        if (msg.delta && playerRef.current) playerRef.current.enqueue(base64Pcm16ToFloat32(msg.delta));
        break;
      case "response.output_audio.done":
        setSpeaking(false);
        break;
      case "input_audio_buffer.speech_started":
        playerRef.current?.clear();
        setSpeaking(false);
        break;
      // Tool call started
      case "response.function_call_arguments.done": {
        const toolName = msg.name ?? "tool";
        setToolRunning(toolName);
        setItems(prev => [...prev, {
          id: `tool-${msg.call_id}`,
          role: "tool",
          text: `Running: ${toolName.replace(/_/g, " ")}…`,
          toolName,
        }]);
        break;
      }
      // Tool result confirmed
      case "conversation.item.added":
        if (msg.item?.type === "function_call_output") setToolRunning(null);
        break;
      case "error":
        console.error("Safi error:", msg);
        toast({ title: "Safi error", description: msg.error?.message ?? "Unknown error", variant: "destructive" });
        break;
    }
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback((closeWs = true) => {
    if (closeWs && wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    processorRef.current?.disconnect(); processorRef.current = null;
    audioCtxRef.current?.close(); audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    playerRef.current?.close(); playerRef.current = null;
  }, []);

  const disconnect = useCallback(() => { cleanup(true); setConnState("idle"); setSpeaking(false); setToolRunning(null); }, [cleanup]);
  const toggleMute = useCallback(() => setMuted(m => !m), []);

  useEffect(() => {
    const unlock = () => playerRef.current?.unlock();
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("click", unlock); window.removeEventListener("keydown", unlock); cleanup(true); };
  }, []);

  const isConnected = connState === "connected";
  const isConnecting = connState === "connecting";

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold">Safi AI</h1>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#b1306f]/30 text-[#b1306f]">
              <Zap className="h-2.5 w-2.5 mr-0.5" />Agentic
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {connState === "idle"       && "Press Start — Safi can act, not just answer"}
            {connState === "connecting" && "Connecting…"}
            {connState === "connected"  && toolRunning ? `Running ${toolRunning.replace(/_/g, " ")}…` :
              connState === "connected" && (speaking ? "Speaking…" : muted ? "Muted" : "Listening…")}
            {connState === "error"      && "Connection failed — try again"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setItems([])} data-testid="button-clear">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {isConnected && (
            <Button variant={muted ? "destructive" : "outline"} size="icon" className="h-8 w-8" onClick={toggleMute} data-testid="button-mute">
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <Button
            size="sm"
            onClick={isConnected ? disconnect : connect}
            disabled={isConnecting}
            className={cn(isConnected
              ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              : "bg-[#b1306f] hover:bg-[#9a2860] text-white"
            )}
            data-testid="button-connect"
          >
            {isConnecting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Connecting…</>
              : isConnected ? "End"
              : <><Mic className="h-3.5 w-3.5 mr-1.5" />Start</>}
          </Button>
        </div>
      </div>

      {/* Live status bar */}
      {isConnected && (
        <div className="flex items-center gap-2 px-6 py-2 bg-[#b1306f]/5 border-b text-xs font-medium">
          <span className={cn(
            "inline-block h-2 w-2 rounded-full",
            toolRunning ? "bg-amber-500 animate-pulse"
              : speaking ? "bg-[#b1306f] animate-pulse"
              : muted ? "bg-muted-foreground"
              : "bg-emerald-500 animate-pulse"
          )} />
          <span className={cn(toolRunning ? "text-amber-600" : "text-[#b1306f]")}>
            {toolRunning ? `Safi is working — ${toolRunning.replace(/_/g, " ")}` :
              speaking ? "Safi is speaking" :
              muted ? "Microphone muted" :
              "Microphone live — speak naturally"}
          </span>
          {speaking && <Volume2 className="h-3.5 w-3.5 ml-1 text-[#b1306f]" />}
        </div>
      )}

      {/* Transcript */}
      <ScrollArea className="flex-1 px-6 py-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
            <div className="h-16 w-16 rounded-2xl bg-[#b1306f]/10 flex items-center justify-center mb-4">
              <Zap className="h-7 w-7 text-[#b1306f]" />
            </div>
            <p className="text-sm font-semibold">Safi — Your AI Business Assistant</p>
            <p className="text-xs mt-2 max-w-[260px] leading-relaxed text-muted-foreground">
              Press Start and tell Safi what to do — book a job, send an invoice, check stock, chase a payment, or generate a report.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5 max-w-xs">
              {["Book a job", "Send invoice", "Check stock", "Chase payment", "Generate report", "View clients"].map(s => (
                <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">{s}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {items.map(item => (
              <div key={item.id} className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}>
                {item.role === "tool" ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {item.text}
                  </div>
                ) : (
                  <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm max-w-[80%] leading-relaxed",
                    item.role === "user"
                      ? "bg-[#b1306f] text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}>
                    {item.text}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
