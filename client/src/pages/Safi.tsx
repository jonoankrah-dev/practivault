/**
 * Safi — Agentic AI Assistant
 * Voice pipeline: mic → AudioWorklet (native rate) → resample to 24kHz → PCM16 → xAI
 * Output: xAI 24kHz PCM16 base64 → AudioContext → speakers
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Loader2, Volume2, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type ConvoItem = { id: string; role: "user" | "assistant" | "tool"; text: string; toolName?: string };
type ConnState = "idle" | "connecting" | "connected" | "error";

// xAI sends and receives 24kHz PCM16
const XAI_RATE = 24000;

// ── PCM16 helpers ─────────────────────────────────────────────────────────────
function f32ToB64(f32: Float32Array): string {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return btoa(String.fromCharCode(...new Uint8Array(i16.buffer)));
}

function b64ToF32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const i16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 0x8000;
  return f32;
}

// ── Linear resampler ──────────────────────────────────────────────────────────
function resampleTo24k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === XAI_RATE) return input;
  const ratio = fromRate / XAI_RATE;
  const len = Math.floor(input.length / ratio);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, input.length - 1);
    out[i] = input[lo] + (pos - lo) * (input[hi] - input[lo]);
  }
  return out;
}

// ── AudioPlayer — queued 24kHz playback ───────────────────────────────────────
class AudioPlayer {
  ctx: AudioContext;
  private tail = 0;

  constructor() {
    this.ctx = new AudioContext({ sampleRate: XAI_RATE });
  }

  resume() { if (this.ctx.state !== "running") this.ctx.resume(); }

  play(f32: Float32Array) {
    this.resume();
    const buf = this.ctx.createBuffer(1, f32.length, XAI_RATE);
    buf.copyToChannel(f32, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    const start = Math.max(now, this.tail);
    src.start(start);
    this.tail = start + buf.duration;
  }

  interrupt() { this.tail = 0; }
  close() { try { this.ctx.close(); } catch {} }
}

// ── MicRecorder — captures mic and streams PCM16 base64 chunks ───────────────
class MicRecorder {
  private ctx: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;
  private script: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private rate = 48000;

  async start(stream: MediaStream, onChunk: (b64: string) => void) {
    // MUST use native rate — forcing a non-native rate on MediaStreamSource
    // causes Chrome/Safari to deliver silence
    this.ctx = new AudioContext();
    this.rate = this.ctx.sampleRate;
    await this.ctx.resume();

    this.source = this.ctx.createMediaStreamSource(stream);

    // Try AudioWorklet (served as a real file at /mic-processor.js)
    try {
      await this.ctx.audioWorklet.addModule("/mic-processor.js");
      this.worklet = new AudioWorkletNode(this.ctx, "mic-processor");
      this.worklet.port.onmessage = (e: MessageEvent) => {
        const resampled = resampleTo24k(e.data.audio as Float32Array, this.rate);
        onChunk(f32ToB64(resampled));
      };
      // Route: mic → worklet → silent sink (no echo, keeps processor alive)
      const sink = this.ctx.createGain();
      sink.gain.value = 0;
      this.source.connect(this.worklet);
      this.worklet.connect(sink);
      sink.connect(this.ctx.destination);
      console.log("[Safi mic] Using AudioWorklet at", this.rate, "Hz");
      return;
    } catch (e) {
      console.warn("[Safi mic] AudioWorklet unavailable, using ScriptProcessor:", e);
    }

    // Fallback: ScriptProcessor (deprecated but widely supported)
    this.script = this.ctx.createScriptProcessor(4096, 1, 1);
    this.script.onaudioprocess = (e) => {
      const raw = e.inputBuffer.getChannelData(0).slice();
      const resampled = resampleTo24k(raw, this.rate);
      onChunk(f32ToB64(resampled));
    };
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    this.source.connect(this.script);
    this.script.connect(sink);
    sink.connect(this.ctx.destination);
    console.log("[Safi mic] Using ScriptProcessor at", this.rate, "Hz");
  }

  stop() {
    try { this.worklet?.disconnect(); } catch {}
    try { this.script?.disconnect(); } catch {}
    try { this.source?.disconnect(); } catch {}
    try { this.ctx?.close(); } catch {}
    this.worklet = null; this.script = null; this.source = null; this.ctx = null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Safi() {
  const { toast } = useToast();
  const [state, setState] = useState<ConnState>("idle");
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [tool, setTool] = useState<string | null>(null);
  const [items, setItems] = useState<ConvoItem[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const player = useRef<AudioPlayer | null>(null);
  const mic = useRef<MicRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mutedRef = useRef(false);
  const draftRef = useRef("");
  const draftId = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [items]);

  // ── Event handler ─────────────────────────────────────────────────────────
  const onMsg = useCallback((raw: string) => {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      // User speech transcript
      case "conversation.item.input_audio_transcription.completed": {
        const t = (msg.transcript ?? "").trim();
        if (t) setItems(p => [...p.filter(i => i.id !== "u-live"), { id: `u-${Date.now()}`, role: "user", text: t }]);
        break;
      }
      // Safi speech transcript (streaming)
      case "response.output_audio_transcript.delta": {
        draftRef.current += msg.delta ?? "";
        const id = `a-${msg.response_id ?? "x"}`;
        draftId.current = id;
        setSpeaking(true);
        setItems(p => {
          const last = p[p.length - 1];
          if (last?.id === id) return [...p.slice(0, -1), { ...last, text: draftRef.current }];
          return [...p, { id, role: "assistant", text: draftRef.current }];
        });
        break;
      }
      case "response.output_audio_transcript.done":
        draftRef.current = ""; draftId.current = null; setSpeaking(false);
        break;
      // Audio chunks from Safi
      case "response.output_audio.delta":
        if (msg.delta) { try { player.current?.play(b64ToF32(msg.delta)); } catch {} }
        break;
      case "response.output_audio.done":
        setSpeaking(false);
        break;
      // User started speaking — stop Safi mid-sentence
      case "input_audio_buffer.speech_started":
        player.current?.interrupt();
        setSpeaking(false);
        break;
      // Tool calls
      case "response.function_call_arguments.done": {
        const name = msg.name ?? "tool";
        setTool(name);
        setItems(p => [...p, { id: `t-${msg.call_id ?? Date.now()}`, role: "tool", text: `Running: ${name.replace(/_/g, " ")}…`, toolName: name }]);
        break;
      }
      case "conversation.item.added":
        if (msg.item?.type === "function_call_output") setTool(null);
        break;
      case "error":
        console.error("[Safi] xAI error:", msg);
        toast({ title: "Safi error", description: msg.error?.message ?? "Unknown", variant: "destructive" });
        break;
    }
  }, []);

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (ws.current) return;
    setState("connecting");

    try {
      // 1. Fetch ephemeral token
      const res = await apiRequest("POST", "/api/safi/realtime-token", {});
      const data = await res.json() as any;
      const secret = data.client_secret ?? data.value;
      if (!secret) throw new Error(data.message ?? `No token: ${JSON.stringify(data)}`);

      // 2. Mic permission
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      stream.current = s;

      // 3. Open WebSocket
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const jwt = getAuthToken() ?? "";
      const socket = new WebSocket(
        `${proto}//${location.host}/ws/safi/realtime?token=${encodeURIComponent(secret)}&auth=${encodeURIComponent(jwt)}`
      );
      ws.current = socket;
      player.current = new AudioPlayer();

      socket.onopen = async () => {
        setState("connected");

        // 4. Configure session
        socket.send(JSON.stringify({
          type: "session.update",
          session: {
            voice: "eve",
            turn_detection: { type: "server_vad" },
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: { model: "default" },
            modalities: ["audio"],
            ...(data.instructions ? { instructions: data.instructions } : {}),
            ...(data.tools?.length ? { tools: data.tools, tool_choice: "auto" } : {}),
          },
        }));

        // 5. Start mic — audio flows continuously to xAI
        const recorder = new MicRecorder();
        mic.current = recorder;
        await recorder.start(s, (b64) => {
          if (!mutedRef.current && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
          }
        });
      };

      socket.onmessage = (e) => onMsg(e.data);
      socket.onclose = (e) => {
        console.log("[Safi] WS closed", e.code, e.reason);
        cleanup(false); setState("idle");
      };
      socket.onerror = () => {
        toast({ title: "Connection failed", description: "Couldn't reach Safi.", variant: "destructive" });
        cleanup(false); setState("error");
      };

    } catch (err: any) {
      toast({ title: "Couldn't start Safi", description: err.message, variant: "destructive" });
      cleanup(false); setState("error");
    }
  }, [onMsg]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback((closeWs = true) => {
    if (closeWs) { ws.current?.close(); ws.current = null; }
    mic.current?.stop(); mic.current = null;
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    player.current?.close(); player.current = null;
    setSpeaking(false); setTool(null);
  }, []);

  const disconnect = useCallback(() => { cleanup(true); setState("idle"); }, [cleanup]);
  const toggleMute = useCallback(() => setMuted(m => !m), []);

  // Unlock AudioContext on first user tap
  useEffect(() => {
    const unlock = () => player.current?.resume();
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
      cleanup(true);
    };
  }, []);

  const connected = state === "connected";
  const connecting = state === "connecting";

  const statusText =
    state === "idle"       ? "Press Start — Safi can act, not just answer" :
    state === "connecting" ? "Connecting…" :
    state === "error"      ? "Connection failed — try again" :
    tool                   ? `Working — ${tool.replace(/_/g, " ")}` :
    speaking               ? "Safi is speaking" :
    muted                  ? "Microphone muted" :
                             "Listening — speak now";

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
          <p className="text-xs text-muted-foreground">{statusText}</p>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
              onClick={() => setItems([])} data-testid="button-clear">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {connected && (
            <Button variant={muted ? "destructive" : "outline"} size="icon" className="h-8 w-8"
              onClick={toggleMute} data-testid="button-mute" title={muted ? "Unmute" : "Mute"}>
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <Button size="sm"
            onClick={connected ? disconnect : connect}
            disabled={connecting}
            className={cn(connected
              ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              : "bg-[#b1306f] hover:bg-[#9a2860] text-white"
            )}
            data-testid="button-connect"
          >
            {connecting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Connecting…</>
              : connected ? "End"
              : <><Mic className="h-3.5 w-3.5 mr-1.5" />Start</>}
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {connected && (
        <div className="flex items-center gap-2 px-6 py-2 bg-[#b1306f]/5 border-b text-xs font-medium">
          <span className={cn("inline-block h-2 w-2 rounded-full",
            tool     ? "bg-amber-500 animate-pulse"
            : speaking ? "bg-[#b1306f] animate-pulse"
            : muted   ? "bg-muted-foreground"
            :           "bg-emerald-500 animate-pulse"
          )} />
          <span className={cn(tool ? "text-amber-600" : "text-[#b1306f]")}>{statusText}</span>
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
            <p className="text-xs mt-2 max-w-[260px] leading-relaxed">
              Press Start and speak naturally. Safi will listen and respond.
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
                    <Loader2 className="h-3 w-3 animate-spin" />{item.text}
                  </div>
                ) : (
                  <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm max-w-[80%] leading-relaxed",
                    item.role === "user"
                      ? "bg-[#b1306f] text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}>{item.text}</div>
                )}
              </div>
            ))}
            <div ref={bottom} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
