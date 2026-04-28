/**
 * Saphie — xAI grok-voice-think-fast-1.0 Realtime Voice Assistant
 *
 * Architecture:
 *  1. On first interaction → POST /api/saphie/realtime-token → get ephemeral client_secret
 *  2. Open WebSocket to /ws/saphie/realtime?token=<secret> (server proxies to xAI)
 *  3. Send session.update with voice="eve", server_vad, instructions
 *  4. Stream raw PCM16 mic audio via input_audio_buffer.append
 *  5. xAI VAD detects speech end → streams back PCM16 audio deltas
 *  6. Play audio deltas in real time via AudioContext
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Loader2, Volume2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type ConvoItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type ConnState = "idle" | "connecting" | "connected" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert Float32 PCM samples → Int16 PCM bytes, base64-encoded */
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

/** Decode base64 PCM16 → Float32 for AudioContext playback */
function base64Pcm16ToFloat32(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;
  return float32;
}

// ── AudioPlayer — queues PCM chunks and plays them gaplessly ─────────────────
class AudioPlayer {
  private ctx: AudioContext;
  private nextTime = 0;
  private sampleRate: number;

  constructor(sampleRate = 24000) {
    this.ctx = new AudioContext({ sampleRate });
    this.sampleRate = sampleRate;
  }

