/**
 * Safi — Fully Agentic AI Assistant
 * xAI grok-voice-think-fast-1.0 realtime WebSocket
 * Audio: native mic → resample to 24kHz PCM16 → xAI
 * Output: xAI 24kHz PCM16 base64 → AudioContext playback
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Loader2, Volume2, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type ConvoItem = {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  toolName?: string;
};
type ConnState = "idle" | "connecting" | "connected" | "error";

// ── xAI expects 24kHz PCM16 ───────────────────────────────────────────────────
const XAI_SAMPLE_RATE = 24000;

// ── PCM16 encode ──────────────────────────────────────────────────────────────
function encodePcm16(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// ── PCM16 decode ──────────────────────────────────────────────────────────────
function decodePcm16(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 0x8000;
  return f32;
}

// ── Linear resampler: any rate → 24kHz ───────────────────────────────────────
function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.round(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[idx] ?? 0;
    const b = input[idx + 1] ?? 0;
    out[i] = a + frac * (b - a);
  }
  return out;
}

// ── Queued audio player ───────────────────────────────────────────────────────
class AudioPlayer {
  private ctx: AudioContext;
  private nextTime = 0;

  constructor() {
    this.ctx = new AudioContext({ sampleRate: XAI_SAMPLE_RATE });
  }

  unlock() {
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  play(f32: Float32Array) {
    this.unlock();
    const buf = this.ctx.createBuffer(1, f32.length, XAI_SAMPLE_RATE);
    buf.copyToChannel(f32, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    const start = Math.max(now, this.nextTime);
    src.start(start);
    this.nextTime = start + buf.duration;
  }

  flush() {
    this.nextTime = 0;
  }

  close() {
    try { this.ctx.close(); } catch {}
  }
}

// ── Mic capture using ScriptProcessor (widely supported) ─────────────────────
// AudioContext at XAI_SAMPLE_RATE auto-resamples from native mic rate
class MicCapture {
  private ctx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  async start(stream: MediaStream, onChunk: (b64: string) => void) {
    // Use XAI_SAMPLE_RATE so the AudioContext handles resampling
    this.ctx = new AudioContext({ sampleRate: XAI_SAMPLE_RATE });
    await this.ctx.resume();

    this.source = this.ctx.createMediaStreamSource(stream);

    // 2048 frames @ 24kHz = ~85ms per chunk — good balance
    this.processor = this.ctx.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      // Data is already at 24kHz (AudioContext resamples for us)
      onChunk(encodePcm16(data));
    };

    this.source.connect(this.processor);
    // IMPORTANT: connect to a silent gain node, NOT to destination
    // This keeps the processor alive without echoing mic to speakers
    const silent = this.ctx.createGain();
    silent.gain.value = 0;
    this.processor.connect(silent);
    silent.connect(this.ctx.destination);
  }

  stop() {
    try { this.processor?.disconnect(); } catch {}
    try { this.source?.disconnect(); } catch {}
    try { this.ctx?.close(); } catch {}
    this.processor = null;
    this.source = null;
    this.ctx = null;
  }
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
  const micRef = useRef<MicCapture | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef("");
  const draftIdRef = useRef<string | null>(null);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [items]);

  // ── Server event handler ──────────────────────────────────────────────────
  const onEvent = useCallback((msg: any) => {
    switch (msg.type) {
      case "conversation.item.input_audio_transcription.completed": {
        const text = (msg.transcript ?? "").trim();
        if (text) setItems(p => [...p.filter(i => i.id !== "u-draft"), { id: `u-${Date.now()}`, role: "user", text }]);
        break;
      }
      case "response.output_audio_transcript.delta": {
        draftRef.current += msg.delta ?? "";
        const id = `a-${msg.response_id ?? "r"}`;
        draftIdRef.current = id;
        setItems(p => {
          const last = p[p.length - 1];
          if (last?.id === id) return [...p.slice(0, -1), { ...last, text: draftRef.current }];
          return [...p, { id, role: "assistant", text: draftRef.current }];
        });
        setSpeaking(true);
        break;
      }
      case "response.output_audio_transcript.done":
        draftRef.current = "";
        draftIdRef.current = null;
        setSpeaking(false);
        break;
      case "response.output_audio.delta":
        if (msg.delta && playerRef.current) {
          try { playerRef.current.play(decodePcm16(msg.delta)); } catch {}
        }
        break;
      case "response.output_audio.done":
        setSpeaking(false);
        break;
      case "input_audio_buffer.speech_started":
        playerRef.current?.flush();
        setSpeaking(false);
        break;
      case "response.function_call_arguments.done": {
        const name = msg.name ?? "tool";
        setToolRunning(name);
        setItems(p => [...p, { id: `tool-${msg.call_id ?? Date.now()}`, role: "tool", text: `Running: ${name.replace(/_/g, " ")}…`, toolName: name }]);
        break;
      }
      case "conversation.item.added":
        if (msg.item?.type === "function_call_output") setToolRunning(null);
        break;
      case "error":
        console.error("Safi WS error event:", msg);
        toast({ title: "Safi error", description: msg.error?.message ?? "Unknown error", variant: "destructive" });
        break;
    }
  }, []);

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (wsRef.current) return;
    setConnState("connecting");

    try {
      // 1. Get ephemeral token + session config
      const tokenRes = await apiRequest("POST", "/api/safi/realtime-token", {});
      const tokenData = await tokenRes.json() as any;
      const secret = tokenData.client_secret ?? tokenData.value;
      if (!secret) throw new Error(tokenData.message ?? `No token: ${JSON.stringify(tokenData)}`);

      // 2. Request mic — let browser use native rate, we'll resample
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      streamRef.current = stream;

      // 3. Open WebSocket proxy
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const jwt = getAuthToken() ?? "";
      const wsUrl = `${protocol}//${location.host}/ws/safi/realtime?token=${encodeURIComponent(secret)}&auth=${encodeURIComponent(jwt)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      playerRef.current = new AudioPlayer();

      ws.onopen = async () => {
        setConnState("connected");

        // 4. Configure xAI session — flat pcm16 format, 24kHz
        ws.send(JSON.stringify({
          type: "session.update",
          session: {
            voice: "eve",
            instructions: tokenData.instructions,
            tools: tokenData.tools,
            tool_choice: "auto",
            turn_detection: { type: "server_vad" },
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: { model: "default" },
          },
        }));

        // 5. Start mic capture — AudioContext at 24kHz auto-resamples
        const mic = new MicCapture();
        micRef.current = mic;
        await mic.start(stream, (b64) => {
          if (!mutedRef.current && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
          }
        });
      };

      ws.onmessage = (e) => {
        try { onEvent(JSON.parse(e.data)); } catch {}
      };

      ws.onclose = (e) => {
        console.log("WS closed", e.code, e.reason);
        doCleanup(false);
        setConnState("idle");
      };

      ws.onerror = () => {
        toast({ title: "Connection error", description: "Couldn't reach Safi.", variant: "destructive" });
        doCleanup(false);
        setConnState("error");
      };

    } catch (err: any) {
      toast({ title: "Couldn't start Safi", description: err.message, variant: "destructive" });
      doCleanup(false);
      setConnState("error");
    }
  }, [onEvent]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const doCleanup = useCallback((closeWs = true) => {
    if (closeWs) { wsRef.current?.close(); wsRef.current = null; }
    micRef.current?.stop(); micRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    playerRef.current?.close(); playerRef.current = null;
    setSpeaking(false);
    setToolRunning(null);
  }, []);

  const disconnect = useCallback(() => {
    doCleanup(true);
    setConnState("idle");
  }, [doCleanup]);

  const toggleMute = useCallback(() => setMuted(m => !m), []);

  // Unlock AudioContext on first tap (iOS requirement)
  useEffect(() => {
    const unlock = () => playerRef.current?.unlock();
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
      doCleanup(true);
    };
  }, []);

  const isConnected = connState === "connected";
  const isConnecting = connState === "connecting";

  // ── Status label ─────────────────────────────────────────────────────────
  const statusLabel = (() => {
    if (connState === "idle") return "Press Start — Safi can act, not just answer";
    if (connState === "connecting") return "Connecting…";
    if (connState === "error") return "Connection failed — try again";
    if (toolRunning) return `Working — ${toolRunning.replace(/_/g, " ")}`;
    if (speaking) return "Safi is speaking";
    if (muted) return "Microphone muted";
    return "Listening — speak now";
  })();

  return (
    <div className="flex flex-col h-full max-h-screen">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold">Safi AI</h1>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#b1306f]/30 text-[#b1306f]">
              <Zap className="h-2.5 w-2.5 mr-0.5" />Agentic
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{statusLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
              onClick={() => setItems([])} data-testid="button-clear">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {isConnected && (
            <Button
              variant={muted ? "destructive" : "outline"}
              size="icon" className="h-8 w-8"
              onClick={toggleMute}
              data-testid="button-mute"
              title={muted ? "Unmute microphone" : "Mute microphone"}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <Button
            size="sm"
            onClick={isConnected ? disconnect : connect}
            disabled={isConnecting}
            className={cn(
              isConnected
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : "bg-[#b1306f] hover:bg-[#9a2860] text-white"
            )}
            data-testid="button-connect"
          >
            {isConnecting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Connecting…</>
              : isConnected ? "End"
              : <><Mic className="h-3.5 w-3.5 mr-1.5" />Start</>}
          </Button>
        </div>
      </div>

      {/* ── Live status bar ── */}
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
            {statusLabel}
          </span>
          {speaking && <Volume2 className="h-3.5 w-3.5 ml-1 text-[#b1306f]" />}
        </div>
      )}

      {/* ── Transcript ── */}
      <ScrollArea className="flex-1 px-6 py-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
            <div className="h-16 w-16 rounded-2xl bg-[#b1306f]/10 flex items-center justify-center mb-4">
              <Zap className="h-7 w-7 text-[#b1306f]" />
            </div>
            <p className="text-sm font-semibold">Safi — Your AI Business Assistant</p>
            <p className="text-xs mt-2 max-w-[260px] leading-relaxed text-muted-foreground">
              Press Start and speak. Safi will listen and respond with voice.
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