  unlock() {
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  enqueue(float32: Float32Array) {
    this.unlock();
    const buffer = this.ctx.createBuffer(1, float32.length, this.sampleRate);
    buffer.copyToChannel(float32, 0);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    const startAt = Math.max(now, this.nextTime);
    source.start(startAt);
    this.nextTime = startAt + buffer.duration;
  }

  clear() {
    this.nextTime = 0;
  }

  close() {
    this.ctx.close();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Saphie() {
  const { toast } = useToast();

  const [connState, setConnState] = useState<ConnState>("idle");
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false); // Saphie is speaking
  const [items, setItems] = useState<ConvoItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Track current partial transcripts
  const userDraftRef = useRef("");
  const assistantDraftRef = useRef("");
  const currentResponseIdRef = useRef<string | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  // ── Connect to xAI realtime ──────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (wsRef.current) return;
    setConnState("connecting");

    try {
      // 1. Get ephemeral token (includes instructions baked in server-side)
      const tokenData = await apiRequest("POST", "/api/saphie/realtime-token", {}) as any;
      const secret = tokenData.client_secret ?? tokenData.value;
      if (!secret) throw new Error(`No client_secret returned. Response: ${JSON.stringify(tokenData)}`);

      // 2. Open mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 3. Open WebSocket proxy
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/ws/saphie/realtime?token=${encodeURIComponent(secret)}`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      // 4. Audio player
      playerRef.current = new AudioPlayer(24000);

      ws.onopen = () => {
        setConnState("connected");

        // Send session config — instructions already set server-side via token,
        // but we confirm voice + VAD here
        ws.send(JSON.stringify({
          type: "session.update",
          session: {
            voice: "eve",
            turn_detection: { type: "server_vad" },
            audio: {
              input:  { format: { type: "audio/pcm", rate: 24000 } },
              output: { format: { type: "audio/pcm", rate: 24000 } },
            },
          },
        }));

        // 5. Wire mic → WebSocket
        const micCtx = new AudioContext({ sampleRate: 24000 });
        audioCtxRef.current = micCtx;
        const source = micCtx.createMediaStreamSource(stream);
        // ScriptProcessor — works everywhere, AudioWorklet would be ideal but requires HTTPS+serving worklet file
        const processor = micCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(micCtx.destination);

        processor.onaudioprocess = (e) => {
          if (mutedRef.current || ws.readyState !== WebSocket.OPEN) return;
          const pcm = float32ToBase64Pcm16(e.inputBuffer.getChannelData(0));
          ws.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: pcm,
          }));
        };
      };

      ws.onmessage = (event) => {
        let msg: any;
        try { msg = JSON.parse(event.data as string); } catch { return; }
        handleServerEvent(msg);
      };

      ws.onclose = () => {
        setConnState("idle");
        cleanup(false);
      };

      ws.onerror = () => {
        setConnState("error");
        toast({ title: "Connection error", description: "Couldn't connect to Saphie. Try again.", variant: "destructive" });
        cleanup(false);
      };

    } catch (e: any) {
      setConnState("error");
      toast({ title: "Couldn't start Saphie", description: e.message, variant: "destructive" });
      cleanup(false);
    }
  }, []);

  // ── Handle incoming xAI events ───────────────────────────────────────────
  const handleServerEvent = useCallback((msg: any) => {
    switch (msg.type) {

      // User speech transcript (streaming)
      case "conversation.item.input_audio_transcription.completed": {
        const text = msg.transcript?.trim();
        if (text) {
          setItems(prev => {
            // Replace any existing user draft or append new
            const last = prev[prev.length - 1];
            if (last?.role === "user" && last.id === "user-draft") {
              return [...prev.slice(0, -1), { id: `user-${Date.now()}`, role: "user", text }];
            }
            return [...prev, { id: `user-${Date.now()}`, role: "user", text }];
          });
          userDraftRef.current = "";
        }
        break;
      }

      // Assistant text transcript delta (streaming)
      case "response.audio_transcript.delta": {
        const delta = msg.delta ?? "";
        assistantDraftRef.current += delta;
        const responseId = msg.response_id ?? "draft";
        setItems(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id === `assistant-${responseId}`) {
            return [...prev.slice(0, -1), { ...last, text: assistantDraftRef.current }];
          }
          return [...prev, { id: `assistant-${responseId}`, role: "assistant", text: assistantDraftRef.current }];
        });
        currentResponseIdRef.current = responseId;
        setSpeaking(true);
        break;
      }

      // Assistant transcript complete
      case "response.audio_transcript.done": {
        assistantDraftRef.current = "";
        currentResponseIdRef.current = null;
        setSpeaking(false);
        break;
      }

      // Audio delta — play immediately
      case "response.output_audio.delta": {
        if (msg.delta && playerRef.current) {
          playerRef.current.enqueue(base64Pcm16ToFloat32(msg.delta));
        }
        break;
      }

      // Audio done
      case "response.output_audio.done": {
        setSpeaking(false);
        break;
      }

      // User started speaking — interrupt any playing audio
      case "input_audio_buffer.speech_started": {
        playerRef.current?.clear();
        setSpeaking(false);
        break;
      }

      case "error": {
        console.error("xAI realtime error:", msg);
        toast({ title: "Saphie error", description: msg.error?.message ?? "Unknown error", variant: "destructive" });
        break;
      }
    }
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback((closeWs = true) => {
    if (closeWs && wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    cleanup(true);
    setConnState("idle");
    setSpeaking(false);
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    setMuted(m => !m);
  }, []);

  // Unlock audio on first interaction
  const handleFirstInteract = useCallback(() => {
    playerRef.current?.unlock();
  }, []);

  useEffect(() => {
    window.addEventListener("click", handleFirstInteract, { once: true });
    window.addEventListener("keydown", handleFirstInteract, { once: true });
    return () => {
      window.removeEventListener("click", handleFirstInteract);
      window.removeEventListener("keydown", handleFirstInteract);
      cleanup(true);
    };
  }, []);

  // ── UI ───────────────────────────────────────────────────────────────────
  const isConnected = connState === "connected";
  const isConnecting = connState === "connecting";

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div>
          <h1 className="text-sm font-semibold">Saphie</h1>
          <p className="text-xs text-muted-foreground">
            {connState === "idle"      && "Press Start to connect"}
            {connState === "connecting" && "Connecting…"}
            {connState === "connected"  && (speaking ? "Speaking…" : muted ? "Muted" : "Listening…")}
            {connState === "error"      && "Connection failed"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Clear chat */}
          {items.length > 0 && (
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setItems([])}
              data-testid="button-clear-chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          {/* Mute toggle — only when connected */}
          {isConnected && (
            <Button
              variant={muted ? "destructive" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={toggleMute}
              data-testid="button-mute-toggle"
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}

          {/* Connect / Disconnect */}
          <Button
            size="sm"
            onClick={isConnected ? disconnect : connect}
            disabled={isConnecting}
            className={cn(
              isConnected
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : "bg-[#b1306f] hover:bg-[#9a2860] text-white"
            )}
            data-testid="button-connect-saphie"
          >
            {isConnecting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Connecting…</>
            ) : isConnected ? (
              "End"
            ) : (
              <><Mic className="h-3.5 w-3.5 mr-1.5" />Start</>
            )}
          </Button>
        </div>
      </div>

      {/* Live indicator */}
      {isConnected && (
        <div className="flex items-center gap-2 px-6 py-2 bg-[#b1306f]/5 border-b text-xs text-[#b1306f] font-medium">
          <span className={cn(
            "inline-block h-2 w-2 rounded-full",
            speaking ? "bg-[#b1306f] animate-pulse" : muted ? "bg-muted-foreground" : "bg-emerald-500 animate-pulse"
          )} />
          {speaking ? "Saphie is speaking" : muted ? "Microphone muted" : "Microphone live — speak naturally"}
          {speaking && <Volume2 className="h-3.5 w-3.5 ml-1" />}
        </div>
      )}

      {/* Transcript */}
      <ScrollArea className="flex-1 px-6 py-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
            <div className="h-14 w-14 rounded-full bg-[#b1306f]/10 flex items-center justify-center mb-3">
              <Mic className="h-6 w-6 text-[#b1306f]" />
            </div>
            <p className="text-sm font-medium">Hi, I'm Saphie</p>
            <p className="text-xs mt-1 max-w-[220px]">
              Press Start and speak naturally — I'll respond instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {items.map(item => (
              <div
                key={item.id}
                className={cn(
                  "flex",
                  item.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm max-w-[80%] leading-relaxed",
                  item.role === "user"
                    ? "bg-[#b1306f] text-white rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {item.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
